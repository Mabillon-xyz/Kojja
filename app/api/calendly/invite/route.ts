import { NextRequest, NextResponse } from "next/server";
import { Composio } from "@composio/core";
import { triggerAutomations, buildEmailHtml } from "@/lib/automations";
import { logEmail } from "@/lib/email-log";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const ORGANIZER_EMAIL = "clement.guiraudpro@gmail.com";
const ORGANIZER_NAME = "Clément Guiraud";

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function formatDateFR(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
function formatTimeFR(date: Date) {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PERSONAL_CAL_ID = "clement.guiraudpro@gmail.com";
const USER_ID = "pg-test-de8a1257-28de-42e5-9d1d-edc298569d44";

let composioClient: Composio | null = null;
function getComposio() {
  if (!composioClient) composioClient = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
  return composioClient;
}

export async function POST(req: NextRequest) {
  if (!process.env.COMPOSIO_API_KEY)
    return NextResponse.json({ error: "COMPOSIO_API_KEY not configured" }, { status: 500 });

  const { name, email, date, time, phone, message } = await req.json();
  if (!name || !email || !date || !time)
    return NextResponse.json({ error: "name, email, date and time are required" }, { status: 400 });

  const startDT = new Date(`${date}T${time}:00`);
  if (isNaN(startDT.getTime()))
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  const endDT = new Date(startDT.getTime() + 30 * 60 * 1000);

  try {
    const result = await getComposio().tools.execute("GOOGLECALENDAR_CREATE_EVENT", {
      userId: USER_ID,
      version: "20260312_00",
      arguments: {
        summary: `Discovery Call — ${name}`,
        description: `30-minute discovery call with ${name} (${email}).`,
        start_datetime: startDT.toISOString(),
        end_datetime: endDT.toISOString(),
        timezone: "Europe/Paris",
        calendar_id: PERSONAL_CAL_ID,
        attendees: [email],
        create_meet_event: true,
      },
    });

    if (!result.successful)
      return NextResponse.json({ error: result.error ?? "Failed to create event" }, { status: 500 });

    const ev = result.data as {
      id?: string;
      htmlLink?: string;
      hangoutLink?: string;
      conferenceData?: { entryPoints?: { uri: string; entryPointType: string }[] };
    };

    const meetLink =
      ev?.hangoutLink ??
      ev?.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
      null;

    // Create CRM lead
    const nameParts = name.trim().split(' ');
    const first_name = nameParts[0] ?? name;
    const last_name = nameParts.slice(1).join(' ') || '';
    const { error: leadError } = await getSupabase().from('leads').insert({
      first_name,
      last_name,
      email: email.toLowerCase(),
      call_date: startDT.toISOString(),
      call_booked_at: new Date().toISOString(),
      stage: 'call_scheduled',
      notes: '',
      phone: phone ?? null,
      message: message ?? null,
    });
    if (leadError) console.error('Lead insert failed:', leadError.message);

    // Send guaranteed confirmation emails (always fires, regardless of automations)
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error("Email skipped: GMAIL_USER or GMAIL_APP_PASSWORD not set in env");
    } else {
      const from = `${ORGANIZER_NAME} <${process.env.GMAIL_USER}>`;
      const dateFR = formatDateFR(startDT);
      const timeFR = formatTimeFR(startDT);
      const ctx = { name, email, date, time: timeFR, meetLink, calLink: ev?.htmlLink ?? null, eventStartIso: startDT.toISOString() };
      const transporter = getTransporter();

      // Email to lead
      const leadBody = `Bonjour ${name},\n\nVotre discovery call de 30 minutes avec Clément Guiraud est confirmé.\n\n📅 ${dateFR} à ${timeFR} (heure de Paris)\n🎥 Rejoindre le Meet : ${meetLink ?? "(lien partagé avant le call)"}\n\nÀ très vite,\nClément`;
      // Email to organizer
      const orgBody = `Nouveau call réservé — ${name} (${email})\n\n📅 ${dateFR} à ${timeFR}\n📧 ${email}${meetLink ? `\n🎥 ${meetLink}` : ""}${ev?.htmlLink ? `\n📆 ${ev.htmlLink}` : ""}`;

      const leadSubject = `✓ Call confirmé — ${dateFR} à ${timeFR}`;
      const orgSubject = `📞 Nouveau call : ${name} — ${dateFR} à ${timeFR}`;
      void Promise.all([
        transporter.sendMail({ from, to: email, subject: leadSubject, html: buildEmailHtml(leadBody, ctx) })
          .then(() => logEmail({ to_email: email, subject: leadSubject, status: "success", source: "invite" }))
          .catch((e) => { console.error("Email to lead failed:", String(e)); return logEmail({ to_email: email, subject: leadSubject, status: "error", error: String(e), source: "invite" }); }),
        transporter.sendMail({ from, to: ORGANIZER_EMAIL, subject: orgSubject, html: buildEmailHtml(orgBody, ctx) })
          .then(() => logEmail({ to_email: ORGANIZER_EMAIL, subject: orgSubject, status: "success", source: "invite" }))
          .catch((e) => { console.error("Email to organizer failed:", String(e)); return logEmail({ to_email: ORGANIZER_EMAIL, subject: orgSubject, status: "error", error: String(e), source: "invite" }); }),
      ]);
    }

    // Fire automations in background for scheduled reminders (best effort)
    triggerAutomations({
      name,
      email,
      date,
      time,
      meetLink,
      calLink: ev?.htmlLink ?? null,
      eventStartIso: startDT.toISOString(),
    }).catch(() => { /* best effort */ });

    return NextResponse.json({
      eventId: ev?.id,
      calLink: ev?.htmlLink,
      meetLink,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { Composio } from "@composio/core";
import { buildEmailHtml, interpolate } from "@/lib/automations";
import { logEmail } from "@/lib/email-log";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { revalidatePath } from "next/cache";

const ORGANIZER_EMAIL = "clement.guiraudpro@gmail.com";
const ORGANIZER_NAME = "Clément Guiraud";
const PERSONAL_CAL_ID = "clement.guiraudpro@gmail.com";
const USER_ID = "pg-test-aa13515c-f26c-44f3-aa7a-9d87bab3072a";
const EDENRED_EMAIL = "clement.guiraud@edenred.com";

function buildBlockICS(startDT: Date, meetLink: string | null, uid: string): string {
  const endDT = new Date(startDT.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const desc = meetLink ? `Lien Meet : ${meetLink}` : "Créneau réservé";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Koja//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(startDT)}`,
    `DTEND:${fmt(endDT)}`,
    "SUMMARY:Bloqué",
    `DESCRIPTION:${desc}`,
    `ORGANIZER;CN=${ORGANIZER_NAME}:mailto:${ORGANIZER_EMAIL}`,
    `ATTENDEE;RSVP=FALSE:mailto:${EDENRED_EMAIL}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function getTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
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

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

  // Parse Paris DST offset
  const [y, mo, d] = date.split("-").map(Number);
  const lastSundayMarch = new Date(y, 2, 31);
  while (lastSundayMarch.getDay() !== 0) lastSundayMarch.setDate(lastSundayMarch.getDate() - 1);
  const lastSundayOctober = new Date(y, 9, 31);
  while (lastSundayOctober.getDay() !== 0) lastSundayOctober.setDate(lastSundayOctober.getDate() - 1);
  const day = new Date(y, mo - 1, d);
  const parisOffset = day >= lastSundayMarch && day < lastSundayOctober ? "+02:00" : "+01:00";
  const startDT = new Date(`${date}T${time}:00${parisOffset}`);
  if (isNaN(startDT.getTime()))
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });

  const [th, tm] = time.split(":").map(Number);
  const endMins = th * 60 + tm + 30;
  const endTimeLocal = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;

  try {
    // Create Google Calendar event
    const result = await getComposio().tools.execute("GOOGLECALENDAR_CREATE_EVENT", {
      userId: USER_ID,
      version: "20260312_00",
      arguments: {
        summary: `Follow-up Call — ${name}`,
        description: `30-minute follow-up call with ${name} (${email}).${message ? `\n\nNote: ${message}` : ""}`,
        start_datetime: `${date}T${time}:00`,
        end_datetime: `${date}T${endTimeLocal}:00`,
        timezone: "Europe/Paris",
        calendar_id: PERSONAL_CAL_ID,
        attendees: [email],
        create_meet_event: true,
      },
    });

    if (!result.successful)
      return NextResponse.json({ error: result.error ?? "Failed to create event" }, { status: 500 });

    const raw = result.data as Record<string, unknown>;
    const ev = (raw?.response_data ?? raw) as {
      id?: string;
      htmlLink?: string;
      hangoutLink?: string;
      conferenceData?: {
        conferenceId?: string;
        entryPoints?: { uri: string; entryPointType: string }[];
      };
    };

    const meetLink =
      ev?.hangoutLink ??
      ev?.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
      (ev?.conferenceData?.conferenceId ? `https://meet.google.com/${ev.conferenceData.conferenceId}` : null);

    // Update CRM lead notes if the lead exists (does NOT change stage or call_date)
    const normalizedEmail = email.toLowerCase();
    // Try email match first, then fallback to full name match
    let { data: lead } = await getSupabase()
      .from("leads")
      .select("id, notes, first_name, last_name, email")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (!lead) {
      const nameParts = name.trim().split(" ")
      const firstName = nameParts[0] ?? ""
      const lastName = nameParts.slice(1).join(" ")
      if (firstName && lastName) {
        const { data: nameMatch } = await getSupabase()
          .from("leads")
          .select("id, notes, first_name, last_name, email")
          .ilike("first_name", firstName)
          .ilike("last_name", lastName)
          .maybeSingle()
        if (nameMatch) {
          lead = nameMatch
          console.log(`[followup] Matched lead by name (${firstName} ${lastName}), CRM email: ${nameMatch.email}`)
        }
      }
    }

    if (lead) {
      const marker = `[FOLLOWUP|${startDT.toISOString()}|${meetLink ?? ""}]`;
      const updatedNotes = lead.notes ? `${lead.notes}\n${marker}` : marker;
      const { error: updateError } = await getSupabase()
        .from("leads")
        .update({
          notes: updatedNotes,
          ...(!lead.first_name ? { first_name: name.trim().split(" ")[0] } : {}),
          ...(!lead.last_name ? { last_name: name.trim().split(" ").slice(1).join(" ") || "" } : {}),
          ...(phone ? { phone } : {}),
        })
        .eq("id", lead.id);
      if (updateError) {
        console.error("Lead notes update failed:", updateError.message);
      } else {
        revalidatePath("/crm");
      }
    } else {
      console.warn(`[followup] No CRM lead found for email: ${normalizedEmail}`);
    }

    // If the CRM lead has a different email than the booking email, collect both
    const crmEmail = lead?.email ?? null
    const reminderEmails = crmEmail && crmEmail.toLowerCase() !== normalizedEmail
      ? [email, crmEmail]
      : [email]

    // Send confirmation emails
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      const from = `${ORGANIZER_NAME} <${process.env.GMAIL_USER}>`;
      const dateFR = formatDateFR(new Date(`${date}T12:00:00Z`));
      const ctx = { name, email, date, time, meetLink: meetLink ?? "", calLink: ev?.htmlLink ?? null, eventStartIso: startDT.toISOString() };
      const transporter = getTransporter();

      const meetLine = meetLink
        ? `Rejoindre Google Meet :\n${meetLink}`
        : "(Le lien Google Meet sera partagé avant le call)";

      const leadBody = `Bonjour ${name},\n\nVotre call de suivi de 30 minutes avec Clément Guiraud est confirmé.\n\n📅 ${dateFR} à ${time} (heure de Paris)\n\n${meetLine}\n\nÀ très vite,\nClément`;
      const orgBody = `Follow-up call réservé — ${name} (${email})\n\n📅 ${dateFR} à ${time}${phone ? `\n📱 ${phone}` : ""}${meetLink ? `\n🎥 ${meetLink}` : ""}${ev?.htmlLink ? `\n📆 ${ev.htmlLink}` : ""}`;

      const leadSubject = `✓ Follow-up confirmé — ${dateFR} à ${time}`;
      const orgSubject = `📞 Follow-up : ${name} — ${dateFR} à ${time}`;

      const icsContent = buildBlockICS(startDT, meetLink ?? null, `followup-${Date.now()}@koja`);

      await Promise.all([
        transporter.sendMail({ from, to: email, subject: leadSubject, html: buildEmailHtml(leadBody, ctx) })
          .then(() => logEmail({ to_email: email, subject: leadSubject, status: "success", source: "followup" }))
          .catch((e) => logEmail({ to_email: email, subject: leadSubject, status: "error", error: String(e), source: "followup" })),
        transporter.sendMail({ from, to: ORGANIZER_EMAIL, subject: orgSubject, html: buildEmailHtml(orgBody, ctx) })
          .then(() => logEmail({ to_email: ORGANIZER_EMAIL, subject: orgSubject, status: "success", source: "followup" }))
          .catch((e) => logEmail({ to_email: ORGANIZER_EMAIL, subject: orgSubject, status: "error", error: String(e), source: "followup" })),
        // Block Edenred calendar slot (title "Bloqué", Meet link in description)
        transporter.sendMail({
          from,
          to: EDENRED_EMAIL,
          subject: "Bloqué",
          html: "<p>Créneau bloqué.</p>",
          alternatives: [{ contentType: "text/calendar; charset=utf-8; method=REQUEST", content: Buffer.from(icsContent) }],
        }).catch((e) => console.error("Edenred ICS failed:", String(e))),
      ]);
    }

    // Schedule reminders: 24h + 1h before the call
    const now = new Date();
    const reminderCtx = { name, email, date, time, meetLink: meetLink ?? "", calLink: ev?.htmlLink ?? null, eventStartIso: startDT.toISOString() };
    const reminderSteps = [
      {
        offsetMs: 24 * 60 * 60 * 1000,
        subject: interpolate("Rappel : votre follow-up demain à {{time}}", reminderCtx),
        body: `Bonjour {{name}},\n\nRappel : votre call de suivi avec Clément est demain.\n\n📅 {{date}} à {{time}} (heure de Paris)\n\n{{meetLink}}\n\nÀ demain,\nClément`,
      },
      {
        offsetMs: 60 * 60 * 1000,
        subject: interpolate("Dans 1 heure : votre follow-up à {{time}}", reminderCtx),
        body: `Bonjour {{name}},\n\nVotre call de suivi commence dans 1 heure.\n\n📅 {{date}} à {{time}} (heure de Paris)\n\n{{meetLink}}\n\nÀ tout à l'heure,\nClément`,
      },
    ];

    for (const step of reminderSteps) {
      const sendAt = new Date(startDT.getTime() - step.offsetMs);
      if (sendAt <= now) continue;
      for (const toEmail of reminderEmails) {
        const { error: reminderError } = await getSupabase().from("scheduled_emails").insert({
          send_at: sendAt.toISOString(),
          to_email: toEmail,
          subject: step.subject,
          body_html: buildEmailHtml(step.body, reminderCtx),
          sent: false,
        });
        if (reminderError) console.error("[followup] reminder insert failed:", reminderError.message);
      }
    }

    return NextResponse.json({ eventId: ev?.id, calLink: ev?.htmlLink, meetLink });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

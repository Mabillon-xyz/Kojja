import { NextRequest, NextResponse } from "next/server";
import { Composio } from "@composio/core";
import { buildEmailHtml, interpolate } from "@/lib/automations";
import { logEmail } from "@/lib/email-log";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const ORGANIZER_EMAIL = "clement.guiraudpro@gmail.com";
const ORGANIZER_NAME = "Clément Guiraud";

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

  // Parse date+time as Europe/Paris local time (CET=+01:00, CEST=+02:00)
  // DST: starts last Sunday of March, ends last Sunday of October
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

  // Local Paris time strings for Composio (it treats datetime as local, not UTC)
  const [th, tm] = time.split(":").map(Number);
  const endMins = th * 60 + tm + 30;
  const endTimeLocal = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;

  try {
    const result = await getComposio().tools.execute("GOOGLECALENDAR_CREATE_EVENT", {
      userId: USER_ID,
      version: "20260312_00",
      arguments: {
        summary: `Discovery Call — ${name}`,
        description: `30-minute discovery call with ${name} (${email}).`,
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
    // Composio wraps the Google Calendar event under response_data
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
      (ev?.conferenceData?.conferenceId
        ? `https://meet.google.com/${ev.conferenceData.conferenceId}`
        : null);
    console.log("[invite] meetLink:", meetLink);

    // Upsert CRM lead by email
    const nameParts = name.trim().split(' ');
    const first_name = nameParts[0] ?? name;
    const last_name = nameParts.slice(1).join(' ') || '';
    const normalizedEmail = email.toLowerCase();

    const { data: existingLead } = await getSupabase()
      .from('leads')
      .select('id, notes, first_name, last_name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingLead) {
      const today = new Date().toISOString().split('T')[0];
      const appendNote = `[${today}] New call booked — ${startDT.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}`;
      const updatedNotes = existingLead.notes ? `${existingLead.notes}\n${appendNote}` : appendNote;
      const { error: updateError } = await getSupabase()
        .from('leads')
        .update({
          call_date: startDT.toISOString(),
          call_booked_at: new Date().toISOString(),
          stage: 'call_scheduled',
          notes: updatedNotes,
          // Only fill name if currently empty
          ...(!existingLead.first_name ? { first_name } : {}),
          ...(!existingLead.last_name ? { last_name } : {}),
          ...(phone ? { phone } : {}),
          ...(message ? { message } : {}),
        })
        .eq('id', existingLead.id);
      if (updateError) console.error('Lead update failed:', updateError.message);
    } else {
      const { error: insertError } = await getSupabase().from('leads').insert({
        first_name,
        last_name,
        email: normalizedEmail,
        call_date: startDT.toISOString(),
        call_booked_at: new Date().toISOString(),
        stage: 'call_scheduled',
        notes: '',
        phone: phone ?? null,
        message: message ?? null,
      });
      if (insertError) console.error('Lead insert failed:', insertError.message);
    }

    // Send guaranteed confirmation emails (always fires, regardless of automations)
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error("Email skipped: GMAIL_USER or GMAIL_APP_PASSWORD not set in env");
    } else {
      const from = `${ORGANIZER_NAME} <${process.env.GMAIL_USER}>`;
      const dateFR = formatDateFR(new Date(`${date}T12:00:00Z`));
      const timeFR = time; // already Paris local time "HH:MM"
      const ctx = { name, email, date, time: timeFR, meetLink, calLink: ev?.htmlLink ?? null, eventStartIso: startDT.toISOString() };
      const transporter = getTransporter();

      // Email to lead
      const meetLine = meetLink
        ? `Rejoindre Google Meet :\n${meetLink}`
        : "(Le lien Google Meet sera partagé avant le call)";
      const leadBody = `Bonjour ${name},\n\nVotre discovery call de 30 minutes avec Clément Guiraud est confirmé.\n\n📅 ${dateFR} à ${timeFR} (heure de Paris)\n\n${meetLine}\n\nÀ très vite,\nClément`;
      // Email to organizer
      const orgBody = `Nouveau call réservé — ${name} (${email})\n\n📅 ${dateFR} à ${timeFR}\n📧 ${email}${meetLink ? `\n🎥 ${meetLink}` : ""}${ev?.htmlLink ? `\n📆 ${ev.htmlLink}` : ""}`;

      const leadSubject = `✓ Call confirmé — ${dateFR} à ${timeFR}`;
      const orgSubject = `📞 Nouveau call : ${name} — ${dateFR} à ${timeFR}`;
      await Promise.all([
        transporter.sendMail({ from, to: email, subject: leadSubject, html: buildEmailHtml(leadBody, ctx) })
          .then(() => logEmail({ to_email: email, subject: leadSubject, status: "success", source: "invite" }))
          .catch((e) => { console.error("Email to lead failed:", String(e)); return logEmail({ to_email: email, subject: leadSubject, status: "error", error: String(e), source: "invite" }); }),
        transporter.sendMail({ from, to: ORGANIZER_EMAIL, subject: orgSubject, html: buildEmailHtml(orgBody, ctx) })
          .then(() => logEmail({ to_email: ORGANIZER_EMAIL, subject: orgSubject, status: "success", source: "invite" }))
          .catch((e) => { console.error("Email to organizer failed:", String(e)); return logEmail({ to_email: ORGANIZER_EMAIL, subject: orgSubject, status: "error", error: String(e), source: "invite" }); }),
      ]);
    }

    // Delete ALL scheduled_emails rows for this lead before inserting new reminders.
    // Handles re-bookings and clears accumulated test rows. History lives in email_logs.
    const { error: deleteError } = await getSupabase()
      .from("scheduled_emails")
      .delete()
      .eq("to_email", email);
    if (deleteError) console.error("[invite] delete old reminders failed:", deleteError.message);

    // Schedule reminders: 24h + 1h before (direct insert, no automations table dependency)
    const now = new Date();
    const reminderCtx = { name, email, date, time, meetLink, calLink: ev?.htmlLink ?? null, eventStartIso: startDT.toISOString() };
    const reminderSteps = [
      {
        offsetMs: 24 * 60 * 60 * 1000,
        subject: interpolate("Rappel : votre call demain à {{time}}", reminderCtx),
        body: `Bonjour {{name}},\n\nRappel : votre discovery call avec Clément est demain.\n\n📅 {{date}} à {{time}} (heure de Paris)\n\n{{meetLink}}\n\nÀ demain,\nClément`,
      },
      {
        offsetMs: 60 * 60 * 1000,
        subject: interpolate("Dans 1 heure : votre call à {{time}}", reminderCtx),
        body: `Bonjour {{name}},\n\nVotre discovery call commence dans 1 heure.\n\n📅 {{date}} à {{time}} (heure de Paris)\n\n{{meetLink}}\n\nÀ tout à l'heure,\nClément`,
      },
    ];
    for (const step of reminderSteps) {
      const sendAt = new Date(startDT.getTime() - step.offsetMs);
      if (sendAt <= now) continue;
      const { error: reminderError } = await getSupabase().from("scheduled_emails").insert({
        send_at: sendAt.toISOString(),
        to_email: email,
        subject: step.subject,
        body_html: buildEmailHtml(step.body, reminderCtx),
        sent: false,
      });
      if (reminderError) console.error("[invite] reminder insert failed:", reminderError.message);
      else console.log("[invite] scheduled reminder for", email, "at", sendAt.toISOString());
    }

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

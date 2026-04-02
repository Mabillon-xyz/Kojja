import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const ORGANIZER_EMAIL = "clement.guiraudpro@gmail.com";
const ORGANIZER_NAME = "Clément Guiraud";
const EDENRED_EMAIL = "clement.guiraud@edenred.com";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

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
    `SUMMARY:Bloqué`,
    `DESCRIPTION:${desc}`,
    `ORGANIZER;CN=${ORGANIZER_NAME}:mailto:${ORGANIZER_EMAIL}`,
    `ATTENDEE;RSVP=FALSE:mailto:${EDENRED_EMAIL}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function parseFollowUpCalls(notes: string | null): { date: string; meetLink: string }[] {
  if (!notes) return [];
  const results: { date: string; meetLink: string }[] = [];
  const re = /\[FOLLOWUP\|([^|]+)\|([^\]]*)\]/g;
  let m;
  while ((m = re.exec(notes)) !== null) results.push({ date: m[1], meetLink: m[2] });
  return results;
}

export async function POST() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ error: "GMAIL credentials not configured" }, { status: 500 });
  }

  const now = new Date();
  const supabase = getSupabase();
  const transporter = getTransporter();
  const from = `${ORGANIZER_NAME} <${process.env.GMAIL_USER}>`;

  // Fetch all leads — we check dates ourselves to catch both discovery + follow-up calls
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, first_name, last_name, email, call_date, notes");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sent: string[] = [];
  const failed: string[] = [];

  for (const lead of leads ?? []) {
    // Discovery call (upcoming only)
    if (lead.call_date && new Date(lead.call_date) > now) {
      const startDT = new Date(lead.call_date);
      const uid = `resend-discovery-${lead.id}@koja`;
      const ics = buildBlockICS(startDT, null, uid);
      try {
        await transporter.sendMail({
          from,
          to: EDENRED_EMAIL,
          subject: "Bloqué",
          html: "<p>Créneau bloqué.</p>",
          alternatives: [{ contentType: "text/calendar; charset=utf-8; method=REQUEST", content: Buffer.from(ics) }],
        });
        sent.push(`discovery:${lead.email}:${lead.call_date}`);
      } catch (e) {
        failed.push(`discovery:${lead.email}:${String(e)}`);
      }
    }

    // Follow-up calls from notes
    for (const fu of parseFollowUpCalls(lead.notes)) {
      const startDT = new Date(fu.date);
      if (startDT <= now) continue; // skip past follow-ups
      const uid = `resend-followup-${lead.id}-${startDT.getTime()}@koja`;
      const ics = buildBlockICS(startDT, fu.meetLink || null, uid);
      try {
        await transporter.sendMail({
          from,
          to: EDENRED_EMAIL,
          subject: "Bloqué",
          html: "<p>Créneau bloqué.</p>",
          alternatives: [{ contentType: "text/calendar; charset=utf-8; method=REQUEST", content: Buffer.from(ics) }],
        });
        sent.push(`followup:${lead.email}:${fu.date}`);
      } catch (e) {
        failed.push(`followup:${lead.email}:${String(e)}`);
      }
    }
  }

  return NextResponse.json({ sent, failed, total: sent.length });
}

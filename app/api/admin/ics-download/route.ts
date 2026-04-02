import { NextRequest, NextResponse } from "next/server";

const ORGANIZER_EMAIL = "clement.guiraudpro@gmail.com";
const ORGANIZER_NAME = "Clément Guiraud";
const EDENRED_EMAIL = "clement.guiraud@edenred.com";

// GET /api/admin/ics-download?date=2026-04-06&time=14:00&meet=https://meet.google.com/xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");   // YYYY-MM-DD
  const time = searchParams.get("time");   // HH:MM (Paris local time)
  const meet = searchParams.get("meet") ?? null;

  if (!date || !time) {
    return NextResponse.json({ error: "date and time are required. Example: ?date=2026-04-06&time=14:00" }, { status: 400 });
  }

  // Parse Paris DST
  const [y, mo, d] = date.split("-").map(Number);
  const lastSundayMarch = new Date(y, 2, 31);
  while (lastSundayMarch.getDay() !== 0) lastSundayMarch.setDate(lastSundayMarch.getDate() - 1);
  const lastSundayOctober = new Date(y, 9, 31);
  while (lastSundayOctober.getDay() !== 0) lastSundayOctober.setDate(lastSundayOctober.getDate() - 1);
  const day = new Date(y, mo - 1, d);
  const parisOffset = day >= lastSundayMarch && day < lastSundayOctober ? "+02:00" : "+01:00";

  const startDT = new Date(`${date}T${time}:00${parisOffset}`);
  if (isNaN(startDT.getTime())) {
    return NextResponse.json({ error: "Invalid date or time" }, { status: 400 });
  }
  const endDT = new Date(startDT.getTime() + 30 * 60 * 1000);

  const fmt = (dt: Date) => dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `manual-${startDT.getTime()}@koja`;
  const desc = meet ? `Lien Meet : ${meet}` : "Créneau réservé";

  const ics = [
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

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="bloque-${date}-${time.replace(":", "h")}.ics"`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { Composio } from "@composio/core";

const PERSONAL_CAL_ID = "clement.guiraudpro@gmail.com";
const USER_ID = "pg-test-de8a1257-28de-42e5-9d1d-edc298569d44";
const SLOT_DURATION = 30; // minutes

// Working hours in Paris time per day-of-week (0=Sun, 1=Mon ... 6=Sat)
const WORKING_HOURS: Record<number, { start: string; end: string }[]> = {
  1: [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
  2: [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
  3: [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
  4: [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
  5: [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
};

let composioClient: Composio | null = null;
function getComposio() {
  if (!composioClient) composioClient = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
  return composioClient;
}

function generateSlots(periods: { start: string; end: string }[]): string[] {
  const slots: string[] = [];
  for (const { start, end } of periods) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let mins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    while (mins + SLOT_DURATION <= endMins) {
      slots.push(`${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`);
      mins += SLOT_DURATION;
    }
  }
  return slots;
}

function toParisMinutes(isoStr: string): number {
  const d = new Date(isoStr);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  const h = parseInt(parts.find(p => p.type === "hour")?.value ?? "0");
  const m = parseInt(parts.find(p => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });

  // Day of week in Paris timezone (use noon to avoid DST edge cases)
  const d = new Date(`${date}T12:00:00Z`);
  const dow = parseInt(
    new Intl.DateTimeFormat("en", { timeZone: "Europe/Paris", weekday: "short" })
      .format(d)
      .slice(0, 2) // not needed, use a different approach
  );

  // Simpler DOW calculation
  const parisDay = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d) + "T12:00:00"
  ).getDay();

  const workingHours = WORKING_HOURS[parisDay];
  if (!workingHours) return NextResponse.json({ slots: [] }); // weekend or holiday

  // Reject past dates
  const todayParis = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  if (date < todayParis) return NextResponse.json({ slots: [] });

  const allSlots = generateSlots(workingHours);

  try {
    const result = await getComposio().tools.execute("GOOGLECALENDAR_EVENTS_LIST", {
      userId: USER_ID,
      version: "20260312_00",
      arguments: {
        calendarId: PERSONAL_CAL_ID,
        // Use full UTC day window — well covers any Paris-time working hours slot
        timeMin: `${date}T00:00:00Z`,
        timeMax: `${date}T23:59:59Z`,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 50,
      },
    });

    type CalEvent = {
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string };
      status?: string;
    };
    const events: CalEvent[] = result.successful
      ? ((result.data as { items?: CalEvent[] })?.items ?? [])
      : [];

    // Build busy ranges in Paris minutes
    const busyRanges = events
      .filter(e => e.status !== "cancelled" && e.start?.dateTime)
      .map(e => ({
        startMins: toParisMinutes(e.start!.dateTime!),
        endMins: toParisMinutes(e.end!.dateTime!),
      }));

    // Current Paris time in minutes (for same-day filtering)
    const nowParisMins = toParisMinutes(new Date().toISOString());

    const availableSlots = allSlots.filter(slot => {
      const [sh, sm] = slot.split(":").map(Number);
      const slotStart = sh * 60 + sm;
      const slotEnd = slotStart + SLOT_DURATION;

      // For today: require at least 60 min buffer
      if (date === todayParis && slotStart <= nowParisMins + 60) return false;

      // Filter slots that overlap with existing events
      return !busyRanges.some(({ startMins, endMins }) =>
        slotStart < endMins && slotEnd > startMins
      );
    });

    return NextResponse.json({ slots: availableSlots });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { Composio } from "@composio/core";

const PERSONAL_CAL_ID = "clement.guiraudpro@gmail.com";
const USER_ID = "default";

let composioClient: Composio | null = null;
function getComposio() {
  if (!composioClient) composioClient = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
  return composioClient;
}

export async function POST(req: NextRequest) {
  if (!process.env.COMPOSIO_API_KEY)
    return NextResponse.json({ error: "COMPOSIO_API_KEY not configured" }, { status: 500 });

  const { name, email, date, time } = await req.json();
  if (!name || !email || !date || !time)
    return NextResponse.json({ error: "name, email, date and time are required" }, { status: 400 });

  const startDT = new Date(`${date}T${time}:00`);
  if (isNaN(startDT.getTime()))
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });

  try {
    const result = await getComposio().tools.execute("GOOGLECALENDAR_CREATE_EVENT", {
      userId: USER_ID,
      dangerouslySkipVersionCheck: true,
      arguments: {
        summary: `Discovery Call — ${name}`,
        description: `30-minute discovery call with ${name} (${email}).`,
        start_datetime: startDT.toISOString(),
        timezone: "Europe/Paris",
        event_duration_hour: 0.5,
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

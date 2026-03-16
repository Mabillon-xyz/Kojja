import { NextRequest, NextResponse } from "next/server";
import { Composio } from "@composio/core";
import { triggerAutomations } from "@/lib/automations";
import { createClient } from "@supabase/supabase-js";

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

  const { name, email, date, time } = await req.json();
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

    // Create CRM lead (best effort — don't block response)
    const nameParts = name.trim().split(' ');
    const first_name = nameParts[0] ?? name;
    const last_name = nameParts.slice(1).join(' ') || '';
    void getSupabase().from('leads').insert({
      first_name,
      last_name,
      email: email.toLowerCase(),
      call_date: startDT.toISOString(),
      stage: 'call_scheduled',
    });

    // Fire automations in background (don't await — don't block response)
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

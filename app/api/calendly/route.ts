import { NextRequest, NextResponse } from "next/server";
import { Composio } from "@composio/core";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PERSONAL_CAL_ID = "clement.guiraudpro@gmail.com";
const USER_ID = "pg-test-aa13515c-f26c-44f3-aa7a-9d87bab3072a";

let composioClient: Composio | null = null;
function getComposio() {
  if (!composioClient) composioClient = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
  return composioClient;
}

export async function DELETE(req: NextRequest) {
  if (!process.env.COMPOSIO_API_KEY)
    return NextResponse.json({ error: "COMPOSIO_API_KEY not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");
  const attendeeEmail = searchParams.get("attendeeEmail");
  if (!eventId)
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  try {
    const result = await getComposio().tools.execute("GOOGLECALENDAR_DELETE_EVENT", {
      userId: USER_ID,
      version: "20260312_00",
      arguments: {
        calendarId: PERSONAL_CAL_ID,
        eventId,
      },
    });

    if (!result.successful)
      return NextResponse.json({ error: result.error ?? "Failed to delete event" }, { status: 500 });

    // Clear call_date on the matching lead so it disappears from the chart
    if (attendeeEmail) {
      await getSupabase()
        .from("leads")
        .update({ call_date: null })
        .eq("email", attendeeEmail.toLowerCase())
        .eq("stage", "call_scheduled");
      revalidatePath("/dashboard");
      revalidatePath("/crm");
    }

    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!process.env.COMPOSIO_API_KEY)
    return NextResponse.json({ error: "COMPOSIO_API_KEY not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const timeMin = searchParams.get("start") ?? new Date().toISOString();
  const timeMax = searchParams.get("end") ?? new Date(Date.now() + 7 * 86400000).toISOString();

  try {
    const result = await getComposio().tools.execute("GOOGLECALENDAR_EVENTS_LIST", {
      userId: USER_ID,
      version: "20260312_00",
      arguments: {
        calendarId: PERSONAL_CAL_ID,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
      },
    });

    if (!result.successful) {
      console.error("[calendly] Composio error:", JSON.stringify(result, null, 2));
      return NextResponse.json({ error: result.error ?? "Failed to list events", detail: result }, { status: 500 });
    }

    const items = (result.data as { items?: unknown[] })?.items ?? [];
    return NextResponse.json({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

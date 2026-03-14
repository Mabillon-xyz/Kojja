import { NextRequest, NextResponse } from "next/server";
import { Composio } from "@composio/core";

const PERSONAL_CAL_ID = "clement.guiraudpro@gmail.com";
const USER_ID = "default";

let composioClient: Composio | null = null;
function getComposio() {
  if (!composioClient) composioClient = new Composio({ apiKey: process.env.COMPOSIO_API_KEY!, toolkitVersions: { googlecalendar: "latest" } });
  return composioClient;
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
      arguments: {
        calendarId: PERSONAL_CAL_ID,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
      },
    });

    if (!result.successful)
      return NextResponse.json({ error: result.error ?? "Failed to list events" }, { status: 500 });

    const items = (result.data as { items?: unknown[] })?.items ?? [];
    return NextResponse.json({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

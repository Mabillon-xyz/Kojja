import { NextResponse } from "next/server";
import { Composio } from "@composio/core";

const USER_ID = "ca_qYgwaF-k0wOh";
const EDENRED_CAL_ID = "clement.guiraud@edenred.com";

let composioClient: Composio | null = null;
function getComposio(): Composio {
  if (!composioClient) {
    composioClient = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
  }
  return composioClient;
}

export async function GET() {
  if (!process.env.COMPOSIO_API_KEY) {
    return NextResponse.json({ error: "COMPOSIO_API_KEY not configured" }, { status: 500 });
  }

  const now = new Date();
  const threeWeeks = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

  try {
    const result = await getComposio().tools.execute("GOOGLECALENDAR_EVENTS_LIST", {
      userId: USER_ID,
      version: "20260312_00",
      arguments: {
        calendarId: EDENRED_CAL_ID,
        timeMin: now.toISOString(),
        timeMax: threeWeeks.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 500,
      },
    });

    return NextResponse.json({
      successful: result.successful,
      error: result.error,
      raw: result.data,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

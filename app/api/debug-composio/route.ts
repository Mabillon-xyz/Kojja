import { NextResponse } from "next/server";

const COMPOSIO_API = "https://backend.composio.dev/api/v2";
const CONNECTED_ACCOUNT_ID = "ca_mID0TMZ8tteR";

export async function GET() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const res = await fetch(`${COMPOSIO_API}/actions/GOOGLECALENDAR_EVENTS_LIST/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        connectedAccountId: CONNECTED_ACCOUNT_ID,
        input: {
          calendarId: "clement.guiraudpro@gmail.com",
          timeMin: new Date().toISOString(),
          timeMax: new Date(Date.now() + 7 * 86400000).toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 5,
        },
        version: "20260312_00",
      }),
    });

    const raw = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }

    return NextResponse.json({ status: res.status, body: parsed });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) });
  }
}

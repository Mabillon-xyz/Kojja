import { NextResponse } from "next/server";

const COMPOSIO_API = "https://backend.composio.dev";

async function testExecute(label: string, apiKey: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`${COMPOSIO_API}/api/v3/tools/execute/GOOGLECALENDAR_EVENTS_LIST`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    return { label, status: res.status, body: parsed };
  } catch (err: unknown) {
    return { label, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const args = {
    calendarId: "clement.guiraudpro@gmail.com",
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 7 * 86400000).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 3,
  };

  const [r1, r2, r3] = await Promise.all([
    testExecute("nanoid", apiKey, { connected_account_id: "ca_mID0TMZ8tteR", arguments: args, version: "20260312_00" }),
    testExecute("uuid", apiKey, { connected_account_id: "f88faf67-55a6-42d2-94c7-888907ac5226", arguments: args, version: "20260312_00" }),
    testExecute("userId", apiKey, { user_id: "pg-test-de8a1257-28de-42e5-9d1d-edc298569d44", arguments: args, version: "20260312_00" }),
  ]);

  return NextResponse.json({ r1, r2, r3 });
}

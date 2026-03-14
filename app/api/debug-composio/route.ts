import { NextResponse } from "next/server";

const COMPOSIO_API = "https://backend.composio.dev";
const USER_ID = "pg-test-de8a1257-28de-42e5-9d1d-edc298569d44";

export async function GET() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const res = await fetch(`${COMPOSIO_API}/api/v3/tools/execute/GOOGLECALENDAR_LIST_CALENDARS`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        user_id: USER_ID,
        arguments: {},
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

import { NextResponse } from "next/server";
import { Composio } from "@composio/core";

const USER_ID = "ca_qYgwaF-k0wOh";

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

  try {
    const result = await getComposio().tools.execute("GOOGLECALENDAR_LIST_CALENDARS", {
      userId: USER_ID,
      version: "20260312_00",
      arguments: {},
    });

    const raw = result.data as Record<string, unknown>;
    const unwrapped = (raw?.response_data ?? raw) as { items?: { id: string; summary: string; accessRole: string }[] };

    return NextResponse.json({
      successful: result.successful,
      error: result.error,
      calendars: unwrapped?.items ?? [],
      raw: result.data,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

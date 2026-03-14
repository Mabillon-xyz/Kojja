import { NextResponse } from "next/server";
import { Composio } from "@composio/core";

export async function GET() {
  if (!process.env.COMPOSIO_API_KEY)
    return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

    // Check connected accounts for googlecalendar
    const accounts = await (composio as unknown as {
      client: { connectedAccounts: { list: (p: object) => Promise<{ items: unknown[] }> } }
    }).client.connectedAccounts.list({ toolkit_slug: "googlecalendar" });

    return NextResponse.json({ connectedAccounts: accounts.items });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) });
  }
}

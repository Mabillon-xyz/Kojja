import { NextResponse } from "next/server";
import { Composio } from "@composio/core";

export async function GET() {
  if (!process.env.COMPOSIO_API_KEY)
    return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
    const tool = await composio.tools.getRawComposioToolBySlug("GOOGLECALENDAR_EVENTS_LIST");
    return NextResponse.json({
      slug: tool.slug,
      toolkit: tool.toolkit,
      version: (tool as Record<string, unknown>).version,
      rawTool: tool,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) });
  }
}

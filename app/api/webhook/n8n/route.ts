import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Verify secret
  const secret = req.headers.get("x-webhook-secret");
  const expected = process.env.N8N_WEBHOOK_SECRET;
  console.log("[webhook] secret_received:", secret?.slice(0, 5), "| expected:", expected?.slice(0, 5), "| match:", secret === expected);
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized", debug: { received: secret?.slice(0,5)+"…", expected: expected?.slice(0,5)+"…", match: secret === expected } }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const source = (body.source as string) ?? "n8n";
  const workflow = (body.workflow as string) ?? null;
  const leads = Array.isArray(body.leads) ? body.leads : [];

  const { error } = await supabase.from("webhook_events").insert({
    source,
    workflow,
    leads_count: leads.length,
    payload: body,
  });

  if (error) {
    console.error("[webhook/n8n] insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, leads_count: leads.length });
}

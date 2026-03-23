import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Verify secret
  const secret = req.headers.get("x-webhook-secret");
  if (!process.env.N8N_WEBHOOK_SECRET || secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Persist leads_yet_to_contact KPI if present (skip flow run logging for these)
  if (typeof body.leads_yet_to_contact === "number") {
    const clientKey = ((body.client as string) ?? "unknown")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");
    await supabase.from("settings").upsert(
      {
        key: `leads_yet_to_contact_${clientKey}`,
        value: { count: body.leads_yet_to_contact, updated_at: new Date().toISOString() },
      },
      { onConflict: "key" }
    );
    return NextResponse.json({ ok: true });
  }

  // Log the flow run event
  await supabase.from("webhook_events").insert({
    source,
    workflow,
    leads_count: leads.length,
    payload: body,
  });

  // Upsert leads by email
  const today = new Date().toISOString().split("T")[0];
  const interactionNote = `[${today}] Contacted via ${source}${workflow ? ` — ${workflow}` : ""}`;

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const lead of leads) {
    const raw = lead as Record<string, unknown>;
    const email = (raw.email as string | undefined)?.toLowerCase().trim();

    if (!email) {
      skipped++;
      continue;
    }

    // Check if lead already exists
    const { data: existing } = await supabase
      .from("leads")
      .select("id, notes, linkedin_url")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      // Append to notes, update linkedin_url if not yet set
      const updatedNotes = existing.notes
        ? `${existing.notes}\n${interactionNote}`
        : interactionNote;

      await supabase
        .from("leads")
        .update({
          notes: updatedNotes,
          ...(!existing.linkedin_url && raw.linkedinUrl
            ? { linkedin_url: raw.linkedinUrl as string }
            : {}),
        })
        .eq("id", existing.id);

      updated++;
    } else {
      // Create new lead
      await supabase.from("leads").insert({
        first_name: (raw.firstName as string) ?? "",
        last_name: (raw.lastName as string) ?? "",
        email,
        company_name: (raw.companyName as string) ?? null,
        linkedin_url: (raw.linkedinUrl as string) ?? null,
        stage: "call_scheduled",
        notes: interactionNote,
        call_booked_at: new Date().toISOString(),
      });

      created++;
    }
  }

  return NextResponse.json({ ok: true, created, updated, skipped });
}

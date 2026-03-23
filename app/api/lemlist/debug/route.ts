import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CAMPAIGN_ID = process.env.LEMLIST_CAMPAIGN_ID ?? "cam_JC7mjRSoLg4MACxR6";

export async function GET() {
  if (!process.env.LEMLIST_API_KEY) {
    return NextResponse.json({ error: "LEMLIST_API_KEY not configured" }, { status: 500 });
  }

  const basicAuth = Buffer.from(`anystring:${process.env.LEMLIST_API_KEY}`).toString("base64");
  const lemlistRes = await fetch(
    `https://api.lemlist.com/api/campaigns/${CAMPAIGN_ID}/export/leads`,
    { cache: "no-store", headers: { Accept: "application/json", Authorization: `Basic ${basicAuth}` } }
  );

  const bodyText = await lemlistRes.text();

  // Parse first 5 lines of CSV
  const lines = bodyText.trim().split(/\r?\n/);
  const headers = lines[0] ?? "";
  const sampleRows = lines.slice(1, 6);

  // Get CRM emails
  const supabase = await createClient();
  const { data: crmLeads } = await supabase.from("leads").select("email, first_name, last_name");

  return NextResponse.json({
    lemlist: {
      status: lemlistRes.status,
      contentType: lemlistRes.headers.get("content-type"),
      rawHeaders: headers,
      parsedHeaders: headers.split(",").map((h) => h.trim().replace(/^"|"$/g, "")),
      sampleRows,
      totalLines: lines.length - 1,
    },
    crm: {
      total: crmLeads?.length ?? 0,
      emails: crmLeads?.map((l) => ({ email: l.email, name: `${l.first_name} ${l.last_name}` })) ?? [],
    },
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CAMPAIGN_ID = process.env.LEMLIST_CAMPAIGN_ID ?? "cam_JC7mjRSoLg4MACxR6";

export async function GET() {
  if (!process.env.LEMLIST_API_KEY) {
    return NextResponse.json({ error: "LEMLIST_API_KEY not configured" }, { status: 500 });
  }

  const basicAuth = Buffer.from(`:${process.env.LEMLIST_API_KEY}`).toString("base64");

  // Try the leads endpoint (JSON)
  const leadsRes = await fetch(
    `https://api.lemlist.com/api/campaigns/${CAMPAIGN_ID}/leads?limit=5`,
    { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } }
  );
  const leadsText = await leadsRes.text();

  // Get CRM emails
  const supabase = await createClient();
  const { data: crmLeads } = await supabase.from("leads").select("email, first_name, last_name");

  return NextResponse.json({
    leads_endpoint: {
      status: leadsRes.status,
      contentType: leadsRes.headers.get("content-type"),
      body: leadsText.slice(0, 500),
    },
    crm: {
      total: crmLeads?.length ?? 0,
      emails: crmLeads?.map((l) => ({ email: l.email, name: `${l.first_name} ${l.last_name}` })) ?? [],
    },
  });
}

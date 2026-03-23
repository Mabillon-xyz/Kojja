import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CAMPAIGN_ID = process.env.LEMLIST_CAMPAIGN_ID ?? "cam_JC7mjRSoLg4MACxR6";

export type LemlistLead = {
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  linkedinUrl?: string;
};

export type EnrichedLead = LemlistLead & {
  inCrm: boolean;
  crmStage: string | null;
};

export type ConversionData = {
  leads: EnrichedLead[];
  total: number;
  inCrm: number;
  customers: number;
  conversionRate: string;
};

export async function GET() {
  if (!process.env.LEMLIST_API_KEY) {
    return NextResponse.json({ error: "LEMLIST_API_KEY not configured" }, { status: 500 });
  }

  // 1. Fetch leads from Lemlist campaign export
  // v1 API uses HTTP Basic Auth: any username, API key as password
  const basicAuth = Buffer.from(`anystring:${process.env.LEMLIST_API_KEY}`).toString("base64");
  const lemlistRes = await fetch(
    `https://api.lemlist.com/api/campaigns/${CAMPAIGN_ID}/export/leads`,
    {
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Basic ${basicAuth}` },
    }
  );

  const bodyText = await lemlistRes.text();
  console.log("[lemlist/conversion] status:", lemlistRes.status, "body[:100]:", bodyText.slice(0, 100));

  if (!lemlistRes.ok) {
    return NextResponse.json(
      { error: `Lemlist API error ${lemlistRes.status}`, detail: bodyText.slice(0, 300) },
      { status: lemlistRes.status }
    );
  }

  // Parse safely — endpoint may return empty body or non-JSON (e.g. CSV)
  let raw: unknown = [];
  if (bodyText.trim()) {
    try {
      raw = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { error: "Lemlist returned non-JSON response", detail: bodyText.slice(0, 300) },
        { status: 502 }
      );
    }
  }

  // The endpoint may return an array or { leads: [...] }
  const lemlistLeads: LemlistLead[] = Array.isArray(raw)
    ? (raw as LemlistLead[])
    : ((raw as { leads?: LemlistLead[] }).leads ?? []);

  // 2. Fetch CRM leads (email, linkedin_url, stage only)
  const supabase = await createClient();
  const { data: crmLeads, error } = await supabase
    .from("leads")
    .select("email, linkedin_url, stage");

  if (error) {
    return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
  }

  // 3. Build lookup maps
  const byEmail = new Map<string, string>();
  const byLinkedin = new Map<string, string>();

  for (const lead of crmLeads ?? []) {
    if (lead.email) byEmail.set(lead.email.toLowerCase().trim(), lead.stage);
    if (lead.linkedin_url) byLinkedin.set(lead.linkedin_url.toLowerCase().trim(), lead.stage);
  }

  // 4. Enrich each Lemlist lead
  const enriched: EnrichedLead[] = lemlistLeads.map((ll) => {
    const stage =
      (ll.email ? byEmail.get(ll.email.toLowerCase().trim()) : undefined) ??
      (ll.linkedinUrl ? byLinkedin.get(ll.linkedinUrl.toLowerCase().trim()) : undefined) ??
      null;

    return { ...ll, inCrm: stage !== null, crmStage: stage };
  });

  const total = enriched.length;
  const inCrm = enriched.filter((l) => l.inCrm).length;
  const customers = enriched.filter((l) => l.crmStage === "customer").length;

  return NextResponse.json({
    leads: enriched,
    total,
    inCrm,
    customers,
    conversionRate: total > 0 ? Math.round((customers / total) * 100) + "%" : "0%",
  } satisfies ConversionData);
}

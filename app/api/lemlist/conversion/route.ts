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

/** Fetch all leads from a Lemlist campaign, handling pagination. */
async function fetchAllLemlistLeads(campaignId: string, apiKey: string): Promise<LemlistLead[]> {
  const basicAuth = Buffer.from(`anystring:${apiKey}`).toString("base64");
  const all: LemlistLead[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `https://api.lemlist.com/api/campaigns/${campaignId}/leads?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Basic ${basicAuth}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Lemlist API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const text = await res.text();
    if (!text.trim()) break;

    let page: unknown;
    try {
      page = JSON.parse(text);
    } catch {
      throw new Error(`Lemlist returned non-JSON: ${text.slice(0, 100)}`);
    }

    // Response may be an array or { leads: [...] }
    const rows: LemlistLead[] = Array.isArray(page) ? page : ((page as { leads?: LemlistLead[] }).leads ?? []);
    if (rows.length === 0) break;

    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }

  return all;
}

export async function GET() {
  if (!process.env.LEMLIST_API_KEY) {
    return NextResponse.json({ error: "LEMLIST_API_KEY not configured" }, { status: 500 });
  }

  // 1. Fetch all leads from Lemlist campaign
  let lemlistLeads: LemlistLead[];
  try {
    lemlistLeads = await fetchAllLemlistLeads(CAMPAIGN_ID, process.env.LEMLIST_API_KEY);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch Lemlist leads" },
      { status: 502 }
    );
  }

  // 2. Fetch CRM leads (email, linkedin_url, stage only)
  const supabase = await createClient();
  const { data: crmLeads, error } = await supabase
    .from("leads")
    .select("email, linkedin_url, stage");

  if (error) {
    return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
  }

  // 3. Build lookup maps (case-insensitive)
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

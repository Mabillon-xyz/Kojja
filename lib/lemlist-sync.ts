import { createClient } from "@supabase/supabase-js";
import type { ConversionData, EnrichedLead, LemlistLead } from "@/app/api/lemlist/conversion/route";

const CAMPAIGN_ID = process.env.LEMLIST_CAMPAIGN_ID ?? "cam_JC7mjRSoLg4MACxR6";
const CACHE_KEY = "lemlist_conversion";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );
}

async function fetchAllLemlistLeads(): Promise<LemlistLead[]> {
  const apiKey = process.env.LEMLIST_API_KEY!;
  const basicAuth = Buffer.from(`anystring:${apiKey}`).toString("base64");
  const all: LemlistLead[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `https://api.lemlist.com/api/campaigns/${CAMPAIGN_ID}/leads?limit=${limit}&offset=${offset}`;
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

    const page: unknown = JSON.parse(text);
    const rows: LemlistLead[] = Array.isArray(page) ? page : ((page as { leads?: LemlistLead[] }).leads ?? []);
    if (rows.length === 0) break;

    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }

  return all;
}

export async function syncLemlistConversion(): Promise<ConversionData & { updatedAt: string }> {
  const supabase = getServiceClient();

  // Fetch Lemlist leads + CRM leads in parallel
  const [lemlistLeads, { data: crmLeads, error }] = await Promise.all([
    fetchAllLemlistLeads(),
    supabase.from("leads").select("email, linkedin_url, stage"),
  ]);

  if (error) throw new Error(`Supabase error: ${error.message}`);

  // Build lookup maps
  const byEmail = new Map<string, string>();
  const byLinkedin = new Map<string, string>();
  for (const lead of crmLeads ?? []) {
    if (lead.email) byEmail.set(lead.email.toLowerCase().trim(), lead.stage);
    if (lead.linkedin_url) byLinkedin.set(lead.linkedin_url.toLowerCase().trim(), lead.stage);
  }

  // Enrich
  const enriched: EnrichedLead[] = lemlistLeads.map((ll) => {
    const stage =
      (ll.email ? byEmail.get(ll.email.toLowerCase().trim()) : undefined) ??
      (ll.linkedinUrl ? byLinkedin.get((ll.linkedinUrl as string).toLowerCase().trim()) : undefined) ??
      null;
    return { ...ll, inCrm: stage !== null, crmStage: stage };
  });

  const total = enriched.length;
  const inCrm = enriched.filter((l) => l.inCrm).length;
  const customers = enriched.filter((l) => l.crmStage === "customer").length;
  const updatedAt = new Date().toISOString();

  const stageBreakdown = {
    call_scheduled: enriched.filter((l) => l.crmStage === "call_scheduled").length,
    call_done: enriched.filter((l) => l.crmStage === "call_done").length,
    proposal_sent: enriched.filter((l) => l.crmStage === "proposal_sent").length,
    customer: customers,
    not_interested: enriched.filter((l) => l.crmStage === "not_interested").length,
  };

  const payload: ConversionData & { updatedAt: string } = {
    leads: enriched,
    total,
    inCrm,
    customers,
    conversionRate: total > 0 ? Math.round((inCrm / total) * 100) + "%" : "0%",
    updatedAt,
  };

  // Write snapshot + update cache in parallel
  await Promise.all([
    supabase.from("campaign_snapshots").insert({
      snapshotted_at: updatedAt,
      campaign_id: CAMPAIGN_ID,
      total_leads: total,
      booked_leads: inCrm,
      conversion_rate: total > 0 ? Math.round((inCrm / total) * 100 * 100) / 100 : 0,
      stage_breakdown: stageBreakdown,
    }),
    supabase.from("app_cache").upsert({ key: CACHE_KEY, value: payload, updated_at: updatedAt }),
  ]);

  return payload;
}

export async function getCachedConversion(): Promise<(ConversionData & { updatedAt: string }) | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("app_cache")
    .select("value")
    .eq("key", CACHE_KEY)
    .maybeSingle();
  return data?.value ?? null;
}

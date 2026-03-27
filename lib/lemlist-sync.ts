import { createClient } from "@supabase/supabase-js";
import type { ConversionData, EnrichedLead, LemlistLead } from "@/app/api/lemlist/conversion/route";
import { getAccount, ALL_ACCOUNT_IDS, type AccountId } from "@/lib/lemlist-accounts";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );
}

async function fetchCoachLeadCount(apiKey: string, campaignId: string): Promise<number> {
  if (!campaignId) return 0;
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");
  const startDate = "2020-01-01T00:00:00.000Z";
  const endDate = new Date().toISOString();
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(
    `https://api.lemlist.com/api/v2/campaigns/${campaignId}/stats?${params}`,
    { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } }
  );
  if (!res.ok) return 0;
  const data = await res.json() as { nbLeads?: number; nbLeadsLaunched?: number };
  return data.nbLeadsLaunched ?? data.nbLeads ?? 0;
}

async function fetchAllLemlistLeads(apiKey: string, campaignId: string): Promise<LemlistLead[]> {
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");

  // Step 1: fetch all lead stubs — campaign leads API returns {_id, state, contactId} only
  const stubs: { contactId?: string }[] = [];
  let offset = 0;
  const limit = 100;
  const MAX_PAGES = 20; // 2000 leads max

  for (let p = 0; p < MAX_PAGES; p++) {
    const url = `https://api.lemlist.com/api/campaigns/${campaignId}/leads?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Lemlist API error ${res.status}: ${text.slice(0, 200)}`);
    }
    const text = await res.text();
    if (!text.trim()) break;
    const page: unknown = JSON.parse(text);
    const rows = Array.isArray(page) ? page : ((page as { leads?: unknown[] }).leads ?? []);
    if (rows.length === 0) break;
    stubs.push(...rows as { contactId?: string }[]);
    if (rows.length < limit) break;
    offset += limit;
  }

  if (stubs.length === 0) return [];

  // Step 2: batch-enrich via /api/contacts?idsOrEmails=... to get email, name, linkedin
  const BATCH = 100;
  const leads: LemlistLead[] = [];

  for (let i = 0; i < stubs.length; i += BATCH) {
    const ids = stubs.slice(i, i + BATCH)
      .map((s) => s.contactId)
      .filter((id): id is string => Boolean(id))
      .join(",");
    if (!ids) continue;

    const res = await fetch(
      `https://api.lemlist.com/api/contacts?idsOrEmails=${ids}`,
      { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } }
    );
    if (!res.ok) continue;

    const contacts: unknown = await res.json();
    if (!Array.isArray(contacts)) continue;

    for (const c of contacts) {
      const contact = c as {
        email?: string;
        fields?: { firstName?: string; lastName?: string; linkedInUrl?: string; companyName?: string };
      };
      leads.push({
        email: contact.email,
        firstName: contact.fields?.firstName,
        lastName: contact.fields?.lastName,
        linkedinUrl: contact.fields?.linkedInUrl,
        companyName: contact.fields?.companyName,
      });
    }
  }

  return leads;
}

export async function syncLemlistConversion(accountId: AccountId): Promise<ConversionData & { updatedAt: string }> {
  const account = getAccount(accountId);
  if (!account) throw new Error(`Unknown Lemlist account: ${accountId}`);

  const apiKey = account.apiKey();
  const campaignId = account.campaignId();
  if (!apiKey) throw new Error(`API key not configured for account: ${accountId}`);

  const supabase = getServiceClient();

  const coachCampaignId = account.coachCampaignId();

  // Fetch Lemlist leads + CRM leads + Coach campaign count in parallel
  const [lemlistLeads, { data: crmLeads, error }, coachTotal] = await Promise.all([
    fetchAllLemlistLeads(apiKey, campaignId),
    supabase.from("leads").select("email, linkedin_url, stage"),
    fetchCoachLeadCount(apiKey, coachCampaignId),
  ]);

  if (error) throw new Error(`Supabase error: ${error.message}`);

  // --- Accurate CRM matching: look up CRM emails directly in Lemlist contacts API ---
  // (The paginated leads API returns historical duplicates beyond offset 2000, so
  //  CRM leads may not appear in the stubs. Querying by email is the reliable approach.)
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");
  const crmEmails = (crmLeads ?? []).map((l) => l.email).filter(Boolean) as string[];
  const crmEmailsInLemlist = new Set<string>();
  if (crmEmails.length > 0) {
    const res = await fetch(
      `https://api.lemlist.com/api/contacts?idsOrEmails=${crmEmails.join(",")}`,
      { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } }
    );
    if (res.ok) {
      const raw: unknown = await res.json();
      // Lemlist may return a raw array or a wrapped object like { leads: [...] }
      let contacts: unknown[] = [];
      if (Array.isArray(raw)) {
        contacts = raw;
      } else if (raw && typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        contacts = Array.isArray(obj.leads) ? obj.leads : Array.isArray(obj.contacts) ? obj.contacts : [];
      }
      for (const c of contacts) {
        const email = (c as { email?: string }).email?.toLowerCase().trim();
        if (email) crmEmailsInLemlist.add(email);
      }
    }
  }

  // CRM leads that exist in Lemlist
  const crmLeadsInLemlist = (crmLeads ?? []).filter(
    (l) => l.email && crmEmailsInLemlist.has(l.email.toLowerCase().trim())
  );
  const inCrm = crmLeadsInLemlist.length;
  const customers = crmLeadsInLemlist.filter((l) => l.stage === "customer").length;
  // All CRM leads represent people who booked a call (email matching is imperfect
  // — some have different emails in Lemlist vs CRM — so use total CRM lead count)
  const booked = (crmLeads ?? []).length;

  // --- Enrich Lemlist leads for the table display (best-effort via stubs) ---
  const byEmail = new Map<string, string>();
  const byLinkedin = new Map<string, string>();
  for (const lead of crmLeads ?? []) {
    if (lead.email) byEmail.set(lead.email.toLowerCase().trim(), lead.stage);
    if (lead.linkedin_url) byLinkedin.set(lead.linkedin_url.toLowerCase().trim(), lead.stage);
  }
  const enriched: EnrichedLead[] = lemlistLeads.map((ll) => {
    const stage =
      (ll.email ? byEmail.get(ll.email.toLowerCase().trim()) : undefined) ??
      (ll.linkedinUrl ? byLinkedin.get((ll.linkedinUrl as string).toLowerCase().trim()) : undefined) ??
      null;
    return { ...ll, inCrm: stage !== null, crmStage: stage };
  });
  // Also add any CRM leads that didn't appear in stubs
  for (const crm of crmLeadsInLemlist) {
    const alreadyInTable = enriched.some(
      (l) => l.email?.toLowerCase() === crm.email?.toLowerCase()
    );
    if (!alreadyInTable) {
      enriched.push({
        email: crm.email ?? undefined,
        firstName: undefined,
        lastName: undefined,
        linkedinUrl: crm.linkedin_url ?? undefined,
        companyName: undefined,
        inCrm: true,
        crmStage: crm.stage,
      });
    }
  }

  const total = coachTotal > 0 ? coachTotal : enriched.length;
  const updatedAt = new Date().toISOString();

  const stageBreakdown = {
    call_scheduled: crmLeadsInLemlist.filter((l) => l.stage === "call_scheduled").length,
    call_done: crmLeadsInLemlist.filter((l) => l.stage === "call_done").length,
    proposal_sent: crmLeadsInLemlist.filter((l) => l.stage === "proposal_sent").length,
    customer: customers,
    not_interested: crmLeadsInLemlist.filter((l) => l.stage === "not_interested").length,
  };

  // Booking rate: booked / Coach total
  const bookingRate = total > 0 ? Math.round((booked / total) * 100 * 100) / 100 : 0;

  const payload: ConversionData & { updatedAt: string } = {
    leads: enriched,
    total,
    inCrm,
    customers,
    conversionRate: total > 0 ? Math.round((customers / total) * 100) + "%" : "0%",
    coachTotal,
    booked,
    updatedAt,
  };

  // Write snapshot + update cache in parallel
  await Promise.all([
    supabase.from("campaign_snapshots").insert({
      snapshotted_at: updatedAt,
      campaign_id: campaignId,
      total_leads: total,
      booked_leads: booked,
      conversion_rate: bookingRate,
      stage_breakdown: stageBreakdown,
    }),
    supabase.from("app_cache").upsert({ key: account.cacheKey, value: payload, updated_at: updatedAt }),
  ]);

  return payload;
}

export async function syncAllAccounts() {
  const results = await Promise.allSettled(
    ALL_ACCOUNT_IDS.map((id) => syncLemlistConversion(id))
  );
  return ALL_ACCOUNT_IDS.map((id, i) => ({
    account: id,
    ok: results[i].status === "fulfilled",
    error: results[i].status === "rejected" ? (results[i] as PromiseRejectedResult).reason?.message : undefined,
  }));
}

export async function getCachedConversion(accountId: AccountId): Promise<(ConversionData & { updatedAt: string }) | null> {
  const account = getAccount(accountId);
  if (!account) return null;

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("app_cache")
    .select("value")
    .eq("key", account.cacheKey)
    .maybeSingle();
  return data?.value ?? null;
}

import { createClient } from "@supabase/supabase-js";
import { getAccount } from "@/lib/lemlist-accounts";
import { getAuthHeader } from "@/lib/lemlist";

type StepStats = {
  sequenceId: string;
  sequenceStep: number;
  taskType: string;
  sent: number;
  invited: number;
};

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );
}

// Read campaign IDs from lemlist_campaigns table (already synced by Campaign Tracker)
// This includes running, paused, and ended campaigns without extra API calls.
async function fetchAllCampaignIds(): Promise<string[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("lemlist_campaigns")
    .select("campaign_id");
  return (data ?? []).map((r: { campaign_id: string }) => r.campaign_id);
}

async function fetchStepStats(
  apiKey: string,
  campaignId: string,
  startDate: string,
  endDate: string
): Promise<StepStats[]> {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(
    `https://api.lemlist.com/api/v2/campaigns/${campaignId}/stats?${params}`,
    { cache: "no-store", headers: { Authorization: getAuthHeader(apiKey) } }
  );
  if (!res.ok) return [];
  const data = await res.json() as { steps?: StepStats[] };
  return data.steps ?? [];
}

// Fetch all steps for a list of campaigns sequentially in batches to avoid rate limits
async function fetchAllSteps(
  apiKey: string,
  campaignIds: string[],
  startDate: string,
  endDate: string
): Promise<StepStats[]> {
  const BATCH = 5;
  const all: StepStats[] = [];
  for (let i = 0; i < campaignIds.length; i += BATCH) {
    const batch = campaignIds.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((id) => fetchStepStats(apiKey, id, startDate, endDate))
    );
    all.push(...results.flat());
  }
  return all;
}

function extractLinkedInMessages(steps: StepStats[]): number {
  return steps
    .filter((s) => s.taskType === "linkedinSend")
    .reduce((sum, s) => sum + (s.sent ?? 0), 0);
}

function extractLinkedInInvites(steps: StepStats[]): number {
  return steps
    .filter((s) => s.taskType === "linkedinInvite")
    .reduce((sum, s) => sum + (s.invited ?? 0), 0);
}

async function syncDay(
  apiKey: string,
  campaignIds: string[],
  date: string
): Promise<{ sentCount: number; inviteCount: number }> {
  const startDate = new Date(date + "T00:00:00.000Z").toISOString();
  const end = new Date(date + "T00:00:00.000Z");
  end.setUTCDate(end.getUTCDate() + 1);

  const steps = await fetchAllSteps(apiKey, campaignIds, startDate, end.toISOString());
  const sentCount = extractLinkedInMessages(steps);
  const inviteCount = extractLinkedInInvites(steps);

  const supabase = getServiceClient();
  await supabase.from("linkedin_daily_sends").upsert({
    date,
    sent_count: sentCount,
    invite_count: inviteCount,
    cumulative_total: 0,
    synced_at: new Date().toISOString(),
  });

  return { sentCount, inviteCount };
}

export async function syncLinkedInDailySends(): Promise<{ date: string; sentCount: number; inviteCount: number }> {
  const account = getAccount("clement");
  if (!account) throw new Error("Account clement not found");

  const apiKey = account.apiKey();
  if (!apiKey) throw new Error("LEMLIST_API_KEY not configured");

  const campaignIds = await fetchAllCampaignIds();
  if (campaignIds.length === 0) throw new Error("No campaigns found in DB — run Campaign Tracker sync first");

  // Manual sync: force-refresh all 21 days sequentially to avoid rate limits
  await backfillMissingDays(apiKey, campaignIds, 21);

  const today = new Date().toISOString().slice(0, 10);
  const result = await syncDay(apiKey, campaignIds, today);
  return { date: today, ...result };
}

export type LinkedInDaySend = {
  date: string;
  sent_count: number;
  invite_count: number;
  cumulative_total: number;
};

async function backfillMissingDays(
  apiKey: string,
  campaignIds: string[],
  forceRefreshDays = 2
): Promise<void> {
  const supabase = getServiceClient();
  const today = new Date();

  const dates: string[] = [];
  for (let i = 0; i <= 21; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const forceRefresh = new Set(dates.slice(0, forceRefreshDays));

  const { data: existing } = await supabase
    .from("linkedin_daily_sends")
    .select("date")
    .in("date", dates);

  const existingDates = new Set((existing ?? []).map((r: { date: string }) => r.date));
  const toFetch = dates.filter((d) => forceRefresh.has(d) || !existingDates.has(d));
  if (toFetch.length === 0) return;

  // Process sequentially to avoid Lemlist rate limits
  for (const date of toFetch) {
    await syncDay(apiKey, campaignIds, date);
  }
}

export async function getLinkedInDailySends(): Promise<LinkedInDaySend[]> {
  const account = getAccount("clement");
  if (account) {
    const apiKey = account.apiKey();
    if (apiKey) {
      const campaignIds = await fetchAllCampaignIds();
      if (campaignIds.length > 0) {
        await backfillMissingDays(apiKey, campaignIds, 2).catch(() => {});
      }
    }
  }

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("linkedin_daily_sends")
    .select("date, sent_count, invite_count, cumulative_total")
    .order("date", { ascending: true });
  return (data ?? []) as LinkedInDaySend[];
}

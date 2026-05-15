import { createClient } from "@supabase/supabase-js";
import { getAccount } from "@/lib/lemlist-accounts";
import { getAllCampaigns, getAuthHeader } from "@/lib/lemlist";

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

async function fetchAllCampaignIds(apiKey: string): Promise<string[]> {
  try {
    const campaigns = await getAllCampaigns(apiKey);
    return campaigns.map((c) => c._id);
  } catch {
    return [];
  }
}

async function fetchAllSteps(
  apiKey: string,
  campaignIds: string[],
  startDate: string,
  endDate: string
): Promise<StepStats[]> {
  const results = await Promise.all(
    campaignIds.map((id) => fetchStepStats(apiKey, id, startDate, endDate))
  );
  return results.flat();
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

  const campaignIds = await fetchAllCampaignIds(apiKey);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [todayResult] = await Promise.all([
    syncDay(apiKey, campaignIds, today),
    syncDay(apiKey, campaignIds, yesterdayStr),
  ]);

  return { date: today, ...todayResult };
}

export type LinkedInDaySend = {
  date: string;
  sent_count: number;
  invite_count: number;
  cumulative_total: number;
};

async function backfillMissingDays(apiKey: string, campaignIds: string[]): Promise<void> {
  const supabase = getServiceClient();
  const today = new Date();

  const dates: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const forceRefresh = new Set(dates.slice(0, 2));

  const { data: existing } = await supabase
    .from("linkedin_daily_sends")
    .select("date")
    .in("date", dates);

  const existingDates = new Set((existing ?? []).map((r: { date: string }) => r.date));
  const toFetch = dates.filter((d) => forceRefresh.has(d) || !existingDates.has(d));
  if (toFetch.length === 0) return;

  await Promise.all(toFetch.map((date) => syncDay(apiKey, campaignIds, date)));
}

export async function getLinkedInDailySends(): Promise<LinkedInDaySend[]> {
  const account = getAccount("clement");
  if (account) {
    const apiKey = account.apiKey();
    if (apiKey) {
      const campaignIds = await fetchAllCampaignIds(apiKey);
      await backfillMissingDays(apiKey, campaignIds);
    }
  }

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("linkedin_daily_sends")
    .select("date, sent_count, invite_count, cumulative_total")
    .order("date", { ascending: true });
  return (data ?? []) as LinkedInDaySend[];
}

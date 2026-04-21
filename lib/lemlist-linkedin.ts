import { createClient } from "@supabase/supabase-js";
import { getAccount } from "@/lib/lemlist-accounts";

const COACH_SEQUENCE_ID = "seq_h4EjowfEoe9m63iny";
const INVITE_SEQUENCE_ID = "seq_SDhBQyu88hGEqF29a";

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
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(
    `https://api.lemlist.com/api/v2/campaigns/${campaignId}/stats?${params}`,
    { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } }
  );
  if (!res.ok) return [];
  const data = await res.json() as { steps?: StepStats[] };
  return data.steps ?? [];
}

function extractFirstMessageSent(steps: StepStats[]): number {
  return steps
    .filter((s) => s.sequenceId === COACH_SEQUENCE_ID && s.sequenceStep === 0 && s.taskType === "linkedinSend")
    .reduce((sum, s) => sum + (s.sent ?? 0), 0);
}

function extractInviteSent(steps: StepStats[]): number {
  return steps
    .filter((s) => s.sequenceId === INVITE_SEQUENCE_ID && s.sequenceStep === 1 && s.taskType === "linkedinInvite")
    .reduce((sum, s) => sum + (s.invited ?? 0), 0);
}

async function syncDay(
  apiKey: string,
  campaignId: string,
  date: string
): Promise<{ sentCount: number; inviteCount: number }> {
  const startDate = new Date(date + "T00:00:00.000Z").toISOString();
  const end = new Date(date + "T00:00:00.000Z");
  end.setUTCDate(end.getUTCDate() + 1);
  const steps = await fetchStepStats(apiKey, campaignId, startDate, end.toISOString());
  const sentCount = extractFirstMessageSent(steps);
  const inviteCount = extractInviteSent(steps);

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
  const campaignId = account.coachCampaignId() || account.campaignId();
  if (!apiKey) throw new Error("LEMLIST_API_KEY not configured");

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Sync today + yesterday in parallel (yesterday is now complete)
  const [todayResult] = await Promise.all([
    syncDay(apiKey, campaignId, today),
    syncDay(apiKey, campaignId, yesterdayStr),
  ]);

  return { date: today, ...todayResult };
}

export type LinkedInDaySend = {
  date: string;
  sent_count: number;
  invite_count: number;
  cumulative_total: number;
};

async function backfillMissingDays(apiKey: string, campaignId: string): Promise<void> {
  const supabase = getServiceClient();
  const today = new Date();

  const dates: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  // Always re-fetch the last 2 days (may have 0 in DB due to a bad sync)
  const forceRefresh = new Set(dates.slice(0, 2));

  const { data: existing } = await supabase
    .from("linkedin_daily_sends")
    .select("date")
    .in("date", dates);

  const existingDates = new Set((existing ?? []).map((r: { date: string }) => r.date));
  const toFetch = dates.filter((d) => forceRefresh.has(d) || !existingDates.has(d));
  if (toFetch.length === 0) return;

  await Promise.all(
    toFetch.map(async (date) => {
      const startDate = new Date(date + "T00:00:00.000Z").toISOString();
      const end = new Date(date + "T00:00:00.000Z");
      end.setUTCDate(end.getUTCDate() + 1);
      const steps = await fetchStepStats(apiKey, campaignId, startDate, end.toISOString());
      const sentCount = extractFirstMessageSent(steps);
      const inviteCount = extractInviteSent(steps);
      await supabase.from("linkedin_daily_sends").upsert({
        date,
        sent_count: sentCount,
        invite_count: inviteCount,
        cumulative_total: 0,
        synced_at: new Date().toISOString(),
      });
    })
  );
}

export async function getLinkedInDailySends(): Promise<LinkedInDaySend[]> {
  const account = getAccount("clement");
  if (account) {
    const apiKey = account.apiKey();
    const campaignId = account.coachCampaignId() || account.campaignId();
    if (apiKey && campaignId) {
      await backfillMissingDays(apiKey, campaignId);
    }
  }

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("linkedin_daily_sends")
    .select("date, sent_count, invite_count, cumulative_total")
    .order("date", { ascending: true });
  return (data ?? []) as LinkedInDaySend[];
}

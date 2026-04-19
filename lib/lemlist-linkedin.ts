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

export async function syncLinkedInDailySends(): Promise<{ date: string; sentCount: number; inviteCount: number }> {
  const account = getAccount("clement");
  if (!account) throw new Error("Account clement not found");

  const apiKey = account.apiKey();
  const campaignId = account.coachCampaignId() || account.campaignId();
  if (!apiKey) throw new Error("LEMLIST_API_KEY not configured");

  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // Use date-filtered query (same day range) for accurate daily counts
  const todayStart = new Date(today).toISOString();
  const steps = await fetchStepStats(apiKey, campaignId, todayStart, tomorrow.toISOString());

  const sentCount = extractFirstMessageSent(steps);
  const inviteCount = extractInviteSent(steps);

  await supabase.from("linkedin_daily_sends").upsert({
    date: today,
    sent_count: sentCount,
    invite_count: inviteCount,
    cumulative_total: 0,
    synced_at: new Date().toISOString(),
  });

  return { date: today, sentCount, inviteCount };
}

export type LinkedInDaySend = {
  date: string;
  sent_count: number;
  invite_count: number;
  cumulative_total: number;
};

export async function getLinkedInDailySends(): Promise<LinkedInDaySend[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("linkedin_daily_sends")
    .select("date, sent_count, invite_count, cumulative_total")
    .order("date", { ascending: true });
  return (data ?? []) as LinkedInDaySend[];
}

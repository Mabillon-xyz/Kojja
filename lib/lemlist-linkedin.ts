import { createClient } from "@supabase/supabase-js";
import { getAccount } from "@/lib/lemlist-accounts";

// First LinkedIn message in the Coach campaign
const COACH_SEQUENCE_ID = "seq_h4EjowfEoe9m63iny";
const FIRST_MESSAGE_STEP = 0; // sequenceStep index

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );
}

async function fetchCumulativeFirstLinkedInSent(apiKey: string, campaignId: string): Promise<number> {
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");
  const params = new URLSearchParams({
    startDate: "2020-01-01T00:00:00.000Z",
    endDate: new Date().toISOString(),
  });

  const res = await fetch(
    `https://api.lemlist.com/api/v2/campaigns/${campaignId}/stats?${params}`,
    { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } }
  );
  if (!res.ok) return 0;

  const data = await res.json() as {
    steps?: Array<{
      sequenceId: string;
      sequenceStep: number;
      taskType: string;
      sent: number;
    }>;
  };

  if (!data.steps) return 0;

  // Sum A + B variants for step 0 of the coach LinkedIn sequence
  return data.steps
    .filter(
      (s) =>
        s.sequenceId === COACH_SEQUENCE_ID &&
        s.sequenceStep === FIRST_MESSAGE_STEP &&
        s.taskType === "linkedinSend"
    )
    .reduce((sum, s) => sum + (s.sent ?? 0), 0);
}

export async function syncLinkedInDailySends(): Promise<{ date: string; sentCount: number; cumulativeTotal: number }> {
  const account = getAccount("clement");
  if (!account) throw new Error("Account clement not found");

  const apiKey = account.apiKey();
  const campaignId = account.coachCampaignId() || account.campaignId();
  if (!apiKey) throw new Error("LEMLIST_API_KEY not configured");

  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const cumulativeTotal = await fetchCumulativeFirstLinkedInSent(apiKey, campaignId);

  // Get most recent previous record to compute today's delta
  const { data: prev } = await supabase
    .from("linkedin_daily_sends")
    .select("cumulative_total")
    .lt("date", today)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // First-ever sync: baseline day — sent_count = 0, we just record the cumulative
  const previousTotal = prev?.cumulative_total ?? cumulativeTotal;
  const sentCount = prev ? Math.max(0, cumulativeTotal - previousTotal) : 0;

  await supabase.from("linkedin_daily_sends").upsert({
    date: today,
    sent_count: sentCount,
    cumulative_total: cumulativeTotal,
    synced_at: new Date().toISOString(),
  });

  return { date: today, sentCount, cumulativeTotal };
}

export type LinkedInDaySend = {
  date: string;
  sent_count: number;
  cumulative_total: number;
};

export async function getLinkedInDailySends(): Promise<LinkedInDaySend[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("linkedin_daily_sends")
    .select("date, sent_count, cumulative_total")
    .order("date", { ascending: true });
  return (data ?? []) as LinkedInDaySend[];
}

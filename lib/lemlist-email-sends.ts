import { createClient } from "@supabase/supabase-js";
import { getAccount } from "@/lib/lemlist-accounts";

export type EmailDaySend = {
  date: string;
  email_count: number;
};

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );
}

async function fetchEmailCountFromLemlist(
  apiKey: string,
  campaignId: string,
  date: string
): Promise<number> {
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");
  const startDate = new Date(date + "T00:00:00.000Z").toISOString();
  const end = new Date(date + "T00:00:00.000Z");
  end.setUTCDate(end.getUTCDate() + 1);
  const endDate = end.toISOString();

  const res = await fetch(
    `https://api.lemlist.com/api/v2/campaigns/${campaignId}/stats?startDate=${startDate}&endDate=${endDate}`,
    { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } }
  );
  if (!res.ok) return 0;
  const data = (await res.json()) as { messagesSent?: number };
  return data.messagesSent ?? 0;
}

async function syncDay(
  apiKey: string,
  campaignId: string,
  date: string
): Promise<number> {
  const emailCount = await fetchEmailCountFromLemlist(apiKey, campaignId, date);
  const supabase = getServiceClient();
  await supabase.from("email_daily_sends").upsert({
    date,
    email_count: emailCount,
    synced_at: new Date().toISOString(),
  });
  return emailCount;
}

export async function syncEmailDailySends(): Promise<{ date: string; emailCount: number }> {
  const account = getAccount("clement");
  if (!account) throw new Error("Account clement not found");

  const apiKey = account.apiKey();
  const campaignId = account.coachCampaignId() || account.campaignId();
  if (!apiKey || !campaignId) throw new Error("Lemlist not configured");

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [todayCount] = await Promise.all([
    syncDay(apiKey, campaignId, today),
    syncDay(apiKey, campaignId, yesterdayStr),
  ]);

  return { date: today, emailCount: todayCount };
}

async function backfillMissingDays(apiKey: string, campaignId: string): Promise<void> {
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
    .from("email_daily_sends")
    .select("date")
    .in("date", dates);

  const existingDates = new Set((existing ?? []).map((r: { date: string }) => r.date));
  const toFetch = dates.filter((d) => forceRefresh.has(d) || !existingDates.has(d));
  if (toFetch.length === 0) return;

  await Promise.all(toFetch.map((date) => syncDay(apiKey, campaignId, date)));
}

export async function getLemlistDailyEmailSends(): Promise<EmailDaySend[]> {
  const account = getAccount("clement");
  if (account) {
    const apiKey = account.apiKey();
    const campaignId = account.coachCampaignId() || account.campaignId();
    if (apiKey && campaignId) {
      await backfillMissingDays(apiKey, campaignId).catch(() => {});
    }
  }

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("email_daily_sends")
    .select("date, email_count")
    .order("date", { ascending: true });

  return (data ?? []) as EmailDaySend[];
}

import { createClient } from "@supabase/supabase-js";
import { getAccount } from "@/lib/lemlist-accounts";
import { getCampaignStatsV2, type LemlistCampaignStatsV2 } from "@/lib/lemlist";

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

async function getActiveCampaignIds(apiKey: string): Promise<string[]> {
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");
  const res = await fetch("https://api.lemlist.com/api/campaigns?limit=100", {
    cache: "no-store",
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    _id: string;
    status: string;
    archived?: boolean;
    name?: string;
  }>;
  return data
    .filter((c) => c.status !== "draft" && !c.archived)
    .map((c) => c._id);
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
  const data = (await res.json()) as LemlistCampaignStatsV2;
  // Ne compter que les vrais emails (canal email), exclure Lemwarm et autres canaux
  return data.perChannel?.email?.sent ?? data.messagesSent ?? 0;
}

async function fetchTotalEmailCountFromAllCampaigns(
  apiKey: string,
  campaignIds: string[],
  date: string
): Promise<number> {
  const results = await Promise.all(
    campaignIds.map((id) => fetchEmailCountFromLemlist(apiKey, id, date))
  );
  return results.reduce((sum, count) => sum + count, 0);
}

async function syncDay(
  apiKey: string,
  campaignIds: string[],
  date: string
): Promise<number> {
  const emailCount = await fetchTotalEmailCountFromAllCampaigns(apiKey, campaignIds, date);
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
  if (!apiKey) throw new Error("Lemlist API key not configured");

  const campaignIds = await getActiveCampaignIds(apiKey);
  if (campaignIds.length === 0) throw new Error("No active campaigns found");

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [todayCount] = await Promise.all([
    syncDay(apiKey, campaignIds, today),
    syncDay(apiKey, campaignIds, yesterdayStr),
  ]);

  return { date: today, emailCount: todayCount };
}

async function backfillMissingDays(apiKey: string, campaignIds: string[]): Promise<void> {
  if (campaignIds.length === 0) return;

  const supabase = getServiceClient();
  const today = new Date();

  const dates: string[] = [];
  for (let i = 1; i <= 21; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  // Force refresh last 7 days to pick up email-only counts (exclude lemwarm)
  const forceRefresh = new Set(dates.slice(0, 7));
  const { data: existing } = await supabase
    .from("email_daily_sends")
    .select("date")
    .in("date", dates);

  const existingDates = new Set((existing ?? []).map((r: { date: string }) => r.date));
  const toFetch = dates.filter((d) => forceRefresh.has(d) || !existingDates.has(d));
  if (toFetch.length === 0) return;

  await Promise.all(toFetch.map((date) => syncDay(apiKey, campaignIds, date)));
}

export async function getLemlistDailyEmailSends(): Promise<EmailDaySend[]> {
  const account = getAccount("clement");
  if (account) {
    const apiKey = account.apiKey();
    if (apiKey) {
      const campaignIds = await getActiveCampaignIds(apiKey);
      if (campaignIds.length > 0) {
        await backfillMissingDays(apiKey, campaignIds).catch(() => {});
      }
    }
  }

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("email_daily_sends")
    .select("date, email_count")
    .order("date", { ascending: true });

  return (data ?? []) as EmailDaySend[];
}

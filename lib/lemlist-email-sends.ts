import { createClient } from "@supabase/supabase-js";
import { getAccount } from "@/lib/lemlist-accounts";
import { type LemlistCampaignStatsV2 } from "@/lib/lemlist";

export type CampaignCount = { name: string; count: number };

export type EmailDaySend = {
  date: string;
  email_count: number;
  breakdown?: CampaignCount[];
};

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );
}

type CampaignInfo = { id: string; name: string };

function shortCampaignName(name: string): string {
  return name
    .replace(/\s*[—–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Janv?|Févr?|Mars|Avr|Mai|Juin|Juil|Août|Sept?|Oct|Nov|Déc)\w*\.?\s*\d{4}$/i, "")
    .replace(/\s*\|\s*Variation\s+([A-Z])/i, " ($1)")
    .trim();
}

async function getActiveCampaigns(apiKey: string): Promise<CampaignInfo[]> {
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
    .map((c) => ({ id: c._id, name: shortCampaignName(c.name ?? c._id) }));
}

async function fetchEmailCount(
  apiKey: string,
  campaignId: string,
  date: string
): Promise<number> {
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");
  const startDate = new Date(date + "T00:00:00.000Z").toISOString();
  const end = new Date(date + "T00:00:00.000Z");
  end.setUTCDate(end.getUTCDate() + 1);

  const res = await fetch(
    `https://api.lemlist.com/api/v2/campaigns/${campaignId}/stats?startDate=${startDate}&endDate=${end.toISOString()}`,
    { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } }
  );
  if (!res.ok) return 0;
  const data = (await res.json()) as LemlistCampaignStatsV2;
  return data.perChannel?.email?.sent ?? data.messagesSent ?? 0;
}

async function syncDay(
  apiKey: string,
  campaigns: CampaignInfo[],
  date: string
): Promise<number> {
  const counts = await Promise.all(
    campaigns.map((c) => fetchEmailCount(apiKey, c.id, date))
  );

  const breakdown: CampaignCount[] = campaigns
    .map((c, i) => ({ name: c.name, count: counts[i] }))
    .filter((b) => b.count > 0);

  const email_count = counts.reduce((sum, n) => sum + n, 0);

  const supabase = getServiceClient();
  await supabase.from("email_daily_sends").upsert({
    date,
    email_count,
    breakdown: breakdown.length > 0 ? breakdown : null,
    synced_at: new Date().toISOString(),
  });

  return email_count;
}

export async function syncEmailDailySends(): Promise<{ date: string; emailCount: number }> {
  const account = getAccount("clement");
  if (!account) throw new Error("Account clement not found");

  const apiKey = account.apiKey();
  if (!apiKey) throw new Error("Lemlist API key not configured");

  const campaigns = await getActiveCampaigns(apiKey);
  if (campaigns.length === 0) throw new Error("No active campaigns found");

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [todayCount] = await Promise.all([
    syncDay(apiKey, campaigns, today),
    syncDay(apiKey, campaigns, yesterdayStr),
  ]);

  return { date: today, emailCount: todayCount };
}

async function backfillMissingDays(apiKey: string, campaigns: CampaignInfo[]): Promise<void> {
  if (campaigns.length === 0) return;

  const supabase = getServiceClient();
  const today = new Date();

  const dates: string[] = [];
  for (let i = 0; i <= 21; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const forceRefresh = new Set(dates.slice(0, 7));
  const { data: existing } = await supabase
    .from("email_daily_sends")
    .select("date")
    .in("date", dates);

  const existingDates = new Set((existing ?? []).map((r: { date: string }) => r.date));
  const toFetch = dates.filter((d) => forceRefresh.has(d) || !existingDates.has(d));
  if (toFetch.length === 0) return;

  await Promise.all(toFetch.map((date) => syncDay(apiKey, campaigns, date)));
}

export async function getLemlistDailyEmailSends(): Promise<EmailDaySend[]> {
  const account = getAccount("clement");
  if (account) {
    const apiKey = account.apiKey();
    if (apiKey) {
      const campaigns = await getActiveCampaigns(apiKey);
      if (campaigns.length > 0) {
        await backfillMissingDays(apiKey, campaigns).catch(() => {});
      }
    }
  }

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("email_daily_sends")
    .select("date, email_count, breakdown")
    .order("date", { ascending: true });

  return (data ?? []) as EmailDaySend[];
}

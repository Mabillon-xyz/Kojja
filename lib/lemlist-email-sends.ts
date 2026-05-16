import { createClient } from "@supabase/supabase-js";
import { getAccount, type AccountId } from "@/lib/lemlist-accounts";
import { type LemlistCampaignStatsV2 } from "@/lib/lemlist";

export type SenderCount = { name: string; count: number };

export type EmailDaySend = {
  date: string;
  email_count: number;
  breakdown?: SenderCount[];
};

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );
}

type CampaignInfo = { id: string; senderEmail: string };

async function getActiveCampaigns(apiKey: string): Promise<CampaignInfo[]> {
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");

  const statuses = ["running", "paused", "ended"];
  const seen = new Set<string>();
  const allCampaigns: Array<{ _id: string; status: string; archived?: boolean }> = [];

  await Promise.all(
    statuses.map(async (status) => {
      const res = await fetch(
        `https://api.lemlist.com/api/campaigns?limit=100&status=${status}`,
        { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } }
      );
      if (!res.ok) return;
      const data = (await res.json()) as Array<{ _id: string; status: string; archived?: boolean }>;
      if (!Array.isArray(data)) return;
      data.forEach((c) => {
        if (!seen.has(c._id)) { seen.add(c._id); allCampaigns.push(c); }
      });
    })
  );

  // fallback: unfiltered endpoint
  const fallbackRes = await fetch("https://api.lemlist.com/api/campaigns?limit=100", {
    cache: "no-store",
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (fallbackRes.ok) {
    const data = (await fallbackRes.json()) as Array<{ _id: string; status: string; archived?: boolean }>;
    if (Array.isArray(data)) {
      data.forEach((c) => {
        if (!seen.has(c._id)) { seen.add(c._id); allCampaigns.push(c); }
      });
    }
  }

  const active = allCampaigns.filter((c) => c.status !== "draft" && !c.archived);

  const details = await Promise.all(
    active.map(async (c) => {
      const res = await fetch(`https://api.lemlist.com/api/campaigns/${c._id}`, {
        cache: "no-store",
        headers: { Authorization: `Basic ${basicAuth}` },
      });
      if (!res.ok) return null;
      const d = (await res.json()) as {
        _id: string;
        senders?: Array<{ email?: string }>;
      };
      const senderEmail = d.senders?.find((s) => s.email)?.email ?? "Unknown";
      return { id: c._id, senderEmail };
    })
  );

  return details.filter((d): d is CampaignInfo => d !== null);
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
  date: string,
  accountId: string
): Promise<number> {
  const counts = await Promise.all(
    campaigns.map((c) => fetchEmailCount(apiKey, c.id, date))
  );

  // Group by sender email
  const senderTotals = new Map<string, number>();
  for (let i = 0; i < campaigns.length; i++) {
    const { senderEmail } = campaigns[i];
    senderTotals.set(senderEmail, (senderTotals.get(senderEmail) ?? 0) + counts[i]);
  }

  const breakdown: SenderCount[] = Array.from(senderTotals.entries())
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({ name, count }));

  const email_count = counts.reduce((sum, n) => sum + n, 0);

  // Don't overwrite existing good data with rate-limited zeros
  if (email_count === 0) return 0;

  const supabase = getServiceClient();
  await supabase.from("email_daily_sends").upsert({
    date,
    account_id: accountId,
    email_count,
    breakdown: breakdown.length > 0 ? breakdown : null,
    synced_at: new Date().toISOString(),
  });

  return email_count;
}

export async function syncEmailDailySends(accountId: AccountId = "clement"): Promise<{ date: string; emailCount: number }> {
  const account = getAccount(accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);

  const apiKey = account.apiKey();
  if (!apiKey) throw new Error("Lemlist API key not configured");

  const campaigns = await getActiveCampaigns(apiKey);
  if (campaigns.length === 0) throw new Error("No active campaigns found");

  // Manual sync: force-refresh all 21 days sequentially to avoid rate limits
  await backfillMissingDays(apiKey, campaigns, accountId, 21);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = await syncDay(apiKey, campaigns, today, accountId);

  return { date: today, emailCount: todayCount };
}

async function backfillMissingDays(
  apiKey: string,
  campaigns: CampaignInfo[],
  accountId: string,
  forceRefreshDays = 2
): Promise<void> {
  if (campaigns.length === 0) return;

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
    .from("email_daily_sends")
    .select("date")
    .eq("account_id", accountId)
    .in("date", dates);

  const existingDates = new Set((existing ?? []).map((r: { date: string }) => r.date));
  const toFetch = dates.filter((d) => forceRefresh.has(d) || !existingDates.has(d));
  if (toFetch.length === 0) return;

  // Process sequentially with delay to avoid Lemlist rate limits
  for (const date of toFetch) {
    await syncDay(apiKey, campaigns, date, accountId);
    await new Promise((r) => setTimeout(r, 400));
  }
}

export async function getLemlistDailyEmailSends(accountId: AccountId = "clement"): Promise<EmailDaySend[]> {
  const account = getAccount(accountId);
  if (account) {
    const apiKey = account.apiKey();
    if (apiKey) {
      const campaigns = await getActiveCampaigns(apiKey);
      if (campaigns.length > 0) {
        await backfillMissingDays(apiKey, campaigns, accountId).catch(() => {});
      }
    }
  }

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("email_daily_sends")
    .select("date, email_count, breakdown")
    .eq("account_id", accountId)
    .order("date", { ascending: true });

  return (data ?? []) as EmailDaySend[];
}

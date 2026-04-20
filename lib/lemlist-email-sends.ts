import { getAccount } from "@/lib/lemlist-accounts";

export type EmailDaySend = {
  date: string;
  email_count: number;
};

export async function getLemlistDailyEmailSends(days = 30): Promise<EmailDaySend[]> {
  const account = getAccount("clement");
  if (!account) return [];

  const apiKey = account.apiKey();
  const campaignId = account.coachCampaignId() || account.campaignId();
  if (!apiKey || !campaignId) return [];

  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");
  const todayStr = new Date().toISOString().slice(0, 10);

  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const results = await Promise.all(
    dates.map(async (date) => {
      const startDate = new Date(date + "T00:00:00.000Z").toISOString();
      const end = new Date(date + "T00:00:00.000Z");
      end.setUTCDate(end.getUTCDate() + 1);
      const endDate = end.toISOString();

      const isToday = date === todayStr;
      const res = await fetch(
        `https://api.lemlist.com/api/v2/campaigns/${campaignId}/stats?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: { Authorization: `Basic ${basicAuth}` },
          ...(isToday ? { cache: "no-store" } : { next: { revalidate: 3600 } }),
        }
      );
      if (!res.ok) return { date, email_count: 0 };
      const data = await res.json() as { messagesSent?: number };
      return { date, email_count: data.messagesSent ?? 0 };
    })
  );

  return results;
}

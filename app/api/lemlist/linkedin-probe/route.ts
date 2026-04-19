import { NextResponse } from "next/server";
import { getAccount } from "@/lib/lemlist-accounts";

export const dynamic = "force-dynamic";

const COACH_SEQUENCE_ID = "seq_h4EjowfEoe9m63iny";

type StepStats = {
  sequenceId: string;
  sequenceStep: number;
  taskType: string;
  sent: number;
};

async function fetchStep0Sent(
  apiKey: string,
  campaignId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(
    `https://api.lemlist.com/api/v2/campaigns/${campaignId}/stats?${params}`,
    { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } }
  );
  if (!res.ok) return -1;
  const data = await res.json() as { steps?: StepStats[] };
  if (!data.steps) return -1;
  return data.steps
    .filter((s) => s.sequenceId === COACH_SEQUENCE_ID && s.sequenceStep === 0 && s.taskType === "linkedinSend")
    .reduce((sum, s) => sum + (s.sent ?? 0), 0);
}

export async function GET() {
  const account = getAccount("clement");
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 400 });

  const apiKey = account.apiKey();
  const campaignId = account.coachCampaignId() || account.campaignId();

  if (!apiKey) return NextResponse.json({ error: "LEMLIST_API_KEY not set" }, { status: 500 });

  // Query each of the last 14 days individually to test if date filtering works
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: { date: string; sent: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const startDate = d.toISOString();
    const endDate = next.toISOString();
    const sent = await fetchStep0Sent(apiKey, campaignId, startDate, endDate);
    days.push({ date: d.toISOString().slice(0, 10), sent });
  }

  const allTime = await fetchStep0Sent(apiKey, campaignId, "2020-01-01T00:00:00.000Z", new Date().toISOString());

  return NextResponse.json({ campaignId, allTimeSent: allTime, dailyBreakdown: days });
}

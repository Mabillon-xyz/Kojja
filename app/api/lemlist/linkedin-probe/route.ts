import { NextResponse } from "next/server";
import { getAccount } from "@/lib/lemlist-accounts";

export const dynamic = "force-dynamic";

const COACH_SEQUENCE_ID = "seq_h4EjowfEoe9m63iny";
const INVITE_SEQUENCE_ID = "seq_SDhBQyu88hGEqF29a";

type StepStats = {
  sequenceId: string;
  sequenceStep: number;
  taskType: string;
  sent: number;
  invited: number;
};

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

function extractFirstMessage(steps: StepStats[]): number {
  return steps
    .filter((s) => s.sequenceId === COACH_SEQUENCE_ID && s.sequenceStep === 0 && s.taskType === "linkedinSend")
    .reduce((sum, s) => sum + (s.sent ?? 0), 0);
}

function extractInvite(steps: StepStats[]): { invited: number; sent: number } {
  const inviteSteps = steps.filter(
    (s) => s.sequenceId === INVITE_SEQUENCE_ID && s.sequenceStep === 1 && s.taskType === "linkedinInvite"
  );
  return {
    invited: inviteSteps.reduce((sum, s) => sum + (s.invited ?? 0), 0),
    sent: inviteSteps.reduce((sum, s) => sum + (s.sent ?? 0), 0),
  };
}

export async function GET() {
  const account = getAccount("clement");
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 400 });

  const apiKey = account.apiKey();
  const campaignId = account.coachCampaignId() || account.campaignId();
  if (!apiKey) return NextResponse.json({ error: "LEMLIST_API_KEY not set" }, { status: 500 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: { date: string; firstMessage: number; inviteInvited: number; inviteSent: number }[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const steps = await fetchStepStats(apiKey, campaignId, d.toISOString(), next.toISOString());
    const invite = extractInvite(steps);
    days.push({
      date: d.toISOString().slice(0, 10),
      firstMessage: extractFirstMessage(steps),
      inviteInvited: invite.invited,
      inviteSent: invite.sent,
    });
  }

  const allSteps = await fetchStepStats(apiKey, campaignId, "2020-01-01T00:00:00.000Z", new Date().toISOString());
  const allTimeInvite = extractInvite(allSteps);

  return NextResponse.json({
    campaignId,
    allTime: {
      firstMessage: extractFirstMessage(allSteps),
      inviteInvited: allTimeInvite.invited,
      inviteSent: allTimeInvite.sent,
    },
    dailyBreakdown: days,
  });
}

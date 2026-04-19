import { NextResponse } from "next/server";
import { getAccount } from "@/lib/lemlist-accounts";

export const dynamic = "force-dynamic";

/**
 * Probe endpoint to explore what Lemlist returns for the coach campaign.
 * Call this once in production to understand the API shape, then delete.
 *
 * Usage: GET /api/lemlist/linkedin-probe
 */
export async function GET() {
  const account = getAccount("clement");
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 400 });

  const apiKey = account.apiKey();
  const campaignId = account.coachCampaignId();

  if (!apiKey) return NextResponse.json({ error: "LEMLIST_API_KEY not set" }, { status: 500 });
  if (!campaignId) return NextResponse.json({ error: "LEMLIST_COACH_CAMPAIGN_ID not set" }, { status: 500 });

  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");
  const headers = { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/json" };

  async function probe(label: string, url: string) {
    try {
      const res = await fetch(url, { cache: "no-store", headers });
      const text = await res.text();
      let body: unknown;
      try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
      return { status: res.status, body };
    } catch (e) {
      return { error: String(e) };
    }
  }

  const startDate = "2025-01-01T00:00:00.000Z";
  const endDate = new Date().toISOString();

  const [
    campaignDetails,
    statsV2,
    activitiesAll,
    activitiesLinkedin,
    activitiesLinkedinStep,
  ] = await Promise.all([
    // Campaign steps — to identify step IDs and their types
    probe("campaign_details", `https://api.lemlist.com/api/campaigns/${campaignId}`),

    // V2 stats — does it return per-step or daily breakdown?
    probe("stats_v2", `https://api.lemlist.com/api/v2/campaigns/${campaignId}/stats?startDate=${startDate}&endDate=${endDate}`),

    // Activities — first page, no type filter
    probe("activities_all", `https://api.lemlist.com/api/v2/campaigns/${campaignId}/activities?limit=5`),

    // Activities filtered by linkedin type (guess 1)
    probe("activities_linkedin", `https://api.lemlist.com/api/v2/campaigns/${campaignId}/activities?type=linkedinSentStep&limit=5`),

    // Activities filtered by linkedin type (guess 2)
    probe("activities_linkedin_step", `https://api.lemlist.com/api/v2/campaigns/${campaignId}/activities?type=linkedinStepSent&limit=5`),
  ]);

  return NextResponse.json({
    campaignId,
    campaignDetails,
    statsV2,
    activitiesAll,
    activitiesLinkedin,
    activitiesLinkedinStep,
  });
}

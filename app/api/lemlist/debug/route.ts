import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Composio } from "@composio/core";
import { getAccount } from "@/lib/lemlist-accounts";

const CAMPAIGN_ID = process.env.LEMLIST_CAMPAIGN_ID ?? "cam_JC7mjRSoLg4MACxR6";

let composioClient: Composio | null = null;
function getComposio() {
  if (!composioClient) composioClient = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
  return composioClient;
}

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account") ?? "clement";
  const account = getAccount(accountId);

  // --- Option A: list available Lemlist actions in Composio ---
  if (req.nextUrl.searchParams.get("list") === "1") {
    const actions = await getComposio().tools.list({ apps: ["lemlist"], limit: 50 });
    return NextResponse.json({ actions });
  }

  // --- Option B: try Composio Lemlist action with connected account ---
  if (req.nextUrl.searchParams.get("composio") === "1") {
    const connectedAccountId = req.nextUrl.searchParams.get("connectedAccountId") ?? "ca_CyIWe9XIOGTM";
    const campaignId = account?.campaignId() ?? CAMPAIGN_ID;
    try {
      const result = await getComposio().tools.execute("LEMLIST_LIST_LEADS_IN_A_CAMPAIGN", {
        connectedAccountId,
        arguments: { campaign_id: campaignId },
      });
      return NextResponse.json({ result });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // --- Default: test direct Basic Auth ---
  if (!account) return NextResponse.json({ error: "Unknown account" }, { status: 400 });
  const apiKey = account.apiKey();
  const campaignId = account.campaignId();
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");

  const leadsRes = await fetch(
    `https://api.lemlist.com/api/campaigns/${campaignId}/leads?limit=3`,
    { cache: "no-store", headers: { Authorization: `Basic ${basicAuth}` } }
  );
  const leadsText = await leadsRes.text();

  const supabase = await createClient();
  const { data: crmLeads } = await supabase.from("leads").select("email, first_name, last_name");

  return NextResponse.json({
    account: accountId,
    apiKeyPresent: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.slice(0, 6) + "..." : null,
    campaignId,
    lemlist: { status: leadsRes.status, body: leadsText.slice(0, 300) },
    crm: { total: crmLeads?.length ?? 0, emails: crmLeads?.map(l => l.email) },
  });
}

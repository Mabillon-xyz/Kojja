import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Composio } from "@composio/core";
import { getAccount } from "@/lib/lemlist-accounts";

let composioClient: Composio | null = null;
function getComposio() {
  if (!composioClient) composioClient = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
  return composioClient;
}

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account") ?? "clement";
  const account = getAccount(accountId);

  // --- Option A: try Composio with connected account ---
  if (req.nextUrl.searchParams.get("composio") === "1") {
    const connectedAccountId = req.nextUrl.searchParams.get("cid") ?? "ca_CyIWe9XIOGTM";
    const campaignId = account?.campaignId() ?? "cam_QRLG9eJkNdBC2t8wT";

    // Try several likely action names until one works
    const actionNames = [
      "LEMLIST_LIST_LEADS_IN_A_CAMPAIGN",
      "LEMLIST_GET_CAMPAIGN_LEADS",
      "LEMLIST_FETCH_LEADS",
      "LEMLIST_LIST_LEADS",
    ];

    const results: Record<string, unknown> = {};
    for (const action of actionNames) {
      try {
        const r = await getComposio().tools.execute(action, {
          connectedAccountId,
          arguments: { campaign_id: campaignId },
        });
        results[action] = r;
        if ((r as { successful?: boolean }).successful) break;
      } catch (e) {
        results[action] = { error: String(e) };
      }
    }
    return NextResponse.json({ results });
  }

  // --- Default: test direct Basic Auth + show env var state ---
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

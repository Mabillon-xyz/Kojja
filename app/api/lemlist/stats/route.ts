import { NextRequest, NextResponse } from "next/server";
import { getAccount } from "@/lib/lemlist-accounts";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account") ?? "clement";
  const account = getAccount(accountId);
  if (!account) return NextResponse.json({ error: "Unknown account" }, { status: 400 });

  const apiKey = account.apiKey();
  if (!apiKey) return NextResponse.json({ error: `LEMLIST_API_KEY not configured for ${accountId}` }, { status: 500 });

  const campaignId = account.campaignId();
  const startDate = "2020-01-01T00:00:00.000Z";
  const endDate = new Date().toISOString();
  const params = new URLSearchParams({ startDate, endDate });
  const basicAuth = Buffer.from(`:${apiKey}`).toString("base64");

  const res = await fetch(
    `https://api.lemlist.com/api/v2/campaigns/${campaignId}/stats?${params}`,
    { next: { revalidate: 300 }, headers: { Authorization: `Basic ${basicAuth}` } }
  );

  const bodyText = await res.text();

  if (!res.ok) {
    console.error("[lemlist/stats] API error:", res.status, bodyText);
    return NextResponse.json({ error: `Lemlist API error ${res.status}`, detail: bodyText }, { status: res.status });
  }

  if (!bodyText.trim()) {
    return NextResponse.json({ error: "Lemlist returned an empty response" }, { status: 502 });
  }

  let data: unknown;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Lemlist returned non-JSON response", detail: bodyText.slice(0, 200) }, { status: 502 });
  }

  return NextResponse.json(data);
}

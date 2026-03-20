import { NextResponse } from "next/server";

const CAMPAIGN_ID = process.env.LEMLIST_CAMPAIGN_ID ?? "cam_JC7mjRSoLg4MACxR6";

export async function GET() {
  if (!process.env.LEMLIST_API_KEY) {
    return NextResponse.json({ error: "LEMLIST_API_KEY not configured" }, { status: 500 });
  }

  const res = await fetch(
    `https://api.lemlist.com/api/campaigns/${CAMPAIGN_ID}/stats?access_token=${process.env.LEMLIST_API_KEY}`,
    { next: { revalidate: 300 } }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("[lemlist] API error:", res.status, text);
    return NextResponse.json({ error: `Lemlist API error ${res.status}`, detail: text }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}

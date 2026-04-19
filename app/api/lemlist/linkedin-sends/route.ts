import { NextResponse } from "next/server";
import { syncLinkedInDailySends, getLinkedInDailySends } from "@/lib/lemlist-linkedin";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getLinkedInDailySends();
  return NextResponse.json(data);
}

export async function POST() {
  try {
    const result = await syncLinkedInDailySends();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[linkedin-sends] sync error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

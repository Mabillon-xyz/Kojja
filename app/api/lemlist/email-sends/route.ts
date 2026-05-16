import { NextResponse } from "next/server";
import { getLemlistDailyEmailSends, syncEmailDailySends } from "@/lib/lemlist-email-sends";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const data = await getLemlistDailyEmailSends();
  return NextResponse.json(data);
}

export async function POST() {
  try {
    const result = await syncEmailDailySends();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[email-sends] sync error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

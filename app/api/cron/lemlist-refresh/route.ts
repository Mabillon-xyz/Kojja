import { NextResponse } from "next/server";
import { syncAllAccounts } from "@/lib/lemlist-sync";
import { syncLinkedInDailySends } from "@/lib/lemlist-linkedin";
import { syncEmailDailySends } from "@/lib/lemlist-email-sends";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run sequentially to avoid Lemlist API rate limits from concurrent calls
  const settled = {
    results: null as unknown,
    linkedIn: null as unknown,
    emailSends: null as unknown,
  };
  try { settled.results = await syncAllAccounts(); } catch (e) { settled.results = { error: (e as Error).message }; }
  try { settled.linkedIn = await syncLinkedInDailySends(); } catch (e) { settled.linkedIn = { error: (e as Error).message }; }
  try { settled.emailSends = await syncEmailDailySends(); } catch (e) { settled.emailSends = { error: (e as Error).message }; }

  console.log("[lemlist-refresh] cron results:", JSON.stringify(settled));

  return NextResponse.json({ ok: true, ...settled });
}

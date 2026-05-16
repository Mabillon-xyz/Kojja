import { NextResponse } from "next/server";
import { syncAllAccounts } from "@/lib/lemlist-sync";
import { syncLinkedInDailySends } from "@/lib/lemlist-linkedin";
import { syncEmailDailySends } from "@/lib/lemlist-email-sends";
import { ALL_ACCOUNT_IDS } from "@/lib/lemlist-accounts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settled: Record<string, unknown> = { results: null };
  try { settled.results = await syncAllAccounts(); } catch (e) { settled.results = { error: (e as Error).message }; }

  for (const accountId of ALL_ACCOUNT_IDS) {
    try { settled[`linkedIn_${accountId}`] = await syncLinkedInDailySends(accountId); }
    catch (e) { settled[`linkedIn_${accountId}`] = { error: (e as Error).message }; }

    try { settled[`emailSends_${accountId}`] = await syncEmailDailySends(accountId); }
    catch (e) { settled[`emailSends_${accountId}`] = { error: (e as Error).message }; }
  }

  console.log("[lemlist-refresh] cron results:", JSON.stringify(settled));
  return NextResponse.json({ ok: true, ...settled });
}

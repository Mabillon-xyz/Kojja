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

  const [results, linkedIn, emailSends] = await Promise.allSettled([
    syncAllAccounts(),
    syncLinkedInDailySends(),
    syncEmailDailySends(),
  ]);

  console.log("[lemlist-refresh] cron results:", JSON.stringify(results));
  console.log("[lemlist-refresh] linkedin sync:", JSON.stringify(linkedIn));
  console.log("[lemlist-refresh] email sends sync:", JSON.stringify(emailSends));

  return NextResponse.json({
    ok: true,
    results: results.status === "fulfilled" ? results.value : { error: results.reason?.message },
    linkedIn: linkedIn.status === "fulfilled" ? linkedIn.value : { error: linkedIn.reason?.message },
    emailSends: emailSends.status === "fulfilled" ? emailSends.value : { error: emailSends.reason?.message },
  });
}

import { NextResponse } from "next/server";
import { syncAllAccounts } from "@/lib/lemlist-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllAccounts();
  console.log("[lemlist-refresh] cron results:", JSON.stringify(results));
  return NextResponse.json({ ok: true, results });
}

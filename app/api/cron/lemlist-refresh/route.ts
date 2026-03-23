import { NextResponse } from "next/server";
import { syncLemlistConversion } from "@/lib/lemlist-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Verify Vercel cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncLemlistConversion();
    console.log(`[lemlist-refresh] synced ${result.total} leads, ${result.inCrm} in CRM, ${result.customers} customers`);
    return NextResponse.json({ ok: true, total: result.total, updatedAt: result.updatedAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[lemlist-refresh] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

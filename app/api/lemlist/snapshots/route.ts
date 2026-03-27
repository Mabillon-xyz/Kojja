import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccount } from "@/lib/lemlist-accounts";

export type Snapshot = {
  id: string;
  snapshotted_at: string;
  total_leads: number;
  booked_leads: number;
  conversion_rate: number;
  stage_breakdown: {
    call_scheduled: number;
    call_done: number;
    proposal_sent: number;
    customer: number;
    not_interested: number;
  } | null;
};

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account") ?? "clement";
  const account = getAccount(accountId);
  if (!account) return NextResponse.json({ error: "Unknown account" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );

  const { data, error } = await supabase
    .from("campaign_snapshots")
    .select("id, snapshotted_at, total_leads, booked_leads, conversion_rate, stage_breakdown")
    .eq("campaign_id", account.campaignId())
    .order("snapshotted_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep only the latest snapshot per day to avoid duplicate dates in the chart
  const byDay = new Map<string, Snapshot>();
  for (const s of (data as Snapshot[])) {
    const day = s.snapshotted_at.slice(0, 10);
    if (!byDay.has(day) || s.snapshotted_at > byDay.get(day)!.snapshotted_at) {
      byDay.set(day, s);
    }
  }
  const deduped = [...byDay.values()].sort((a, b) => a.snapshotted_at.localeCompare(b.snapshotted_at));

  return NextResponse.json(deduped);
}

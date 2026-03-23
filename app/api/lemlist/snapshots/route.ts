import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = process.env.LEMLIST_CAMPAIGN_ID ?? "cam_JC7mjRSoLg4MACxR6";

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

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );

  const { data, error } = await supabase
    .from("campaign_snapshots")
    .select("id, snapshotted_at, total_leads, booked_leads, conversion_rate, stage_breakdown")
    .eq("campaign_id", CAMPAIGN_ID)
    .order("snapshotted_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as Snapshot[]);
}

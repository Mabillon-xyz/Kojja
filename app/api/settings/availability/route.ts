import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type DaySchedule = { start: string; end: string }[];
export type AvailabilityConfig = {
  days: Record<string, DaySchedule>; // key = day-of-week "1"…"7" (1=Mon, 7=Sun)
};

export const DEFAULT_AVAILABILITY: AvailabilityConfig = {
  days: {
    "1": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "2": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "3": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "4": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "5": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
  },
};

export async function GET() {
  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "availability")
      .single();

    const config: AvailabilityConfig = data?.value ?? DEFAULT_AVAILABILITY;
    return NextResponse.json(config);
  } catch {
    return NextResponse.json(DEFAULT_AVAILABILITY);
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: AvailabilityConfig = await req.json();
  if (!body?.days) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service
    .from("settings")
    .upsert({ key: "availability", value: body }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

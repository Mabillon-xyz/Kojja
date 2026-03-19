import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_AVAILABILITY } from "@/lib/availability-types";
import type { AvailabilityConfig } from "@/lib/availability-types";

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

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body?.name || !Array.isArray(body?.steps))
    return NextResponse.json({ error: "name and steps required" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("automations")
    .insert({
      name: body.name,
      enabled: body.enabled ?? true,
      trigger: "call_booked",
      steps: body.steps,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

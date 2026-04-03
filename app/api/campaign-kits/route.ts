import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/campaign-kits?lead_id=<uuid>  → list kits (meta only, no content)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('lead_id')
  const supabase = getSupabase()

  let query = supabase
    .from('campaign_kits')
    .select('id, lead_id, coach_name, label, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (leadId) query = query.eq('lead_id', leadId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/campaign-kits  → save a new kit
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { lead_id, coach_name, form_inputs, icp, okrs, hooks, linkedin, emails, label } = body

  if (!coach_name || !icp) {
    return NextResponse.json({ error: 'coach_name and icp are required' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('campaign_kits')
    .insert({
      lead_id: lead_id || null,
      coach_name,
      form_inputs: form_inputs ?? {},
      icp,
      okrs: okrs ?? [],
      hooks: hooks ?? [],
      linkedin: linkedin ?? [],
      emails: emails ?? [],
      label: label ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

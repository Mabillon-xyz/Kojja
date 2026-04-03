import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/leads/research/batch
 * Returns the list of leads that don't have an existing research record.
 * The client is responsible for calling each lead's research endpoint individually.
 */
export async function GET() {
  const supabase = getSupabase()

  const { data: leads, error: leadsErr } = await supabase
    .from('leads')
    .select('id, first_name, last_name')

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })
  if (!leads || leads.length === 0) return NextResponse.json([])

  const { data: existing } = await supabase
    .from('lead_research')
    .select('lead_id')

  const alreadyResearched = new Set((existing ?? []).map((r: { lead_id: string }) => r.lead_id))
  const toResearch = leads.filter(l => !alreadyResearched.has(l.id))

  return NextResponse.json(
    toResearch.map(l => ({ id: l.id, name: `${l.first_name} ${l.last_name}` }))
  )
}

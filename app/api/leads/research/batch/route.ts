import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/leads/research/batch
 * Fires off lead research for all leads that don't have an existing research record.
 * Fire-and-forget per lead — returns immediately with the count.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase()

  // Optionally accept a list of lead IDs to restrict to
  let targetIds: string[] | null = null
  try {
    const body = await req.json().catch(() => ({}))
    if (Array.isArray(body?.lead_ids) && body.lead_ids.length > 0) {
      targetIds = body.lead_ids
    }
  } catch { /* no body */ }

  // Fetch all leads (or specified ones)
  let leadsQuery = supabase.from('leads').select('id, first_name, last_name')
  if (targetIds) leadsQuery = leadsQuery.in('id', targetIds)

  const { data: leads, error: leadsErr } = await leadsQuery
  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })
  if (!leads || leads.length === 0) return NextResponse.json({ queued: 0, skipped: 0 })

  // Find leads that already have at least one research record
  const { data: existing } = await supabase
    .from('lead_research')
    .select('lead_id')
  const alreadyResearched = new Set((existing ?? []).map((r: { lead_id: string }) => r.lead_id))

  // Determine which need research
  const toResearch = leads.filter(l => !alreadyResearched.has(l.id))
  const skipped = leads.length - toResearch.length

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // Fire-and-forget one request per lead
  for (const lead of toResearch) {
    fetch(`${siteUrl}/api/leads/${lead.id}/research`, { method: 'POST' }).catch(() => {})
  }

  return NextResponse.json({
    queued: toResearch.length,
    skipped,
    leads: toResearch.map(l => ({ id: l.id, name: `${l.first_name} ${l.last_name}` })),
  })
}

import { createClient } from '@supabase/supabase-js'
import { getAllCampaigns, getCampaignStatsV2, getAuthHeader } from '@/lib/lemlist'
import type { LemlistCampaignStatsV2 } from '@/lib/lemlist'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  )
}

function pct(num: number, den: number): number {
  if (den === 0) return 0
  return Math.round((num / den) * 1000) / 10
}

function linkedinInvitesSentFromSteps(stats: LemlistCampaignStatsV2 | null): number {
  if (!stats?.steps) return 0
  return stats.steps
    .filter(s => s.taskType === 'linkedinInvite')
    .reduce((sum, s) => sum + (s.invited ?? 0), 0)
}

export async function syncCampaigns(opts?: { apiKey?: string; clientId?: string }): Promise<{ synced: number; timestamp: string; error?: string }> {
  const apiKey = opts?.apiKey ?? process.env.LEMLIST_API_KEY
  const clientId = opts?.clientId ?? null
  if (!apiKey) return { synced: 0, timestamp: new Date().toISOString(), error: 'LEMLIST_API_KEY not set' }

  const supabase = getSupabase()

  // 1. Get all campaigns from Lemlist
  let campaigns: Awaited<ReturnType<typeof getAllCampaigns>>
  try {
    campaigns = await getAllCampaigns(apiKey)
  } catch (err) {
    return { synced: 0, timestamp: new Date().toISOString(), error: String(err) }
  }

  if (campaigns.length === 0) return { synced: 0, timestamp: new Date().toISOString() }

  // 2. Get stats for all campaigns in parallel batches of 10
  const BATCH = 10
  const statsMap = new Map<string, LemlistCampaignStatsV2 | null>()

  for (let i = 0; i < campaigns.length; i += BATCH) {
    const batch = campaigns.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(c => getCampaignStatsV2(c._id, apiKey).then(s => ({ id: c._id, stats: s })))
    )
    results.forEach(({ id, stats }) => statsMap.set(id, stats))
  }

  // 3. Count discovery calls booked per campaign (from leads table)
  const { data: bookedLeads } = await supabase
    .from('leads')
    .select('lemlist_campaign_id')
    .not('call_booked_at', 'is', null)
    .not('lemlist_campaign_id', 'is', null)

  const bookedByCampaign = new Map<string, number>()
  for (const lead of bookedLeads ?? []) {
    const cid = lead.lemlist_campaign_id as string
    bookedByCampaign.set(cid, (bookedByCampaign.get(cid) ?? 0) + 1)
  }

  // 4. Build upsert rows
  const timestamp = new Date().toISOString()

  const upserts = campaigns.map(campaign => {
    const stats = statsMap.get(campaign._id)
    const email = stats?.perChannel?.email
    const linkedin = stats?.perChannel?.linkedin
    const emailSent = email?.sent ?? 0
    const linkedinAccepted = stats?.invitationAccepted ?? linkedin?.invitationAccepted ?? 0
    const linkedinInvitesSent = linkedinInvitesSentFromSteps(stats ?? null) || stats?.nbLeads || 0

    const rawStatus = campaign.status ?? 'draft'
    const status = rawStatus === 'active' ? 'running'
      : rawStatus === 'stopped' ? 'ended'
      : rawStatus

    return {
      campaign_id: campaign._id,
      name: campaign.name,
      status,
      created_at_lemlist: campaign.createdAt ?? null,
      client_id: clientId,

      emails_sent: emailSent,
      emails_delivered: email?.delivered ?? 0,
      emails_opened: email?.opened ?? 0,
      emails_opened_pct: pct(email?.opened ?? 0, emailSent),
      emails_replied: email?.replied ?? 0,
      emails_replied_pct: pct(email?.replied ?? 0, emailSent),

      linkedin_invites_sent: linkedinInvitesSent,
      linkedin_invites_accepted: linkedinAccepted,
      linkedin_acceptance_pct: pct(linkedinAccepted, linkedinInvitesSent),
      linkedin_messages_sent: linkedin?.sent ?? 0,
      linkedin_messages_replied: linkedin?.replied ?? 0,
      linkedin_reply_pct: pct(linkedin?.replied ?? 0, linkedin?.sent ?? 0),

      leads_total: stats?.nbLeads ?? 0,
      leads_reached: stats?.nbLeadsReached ?? 0,
      leads_interested: stats?.nbLeadsInterested ?? 0,

      discovery_calls_booked: bookedByCampaign.get(campaign._id) ?? 0,

      synced_at: timestamp,
    }
  })

  const { error } = await supabase
    .from('lemlist_campaigns')
    .upsert(upserts, { onConflict: 'campaign_id' })

  if (error) return { synced: 0, timestamp, error: error.message }

  return { synced: upserts.length, timestamp }
}

// Unused but kept for potential direct HTTP use
export { getAuthHeader }

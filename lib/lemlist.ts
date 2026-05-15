const API_BASE = 'https://api.lemlist.com/api'

export function getAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`:${apiKey}`).toString('base64')}`
}

export async function post(
  path: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: getAuthHeader(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Lemlist POST ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text) as Record<string, unknown>
}

export async function get(
  path: string,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: getAuthHeader(apiKey) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Lemlist GET ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text) as Record<string, unknown>
}

export async function getSequenceId(campaignId: string, apiKey: string): Promise<string> {
  const data = await get(`/campaigns/${campaignId}/sequences`, apiKey)
  const id = Object.keys(data)[0]
  if (!id) throw new Error('No sequence found for campaign')
  return id
}

export async function startCampaign(campaignId: string, apiKey: string): Promise<void> {
  await post(`/campaigns/${campaignId}/start`, apiKey, {})
}

// ─── Campaign stats ─────────────────────────────────────────────────────────

const API_BASE_V2 = 'https://api.lemlist.com/api/v2'

export type LemlistCampaignItem = {
  _id: string
  name: string
  status: string
  createdAt: string
  labels?: string[]
}

export type LemlistCampaignStatsV2 = {
  campaignId: string
  leadMetrics: {
    total: number
    reached: number
    interested: number
    notInterested: number
  }
  messageMetrics: {
    openedPercentage: number
    repliedPercentage: number
    perChannel: {
      email: {
        sent: number
        delivered: number
        opened: number
        replied: number
        bounced: number
      }
      linkedin: {
        sent: number
        delivered: number
        invitationAccepted: number
        replied: number
      }
    }
  }
  channelMetrics: {
    linkedinInvitationAccepted: number
    meetingBooked: number
  }
  steps?: {
    taskType?: string
    invited?: number
    sent?: number
    replied?: number
  }[]
}

export async function getAllCampaigns(apiKey: string): Promise<LemlistCampaignItem[]> {
  const res = await fetch(`${API_BASE}/campaigns?limit=100`, {
    headers: { Authorization: getAuthHeader(apiKey) },
  })
  if (!res.ok) throw new Error(`Lemlist GET /campaigns → ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function getCampaignStatsV2(campaignId: string, apiKey: string): Promise<LemlistCampaignStatsV2 | null> {
  try {
    const res = await fetch(`${API_BASE_V2}/campaigns/${campaignId}/stats`, {
      headers: { Authorization: getAuthHeader(apiKey) },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function findLeadCampaignByEmail(email: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/leads/${encodeURIComponent(email)}`, {
      headers: { Authorization: getAuthHeader(apiKey) },
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data as { campaignId?: string })?.campaignId ?? null
  } catch {
    return null
  }
}

export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

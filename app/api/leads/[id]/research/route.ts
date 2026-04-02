import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const COACHES_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/19O54kk8km9RJsfemuAK2HNlkU9ze3vahcA-LyrJhp1c/export?format=csv&gid=1823960202'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── CSV utils ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h.trim()] = (values[i] ?? '').trim() })
    return row
  })
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KojaResearch/1.0)' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return `HTTP ${res.status} ${res.statusText}`
    const text = await res.text()
    const MAX = 40_000
    return text.length > MAX ? text.slice(0, MAX) + '\n[truncated]' : text
  } catch (e) {
    return `Fetch error: ${e instanceof Error ? e.message : 'unknown'}`
  }
}

async function parallelSearch(query: string): Promise<string> {
  const apiKey = process.env.PARALLEL_API_KEY
  if (!apiKey) return 'Web search not configured (missing PARALLEL_API_KEY).'
  try {
    const res = await fetch('https://api.parallel.ai/v1beta/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        objective: query,
        search_queries: [query],
        mode: 'fast',
        excerpts: { max_chars_per_result: 2000 },
      }),
    })
    if (!res.ok) return `Search failed: ${res.status}`
    const data = await res.json()
    type R = { title?: string; url?: string; excerpts?: { text?: string }[]; snippet?: string }
    const results: R[] = data?.results ?? (Array.isArray(data) ? data : [])
    if (results.length > 0) {
      return results
        .slice(0, 5)
        .map(r => `**${r.title ?? 'Result'}**\n${r.url ?? ''}\n${r.excerpts?.[0]?.text ?? r.snippet ?? ''}`)
        .join('\n\n')
    }
    if (typeof data?.answer === 'string') return data.answer
    return JSON.stringify(data)
  } catch (e) {
    return `Search error: ${e instanceof Error ? e.message : 'unknown'}`
  }
}

async function fetchLemlistContact(email: string | null): Promise<Record<string, unknown> | null> {
  if (!email) return null
  const apiKey = process.env.LEMLIST_API_KEY
  if (!apiKey) return null
  try {
    const basicAuth = Buffer.from(`:${apiKey}`).toString('base64')
    const res = await fetch(
      `https://api.lemlist.com/api/contacts?idsOrEmails=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Basic ${basicAuth}` }, signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const contacts = Array.isArray(data) ? data : []
    return (contacts[0] as Record<string, unknown>) ?? null
  } catch {
    return null
  }
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const FETCH_URL_TOOL: Anthropic.Tool = {
  name: 'fetch_url',
  description: 'Fetch the content of a URL. Use for LinkedIn profiles, coach websites, or any public page.',
  input_schema: {
    type: 'object' as const,
    properties: { url: { type: 'string', description: 'The URL to fetch' } },
    required: ['url'],
  },
}

const WEB_SEARCH_TOOL: Anthropic.Tool = {
  name: 'web_search',
  description: 'Search the internet for information about a person, their coaching practice, or company.',
  input_schema: {
    type: 'object' as const,
    properties: { query: { type: 'string', description: 'The search query' } },
    required: ['query'],
  },
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ResearchReport = {
  profile_summary: string
  icp_match: 'high' | 'medium' | 'low'
  icp_reason: string
  enriched_fields: { company_name?: string; city?: string; linkedin_url?: string; phone?: string }
  icebreaker: string
  email_subject: string
  email_body: string
  linkedin_dm: string
  sources: string[]
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('lead_research')
    .select('*')
    .eq('lead_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabase()

  // 1. Fetch lead
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('*')
    .eq('id', params.id)
    .single()

  if (leadErr || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // 2. In parallel: fetch Google Sheet + Lemlist contact
  const [sheetResult, lemlistResult] = await Promise.allSettled([
    fetchUrl(COACHES_SHEET_URL),
    fetchLemlistContact(lead.email),
  ])

  // Find matching row in Google Sheet by LinkedIn URL or last name
  let sheetsRow: Record<string, string> | null = null
  if (sheetResult.status === 'fulfilled') {
    const rows = parseCSV(sheetResult.value)
    const leadLinkedin = (lead.linkedin_url ?? '').toLowerCase()
    const leadLastName = (lead.last_name ?? '').toLowerCase()

    sheetsRow = rows.find(row => {
      const rowLinkedin = (row.linkedInProfileUrl ?? '').toLowerCase()
      const rowName = (row.fullName ?? '').toLowerCase()
      if (leadLinkedin && rowLinkedin) {
        // Match on LinkedIn URL slug
        const leadSlug = leadLinkedin.split('/in/').pop()?.replace(/\/$/, '') ?? ''
        const rowSlug = rowLinkedin.split('/in/').pop()?.replace(/\/$/, '') ?? ''
        if (leadSlug && rowSlug && leadSlug === rowSlug) return true
      }
      // Fallback: match on last name
      return leadLastName.length > 2 && rowName.toLowerCase().includes(leadLastName)
    }) ?? null
  }

  const lemlistContact =
    lemlistResult.status === 'fulfilled' ? lemlistResult.value : null

  // 3. Build context
  const leadContext = [
    `Name: ${lead.first_name} ${lead.last_name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company_name ?? 'Unknown'}`,
    `City: ${lead.city ?? 'Unknown'}`,
    `LinkedIn: ${lead.linkedin_url ?? 'Unknown'}`,
    `Phone: ${lead.phone ?? 'Unknown'}`,
    lead.notes ? `Notes: ${lead.notes}` : null,
    lead.comment ? `Comment: ${lead.comment}` : null,
  ].filter(Boolean).join('\n')

  const sheetsContext = sheetsRow
    ? `\n\nGoogle Sheets coach database row:\n${JSON.stringify(sheetsRow, null, 2)}`
    : ''

  const lemlistContext = lemlistContact
    ? `\n\nLemlist contact data:\n${JSON.stringify(lemlistContact, null, 2)}`
    : ''

  // 4. Run Claude agentic loop
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const SYSTEM = `Tu es un assistant de recherche CRM pour Koj²a, un outil de prospection pour coachs business indépendants en France.

L'ICP cible est : coach business indépendant (solo ou très petite structure), accompagnant des dirigeants de TPE/PME françaises, basé en région française (hors Paris), avec 5+ ans d'expérience terrain.

Ton rôle : rechercher des informations sur un prospect coach, évaluer son adéquation ICP, et générer des messages d'approche personnalisés.

Utilise web_search pour rechercher des informations sur ce coach (nom + "coach", site web, LinkedIn, activité, certifications).
Utilise fetch_url pour lire une page LinkedIn, un site de coaching, ou toute URL pertinente.

Génère les messages en français, vouvoiement, ancrés dans la situation réelle du coach.

IMPORTANT : Ta réponse finale doit être UNIQUEMENT un objet JSON valide (sans markdown, sans explication, sans backticks).`

  const userMessage = `Recherche ce prospect coach et génère un rapport JSON.

${leadContext}${sheetsContext}${lemlistContext}

Effectue des recherches web pour mieux connaître ce coach, puis réponds UNIQUEMENT avec ce JSON :
{
  "profile_summary": "2-3 phrases sur qui il/elle est professionnellement",
  "icp_match": "high" ou "medium" ou "low",
  "icp_reason": "Pourquoi il/elle correspond ou non à l'ICP (coach indépendant accompagnant des dirigeants TPE/PME en France régionale)",
  "enriched_fields": {
    "company_name": "...",
    "city": "...",
    "linkedin_url": "https://linkedin.com/in/...",
    "phone": "..."
  },
  "icebreaker": "1-2 phrases personnalisées pour l'accroche, basées sur un élément concret de son profil",
  "email_subject": "Objet de l'email de prospection",
  "email_body": "Corps de l'email (5-7 lignes, vouvoiement, référencer sa situation spécifique)",
  "linkedin_dm": "Message LinkedIn DM (max 300 caractères)",
  "sources": ["url1", "url2"]
}`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }]
  const tools = [WEB_SEARCH_TOOL, FETCH_URL_TOOL]
  let finalText = ''
  const MAX_ITER = 8

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM,
      tools,
      messages,
    })

    for (const block of response.content) {
      if (block.type === 'text') finalText = block.text
    }

    if (response.stop_reason === 'end_turn') break

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        let result: string
        if (block.name === 'web_search') {
          result = await parallelSearch((block.input as { query: string }).query)
        } else if (block.name === 'fetch_url') {
          result = await fetchUrl((block.input as { url: string }).url)
        } else {
          result = 'Unknown tool'
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }

      messages.push({ role: 'user', content: toolResults })
    }
  }

  // 5. Parse JSON report
  let report: ResearchReport | null = null
  try {
    const jsonMatch = finalText.match(/\{[\s\S]*\}/)
    if (jsonMatch) report = JSON.parse(jsonMatch[0]) as ResearchReport
  } catch {
    // parsing failed — use raw text as summary
  }

  if (!report) {
    report = {
      profile_summary: finalText.slice(0, 500) || 'Research completed.',
      icp_match: 'medium',
      icp_reason: 'Unable to determine automatically.',
      enriched_fields: {},
      icebreaker: '',
      email_subject: '',
      email_body: '',
      linkedin_dm: '',
      sources: [],
    }
  }

  // 6. Update lead with enriched fields (only fill empty fields)
  const ef = report.enriched_fields ?? {}
  const updates: Record<string, string> = {}
  if (ef.company_name && !lead.company_name) updates.company_name = ef.company_name
  if (ef.city && !lead.city) updates.city = ef.city
  if (ef.linkedin_url && !lead.linkedin_url) updates.linkedin_url = ef.linkedin_url
  if (ef.phone && !lead.phone) updates.phone = ef.phone
  if (Object.keys(updates).length > 0) {
    await supabase.from('leads').update(updates).eq('id', params.id)
  }

  // 7. Save research record
  const { data: saved, error: saveErr } = await supabase
    .from('lead_research')
    .insert({
      lead_id: params.id,
      model: 'claude-sonnet-4-6',
      profile_summary: report.profile_summary,
      icp_match: report.icp_match,
      icp_reason: report.icp_reason,
      enriched_fields: report.enriched_fields,
      icebreaker: report.icebreaker,
      email_subject: report.email_subject,
      email_body: report.email_body,
      linkedin_dm: report.linkedin_dm,
      sources: report.sources,
      sheets_row: sheetsRow,
      lemlist_contact: lemlistContact,
    })
    .select()
    .single()

  if (saveErr) {
    return NextResponse.json({ error: saveErr.message }, { status: 500 })
  }

  return NextResponse.json(saved)
}

import Anthropic from '@anthropic-ai/sdk'
import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createServiceClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'
import { getAccount } from '@/lib/lemlist-accounts'

export const maxDuration = 300

const LEMLIST_API = 'https://api.lemlist.com/api'
const SUMMARY_RECIPIENT = 'contact@clementguiraud.fr'

// ── Lemlist helpers ───────────────────────────────────────────────────────────

function lemlistAuth(apiKey: string) {
  return `Basic ${Buffer.from(`:${apiKey}`).toString('base64')}`
}

async function lemlistPost(
  path: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${LEMLIST_API}${path}`, {
    method: 'POST',
    headers: { Authorization: lemlistAuth(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Lemlist ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text) as Record<string, unknown>
}

async function lemlistGet(path: string, apiKey: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${LEMLIST_API}${path}`, {
    headers: { Authorization: lemlistAuth(apiKey) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Lemlist GET ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text) as Record<string, unknown>
}

function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadsFilter {
  filterId: string
  in: string[]
  out: string[]
}

interface CampaignSpec {
  campaignName: string
  campaignNumber: number
  hypothesis: string
  icpDescription: string
  zone: string
  messageVariation: string
  rationale: string
  email1Subject: string
  email1Body: string
  linkedinNote: string
  email2Subject: string
  email2Body: string
  linkedinStep4Message: string
  emailBreakupSubject: string
  emailBreakupBody: string
  leadsFilters: LeadsFilter[]
}

interface LemLead {
  firstName?: string
  lastName?: string
  email?: string
  linkedinUrl?: string
  companyName?: string
  jobTitle?: string
}

// ── Claude spec generation ────────────────────────────────────────────────────

const CAMPAIGN_RULES_SUMMARY = `
Règles campagne Koj²a :
- Séquence : email j0 → linkedinInvite j3 → email j6 → conditional linkedinInviteAccepted j8 (waitUntil) → YES: linkedinSend j8 + break-up email j11 / NO: break-up email j11
- Objet email : 2–4 mots, ex : "{{firstName}} — un avis ?" / "Votre pipeline, {{firstName}}" / "{{firstName}}"
- Corps email 1 : {{icebreaker}} en ouverture + qui-je-suis (1 phrase) + offre avec KPI concret + question ouverte + signature "Clément"
- Ne pas mentionner d'outil, pas de "automatisation", pas de jargon startup, pas de listes à puces
- Domaine envoi : clement.guiraudpro@gmail.com
- Convention nommage : [Persona] | [Secteur/Ville] — [Mois Année]
`

async function generateCampaignSpec(campaignLogContent: string): Promise<CampaignSpec> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: `Tu es l'assistant outbound de Koj²a. Tu analyses le journal de campagne et décides quelle est la prochaine expérience à lancer.

Output ONLY valid JSON. No markdown, no commentary. Start with { and end with }.

${CAMPAIGN_RULES_SUMMARY}

Lemleads filterId valides pour les personnes : "country" | "currentTitle" | "location" | "seniority" | "currentCompanyHeadcount" | "pastTitle" | "keyword"
IMPORTANT : le seul filterId géographique valide est "location". Ce filtre accepte uniquement des noms de villes (ex: "Lyon", "Toulouse") — jamais des noms de régions. Mapper chaque zone vers ses villes :
Mapping zone → villes à utiliser dans "in" :
- Occitanie/PACA → ["Toulouse", "Montpellier", "Marseille", "Nice", "Aix-en-Provence"]
- Auvergne-Rhône-Alpes → ["Lyon", "Grenoble", "Clermont-Ferrand", "Saint-Étienne"]
- Grand Ouest (Bretagne/Pays de Loire/Nouvelle-Aquitaine) → ["Nantes", "Bordeaux", "Rennes", "Brest", "Angers"]
- Grand Est → ["Strasbourg", "Reims", "Nancy", "Metz"]
- Hauts-de-France → ["Lille", "Amiens", "Roubaix"]
- Normandie/Centre → ["Rouen", "Caen", "Tours", "Orléans"]
- Paris & IDF → ["Paris", "Versailles", "Boulogne-Billancourt", "Neuilly-sur-Seine"]
- Toute la France (pas de zone précise) → omettre le filtre "location" entièrement
Pour les coachs français : country="France", currentTitle contient des variantes de "coach" (coach dirigeant, coach exécutif, business coach, coach professionnel, coach certifié, executive coach).

Génère un JSON avec exactement cette structure :
{
  "campaignName": "string — format [Persona] | [Secteur/Ville] — Mai 2026",
  "campaignNumber": number,
  "hypothesis": "string — l'hypothèse testée en 1 phrase",
  "icpDescription": "string — description du persona ciblé",
  "zone": "string — zone géographique France",
  "messageVariation": "string — ex: Variation A email court, LinkedIn-first, etc.",
  "rationale": "string — 2-3 phrases expliquant pourquoi cette hypothèse maintenant",
  "email1Subject": "string — 2-4 mots avec {{firstName}}",
  "email1Body": "string — corps email 1 plain text, {{icebreaker}} en première ligne, paragraphes séparés par \\n\\n",
  "linkedinNote": "string — note LinkedIn invite ≤300 caractères",
  "email2Subject": "string — 2-4 mots avec {{firstName}}",
  "email2Body": "string — corps email 2 plain text",
  "linkedinStep4Message": "string — message LinkedIn j8 si invite acceptée",
  "emailBreakupSubject": "string — 1-2 mots avec {{firstName}}",
  "emailBreakupBody": "string — corps email break-up plain text",
  "leadsFilters": [
    {"filterId": "country", "in": ["France"], "out": []},
    {"filterId": "currentTitle", "in": ["coach dirigeant", "coach exécutif", "business coach", "coach professionnel", "executive coach"], "out": []},
    {"filterId": "location", "in": ["...villes ou régions selon la zone ciblée"], "out": []}
  ]
}`,
    messages: [
      {
        role: 'user',
        content: `Journal de campagne actuel :\n\n${campaignLogContent}\n\nAnalyse les campagnes existantes et les hypothèses en file d'attente. Choisis la prochaine hypothèse à tester — en priorité quelque chose de structurellement différent de ce qui a déjà été lancé (variation ICP, angle message, type de persona, zone géographique). Génère le JSON complet.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as CampaignSpec
}

// ── Lead search via Lemlist MCP (direct SDK call) ─────────────────────────────

const LEMLIST_MCP_URL = 'https://app.lemlist.com/mcp'

const VALID_LEMLEADS_FILTER_IDS = new Set([
  'country', 'currentTitle', 'currentTitleWithExactMatch', 'location',
  'seniority', 'currentCompanyHeadcount', 'pastTitle', 'keyword',
  'department', 'currentPositionTenure', 'yearsOfExperience',
  'currentCompanyType', 'currentCompanyCountry', 'currentCompanyLocation',
  'currentCompanySubIndustry', 'currentCompanyMarket', 'currentCompany',
  'region', 'interest', 'skill',
])

function sanitizeFilters(filters: LeadsFilter[]): LeadsFilter[] {
  return filters
    .map((f) => f.filterId === 'city' ? { ...f, filterId: 'location' } : f)
    .filter((f) => VALID_LEMLEADS_FILTER_IDS.has(f.filterId))
}

async function callLemleadsSearch(mcp: MCPClient, filters: LeadsFilter[]): Promise<LemLead[]> {
  const result = await mcp.callTool({ name: 'lemleads_search', arguments: {
    mode: 'people',
    filters,
    size: 40,
  }})

  const rawText = (result.content as Array<{ type: string; text?: string }>)
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')

  const parsed = JSON.parse(rawText) as { results?: Record<string, unknown>[] } | Record<string, unknown>[]
  const results = Array.isArray(parsed) ? parsed : (parsed as { results?: Record<string, unknown>[] }).results ?? []

  return results
    .map((r) => {
      const nameParts = ((r.full_name ?? '') as string).trim().split(/\s+/)
      const slug = r.canonical_shorthand_name as string | undefined
      return {
        firstName: nameParts[0] ?? undefined,
        lastName: nameParts.slice(1).join(' ') || undefined,
        email: (r.potential_email as string | undefined) ?? undefined,
        linkedinUrl: slug ? `https://www.linkedin.com/in/${slug}` : undefined,
        companyName: (r.current_exp_company_name as string | undefined) ?? undefined,
        jobTitle: (r.headline as string | undefined) ?? undefined,
      }
    })
    .filter((l) => l.firstName ?? l.email)
}

async function searchLeads(
  spec: CampaignSpec,
  apiKey: string,
): Promise<{ leads: LemLead[]; fallbackUsed: boolean; filtersUsed: LeadsFilter[] }> {
  const transport = new StreamableHTTPClientTransport(new URL(LEMLIST_MCP_URL), {
    requestInit: { headers: { 'X-API-Key': apiKey } },
  })

  const mcp = new MCPClient({ name: 'koja-dashboard', version: '1.0' }, {})
  await mcp.connect(transport)

  try {
    const strictFilters = sanitizeFilters(spec.leadsFilters)
    const leads = await callLemleadsSearch(mcp, strictFilters)
    if (leads.length > 0) return { leads, fallbackUsed: false, filtersUsed: strictFilters }

    // Fallback: drop location + any non-essential filter, keep only country + currentTitle
    const minimalFilters = strictFilters.filter(
      (f) => f.filterId === 'country' || f.filterId === 'currentTitle',
    )
    if (minimalFilters.length === strictFilters.length) {
      return { leads: [], fallbackUsed: false, filtersUsed: strictFilters }
    }
    const fallbackLeads = await callLemleadsSearch(mcp, minimalFilters)
    return { leads: fallbackLeads, fallbackUsed: true, filtersUsed: minimalFilters }
  } finally {
    await mcp.close()
  }
}

// ── Deduplication ─────────────────────────────────────────────────────────────

async function deduplicateLeads(leads: LemLead[], apiKey: string): Promise<LemLead[]> {
  const unique: LemLead[] = []
  for (const lead of leads) {
    if (!lead.email) { unique.push(lead); continue }
    try {
      const res = await fetch(
        `${LEMLIST_API}/contacts?idsOrEmails=${encodeURIComponent(lead.email)}&limit=1`,
        { headers: { Authorization: lemlistAuth(apiKey) } },
      )
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) continue
      }
    } catch { /* keep lead on error */ }
    unique.push(lead)
  }
  return unique
}

// ── Icebreaker generation ─────────────────────────────────────────────────────

async function generateIcebreakers(
  leads: LemLead[],
  spec: CampaignSpec,
): Promise<Array<LemLead & { icebreaker: string }>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const leadList = leads
    .map((l, i) =>
      `${i + 1}. ${l.firstName ?? ''} ${l.lastName ?? ''} — ${l.jobTitle ?? 'Coach'} @ ${l.companyName ?? 'Cabinet'}`,
    )
    .join('\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: `Tu génères des icebreakers pour des emails B2B ciblant des coachs business français.

Contexte campagne : ${spec.icpDescription}.

Règles icebreaker :
- 1–2 phrases naturelles, conversationnelles, ancrées dans un fait CONCRET du parcours
- ≤30 mots
- Interdit : commencer par "Je vois que vous êtes coach" / mentionner les followers / inventer des faits
- Basé sur le titre, l'entreprise, et le contexte ICP
- Ton : direct et professionnel, pas flatteur

Output : JSON array dans le même ordre que l'input. Format : [{"icebreaker": "..."}, ...]
Ne retourner que le JSON, rien d'autre.`,
    messages: [
      {
        role: 'user',
        content: `Génère un icebreaker pour chacun de ces ${leads.length} leads :\n\n${leadList}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const icebreakers = JSON.parse(cleaned) as Array<{ icebreaker: string }>

  return leads.map((lead, i) => ({
    ...lead,
    icebreaker: icebreakers[i]?.icebreaker ?? '',
  }))
}

// ── Add leads to campaign ─────────────────────────────────────────────────────

async function addLeadsToCampaign(
  campaignId: string,
  leads: Array<LemLead & { icebreaker: string }>,
  apiKey: string,
): Promise<number> {
  let added = 0
  for (const lead of leads) {
    if (!lead.email) continue
    try {
      await lemlistPost(`/campaigns/${campaignId}/leads/${encodeURIComponent(lead.email)}`, apiKey, {
        firstName: lead.firstName ?? '',
        lastName: lead.lastName ?? '',
        companyName: lead.companyName ?? '',
        linkedinUrl: lead.linkedinUrl ?? '',
        icebreaker: lead.icebreaker,
      })
      added++
      await new Promise((r) => setTimeout(r, 200))
    } catch { /* skip failed lead */ }
  }
  return added
}

// ── Campaign log update ───────────────────────────────────────────────────────

function buildCampaignSection(spec: CampaignSpec, campaignId: string, leadsAdded: number): string {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  return `
---

### Campagne #${spec.campaignNumber} — ${spec.campaignName}

**ID Lemlist :** ${campaignId}
**Statut :** Live ▶ (créée automatiquement)
**Créée le :** ${date}
**Leads ajoutés :** ${leadsAdded}

#### Ciblage
- **Persona :** ${spec.icpDescription}
- **Zone :** ${spec.zone}
- **Domaine envoi :** clement.guiraudpro@gmail.com
- **Variation message :** ${spec.messageVariation}

#### Hypothèse testée
${spec.hypothesis}

**Raisonnement :** ${spec.rationale}

#### Résultats *(à remplir dans 2–3 semaines)*
| Métrique | Valeur | Benchmark cible |
|----------|--------|-----------------|
| Taux d'ouverture email 1 | — | >40% |
| Taux de réponse email | — | >4% |
| Taux d'acceptance LinkedIn | — | >40% |
| RDV discovery bookés | — | ≥1 |

#### Décision
- [ ] À compléter après réception des données

`
}

function updateCampaignLogContent(
  content: string,
  spec: CampaignSpec,
  campaignId: string,
  leadsAdded: number,
): string {
  let updated = content

  const overviewIdx = updated.indexOf('## Vue d\'ensemble')
  const nextSeparator = updated.indexOf('\n---\n', overviewIdx)
  if (overviewIdx !== -1 && nextSeparator !== -1) {
    const section = updated.slice(overviewIdx, nextSeparator)
    const rows = section.split('\n').filter((l) => /^\| \d+/.test(l))
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1]
      const lastRowPos = updated.lastIndexOf(lastRow, nextSeparator)
      const insertAt = lastRowPos + lastRow.length
      const newRow = `\n| ${spec.campaignNumber} | ${spec.campaignName} | Live ▶ (auto) | ${leadsAdded} | — | — | — | — |`
      updated = updated.slice(0, insertAt) + newRow + updated.slice(insertAt)
    }
  }

  const learningsMarker = '\n## Learnings cumulés'
  const newSection = buildCampaignSection(spec, campaignId, leadsAdded)
  if (updated.includes(learningsMarker)) {
    updated = updated.replace(learningsMarker, newSection + '\n## Learnings cumulés')
  } else {
    updated += newSection
  }

  return updated
}

// ── Summary email ─────────────────────────────────────────────────────────────

function buildSummaryHtml(spec: CampaignSpec, campaignId: string, leadsAdded: number): string {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  return `
<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#171717;font-size:15px;line-height:1.6;">
  <h2 style="font-size:20px;font-weight:600;margin-bottom:4px;">Campagne lancée ▶</h2>
  <p style="color:#737373;margin-top:0;font-size:13px;">Koj²a Outbound — ${date}</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;">
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
    <tr><td style="padding:6px 0;color:#737373;width:160px;vertical-align:top;">Campagne</td><td style="padding:6px 0;"><strong>${spec.campaignName}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#737373;vertical-align:top;">ID Lemlist</td><td style="padding:6px 0;"><a href="https://app.lemlist.com/campaign/${campaignId}" style="color:#4f46e5;">${campaignId}</a></td></tr>
    <tr><td style="padding:6px 0;color:#737373;vertical-align:top;">Leads ajoutés</td><td style="padding:6px 0;"><strong>${leadsAdded}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#737373;vertical-align:top;">Hypothèse</td><td style="padding:6px 0;">${spec.hypothesis}</td></tr>
    <tr><td style="padding:6px 0;color:#737373;vertical-align:top;">ICP ciblé</td><td style="padding:6px 0;">${spec.icpDescription}</td></tr>
    <tr><td style="padding:6px 0;color:#737373;vertical-align:top;">Zone</td><td style="padding:6px 0;">${spec.zone}</td></tr>
    <tr><td style="padding:6px 0;color:#737373;vertical-align:top;">Variation</td><td style="padding:6px 0;">${spec.messageVariation}</td></tr>
  </table>
  <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin-bottom:20px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;">Pourquoi cette hypothèse ?</p>
    <p style="margin:0;font-size:14px;color:#404040;">${spec.rationale}</p>
  </div>
  <a href="https://app.lemlist.com/campaign/${campaignId}" style="display:inline-block;padding:10px 20px;background:#171717;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">Ouvrir dans Lemlist →</a>
</div>
`
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST() {
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  async function send(data: Record<string, unknown>) {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    } catch { /* writer closed */ }
  }

  ;(async () => {
    try {
      const account = getAccount('clement')
      const apiKey = account?.apiKey()
      if (!apiKey) throw new Error('LEMLIST_API_KEY not configured')

      // 1. Read campaign log
      await send({ step: 'reading_log', label: 'Lecture du journal de campagne…' })
      const supabase = await createServiceClient()
      const { data: doc, error: docErr } = await supabase
        .from('documents')
        .select('content')
        .eq('id', 'campaign-log')
        .single()
      if (docErr || !doc?.content) throw new Error('Campaign log not found in Supabase')

      // 2. Generate spec
      await send({ step: 'generating_spec', label: 'Analyse du journal et génération de la prochaine campagne…' })
      const spec = await generateCampaignSpec(doc.content)
      await send({ step: 'spec_done', label: `Campagne #${spec.campaignNumber} : ${spec.campaignName}` })

      // 3. Create campaign in Lemlist
      await send({ step: 'creating_campaign', label: 'Création de la campagne dans Lemlist…' })
      const camp = await lemlistPost('/campaigns', apiKey, {
        name: spec.campaignName,
        timezone: 'Europe/Paris',
      })
      const campaignId = camp._id as string

      // 4. Get sequence ID (not in creation response — must fetch separately)
      const seqData = await lemlistGet(`/campaigns/${campaignId}/sequences`, apiKey)
      const sequenceId = Object.keys(seqData)[0]
      if (!sequenceId) throw new Error('No sequence found for campaign')

      // 5. Build 5-step sequence
      await lemlistPost(`/sequences/${sequenceId}/steps`, apiKey, {
        type: 'email', delay: 0,
        subject: spec.email1Subject,
        message: textToHtml(spec.email1Body),
      })
      await lemlistPost(`/sequences/${sequenceId}/steps`, apiKey, {
        type: 'linkedinInvite', delay: 3,
        message: spec.linkedinNote,
      })
      await lemlistPost(`/sequences/${sequenceId}/steps`, apiKey, {
        type: 'email', delay: 3,
        subject: spec.email2Subject,
        message: textToHtml(spec.email2Body),
      })
      const conditional = await lemlistPost(`/sequences/${sequenceId}/steps`, apiKey, {
        type: 'conditional', delay: 2,
        conditionKey: 'linkedinInviteAccepted',
        delayType: 'waitUntil',
      })

      type Condition = { sequenceId: string; fallback?: boolean }
      const conditions = (conditional.conditions as Condition[]) ?? []
      const yesSeqId = conditions.find((c) => !c.fallback)?.sequenceId
      const noSeqId = conditions.find((c) => c.fallback)?.sequenceId

      if (yesSeqId) {
        await lemlistPost(`/sequences/${yesSeqId}/steps`, apiKey, {
          type: 'linkedinSend', delay: 0, message: spec.linkedinStep4Message,
        })
        await lemlistPost(`/sequences/${yesSeqId}/steps`, apiKey, {
          type: 'email', delay: 3,
          subject: spec.emailBreakupSubject,
          message: textToHtml(spec.emailBreakupBody),
        })
      }
      if (noSeqId) {
        await lemlistPost(`/sequences/${noSeqId}/steps`, apiKey, {
          type: 'email', delay: 3,
          subject: spec.emailBreakupSubject,
          message: textToHtml(spec.emailBreakupBody),
        })
      }
      await send({ step: 'campaign_created', label: 'Structure créée (5 étapes)' })

      // 6. Search leads
      await send({ step: 'searching_leads', label: `Recherche leads (${spec.icpDescription})…` })
      let rawLeads: LemLead[] = []
      try {
        const { leads, fallbackUsed, filtersUsed } = await searchLeads(spec, apiKey)
        rawLeads = leads
        const filterSummary = filtersUsed.map((f) => `${f.filterId}:[${f.in.join(',')}]`).join(' ')
        const fallbackNote = fallbackUsed ? ' (fallback: filtres géo supprimés)' : ''
        await send({ step: 'leads_found', label: `${rawLeads.length} leads trouvés${fallbackNote} — ${filterSummary}` })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'erreur'
        await send({ step: 'leads_warning', label: `⚠ Recherche leads échouée : ${msg.slice(0, 120)}` })
      }

      // 7. Deduplicate
      let uniqueLeads = rawLeads
      if (rawLeads.length > 0) {
        await send({ step: 'deduplicating', label: 'Déduplication…' })
        uniqueLeads = await deduplicateLeads(rawLeads, apiKey)
        const excluded = rawLeads.length - uniqueLeads.length
        await send({
          step: 'dedup_done',
          label: `${uniqueLeads.length} leads uniques${excluded > 0 ? ` (${excluded} doublons exclus)` : ''}`,
        })
      }

      // 8. Generate icebreakers
      let leadsWithIcebreakers: Array<LemLead & { icebreaker: string }> = []
      if (uniqueLeads.length > 0) {
        await send({ step: 'generating_icebreakers', label: `Génération des icebreakers (${uniqueLeads.length} leads)…` })
        leadsWithIcebreakers = await generateIcebreakers(uniqueLeads, spec)
        await send({ step: 'icebreakers_done', label: 'Icebreakers générés' })
      }

      // 9. Add leads to campaign
      let leadsAdded = 0
      if (leadsWithIcebreakers.length > 0) {
        await send({ step: 'adding_leads', label: `Ajout des leads dans Lemlist…` })
        leadsAdded = await addLeadsToCampaign(campaignId, leadsWithIcebreakers, apiKey)
        await send({ step: 'leads_added', label: `${leadsAdded} leads ajoutés à la campagne` })
      }

      // 10. Activate campaign (live — only if leads were added)
      if (leadsAdded > 0) {
        await send({ step: 'activating', label: 'Activation de la campagne…' })
        await lemlistPost(`/campaigns/${campaignId}/start`, apiKey, {})
        await send({ step: 'campaign_live', label: '✓ Campagne activée (live)' })
      } else {
        await send({ step: 'campaign_live', label: '⚠ Campagne créée en pause (aucun lead ajouté)' })
      }

      // 11. Update campaign log in Supabase
      const updatedContent = updateCampaignLogContent(doc.content, spec, campaignId, leadsAdded)
      await supabase
        .from('documents')
        .update({ content: updatedContent })
        .eq('id', 'campaign-log')

      // 12. Send summary email
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      })
      await transporter.sendMail({
        from: `Koj²a <${process.env.GMAIL_USER}>`,
        to: SUMMARY_RECIPIENT,
        subject: `Koj²a — Campagne lancée : ${spec.campaignName} (${leadsAdded} leads)`,
        html: buildSummaryHtml(spec, campaignId, leadsAdded),
      })

      await send({
        step: 'done', ok: true,
        campaignId,
        campaignName: spec.campaignName,
        hypothesis: spec.hypothesis,
        rationale: spec.rationale,
        leadsAdded,
        lemlistUrl: `https://app.lemlist.com/campaign/${campaignId}`,
      })
    } catch (err) {
      console.error('[campaign-auto]', err)
      await send({ step: 'error', error: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

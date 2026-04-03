import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type CampaignSuggestions = {
  coachSpecialty: string
  targetAudience: string
  clientPainPoints: string
  results: string
  context: string
}

/**
 * GET /api/leads/[id]/research/suggestions
 *
 * Takes the latest lead_research record and uses Claude (no tools, fast)
 * to infer form-ready suggestions for the campaign builder:
 * - coachSpecialty, targetAudience: who they are / who they serve
 * - clientPainPoints: what problems THIS COACH solves FOR HIS CLIENTS
 * - results: what concrete results THIS COACH delivers to his clients
 * - context: additional context for personalization
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabase()

  // 1. Fetch latest research record for this lead
  const { data: records, error } = await supabase
    .from('lead_research')
    .select('profile_summary, icp_reason, icebreaker, sheets_row, lemlist_contact')
    .eq('lead_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!records || records.length === 0) {
    return NextResponse.json({ error: 'No research found for this lead' }, { status: 404 })
  }

  const r = records[0]
  if (!r.profile_summary) {
    return NextResponse.json({ error: 'Research has no profile summary yet' }, { status: 404 })
  }

  // 2. Also fetch lead data for extra context
  const { data: lead } = await supabase
    .from('leads')
    .select('first_name, last_name, company_name, city, effectif, naf_libelle')
    .eq('id', params.id)
    .single()

  // 3. Build context string
  const leadContext = [
    lead ? `Coach : ${lead.first_name} ${lead.last_name}${lead.company_name ? ` (${lead.company_name})` : ''}` : null,
    lead?.city ? `Basé à : ${lead.city}` : null,
    lead?.effectif ? `Effectif cabinet : ${lead.effectif}` : null,
    lead?.naf_libelle ? `Activité : ${lead.naf_libelle}` : null,
  ].filter(Boolean).join('\n')

  const sheetsContext = r.sheets_row
    ? `\n\nDonnées Google Sheets :\n${JSON.stringify(r.sheets_row, null, 2)}`
    : ''

  // 4. Fast Claude call (no tools) — pure inference
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const prompt = `Tu es un expert en marketing B2B pour coachs business. À partir du profil ci-dessous, génère des suggestions pour un campaign builder Lemlist.

IMPORTANT : Les champs "clientPainPoints" et "results" décrivent ce que LE COACH apporte À SES CLIENTS (les dirigeants qu'il accompagne), PAS ses propres caractéristiques.

${leadContext}

Profil du coach (résumé recherche IA) :
${r.profile_summary}

Analyse adéquation ICP :
${r.icp_reason ?? ''}

Accroche personnalisée :
${r.icebreaker ?? ''}
${sheetsContext}

Réponds UNIQUEMENT avec ce JSON valide (pas de markdown, pas d'explication) :
{
  "coachSpecialty": "Spécialité de coaching en 1-2 phrases courtes, basée sur son expérience réelle",
  "targetAudience": "Profil exact des clients qu'il accompagne (type d'entreprise, fonction, situation)",
  "clientPainPoints": "3-4 problèmes concrets que ses clients vivent et qu'il peut résoudre, séparés par ' / '",
  "results": "3-4 résultats tangibles et mesurables qu'il apporte à ses clients, séparés par ' / '",
  "context": "Contexte additionnel utile : méthode, certifications, ancrage géographique, réseau, positionnement distinctif"
}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? ''

  let suggestions: CampaignSuggestions
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found')
    suggestions = JSON.parse(match[0]) as CampaignSuggestions
  } catch {
    return NextResponse.json({ error: 'Failed to parse suggestions', raw: text }, { status: 500 })
  }

  return NextResponse.json(suggestions)
}

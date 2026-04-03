import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const CampaignKitSchema = z.object({
  icp: z.string().min(10),
  okrs: z.array(z.string().min(5)).min(3).max(6),
  hooks: z.array(z.string().min(10)).min(4).max(4),
  linkedin: z.array(z.string().min(10)).min(3).max(3),
  emails: z.array(z.object({
    subject: z.string().min(3),
    body: z.string().min(20),
  })).min(3).max(3),
})

type CampaignKit = z.infer<typeof CampaignKitSchema>

const SYSTEM_PROMPT = `Tu es un expert en prospection B2B et copywriting pour coachs business indépendants.
Output ONLY valid JSON. No markdown, no commentary — just the raw JSON object.
Start with { and end with }. Nothing else.

FORMULE COPYWRITING OBLIGATOIRE pour tous les emails et messages LinkedIn :
1. PERSONNALISATION — 1-2 phrases ancrées dans la situation spécifique du prospect (son actualité, son contexte, ce qu'il vit)
2. QUI JE SUIS — 1 phrase de présentation du coach (nom, spécialité, expérience clé)
3. OFFRE PRÉCISE — ce que le coach propose concrètement + 1 preuve chiffrée au format "[action] → [résultat chiffré] en [X mois]"
4. CALL TO ACTION — une seule action claire et simple (pas de question ouverte, pas de liste de choix)

Cette formule s'applique à TOUS les emails et messages LinkedIn générés. Ne pas dévier.`

function buildPrompt(params: {
  coachName: string
  coachSpecialty: string
  targetAudience: string
  clientPainPoints: string
  results: string
  context: string
  docs: string
}): string {
  const docsBlock = params.docs
    ? `Here are the internal best practices and context documents to guide your output:\n---\n${params.docs}\n---\n\n`
    : ''

  return `${docsBlock}Génère un kit de campagne Lemlist complet pour ce profil de coach business :

- Coach / Cabinet : ${params.coachName}
- Spécialité : ${params.coachSpecialty}
- Audience cible (qui il coache) : ${params.targetAudience}
- Pain points adressés : ${params.clientPainPoints}
- Proof points (KPIs au format [action] → [résultat chiffré] en [X mois]) : ${params.results}
${params.context ? `- Contexte additionnel : ${params.context}` : ''}

Retourne un objet JSON avec EXACTEMENT cette structure :
{
  "icp": "Définition en 2-3 phrases du profil client idéal pour ce coach",
  "okrs": [
    "OKR 1 — résultat livré par ce coach, mesurable",
    "OKR 2",
    "OKR 3",
    "OKR 4"
  ],
  "hooks": [
    "Accroche 1 — phrase de personnalisation ancrée dans la situation du prospect, utilise {{variable}} pour les parties à personnaliser",
    "Accroche 2",
    "Accroche 3",
    "Accroche 4"
  ],
  "linkedin": [
    "Message LinkedIn 1 — OBLIGATOIRE : suivre la formule en 4 étapes (personnalisation → qui je suis → offre précise avec 1 KPI → CTA). Max 280 chars.",
    "Message LinkedIn 2",
    "Message LinkedIn 3"
  ],
  "emails": [
    {
      "subject": "Objet email 1",
      "body": "Corps email 1 — OBLIGATOIRE : suivre la formule en 4 étapes.\n\n[1 PERSONNALISATION : 1-2 phrases sur la situation spécifique du prospect avec {{variable}}]\n\n[2 QUI JE SUIS : 1 phrase de présentation]\n\n[3 OFFRE PRÉCISE : ce que je propose + 1 preuve chiffrée au format action → résultat en X mois]\n\n[4 CTA : 1 seule action claire]\n\nCordialement,\n{{sender_name}}"
    },
    {
      "subject": "Objet email 2 (relance J+5)",
      "body": "Corps email 2 — même formule, angle différent"
    },
    {
      "subject": "Objet email 3 (relance J+12)",
      "body": "Corps email 3 — même formule, dernier contact"
    }
  ]
}

Règles :
- LinkedIn : ≤280 chars, vouvoiement, suivre la formule 4 étapes de façon compressée
- Emails : 6-8 lignes max, vouvoiement, 1 seul CTA par email, suivre la formule 4 étapes
- Hooks : accroches de personnalisation réalistes avec {{placeholder}} pour les variables
- OKRs : orientés résultats mesurables (pas des tâches)
- Proof points dans l'offre : utiliser les KPIs fournis au format [action] → [résultat chiffré] en [X mois]`
}

async function attempt(prompt: string): Promise<CampaignKit> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(cleaned)
  return CampaignKitSchema.parse(parsed)
}

export async function POST(req: NextRequest) {
  try {
    const { coachName, coachSpecialty, targetAudience, clientPainPoints, results, context } =
      await req.json()

    if (!coachName || !coachSpecialty || !targetAudience || !clientPainPoints || !results) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Fetch best-practice docs from Supabase
    const supabase = await createServiceClient()
    const { data: docs } = await supabase
      .from('documents')
      .select('title, content')
      .eq('is_system', false)
      .order('sort_order')

    const docsBlock = (docs ?? [])
      .filter((d) => d.content)
      .map((d) => `# ${d.title}\n${d.content}`)
      .join('\n\n')

    const prompt = buildPrompt({
      coachName,
      coachSpecialty,
      targetAudience,
      clientPainPoints,
      results,
      context: context ?? '',
      docs: docsBlock,
    })

    let kit: CampaignKit
    try {
      kit = await attempt(prompt)
    } catch {
      // Second attempt with stricter instruction
      kit = await attempt(prompt + '\n\nCRITICAL: Start with { and end with }. Nothing else.')
    }

    return NextResponse.json(kit)
  } catch (err: unknown) {
    console.error('[campaign-builder]', err)
    const msg =
      err instanceof Error ? err.message : 'Failed to generate campaign kit'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

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

const SYSTEM_PROMPT = `Tu es un expert en outbound B2B pour coaches de dirigeants.
Output ONLY valid JSON. No markdown, no commentary — just the raw JSON object.
Start with { and end with }. Nothing else.

## CONTEXTE DU COACH
- Profil : coach indépendant, ancienne carrière terrain en entreprise
- Cible : dirigeants et managers de PME/ETI privées
- Ton : pair-à-pair, humain, jamais vendeur

## STRUCTURE OBLIGATOIRE pour TOUS les messages LinkedIn et emails (dans cet ordre) :
1. OBJET : "Question pour {{prénom}}" — ne jamais modifier
2. OPENER (1 phrase) : ancré sur un signal réel et observable lié à {{entreprise}} (recrutement, croissance, restructuration, levée de fonds, prise de poste…)
3. PROBLEM STATEMENT (1-2 phrases) : nommer la douleur du dirigeant dans cette situation — jamais la solution, jamais le mot "coaching"
4. VALUE PROP (1 phrase) : un résultat concret avec un délai chiffré, choisi parmi :
   - restructuration d'équipe → alignement et réduction des frictions en 3 mois
   - transition de poste → légitimité établie en 4 mois
   - stratégie IA → gains de productivité de 25-30% en 6 mois
   - animation de réseau → 15-20 leaders engagés en 6 mois
   Choisir le KPI le plus cohérent avec le signal détecté.
5. CTA (1 phrase) : une question ouverte + proposition de call 20 min

## RÈGLES ABSOLUES
- 60-80 mots maximum (hors objet) pour les messages LinkedIn
- Jamais le mot "coaching" ou "coach"
- Jamais de formule de politesse creuse ("je me permets de…", "j'espère que vous allez bien…")
- Jamais de lien, jamais de pièce jointe
- Toujours finir par une question, jamais une affirmation
- Ton sobre, direct, professionnel — pas d'enthousiasme excessif
- Vouvoiement systématique`

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
    "Message LinkedIn 1 — STRUCTURE OBLIGATOIRE : OPENER (1 phrase sur signal observable de {{entreprise}}) + PROBLEM STATEMENT (1-2 phrases sur la douleur, sans jamais dire 'coaching') + VALUE PROP (1 résultat chiffré parmi les 4 KPIs) + CTA (question ouverte + call 20 min). 60-80 mots max.",
    "Message LinkedIn 2 — même structure, signal différent (ex: prise de poste si le 1er utilisait recrutement)",
    "Message LinkedIn 3 — même structure, angle VALUE PROP différent"
  ],
  "emails": [
    {
      "subject": "Question pour {{prénom}}",
      "body": "Bonjour {{prénom}},\n\n[OPENER : 1 phrase ancrée sur un signal observable de {{entreprise}}]\n\n[PROBLEM STATEMENT : 1-2 phrases sur la douleur du dirigeant dans cette situation — jamais 'coaching']\n\n[VALUE PROP : 1 résultat concret avec délai chiffré]\n\n[CTA : question ouverte + call 20 min ?]\n\n[Prénom du coach]"
    },
    {
      "subject": "Question pour {{prénom}}",
      "body": "Corps email 2 — même structure OPENER/PROBLEM/VALUE PROP/CTA, signal ou angle différent. Relance J+5."
    },
    {
      "subject": "Question pour {{prénom}}",
      "body": "Corps email 3 — même structure, dernier contact. Relance J+12. Toujours finir par une question."
    }
  ]
}

Règles strictes :
- LinkedIn : 60-80 mots max (hors objet), vouvoiement, structure OPENER → PROBLEM → VALUE PROP → CTA
- Emails : 5-7 lignes max, vouvoiement, même structure, jamais "coaching" ni "je me permets de"
- Objet email TOUJOURS "Question pour {{prénom}}" — ne pas modifier
- Hooks : accroches de personnalisation réalistes avec {{placeholder}} pour les variables
- OKRs : résultats mesurables que le coach délivre (pas des tâches)
- VALUE PROP : choisir parmi les 4 KPIs prédéfinis celui qui colle le mieux au signal
- Toujours finir les messages par une question, jamais une affirmation`
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

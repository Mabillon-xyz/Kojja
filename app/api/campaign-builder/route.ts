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

## STRUCTURE OBLIGATOIRE pour le MESSAGE 1 (LinkedIn et email) :
1. "Bonjour {{firstName}},"
2. [Accroche de personnalisation — hook[0] mot pour mot, remplacer seulement les {{placeholders}}]
3. "J'ai accompagné des dirigeants dans des situations comparables : [résultat chiffré issu des proof points du coach] en [délai]."
4. "Qu'est-ce qui représente votre friction principale en ce moment — un call de 20 min pour en parler ?"

## RÈGLES ABSOLUES
- Messages LinkedIn : structure courte, 4 phrases maximum, une phrase par paragraphe (alinéa entre chaque)
- Jamais le mot "coaching" ou "coach"
- Jamais de formule de politesse creuse ("je me permets de…", "j'espère que vous allez bien…")
- Jamais de lien, jamais de pièce jointe
- Toujours finir par une question, jamais une affirmation
- Ton sobre, direct, professionnel — pas d'enthousiasme excessif
- Vouvoiement systématique`

function buildCoachPrompt(params: {
  coachName: string
  coachSpecialty: string
  targetAudience: string
  clientPainPoints: string
  results: string
  context: string
  strict?: boolean
}): string {
  return `Génère un kit de campagne Lemlist complet pour ce profil de coach business :

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
    "Accroche 1 — ancrée sur {{durationInRole}} (ex : ancienneté longue = dirigeant installé ; < 1 an = prise de poste récente) combiné à {{title}} et {{companyName}}",
    "Accroche 2 — ancrée sur {{industry}} et {{title}}, angle sectoriel ou responsabilité",
    "Accroche 3 — variation : utilise {{summary}} ou {{titleDescription}} si non vide, sinon {{companyName}} + {{location}}",
    "Accroche 4 — variation : angle différent des 3 premières, utilise {{sharedConnectionsCount}} si > 0, sinon {{title}} + {{durationInRole}}"
  ],
  "linkedin": [
    "Bonjour {{firstName}},\\n\\n[hook[0] mot pour mot]\\n\\nJ'ai accompagné des dirigeants dans des situations comparables : [résultat chiffré issu des proof points du coach] en [délai].\\n\\nQu'est-ce qui représente votre friction principale en ce moment — un call de 20 min pour en parler ?",
    "{{firstName}}, pour être concret :\\n\\n[un client dans une situation similaire] a [résultat chiffré] en [délai].\\n\\nÇa vous parlerait d'en discuter ?\\n\\nUn call de 30 min suffirait pour que vous repartiez avec 2-3 actions concrètes 😄 Je vous joins mon calendrier, n'hésitez pas à réserver un créneau : {{lien_calendrier}}",
    "Je ferme la boucle {{firstName}} 🙂\\n\\nJe peux vous envoyer une mini-checklist \\\"hygiène dirigeant\\\" (1 page) : priorités, délégation, rituels, prise de recul.\\n\\nVous préférez \\\"checklist\\\" (je l'envoie ici) ou \\\"call\\\" (30 min offert) ?\\n\\nSans réponse, je vous laisse tranquille."
  ],
  "emails": [
    {
      "subject": "Question pour {{prénom}}",
      "body": "Bonjour {{firstName}},\n\n[hook[1] mot pour mot — accroche différente de hook[0], angle ou signal différent]\n\nJ'ai accompagné des dirigeants dans des situations comparables : [résultat chiffré issu des proof points du coach] en [délai].\n\nQu'est-ce qui représente votre friction principale en ce moment — un call de 20 min pour en parler ?\n\n[Prénom du coach]"
    },
    {
      "subject": "Question pour {{prénom}}",
      "body": "Bonjour {{firstName}},\n\nPour être concret : [un client dans une situation similaire] a [résultat chiffré] en [délai].\n\nÇa vous parlerait d'en discuter ?\n\nUn call de 30 min suffirait pour que vous repartiez avec 2-3 actions concrètes 😄\n\nJe vous joins mon calendrier, n'hésitez pas à réserver un créneau : {{lien_calendrier}}\n\n[Prénom du coach]"
    },
    {
      "subject": "Question pour {{prénom}}",
      "body": "Bonjour {{firstName}},\n\nJe ferme la boucle 🙂\n\nJe peux vous envoyer une mini-checklist \"hygiène dirigeant\" (1 page) : priorités, délégation, rituels, prise de recul.\n\nVous préférez \"checklist\" (je l'envoie ici) ou \"call\" (30 min offert) ?\n\nSans réponse, je vous laisse tranquille.\n\n[Prénom du coach]"
    }
  ]
}

## VARIABLES LEMLIST DISPONIBLES — utiliser UNIQUEMENT ces {{variables}} dans les hooks
Colonnes présentes dans le CSV import :
- {{firstName}} — prénom du prospect
- {{companyName}} — nom de l'entreprise
- {{title}} — poste actuel (ex: "Président", "CEO", "Directeur général")
- {{industry}} — secteur d'activité (ex: "Fabrication de machines industrielles")
- {{durationInRole}} — ancienneté dans le poste (ex: "5 years 3 months in role")
- {{location}} — ville/région du prospect
- {{sharedConnectionsCount}} — nombre de connexions communes (peut être 0)
- {{summary}} — résumé du profil LinkedIn (peut être vide — utiliser avec précaution)
- {{titleDescription}} — description de l'entreprise (peut être vide — utiliser avec précaution)

Signaux à exploiter :
- {{durationInRole}} ≥ 5 ans → dirigeant installé, cap potentiel à franchir
- {{durationInRole}} < 1 an → prise de poste récente, légitimité à construire
- {{industry}} → tension sectorielle spécifique
- {{sharedConnectionsCount}} > 0 → mention naturelle possible
- {{summary}} / {{titleDescription}} non vide → ancrage sur le discours public du prospect

Règles strictes :
- LinkedIn message 1 : structure 4 paragraphes avec hook[0] verbatim
- Email 1 : même structure 4 paragraphes mais avec hook[1] verbatim (angle différent de hook[0])
- Ne pas ajouter de phrase entre les 4 paragraphes — rien d'autre
- LinkedIn messages 2 et 3 : suivre EXACTEMENT les structures indiquées (preuve de résultat / closing loop), ton décontracté avec émojis
- Objet email TOUJOURS "Question pour {{firstName}}" — ne pas modifier
- Hooks : n'utiliser QUE les {{variables}} listées ci-dessus — aucune autre
- OKRs : résultats mesurables que le coach délivre (pas des tâches)
- Jamais "coaching", "coach", "je me permets de", ni formule de politesse creuse${params.strict ? '\n\nCRITICAL: Start with { and end with }. Nothing else.' : ''}`
}

async function attempt(docsBlock: string, coachPrompt: string): Promise<CampaignKit> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const userContent: Anthropic.MessageParam['content'] = [
    // Docs block — stable across calls, eligible for prompt caching
    ...(docsBlock ? [{
      type: 'text' as const,
      text: `Here are the internal best practices and context documents to guide your output:\n---\n${docsBlock}\n---\n\n`,
      cache_control: { type: 'ephemeral' as const },
    }] : []),
    // Coach-specific params — variable, not cached
    { type: 'text' as const, text: coachPrompt },
  ]

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    // System prompt cached — identical on every call
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
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

    const baseParams = { coachName, coachSpecialty, targetAudience, clientPainPoints, results, context: context ?? '' }

    let kit: CampaignKit
    try {
      kit = await attempt(docsBlock, buildCoachPrompt(baseParams))
    } catch {
      // Second attempt with stricter JSON instruction
      kit = await attempt(docsBlock, buildCoachPrompt({ ...baseParams, strict: true }))
    }

    return NextResponse.json(kit)
  } catch (err: unknown) {
    console.error('[campaign-builder]', err)
    const msg =
      err instanceof Error ? err.message : 'Failed to generate campaign kit'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

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

const SYSTEM_PROMPT = `You are an expert cold outreach strategist and B2B copywriter specializing in coaching businesses.
Output ONLY valid JSON. No markdown, no commentary — just the raw JSON object.
Start with { and end with }. Nothing else.`

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

  return `${docsBlock}Generate a complete Lemlist campaign kit for this coaching business profile:

- Coach / Company: ${params.coachName}
- Coaching specialty: ${params.coachSpecialty}
- Target audience (who they coach): ${params.targetAudience}
- Pain points addressed: ${params.clientPainPoints}
- Concrete results / proof points: ${params.results}
${params.context ? `- Additional context: ${params.context}` : ''}

Return a JSON object with EXACTLY this structure:
{
  "icp": "2-3 sentence definition of the ideal client profile for this coach",
  "okrs": [
    "OKR 1 (outcome this coach delivers, measurable)",
    "OKR 2",
    "OKR 3",
    "OKR 4"
  ],
  "hooks": [
    "Personalization hook 1 — use {{variable}} for anything to customize per prospect",
    "Personalization hook 2",
    "Personalization hook 3",
    "Personalization hook 4"
  ],
  "linkedin": [
    "LinkedIn message 1 — conversational, no pitch, max 280 chars, opens a dialogue",
    "LinkedIn message 2",
    "LinkedIn message 3"
  ],
  "emails": [
    {
      "subject": "Email subject line 1",
      "body": "Email body 1 — 5-7 lines, direct, outcome-focused, one clear CTA"
    },
    {
      "subject": "Email subject line 2",
      "body": "Email body 2"
    },
    {
      "subject": "Email subject line 3",
      "body": "Email body 3"
    }
  ]
}

Rules:
- LinkedIn: conversational, no sales pitch, open a genuine dialogue, ≤280 chars
- Emails: 5-7 lines max, direct, outcome-focused, single clear CTA
- Hooks: realistic personalization angles with {{placeholder}} for variable parts
- OKRs: outcome-oriented, measurable (not task-based)
- Write in French unless the coach profile suggests otherwise`
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

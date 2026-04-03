import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const RecapSchema = z.object({
  summary: z.string().min(10),
  key_insights: z.array(z.string()).min(1).max(6),
  next_action: z.string().min(3),
  next_action_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  new_stage: z.enum(['call_done', 'proposal_sent', 'customer', 'not_interested']).optional(),
})

type RecapResult = z.infer<typeof RecapSchema>

const SYSTEM = `You are a CRM assistant for a business coach.
Analyze a call recap or transcript and extract structured information.
Output ONLY valid JSON. No markdown. Start with { end with }.`

function buildPrompt(recap: string, leadName: string): string {
  return `Lead name: ${leadName}

Call recap / transcript:
---
${recap}
---

Extract the following and return a JSON object with EXACTLY this shape:
{
  "summary": "2-3 sentence summary of what was discussed and the lead's situation",
  "key_insights": ["insight about the lead", "another insight", "..."],
  "next_action": "The most important next step to take",
  "next_action_date": "YYYY-MM-DD (when to take that action)",
  "new_stage": "call_done | proposal_sent | customer | not_interested (omit if stage is unclear)"
}

Rules:
- key_insights: 3-5 items, each a concrete observation about the lead (pain, budget, timeline, objections, motivation)
- next_action: specific and actionable (e.g. "Envoyer la proposition commerciale", "Recontacter après relecture")
- new_stage: only include if clearly implied by the recap
- Write in the same language as the recap`
}

async function extract(recap: string, leadName: string): Promise<RecapResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: 'user', content: buildPrompt(recap, leadName) }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return RecapSchema.parse(JSON.parse(cleaned))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { recap } = await req.json()
    if (!recap || typeof recap !== 'string' || recap.trim().length < 20) {
      return NextResponse.json({ error: 'Recap text is too short' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // Fetch lead
    const { data: lead } = await supabase
      .from('leads')
      .select('first_name, last_name, notes, stage')
      .eq('id', params.id)
      .single()

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const leadName = `${lead.first_name} ${lead.last_name}`

    // Extract with Claude
    let result: RecapResult
    try {
      result = await extract(recap, leadName)
    } catch {
      result = await extract(recap + '\n\nCRITICAL: Start with { end with }. Nothing else.', leadName)
    }

    // Format the notes block to append
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const insightLines = result.key_insights.map((i) => `• ${i}`).join('\n')
    const notesBlock = `[RECAP ${new Date().toISOString().slice(0, 10)}] — ${today}\n${result.summary}\n\n${insightLines}`
    const updatedNotes = lead.notes
      ? `${lead.notes}\n\n${notesBlock}`
      : notesBlock

    // Build update payload
    const updates: Record<string, unknown> = {
      notes: updatedNotes,
      next_action: result.next_action,
      next_action_date: result.next_action_date,
      updated_at: new Date().toISOString(),
    }
    if (result.new_stage && result.new_stage !== lead.stage) {
      updates.stage = result.new_stage
    }

    await supabase.from('leads').update(updates).eq('id', params.id)

    return NextResponse.json({ ...result, notes_block: notesBlock })
  } catch (err) {
    console.error('[recap]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to analyze recap' },
      { status: 500 }
    )
  }
}

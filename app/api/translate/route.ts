import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ProposalContent, ProposalLanguage } from '@/types/proposal'

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

export async function POST(req: NextRequest) {
  const { content, targetLanguage } = await req.json() as {
    content: ProposalContent
    targetLanguage: ProposalLanguage
  }

  if (!content || !targetLanguage) {
    return NextResponse.json({ error: 'Missing content or targetLanguage' }, { status: 400 })
  }

  const langName = targetLanguage === 'fr' ? 'French' : 'English'

  const toTranslate = {
    introduction: content.introduction ?? content.executiveSummary ?? '',
    challenges: content.challenges.map((c) => ({
      challenge: c.challenge,
      deliverable: c.deliverable,
    })),
    lineItemProducts: content.pricing.lineItems.map((l) => l.product),
    paymentDescriptions: content.paymentSchedule.map((p) => p.description),
    paymentDates: content.paymentSchedule.map((p) => p.date),
  }

  const prompt = `Translate the following proposal fields to ${langName}. Return ONLY a valid JSON object — no markdown, no explanation.

Input:
${JSON.stringify(toTranslate, null, 2)}

Return this exact structure with all text fields translated to ${langName}:
{
  "introduction": "...",
  "challenges": [{ "challenge": "...", "deliverable": "..." }],
  "lineItemProducts": ["..."],
  "paymentDescriptions": ["..."],
  "paymentDates": ["..."]
}`

  const message = await getClient().messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const translated = JSON.parse(cleaned)

  // Merge translated fields back into content
  const updatedContent: ProposalContent = {
    ...content,
    language: targetLanguage,
    introduction: translated.introduction,
    challenges: content.challenges.map((c, i) => ({
      ...c,
      challenge: translated.challenges[i]?.challenge ?? c.challenge,
      deliverable: translated.challenges[i]?.deliverable ?? c.deliverable,
    })),
    pricing: {
      ...content.pricing,
      lineItems: content.pricing.lineItems.map((l, i) => ({
        ...l,
        product: translated.lineItemProducts[i] ?? l.product,
      })),
    },
    paymentSchedule: content.paymentSchedule.map((p, i) => ({
      ...p,
      description: translated.paymentDescriptions[i] ?? p.description,
      date: translated.paymentDates[i] ?? p.date,
    })),
  }

  return NextResponse.json({ content: updatedContent })
}

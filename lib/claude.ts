import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { ProposalContent } from '@/types/proposal'

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

const ProposalContentSchema = z.object({
  introduction: z.string().min(1),
  challenges: z.array(z.object({
    challenge: z.string(),
    deliverable: z.string(),
  })).min(1).max(4),
  pricing: z.object({
    lineItems: z.array(z.object({
      product: z.string(),
      price: z.number(),
      quantity: z.number(),
      total: z.number(),
    })).min(1),
    subtotal: z.number(),
    tax: z.number().optional(),
    total: z.number(),
  }),
  paymentSchedule: z.array(z.object({
    date: z.string(),
    amount: z.number(),
    description: z.string(),
  })).min(1),
})

const SYSTEM_PROMPT = `You are a professional business proposal writer. Output ONLY valid JSON. No markdown, no commentary — just the raw JSON object.

Be concise and direct. Every sentence must earn its place.`

function buildPrompt(params: {
  description: string
  clientName: string
  clientCompany: string
  senderName: string
  senderCompany: string
  price: number
  currency: string
}) {
  const currencySymbol = params.currency === 'usd' ? '$' : params.currency === 'eur' ? '€' : params.currency.toUpperCase()

  return `Generate a concise sales proposal for:

Client: ${params.clientName} at ${params.clientCompany}
Sender: ${params.senderName} at ${params.senderCompany}
Total: ${currencySymbol}${params.price.toLocaleString()} ${params.currency.toUpperCase()}

Project:
${params.description}

Return a JSON object with EXACTLY this structure:
{
  "introduction": "3-4 sentences max. Warm opening, what you're proposing, and your key differentiator. Be specific to their company and context.",
  "challenges": [
    { "challenge": "one specific client need or pain point", "deliverable": "one concrete output that addresses it" }
  ],
  "pricing": {
    "lineItems": [
      { "product": "service name", "price": 0, "quantity": 1, "total": 0 }
    ],
    "subtotal": 0,
    "total": ${params.price}
  },
  "paymentSchedule": [
    { "date": "Upon signing", "amount": ${params.price * 0.5}, "description": "50% deposit" },
    { "date": "Upon delivery", "amount": ${params.price * 0.5}, "description": "Balance on completion" }
  ]
}

Rules:
- introduction: 3-4 sentences only, no fluff
- challenges: 2-3 items. Short and punchy — one pain point, one deliverable per row.
- pricing: 1 line item is perfectly fine for a flat fee. Use 2-3 items only if the work has distinct phases. Total must equal exactly ${params.price}. All amounts must be numbers.
- paymentSchedule: 1-2 milestones. Keep simple.`
}

export async function generateProposalContent(params: {
  description: string
  clientName: string
  clientCompany: string
  senderName: string
  senderCompany: string
  price: number
  currency: string
}): Promise<ProposalContent> {
  const attempt = async (prompt: string): Promise<ProposalContent> => {
    const message = await getClient().messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return ProposalContentSchema.parse(parsed) as ProposalContent
  }

  try {
    return await attempt(buildPrompt(params))
  } catch {
    const strictPrompt = buildPrompt(params) + '\n\nCRITICAL: Start with { and end with }. Nothing else.'
    return await attempt(strictPrompt)
  }
}

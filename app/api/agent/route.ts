import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
]

async function loadDocs(): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('documents')
    .select('title, content')
    .order('sort_order', { ascending: true })

  if (!data?.length) return ''

  return data
    .map((doc) => `## ${doc.title}\n\n${doc.content}`)
    .join('\n\n---\n\n')
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const { messages, model } = await req.json()

  if (!messages?.length) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  const selectedModel = MODELS.includes(model) ? model : 'claude-sonnet-4-6'

  const docs = await loadDocs()
  const systemPrompt = `You are an expert assistant for Koj²a, a business development and sales coaching platform.
${docs ? `\nYou have access to the following internal documentation. Use it to answer questions accurately.\n\n--- DOCUMENTATION ---\n${docs}\n--- END DOCUMENTATION ---\n` : ''}
Be concise, direct, and helpful. Answer in the same language as the user's message.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const stream = client.messages.stream({
    model: selectedModel,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no',
    },
  })
}

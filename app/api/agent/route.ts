import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
]

const WEB_SEARCH_TOOL: Anthropic.Tool = {
  name: 'web_search',
  description:
    'Search the internet for current information, news, recent events, data, prices, or anything that requires up-to-date knowledge. Use this whenever you need real-time or recent information.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web',
      },
    },
    required: ['query'],
  },
}

async function parallelSearch(query: string): Promise<string> {
  const apiKey = process.env.PARALLEL_API_KEY
  if (!apiKey) return 'Web search is not configured (missing PARALLEL_API_KEY).'

  try {
    const response = await fetch('https://api.parallel.ai/v1beta/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ query }),
    })

    if (!response.ok) {
      return `Search failed: ${response.status} ${response.statusText}`
    }

    const data = await response.json()

    // Handle various Parallel API response shapes
    if (Array.isArray(data?.results) && data.results.length > 0) {
      return data.results
        .slice(0, 5)
        .map(
          (r: { title?: string; url?: string; snippet?: string; content?: string }) =>
            `**${r.title ?? 'Result'}**\n${r.url ?? ''}\n${r.snippet ?? r.content ?? ''}`
        )
        .join('\n\n')
    }

    if (Array.isArray(data) && data.length > 0) {
      return data
        .slice(0, 5)
        .map(
          (r: { title?: string; url?: string; snippet?: string; content?: string }) =>
            `**${r.title ?? 'Result'}**\n${r.url ?? ''}\n${r.snippet ?? r.content ?? ''}`
        )
        .join('\n\n')
    }

    if (typeof data?.answer === 'string') return data.answer
    if (typeof data?.text === 'string') return data.text
    if (typeof data === 'string') return data

    return JSON.stringify(data)
  } catch (err) {
    return `Search error: ${err instanceof Error ? err.message : 'unknown error'}`
  }
}

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
You have access to a web_search tool. Use it proactively whenever you need current information, recent news, or data you might not have. Do not hesitate to search — it's always available.
Be concise, direct, and helpful. Answer in the same language as the user's message.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Agentic tool-use loop (non-streaming) until all tool calls are resolved
  let currentMessages = [...messages] as Anthropic.MessageParam[]

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.messages.create({
      model: selectedModel,
      max_tokens: 4096,
      system: systemPrompt,
      tools: [WEB_SEARCH_TOOL],
      messages: currentMessages,
    })

    if (response.stop_reason !== 'tool_use') {
      // Final response — stream the accumulated text
      const finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')

      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(finalText))
          controller.close()
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

    // Execute tool calls in parallel
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        if (block.name === 'web_search') {
          const input = block.input as { query: string }
          const result = await parallelSearch(input.query)
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: result,
          }
        }
        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: 'Unknown tool.',
        }
      })
    )

    // Add assistant turn + tool results, then loop
    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ]
  }
}

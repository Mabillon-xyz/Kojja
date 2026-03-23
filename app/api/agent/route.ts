import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
]

// ─── Tool definitions ───────────────────────────────────────────────────────

const WEB_SEARCH_TOOL: Anthropic.Tool = {
  name: 'web_search',
  description:
    'Search the internet for current information, news, recent events, data, prices, or anything that requires up-to-date knowledge. Use this whenever you need real-time or recent information.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'The search query to look up on the web' },
    },
    required: ['query'],
  },
}

const QUERY_DATABASE_TOOL: Anthropic.Tool = {
  name: 'query_database',
  description:
    'Query the Koja app Supabase database (read-only SELECT). Use this to look up leads, email logs, automations, conversations, documents, settings, or webhook events.',
  input_schema: {
    type: 'object' as const,
    properties: {
      table: {
        type: 'string',
        enum: ['leads', 'documents', 'email_logs', 'automations', 'scheduled_emails', 'webhook_events', 'agent_conversations', 'settings'],
        description: 'Table to query',
      },
      select: {
        type: 'string',
        description: 'Comma-separated columns to return. Default: *',
      },
      filters: {
        type: 'object',
        description: 'Key-value equality filters, e.g. { "stage": "prospect" }',
      },
      limit: {
        type: 'number',
        description: 'Max rows to return (default 50, max 200)',
      },
      order: {
        type: 'object',
        properties: {
          column: { type: 'string' },
          ascending: { type: 'boolean' },
        },
        required: ['column'],
        description: 'Sort order',
      },
    },
    required: ['table'],
  },
}

const DB_SCHEMA = `
Database tables (read-only access via query_database tool):

- leads: id, first_name, last_name, email, comment, linkedin_url, stage, call_date, call_booked_at, next_action_date, notes
- documents: id, title, emoji, content, last_updated, is_system, sort_order
- email_logs: to_email, subject, status, error, source, sent_at
- automations: id, enabled, trigger, name, created_at
- scheduled_emails: id, automation_id, send_at, to_email, subject, body, sent_at, sent, error
- webhook_events: id, created_at, source, workflow, leads_count, payload
- agent_conversations: id, title, model, created_at, updated_at, messages
- settings: key, value
`.trim()

// ─── Tool implementations ────────────────────────────────────────────────────

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
      body: JSON.stringify({
        objective: query,
        search_queries: [query],
        mode: 'fast',
        excerpts: { max_chars_per_result: 2000 },
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      return `Search failed: ${response.status} ${response.statusText}${errText ? ` — ${errText}` : ''}`
    }

    const data = await response.json()

    type ParallelResult = {
      title?: string
      url?: string
      excerpts?: { text?: string }[]
      snippet?: string
      content?: string
    }

    const results: ParallelResult[] =
      data?.results ?? (Array.isArray(data) ? data : [])

    if (results.length > 0) {
      return results
        .slice(0, 5)
        .map((r) => {
          const excerpt = r.excerpts?.[0]?.text ?? r.snippet ?? r.content ?? ''
          return `**${r.title ?? 'Result'}**\n${r.url ?? ''}\n${excerpt}`
        })
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

type QueryInput = {
  table: string
  select?: string
  filters?: Record<string, unknown>
  limit?: number
  order?: { column: string; ascending?: boolean }
}

async function queryDatabase(input: QueryInput): Promise<string> {
  const ALLOWED_TABLES = [
    'leads', 'documents', 'email_logs', 'automations',
    'scheduled_emails', 'webhook_events', 'agent_conversations', 'settings',
  ]

  if (!ALLOWED_TABLES.includes(input.table)) {
    return `Table "${input.table}" is not allowed. Available: ${ALLOWED_TABLES.join(', ')}`
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = supabase
      .from(input.table)
      .select(input.select ?? '*')

    if (input.filters) {
      for (const [col, val] of Object.entries(input.filters)) {
        query = query.eq(col, val)
      }
    }

    if (input.order) {
      query = query.order(input.order.column, { ascending: input.order.ascending ?? true })
    }

    query = query.limit(Math.min(input.limit ?? 50, 200))

    const { data, error } = await query

    if (error) return `Query error: ${error.message}`
    if (!data?.length) return `No rows found in ${input.table}.`

    return JSON.stringify(data, null, 2)
  } catch (err) {
    return `Database error: ${err instanceof Error ? err.message : 'unknown error'}`
  }
}

// ─── Docs loader ─────────────────────────────────────────────────────────────

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

// ─── Route handler ────────────────────────────────────────────────────────────

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
You have access to two tools:
- web_search: search the internet for current or external information
- query_database: read the live Koja database (SELECT only)

${DB_SCHEMA}

Use query_database whenever the user asks about leads, emails, automations, or any data in the app. Use web_search for external or real-time information.
Be concise, direct, and helpful. Answer in the same language as the user's message.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let currentMessages = [...messages] as Anthropic.MessageParam[]
  let totalTokens = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.messages.create({
      model: selectedModel,
      max_tokens: 4096,
      system: systemPrompt,
      tools: [WEB_SEARCH_TOOL, QUERY_DATABASE_TOOL],
      messages: currentMessages,
    })

    totalTokens += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

    if (response.stop_reason !== 'tool_use') {
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
          'X-Tokens-Used': String(totalTokens),
          'Access-Control-Expose-Headers': 'X-Tokens-Used',
        },
      })
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        let result: string

        if (block.name === 'web_search') {
          result = await parallelSearch((block.input as { query: string }).query)
        } else if (block.name === 'query_database') {
          result = await queryDatabase(block.input as QueryInput)
        } else {
          result = 'Unknown tool.'
        }

        return { type: 'tool_result' as const, tool_use_id: block.id, content: result }
      })
    )

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ]
  }
}

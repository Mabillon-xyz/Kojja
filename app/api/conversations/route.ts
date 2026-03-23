import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('agent_conversations')
    .select('id, title, model, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { title, model, messages } = await req.json()
  if (!messages) return NextResponse.json({ error: 'messages required' }, { status: 400 })

  const { data, error } = await supabase
    .from('agent_conversations')
    .insert({ title: title ?? 'New conversation', model: model ?? 'claude-sonnet-4-6', messages })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const KEYS = ['claude:memory', 'claude:context', 'claude:agents', 'claude:skills'] as const

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', KEYS)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result: Record<string, string> = {
    memory: '',
    context: '',
    agents: '',
    skills: '',
  }

  for (const row of data ?? []) {
    const tab = row.key.replace('claude:', '') as keyof typeof result
    result[tab] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value, null, 2)
  }

  return NextResponse.json(result)
}

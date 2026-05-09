import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const KEYS = ['claude:memory', 'claude:context', 'claude:agents', 'claude:skills'] as const

export async function GET() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
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

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const deleteId = searchParams.get('deleteId')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const result: Record<string, unknown> = {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: url ? `${url.slice(0, 35)}...` : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: serviceKey
        ? `set — ${serviceKey.length} chars — starts with: ${serviceKey.slice(0, 12)}...`
        : 'MISSING ⚠️',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? `set — ${anonKey.length} chars` : 'MISSING',
    },
  }

  if (!url || !serviceKey) {
    return NextResponse.json({ ...result, fatal: 'Missing env vars — delete will fail' })
  }

  const supabase = createClient(url, serviceKey)

  // Count leads
  const { count, error: countError } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
  result.leadCount = countError ? `ERROR: ${countError.message}` : count

  // Sample leads (id + name)
  const { data: sample, error: sampleError } = await supabase
    .from('leads')
    .select('id, first_name, last_name, email')
    .limit(5)
  result.sampleLeads = sampleError ? `ERROR: ${sampleError.message}` : sample

  // Attempt delete if deleteId provided
  if (deleteId) {
    const { error: delError } = await supabase.from('leads').delete().eq('id', deleteId)
    result.deleteTest = {
      id: deleteId,
      success: !delError,
      error: delError?.message ?? null,
    }
  }

  return NextResponse.json(result, { status: 200 })
}

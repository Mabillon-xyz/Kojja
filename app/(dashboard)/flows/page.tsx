import { createClient } from '@/lib/supabase/server'
import FlowsList, { type WebhookEvent } from '@/components/flows/FlowsList'

export default async function FlowsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('webhook_events')
    .select('id, created_at, source, workflow, leads_count, payload')
    .order('created_at', { ascending: false })
    .limit(100)

  return <FlowsList events={(data ?? []) as WebhookEvent[]} />
}

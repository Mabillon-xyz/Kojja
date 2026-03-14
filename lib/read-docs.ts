import { createClient } from '@/lib/supabase/server'

export interface DocSection {
  id: string
  title: string
  emoji: string
  lastUpdated: string
  content: string
  isSystem: boolean
  sortOrder: number
}

export async function readDocs(): Promise<DocSection[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, emoji, content, last_updated, is_system, sort_order')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`readDocs: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    content: row.content,
    lastUpdated: row.last_updated,
    isSystem: row.is_system,
    sortOrder: row.sort_order,
  }))
}

export async function readDoc(id: string): Promise<DocSection | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, emoji, content, last_updated, is_system, sort_order')
    .eq('id', id)
    .single()

  if (error) return null

  return {
    id: data.id,
    title: data.title,
    emoji: data.emoji,
    content: data.content,
    lastUpdated: data.last_updated,
    isSystem: data.is_system,
    sortOrder: data.sort_order,
  }
}

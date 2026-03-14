'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50)
}

function nowFr(): string {
  return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export async function createDocument(formData: FormData) {
  const title = (formData.get('title') as string)?.trim() || 'Sans titre'
  const emoji = (formData.get('emoji') as string)?.trim() || '📄'
  const supabase = await createClient()

  const baseSlug = slugify(title) || `note-${Date.now()}`

  // Get next sort_order and ensure unique id
  const { data: existing } = await supabase
    .from('documents')
    .select('id, sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1

  const { data: idCheck } = await supabase
    .from('documents')
    .select('id')
    .eq('id', baseSlug)
    .maybeSingle()

  const id = idCheck ? `${baseSlug}-${Date.now()}` : baseSlug

  await supabase.from('documents').insert({
    id,
    title,
    emoji,
    content: '',
    last_updated: nowFr(),
    sort_order: nextOrder,
    is_system: false,
  })

  revalidatePath('/documentation')
  redirect(`/documentation/${id}?edit=1`)
}

export async function updateDocument(id: string, title: string, emoji: string, content: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('documents')
    .update({
      title,
      emoji,
      content,
      last_updated: nowFr(),
    })
    .eq('id', id)

  if (error) throw new Error(`updateDocument: ${error.message}`)

  revalidatePath('/documentation')
  revalidatePath(`/documentation/${id}`)
}

export async function deleteDocument(id: string) {
  const supabase = await createClient()
  await supabase.from('documents').delete().eq('id', id)
  revalidatePath('/documentation')
  redirect('/documentation')
}

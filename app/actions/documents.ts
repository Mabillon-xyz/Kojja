'use server'
import fs from 'fs'
import path from 'path'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const DOCS_DIR = path.join(process.cwd(), 'content', 'koja2')

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

function findFile(id: string): string | null {
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))
  for (const file of files) {
    const raw = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8')
    const m = raw.match(/^id:\s*(.+)$/m)
    if (m && m[1].trim() === id) return file
  }
  return null
}

export async function createDocument(formData: FormData) {
  const title = (formData.get('title') as string)?.trim() || 'Sans titre'
  const emoji = (formData.get('emoji') as string)?.trim() || '📄'

  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))
  const nextNum = files.length + 1
  const baseSlug = slugify(title) || `note-${Date.now()}`

  // Ensure unique id
  const existingIds = files.map((f) => {
    const raw = fs.readFileSync(path.join(DOCS_DIR, f), 'utf-8')
    const m = raw.match(/^id:\s*(.+)$/m)
    return m ? m[1].trim() : ''
  })
  let id = baseSlug
  let suffix = 2
  while (existingIds.includes(id)) {
    id = `${baseSlug}-${suffix++}`
  }

  const filename = `${String(nextNum).padStart(2, '0')}-${id}.md`
  const content = `---\nid: ${id}\ntitle: ${title}\nemoji: ${emoji}\nlastUpdated: ${nowFr()}\n---\n\n`
  fs.writeFileSync(path.join(DOCS_DIR, filename), content)

  revalidatePath('/documentation')
  redirect(`/documentation/${id}?edit=1`)
}

export async function updateDocument(id: string, title: string, emoji: string, content: string) {
  const file = findFile(id)
  if (!file) throw new Error(`Document introuvable : ${id}`)

  const frontmatter = `---\nid: ${id}\ntitle: ${title}\nemoji: ${emoji}\nlastUpdated: ${nowFr()}\n---\n\n`
  fs.writeFileSync(path.join(DOCS_DIR, file), frontmatter + content)

  revalidatePath('/documentation')
  revalidatePath(`/documentation/${id}`)
}

export async function deleteDocument(id: string) {
  const file = findFile(id)
  if (!file) return
  fs.unlinkSync(path.join(DOCS_DIR, file))
  revalidatePath('/documentation')
  redirect('/documentation')
}

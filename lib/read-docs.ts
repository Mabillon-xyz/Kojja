import fs from 'fs'
import path from 'path'

export interface DocSection {
  id: string
  title: string
  emoji: string
  lastUpdated: string
  content: string
  filename: string
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, content: raw }

  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(': ')
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 2).trim()
      meta[key] = value
    }
  }

  return { meta, content: match[2].trimStart() }
}

export function readDocs(dir = 'koja2'): DocSection[] {
  const docsDir = path.join(process.cwd(), 'content', dir)
  const files = fs
    .readdirSync(docsDir)
    .filter((f) => f.endsWith('.md'))
    .sort()

  return files.map((filename) => {
    const raw = fs.readFileSync(path.join(docsDir, filename), 'utf-8')
    const { meta, content } = parseFrontmatter(raw)
    return {
      id: meta.id ?? filename.replace('.md', ''),
      title: meta.title ?? filename,
      emoji: meta.emoji ?? '📄',
      lastUpdated: meta.lastUpdated ?? '',
      content,
      filename,
    }
  })
}

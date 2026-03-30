#!/usr/bin/env node
/**
 * sync-docs.mjs
 * Lit tous les fichiers .md de content/koja2/ et les upsert dans Supabase.
 * À lancer après chaque modification stratégique.
 *
 * Usage : node scripts/sync-docs.mjs
 */

// Local dev: bypass TLS cert issues (system proxy/VPN intercepts)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// ── Load .env.local ─────────────────────────────────────────────────────────
const envFile = path.join(ROOT, '.env.local')
const env = fs.readFileSync(envFile, 'utf-8').split('\n').reduce((acc, line) => {
  const idx = line.indexOf('=')
  if (idx > 0) acc[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
  return acc
}, {})

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Parse frontmatter ────────────────────────────────────────────────────────
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, content: raw }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(': ')
    if (idx !== -1) meta[line.slice(0, idx).trim()] = line.slice(idx + 2).trim()
  }
  return { meta, content: match[2].trimStart() }
}

// ── Sync ─────────────────────────────────────────────────────────────────────
const docsDir = path.join(ROOT, 'content', 'koja2')
const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md')).sort()

console.log(`\n📚 Syncing ${files.length} documents → Supabase\n`)

let ok = 0
for (const file of files) {
  const raw = fs.readFileSync(path.join(docsDir, file), 'utf-8')
  const { meta, content } = parseFrontmatter(raw)
  const sortOrder = parseInt(file.split('-')[0]) || 99

  const { error } = await supabase.from('documents').upsert(
    {
      id: meta.id,
      title: meta.title,
      emoji: meta.emoji,
      content,
      last_updated: meta.lastUpdated ?? '',
      sort_order: sortOrder,
      is_system: true,
      tag: meta.tag ?? null,
    },
    { onConflict: 'id' }
  )

  if (error) {
    console.error(`  ❌ ${meta.id} — ${error.message}`)
  } else {
    console.log(`  ✅ ${meta.id} — ${meta.title}`)
    ok++
  }
}

console.log(`\n${ok}/${files.length} documents synchronisés.\n`)

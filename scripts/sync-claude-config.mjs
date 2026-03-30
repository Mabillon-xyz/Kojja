#!/usr/bin/env node
/**
 * sync-claude-config.mjs
 * Reads Claude Code config files (MEMORY.md, CLAUDE.md) and upserts
 * their content into the Supabase settings table as claude:* keys.
 *
 * Usage: node scripts/sync-claude-config.mjs
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

// ── File paths ────────────────────────────────────────────────────────────────
const HOME = process.env.HOME || '/Users/Clement.GUIRAUD'
const PATHS = {
  memory:  `${HOME}/.claude/projects/-Users-Clement-GUIRAUD-Desktop-Claude-Product-koja2/memory/MEMORY.md`,
  globalClaude: `${HOME}/.claude/CLAUDE.md`,
  workspaceClaude: `${HOME}/Desktop/Claude/.claude/CLAUDE.md`,
  productClaude:  `${HOME}/Desktop/Claude/Product/.claude/CLAUDE.md`,
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf-8') }
  catch { return null }
}

// ── Extract sections ─────────────────────────────────────────────────────────
function extractSection(content, heading) {
  const re = new RegExp(`(##+ ${heading}[\\s\\S]*?)(?=\\n## |$)`, 'i')
  const m = content.match(re)
  return m ? m[1].trim() : null
}

// ── Build content for each tab ───────────────────────────────────────────────
const workspaceClaude = readFile(PATHS.workspaceClaude) ?? ''
const productClaude   = readFile(PATHS.productClaude)   ?? ''
const globalClaude    = readFile(PATHS.globalClaude)    ?? ''
const memoryContent   = readFile(PATHS.memory)          ?? ''

// Agents — from workspace CLAUDE.md
const agentsSection = extractSection(workspaceClaude, 'Shared Agents') ?? ''
const globalSkills  = extractSection(globalClaude, 'Skills') ?? ''
const agentsContent = [
  agentsSection,
  globalSkills ? `\n---\n\n${globalSkills}` : '',
].filter(Boolean).join('')

// Skills — from workspace CLAUDE.md
const skillsContent = extractSection(workspaceClaude, 'Skills') ?? workspaceClaude

// Context — relevant project rules (excluding agents/skills)
const contextParts = [
  globalClaude ? `## Global config\n\n${globalClaude}` : '',
  productClaude ? `---\n\n## Product / PM rules\n\n${productClaude}` : '',
].filter(Boolean)
const contextContent = contextParts.join('\n\n')

// ── Upsert ───────────────────────────────────────────────────────────────────
const entries = [
  { key: 'claude:memory',  value: memoryContent },
  { key: 'claude:context', value: contextContent },
  { key: 'claude:agents',  value: agentsContent },
  { key: 'claude:skills',  value: skillsContent },
]

console.log('\n🔧 Syncing Claude config → Supabase settings\n')

let ok = 0
for (const entry of entries) {
  const { error } = await supabase
    .from('settings')
    .upsert(entry, { onConflict: 'key' })

  if (error) {
    console.error(`  ❌ ${entry.key} — ${error.message}`)
  } else {
    const lines = entry.value.split('\n').length
    console.log(`  ✅ ${entry.key} (${lines} lines)`)
    ok++
  }
}

console.log(`\n${ok}/${entries.length} config entries synchronisés.\n`)

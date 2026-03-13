'use client'
import { useState } from 'react'
import { DocSection } from '@/lib/docs-content'
import { cn } from '@/lib/utils'

function renderMarkdown(md: string): string {
  return md
    // h3
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-neutral-900 mt-6 mb-2">$1</h3>')
    // h2
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-neutral-900 mt-8 mb-3 pb-2 border-b border-neutral-100">$1</h2>')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-neutral-900">$1</strong>')
    // italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // code block
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre class="bg-neutral-900 text-neutral-100 rounded-lg p-4 text-xs overflow-x-auto my-4 font-mono leading-relaxed">$1</pre>')
    // inline code
    .replace(/`([^`]+)`/g, '<code class="bg-neutral-100 text-neutral-800 rounded px-1.5 py-0.5 text-xs font-mono">$1</code>')
    // blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-neutral-300 pl-4 my-3 text-neutral-600 italic text-sm">$1</blockquote>')
    // table header separator (skip)
    .replace(/^\|[-| :]+\|$/gm, '__TABLE_SEP__')
    // tables
    .replace(/((?:^\|.+\|\n?)+)/gm, (match) => {
      const rows = match.trim().split('\n').filter(r => r !== '__TABLE_SEP__' && !r.match(/^\|[-| :]+\|$/))
      if (rows.length === 0) return match
      const [header, ...body] = rows
      const thCells = header.split('|').filter(Boolean).map(c =>
        `<th class="px-3 py-2 text-left text-xs font-semibold text-neutral-600 whitespace-nowrap">${c.trim()}</th>`
      ).join('')
      const bodyRows = body.map(row => {
        const tds = row.split('|').filter(Boolean).map(c =>
          `<td class="px-3 py-2 text-sm text-neutral-700 align-top">${c.trim()}</td>`
        ).join('')
        return `<tr class="border-t border-neutral-100">${tds}</tr>`
      }).join('')
      return `<div class="overflow-x-auto my-4"><table class="w-full text-sm border border-neutral-200 rounded-lg overflow-hidden"><thead class="bg-neutral-50"><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`
    })
    // hr
    .replace(/^---$/gm, '<hr class="my-6 border-neutral-200">')
    // unordered list items
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-neutral-700 leading-relaxed list-disc">$1</li>')
    // wrap consecutive <li> in <ul>
    .replace(/(<li[\s\S]*?<\/li>\n?)+/g, m => `<ul class="my-2 space-y-1">${m}</ul>`)
    // paragraphs (lines with content, not already HTML)
    .replace(/^(?!<[a-z])(.+)$/gm, '<p class="text-sm text-neutral-700 leading-relaxed my-1">$1</p>')
    // clean up empty paragraphs
    .replace(/<p[^>]*>\s*<\/p>/g, '')
    // clean up __TABLE_SEP__ leftovers
    .replace(/__TABLE_SEP__/g, '')
}

export default function DocsViewer({ sections }: { sections: DocSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id)
  const active = sections.find(s => s.id === activeId)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Documentation Produit</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Synthèse vivante de la stratégie, de l&apos;ICP et des décisions produit Koj²a. Mise à jour après chaque session de travail.
        </p>
      </div>

      <div className="flex gap-6 min-h-[calc(100vh-220px)]">
        {/* Sidebar */}
        <aside className="w-56 shrink-0">
          <nav className="space-y-0.5 sticky top-22">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveId(section.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
                  activeId === section.id
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                )}
              >
                <span>{section.emoji}</span>
                <span className="truncate">{section.title}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {active && (
            <div className="bg-white rounded-xl border border-neutral-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{active.emoji}</span>
                  <h2 className="text-xl font-semibold text-neutral-900">{active.title}</h2>
                </div>
                <span className="text-xs text-neutral-400">Mis à jour : {active.lastUpdated}</span>
              </div>
              <div
                className="prose-neutral max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(active.content) }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

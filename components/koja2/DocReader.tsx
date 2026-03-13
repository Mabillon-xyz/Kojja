'use client'

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-neutral-900 mt-8 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-neutral-900 mt-10 mb-3 pb-2 border-b border-neutral-100">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-neutral-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre class="bg-neutral-900 text-neutral-100 rounded-lg p-4 text-sm overflow-x-auto my-5 font-mono leading-relaxed">$1</pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-neutral-100 text-neutral-800 rounded px-1.5 py-0.5 text-xs font-mono">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-neutral-300 pl-5 my-4 text-neutral-600 italic">$1</blockquote>')
    .replace(/^\|[-| :]+\|$/gm, '__TABLE_SEP__')
    .replace(/((?:^\|.+\|\n?)+)/gm, (match) => {
      const rows = match.trim().split('\n').filter(r => r !== '__TABLE_SEP__' && !r.match(/^\|[-| :]+\|$/))
      if (rows.length === 0) return match
      const [header, ...body] = rows
      const thCells = header.split('|').filter(Boolean).map(c =>
        `<th class="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap">${c.trim()}</th>`
      ).join('')
      const bodyRows = body.map(row => {
        const tds = row.split('|').filter(Boolean).map(c =>
          `<td class="px-4 py-3 text-sm text-neutral-700 align-top">${c.trim()}</td>`
        ).join('')
        return `<tr class="border-t border-neutral-100 hover:bg-neutral-50">${tds}</tr>`
      }).join('')
      return `<div class="overflow-x-auto my-5 rounded-lg border border-neutral-200"><table class="w-full text-sm"><thead class="bg-neutral-50"><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`
    })
    .replace(/^---$/gm, '<hr class="my-8 border-neutral-100">')
    .replace(/^- (.+)$/gm, '<li class="ml-5 text-sm text-neutral-700 leading-relaxed list-disc">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>\n?)+/g, m => `<ul class="my-3 space-y-1.5">${m}</ul>`)
    .replace(/^(?!<[a-z])(.+)$/gm, '<p class="text-sm text-neutral-700 leading-relaxed my-2">$1</p>')
    .replace(/<p[^>]*>\s*<\/p>/g, '')
    .replace(/__TABLE_SEP__/g, '')
}

export default function DocReader({ content }: { content: string }) {
  return (
    <div
      className="max-w-none"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  )
}

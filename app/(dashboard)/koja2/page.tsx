import Link from 'next/link'
import { readDocs } from '@/lib/read-docs'

function excerpt(content: string, max = 120): string {
  const text = content
    .replace(/^---[\s\S]*?---\n?/, '')     // strip frontmatter if any
    .replace(/^#{1,3} .+$/gm, '')          // strip headings
    .replace(/\*\*(.+?)\*\*/g, '$1')       // strip bold
    .replace(/\*(.+?)\*/g, '$1')           // strip italic
    .replace(/`[^`]+`/g, '')               // strip inline code
    .replace(/^> /gm, '')                  // strip blockquote markers
    .replace(/^- /gm, '')                  // strip list markers
    .replace(/^\|.+\|$/gm, '')            // strip tables
    .replace(/\n{2,}/g, ' ')              // collapse newlines
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

export default function Koja2LibraryPage() {
  const docs = readDocs('koja2')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Koj²a — Base de connaissances</h1>
        <p className="text-neutral-500 text-sm mt-1">
          {docs.length} documents · Stratégie, ICP, décisions produit. Mis à jour après chaque session de travail.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map((doc) => (
          <Link
            key={doc.id}
            href={`/koja2/${doc.id}`}
            className="group block bg-white rounded-xl border border-neutral-200 p-6 hover:border-neutral-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{doc.emoji}</span>
              <span className="text-xs text-neutral-400 mt-1">{doc.lastUpdated}</span>
            </div>
            <h2 className="text-sm font-semibold text-neutral-900 mb-2 group-hover:text-black">
              {doc.title}
            </h2>
            <p className="text-xs text-neutral-500 leading-relaxed">
              {excerpt(doc.content)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

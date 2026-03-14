import Link from 'next/link'
import { readDocs } from '@/lib/read-docs'
import { createDocument } from '@/app/actions/documents'

export default async function DocumentationPage() {
  const docs = await readDocs()

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Documentation</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{docs.length} document{docs.length > 1 ? 's' : ''}</p>
        </div>

        <form action={createDocument} className="flex items-center gap-2">
          <input type="hidden" name="emoji" value="📄" />
          <input
            name="title"
            placeholder="Titre du nouveau document…"
            required
            className="text-sm border border-neutral-200 rounded-lg px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-transparent placeholder:text-neutral-400"
          />
          <button
            type="submit"
            className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors whitespace-nowrap"
          >
            + Nouveau
          </button>
        </form>
      </div>

      {/* Document list — Google Docs style */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_160px] items-center px-4 py-2 border-b border-neutral-100 bg-neutral-50">
          <div className="w-10" />
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Nom</span>
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide text-right">Modifié</span>
        </div>

        {docs.map((doc, i) => (
          <Link
            key={doc.id}
            href={`/documentation/${doc.id}`}
            className={`grid grid-cols-[auto_1fr_160px] items-center px-4 py-3.5 hover:bg-neutral-50 transition-colors group ${
              i < docs.length - 1 ? 'border-b border-neutral-100' : ''
            }`}
          >
            <div className="w-10 flex items-center">
              <div className={`w-8 h-8 rounded flex items-center justify-center text-base border ${
                doc.isSystem
                  ? 'bg-blue-50 border-blue-100'
                  : 'bg-amber-50 border-amber-100'
              }`}>
                {doc.emoji}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-900 group-hover:text-black">
                {doc.title}
              </span>
              {doc.isSystem && (
                <span className="text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                  stratégie
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-xs text-neutral-400">{doc.lastUpdated}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

import Link from 'next/link'
import { readDocs } from '@/lib/read-docs'
import { createDocument } from '@/app/actions/documents'

export default async function Koja2Page() {
  const docs = await readDocs()

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Koj²a — Documentation</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {docs.length} document{docs.length > 1 ? 's' : ''} · Stratégie, ICP, décisions produit
          </p>
        </div>

        <form action={createDocument} className="flex items-center gap-2">
          <input type="hidden" name="emoji" value="📄" />
          <input
            name="title"
            placeholder="Nouveau document…"
            required
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-52 focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder:text-gray-400"
          />
          <button
            type="submit"
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            + Nouveau
          </button>
        </form>
      </div>

      {/* Document list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_160px] items-center px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="w-10" />
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nom</span>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Modifié</span>
        </div>

        {docs.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            Aucun document — lance le SQL seed dans Supabase.
          </div>
        )}

        {docs.map((doc, i) => (
          <Link
            key={doc.id}
            href={`/koja2/${doc.id}`}
            className={`grid grid-cols-[auto_1fr_160px] items-center px-4 py-3.5 hover:bg-gray-50 transition-colors group ${
              i < docs.length - 1 ? 'border-b border-gray-100' : ''
            }`}
          >
            <div className="w-10 flex items-center">
              <div className={`w-8 h-8 rounded flex items-center justify-center text-base border ${
                doc.isSystem ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'
              }`}>
                {doc.emoji}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 group-hover:text-black">
                {doc.title}
              </span>
              {doc.isSystem && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  stratégie
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-xs text-gray-400">{doc.lastUpdated}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

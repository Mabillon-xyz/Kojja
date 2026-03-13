import { notFound } from 'next/navigation'
import Link from 'next/link'
import { readDocs } from '@/lib/read-docs'
import DocReader from '@/components/koja2/DocReader'

export default function DocPage({ params }: { params: { id: string } }) {
  const docs = readDocs('koja2')
  const doc = docs.find((d) => d.id === params.id)
  if (!doc) notFound()

  const idx = docs.findIndex((d) => d.id === params.id)
  const prev = idx > 0 ? docs[idx - 1] : null
  const next = idx < docs.length - 1 ? docs[idx + 1] : null

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back + breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/koja2" className="hover:text-neutral-900 transition-colors flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M8.5 11L4.5 7L8.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Koj²a
        </Link>
        <span>/</span>
        <span className="text-neutral-900">{doc.title}</span>
      </div>

      {/* Document */}
      <div className="bg-white rounded-xl border border-neutral-200 p-10">
        <div className="flex items-start justify-between mb-8 pb-6 border-b border-neutral-100">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{doc.emoji}</span>
            <h1 className="text-2xl font-semibold text-neutral-900">{doc.title}</h1>
          </div>
          <span className="text-xs text-neutral-400 mt-2 shrink-0">Mis à jour : {doc.lastUpdated}</span>
        </div>

        <DocReader content={doc.content} />
      </div>

      {/* Prev / Next navigation */}
      <div className="mt-6 flex items-center justify-between gap-4">
        {prev ? (
          <Link
            href={`/koja2/${prev.id}`}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M8.5 11L4.5 7L8.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>{prev.emoji} {prev.title}</span>
          </Link>
        ) : <div />}
        {next ? (
          <Link
            href={`/koja2/${next.id}`}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <span>{next.emoji} {next.title}</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5.5 3L9.5 7L5.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        ) : <div />}
      </div>
    </div>
  )
}

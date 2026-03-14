import { notFound } from 'next/navigation'
import Link from 'next/link'
import { readDocs, readDoc } from '@/lib/read-docs'
import DocEditor from '@/components/documentation/DocEditor'

export default async function DocPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { edit?: string }
}) {
  const [doc, docs] = await Promise.all([readDoc(params.id), readDocs()])
  if (!doc) notFound()

  const idx = docs.findIndex((d) => d.id === params.id)
  const prev = idx > 0 ? docs[idx - 1] : null
  const next = idx < docs.length - 1 ? docs[idx + 1] : null

  return (
    <div className="min-h-full bg-[#f0f4f9] px-8 py-8">
      {/* Breadcrumb */}
      <div className="max-w-[860px] mx-auto mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/koja2" className="hover:text-gray-900 transition-colors flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M8.5 11L4.5 7L8.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Koj²a
        </Link>
        <span>/</span>
        <span className="text-gray-700 truncate">{doc.title}</span>
      </div>

      <div className="max-w-[860px] mx-auto">
        <DocEditor
          id={doc.id}
          initialTitle={doc.title}
          initialEmoji={doc.emoji}
          initialContent={doc.content}
          lastUpdated={doc.lastUpdated}
          isSystem={doc.isSystem}
          startInEdit={searchParams.edit === '1'}
          prev={prev ? { id: prev.id, title: prev.title, emoji: prev.emoji } : null}
          next={next ? { id: next.id, title: next.title, emoji: next.emoji } : null}
        />
      </div>
    </div>
  )
}

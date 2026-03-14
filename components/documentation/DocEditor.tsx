'use client'
import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { updateDocument, deleteDocument } from '@/app/actions/documents'

// ─── Markdown renderer ───────────────────────────────────────────────────────

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-neutral-900 mt-8 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-neutral-900 mt-10 mb-3 pb-2 border-b border-neutral-100">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-neutral-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre class="bg-neutral-900 text-neutral-100 rounded-lg p-4 text-sm overflow-x-auto my-5 font-mono leading-relaxed">$1</pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-neutral-100 text-neutral-800 rounded px-1.5 py-0.5 text-sm font-mono">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-neutral-300 pl-5 my-4 text-neutral-600 italic text-[15px]">$1</blockquote>')
    .replace(/^\|[-| :]+\|$/gm, '__TABLE_SEP__')
    .replace(/((?:^\|.+\|\n?)+)/gm, (match) => {
      const rows = match.trim().split('\n').filter(r => r !== '__TABLE_SEP__' && !r.match(/^\|[-| :]+\|$/))
      if (rows.length === 0) return match
      const [header, ...body] = rows
      const ths = header.split('|').filter(Boolean).map(c =>
        `<th class="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">${c.trim()}</th>`
      ).join('')
      const trs = body.map(row => {
        const tds = row.split('|').filter(Boolean).map(c =>
          `<td class="px-4 py-3 text-[15px] text-neutral-700 align-top">${c.trim()}</td>`
        ).join('')
        return `<tr class="border-t border-neutral-100 hover:bg-neutral-50">${tds}</tr>`
      }).join('')
      return `<div class="overflow-x-auto my-5 rounded-lg border border-neutral-200"><table class="w-full"><thead class="bg-neutral-50"><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
    })
    .replace(/^---$/gm, '<hr class="my-8 border-neutral-100">')
    .replace(/^- (.+)$/gm, '<li class="ml-5 text-[15px] text-neutral-700 leading-relaxed list-disc">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>\n?)+/g, m => `<ul class="my-3 space-y-1.5">${m}</ul>`)
    .replace(/^(?!<[a-z])(.+)$/gm, '<p class="text-[15px] text-neutral-700 leading-relaxed my-2">$1</p>')
    .replace(/<p[^>]*>\s*<\/p>/g, '')
    .replace(/__TABLE_SEP__/g, '')
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavDoc { id: string; title: string; emoji: string }

interface Props {
  id: string
  initialTitle: string
  initialEmoji: string
  initialContent: string
  lastUpdated: string
  startInEdit: boolean
  prev: NavDoc | null
  next: NavDoc | null
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DocEditor({
  id, initialTitle, initialEmoji, initialContent,
  lastUpdated, startInEdit, prev, next,
}: Props) {
  const [editing, setEditing] = useState(startInEdit)
  const [title, setTitle] = useState(initialTitle)
  const [emoji, setEmoji] = useState(initialEmoji)
  const [content, setContent] = useState(initialContent)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // auto-resize textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
      el.focus()
    }
  }, [editing])

  function handleSave() {
    startTransition(async () => {
      await updateDocument(id, title, emoji, content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setEditing(false)
    })
  }

  function handleDelete() {
    if (!confirm('Supprimer ce document définitivement ?')) return
    startTransition(() => deleteDocument(id))
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-neutral-100 bg-white sticky top-14 z-10">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          {lastUpdated && <span>Mis à jour : {lastUpdated}</span>}
          {saved && <span className="text-green-600 font-medium">✓ Enregistré</span>}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setTitle(initialTitle); setEmoji(initialEmoji); setContent(initialContent) }}
                className="text-sm text-neutral-500 hover:text-neutral-900 px-3 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="text-sm bg-neutral-900 text-white px-4 py-1.5 rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDelete}
                className="text-sm text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                Supprimer
              </button>
              <button
                onClick={() => setEditing(true)}
                className="text-sm bg-neutral-900 text-white px-4 py-1.5 rounded-lg hover:bg-neutral-700 transition-colors"
              >
                Modifier
              </button>
            </>
          )}
        </div>
      </div>

      {/* Document body */}
      <div className="px-16 py-12 min-h-[600px]">
        {/* Title area */}
        {editing ? (
          <div className="flex items-center gap-3 mb-8">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="text-4xl w-14 text-center bg-transparent outline-none"
              maxLength={2}
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 text-3xl font-bold text-neutral-900 bg-transparent outline-none placeholder:text-neutral-300 border-b border-neutral-200 pb-2 focus:border-neutral-400 transition-colors"
              placeholder="Titre du document"
            />
          </div>
        ) : (
          <div className="flex items-center gap-4 mb-10 pb-6 border-b border-neutral-100">
            <span className="text-4xl">{emoji}</span>
            <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
          </div>
        )}

        {/* Content */}
        {editing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            className="w-full text-[15px] text-neutral-700 leading-relaxed resize-none outline-none font-mono bg-transparent min-h-[400px]"
            placeholder="Écrivez en Markdown…"
          />
        ) : (
          <div
            className="max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>

      {/* Prev / Next */}
      {(prev || next) && (
        <div className="flex items-center justify-between px-8 py-4 border-t border-neutral-100 bg-neutral-50">
          {prev ? (
            <Link
              href={`/documentation/${prev.id}`}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M8.5 11L4.5 7L8.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{prev.emoji} {prev.title}</span>
            </Link>
          ) : <div />}
          {next ? (
            <Link
              href={`/documentation/${next.id}`}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <span>{next.emoji} {next.title}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5.5 3L9.5 7L5.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ) : <div />}
        </div>
      )}
    </div>
  )
}

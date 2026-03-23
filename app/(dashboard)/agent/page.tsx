'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Loader2, ChevronDown, Plus, Trash2, MessageSquare, PanelLeft, X, Zap } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const mdComponents: Components = {
  p:          ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  h1:         ({ children }) => <h1 className="text-lg font-bold mb-3 mt-4 first:mt-0">{children}</h1>,
  h2:         ({ children }) => <h2 className="text-base font-bold mb-2 mt-4 first:mt-0">{children}</h2>,
  h3:         ({ children }) => <h3 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
  ul:         ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
  ol:         ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
  li:         ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong:     ({ children }) => <strong className="font-semibold">{children}</strong>,
  em:         ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-neutral-300 pl-3 italic text-neutral-500 mb-3">{children}</blockquote>,
  hr:         () => <hr className="border-neutral-200 my-4" />,
  a:          ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">{children}</a>,
  code:       ({ className, children }) => {
    const isBlock = className?.startsWith('language-')
    return isBlock
      ? <code className="block bg-neutral-100 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre">{children}</code>
      : <code className="bg-neutral-100 text-neutral-800 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
  },
  pre:        ({ children }) => <pre className="mb-3 last:mb-0 rounded-lg overflow-hidden">{children}</pre>,
  table:      ({ children }) => <div className="overflow-x-auto mb-3"><table className="w-full text-xs border-collapse">{children}</table></div>,
  thead:      ({ children }) => <thead className="bg-neutral-100">{children}</thead>,
  th:         ({ children }) => <th className="text-left font-semibold px-3 py-2 border border-neutral-200">{children}</th>,
  td:         ({ children }) => <td className="px-3 py-2 border border-neutral-200">{children}</td>,
  tr:         ({ children }) => <tr className="even:bg-neutral-50">{children}</tr>,
}

const MODELS = [
  { id: 'claude-sonnet-4-6',        label: 'Sonnet 4.6', speed: '⭐⭐⭐⭐',  depth: '⭐⭐⭐⭐',  cost: '⭐⭐⭐' },
  { id: 'claude-opus-4-6',          label: 'Opus 4.6',   speed: '⭐⭐',      depth: '⭐⭐⭐⭐⭐', cost: '⭐⭐⭐⭐⭐' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', speed: '⭐⭐⭐⭐⭐', depth: '⭐⭐',      cost: '⭐' },
]

type Message    = { role: 'user' | 'assistant'; content: string }
type ConvSummary = { id: string; title: string; model: string; updated_at: string }

// ─── Token tracking (localStorage, rolling 1h) ───────────────────────────────

const TOKEN_KEY = 'koja_token_usage'

function getHourlyTokens(): number {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return 0
    const entries: { tokens: number; ts: number }[] = JSON.parse(raw)
    const cutoff = Date.now() - 3_600_000
    return entries.filter((e) => e.ts > cutoff).reduce((s, e) => s + e.tokens, 0)
  } catch { return 0 }
}

function recordTokens(tokens: number) {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    const entries: { tokens: number; ts: number }[] = raw ? JSON.parse(raw) : []
    const cutoff = Date.now() - 3_600_000
    const pruned = entries.filter((e) => e.ts > cutoff)
    pruned.push({ tokens, ts: Date.now() })
    localStorage.setItem(TOKEN_KEY, JSON.stringify(pruned))
  } catch { /* ignore */ }
}

function formatTokens(n: number): string {
  if (n === 0) return '0 tok'
  if (n < 1000) return `${n} tok`
  return `${(n / 1000).toFixed(1)}k tok`
}

// ─── Sidebar grouping ────────────────────────────────────────────────────────

function groupByDate(convs: ConvSummary[]) {
  const now   = new Date()
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const weekAgo   = new Date(today.getTime() - 7 * 86_400_000)

  const groups: { label: string; items: ConvSummary[] }[] = [
    { label: 'Today',     items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This week', items: [] },
    { label: 'Earlier',   items: [] },
  ]

  for (const c of convs) {
    const d = new Date(c.updated_at)
    if (d >= today)     groups[0].items.push(c)
    else if (d >= yesterday) groups[1].items.push(c)
    else if (d >= weekAgo)   groups[2].items.push(c)
    else                     groups[3].items.push(c)
  }

  return groups.filter((g) => g.items.length > 0)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AgentPage() {
  const [messages, setMessages]           = useState<Message[]>([])
  const [input, setInput]                 = useState('')
  const [model, setModel]                 = useState(MODELS[0].id)
  const [loading, setLoading]             = useState(false)
  const [modelOpen, setModelOpen]         = useState(false)
  const [conversations, setConversations] = useState<ConvSummary[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [hourlyTokens, setHourlyTokens]   = useState(0)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Load conversations + auto-open most recent ──────────────────────────
  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/conversations')
    if (!res.ok) return []
    const data: ConvSummary[] = await res.json()
    setConversations(data)
    return data
  }, [])

  useEffect(() => {
    setHourlyTokens(getHourlyTokens())
    loadConversations().then((data) => {
      if (data.length > 0) openConversation(data[0].id)
    })
  // openConversation is stable (no deps that change), safe to ignore lint here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConversations])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  // ── Conversation actions ─────────────────────────────────────────────────
  async function openConversation(id: string) {
    const res = await fetch(`/api/conversations/${id}`)
    if (!res.ok) return
    const data = await res.json()
    setMessages(data.messages ?? [])
    setModel(data.model ?? MODELS[0].id)
    setConversationId(id)
    setSidebarOpen(false)
  }

  function newChat() {
    setMessages([])
    setInput('')
    setConversationId(null)
  }

  async function deleteConversation(id: string) {
    setDeletingId(id)
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (conversationId === id) newChat()
    setDeletingId(null)
  }

  // ── Send ─────────────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    let full = ''
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, model }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: `Error: ${err.error ?? 'Something went wrong'}` },
        ])
        return
      }

      // Track token usage from response header
      const tokensUsed = parseInt(res.headers.get('X-Tokens-Used') ?? '0', 10)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: full },
        ])
      }

      if (tokensUsed > 0) {
        recordTokens(tokensUsed)
        setHourlyTokens(getHourlyTokens())
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `Error: ${String(e)}` },
      ])
      return
    } finally {
      setLoading(false)
    }

    // Persist conversation
    const finalMessages: Message[] = [...newMessages, { role: 'assistant', content: full }]
    if (!conversationId) {
      const title = text.slice(0, 60)
      const res2 = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, model, messages: finalMessages }),
      })
      if (res2.ok) {
        const created = await res2.json()
        setConversationId(created.id)
        setConversations((prev) => [
          { id: created.id, title, model, updated_at: created.updated_at },
          ...prev,
        ])
      }
    } else {
      await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: finalMessages }),
      })
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, updated_at: new Date().toISOString() } : c
        )
      )
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const selectedModel = MODELS.find((m) => m.id === model) ?? MODELS[0]
  const groups        = groupByDate(conversations)

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const sidebarContent = (
    <>
      <div className="px-3 py-3 border-b border-neutral-100 flex items-center gap-2">
        <button
          onClick={() => { newChat(); setSidebarOpen(false) }}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-neutral-700 hover:bg-white hover:shadow-sm border border-neutral-200 transition-all"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {groups.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">No conversations yet</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-4 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                {group.label}
              </p>
              {group.items.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-1 mx-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                    conv.id === conversationId
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-neutral-600 hover:bg-white hover:text-neutral-900'
                  }`}
                  onClick={() => openConversation(conv.id)}
                >
                  <span className="flex-1 text-xs truncate leading-snug">{conv.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                    className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:text-red-500 ${
                      conv.id === conversationId ? 'text-blue-400' : 'text-neutral-400'
                    }`}
                  >
                    {deletingId === conv.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Trash2 className="w-3 h-3" />
                    }
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  )

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="-mx-6 -mt-6 -mb-28 md:-mb-8 lg:-mx-8 lg:-mt-8 h-[calc(100vh-48px)] flex bg-white overflow-hidden">

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
          <aside className="md:hidden fixed left-0 top-0 h-full w-72 z-50 bg-white border-r border-neutral-100 flex flex-col shadow-xl">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-neutral-100 flex-shrink-0 bg-neutral-50/50">
        {sidebarContent}
      </aside>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-neutral-100 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden flex-shrink-0 p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-neutral-900">Agent</h1>
              <p className="hidden sm:block text-xs text-neutral-400 mt-0.5">Powered by Koj²a documentation</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Token usage badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-500 text-xs"
              title="Tokens consumed in the last hour"
            >
              <Zap className="w-3 h-3" />
              <span className="font-medium tabular-nums">{formatTokens(hourlyTokens)}</span>
              <span className="text-neutral-400">/ 1h</span>
            </div>

            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setModelOpen((o) => !o)}
                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors text-neutral-700"
              >
                <span className="font-medium">{selectedModel.label}</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {modelOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setModelOpen(false)} />
                  <div className="absolute right-0 top-10 z-20 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden w-56 sm:w-64">
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setModel(m.id); setModelOpen(false) }}
                        className={`w-full flex flex-col gap-1.5 px-4 py-3 text-sm transition-colors text-left ${
                          m.id === model ? 'bg-blue-50 text-blue-700' : 'text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        <span className="font-semibold">{m.label}</span>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-400 w-20">Speed</span>
                            <span className="text-xs leading-none">{m.speed}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-400 w-20">Depth</span>
                            <span className="text-xs leading-none">{m.depth}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-400 w-20">Cost</span>
                            <span className="text-xs leading-none">{m.cost}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-20">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center">
                <Bot className="w-6 h-6 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-500">Ask anything about Koj²a</p>
              <p className="text-xs text-neutral-400 max-w-xs">
                This agent has read all your documentation and can search the web and query your database.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                msg.role === 'user' ? 'bg-blue-600' : 'bg-neutral-100'
              }`}>
                {msg.role === 'user'
                  ? <User className="w-3.5 h-3.5 text-white" />
                  : <Bot className="w-3.5 h-3.5 text-neutral-500" />
                }
              </div>

              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm leading-relaxed whitespace-pre-wrap'
                  : 'bg-neutral-50 text-neutral-800 rounded-tl-sm border border-neutral-100'
              }`}>
                {msg.content === '' && msg.role === 'assistant' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                ) : msg.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 md:px-6 pb-4 md:pb-6 pt-3 border-t border-neutral-100">
          <div className="flex items-end gap-3 bg-neutral-50 rounded-2xl border border-neutral-200 px-4 py-3 focus-within:border-neutral-300 focus-within:bg-white transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question... (Enter to send, Shift+Enter for new line)"
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-neutral-800 placeholder-neutral-400 resize-none outline-none min-h-[24px] disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, ChevronDown } from 'lucide-react'

const MODELS = [
  {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6',
    speed:  '⭐⭐⭐⭐',
    depth:  '⭐⭐⭐⭐',
    cost:   '⭐⭐⭐',
  },
  {
    id: 'claude-opus-4-6',
    label: 'Opus 4.6',
    speed:  '⭐⭐',
    depth:  '⭐⭐⭐⭐⭐',
    cost:   '⭐⭐⭐⭐⭐',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    speed:  '⭐⭐⭐⭐⭐',
    depth:  '⭐⭐',
    cost:   '⭐',
  },
]

type Message = { role: 'user' | 'assistant'; content: string }

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(MODELS[0].id)
  const [loading, setLoading] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    // Placeholder for streaming assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

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

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: full },
        ])
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `Error: ${String(e)}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const selectedModel = MODELS.find((m) => m.id === model) ?? MODELS[0]

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] max-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
        <div>
          <h1 className="text-base font-semibold text-neutral-900">Agent</h1>
          <p className="text-xs text-neutral-400 mt-0.5">Powered by Koj²a documentation</p>
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
              <div className="absolute right-0 top-10 z-20 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden w-64">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setModel(m.id); setModelOpen(false) }}
                    className={`w-full flex flex-col gap-1.5 px-4 py-3 text-sm transition-colors text-left ${
                      m.id === model
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-neutral-700 hover:bg-neutral-50'
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-20">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center">
              <Bot className="w-6 h-6 text-neutral-400" />
            </div>
            <p className="text-sm font-medium text-neutral-500">Ask anything about Koj²a</p>
            <p className="text-xs text-neutral-400 max-w-xs">
              This agent has read all your documentation and can answer questions about your strategy, ICP, workflows and more.
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

            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-neutral-50 text-neutral-800 rounded-tl-sm border border-neutral-100'
            }`}>
              {msg.content === '' && msg.role === 'assistant'
                ? <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                : msg.content
              }
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-3 border-t border-neutral-100">
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
  )
}

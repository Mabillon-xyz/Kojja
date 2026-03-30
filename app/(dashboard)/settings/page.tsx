'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

type Tab = 'agent' | 'context' | 'memory' | 'skills'

const TABS: { id: Tab; label: string; emoji: string; description: string }[] = [
  { id: 'agent',   label: 'Agent',   emoji: '🤖', description: 'Sub-agents Claude can spawn' },
  { id: 'context', label: 'Context', emoji: '📋', description: 'Project rules loaded each session' },
  { id: 'memory',  label: 'Memory',  emoji: '🧠', description: 'Persistent notes across sessions' },
  { id: 'skills',  label: 'Skills',  emoji: '⚡', description: 'Automation skills available' },
]

const mdComponents: Components = {
  p:    ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-neutral-700">{children}</p>,
  h1:   ({ children }) => <h1 className="text-base font-bold mb-3 mt-5 first:mt-0 text-neutral-900">{children}</h1>,
  h2:   ({ children }) => <h2 className="text-sm font-bold mb-2 mt-4 first:mt-0 text-neutral-900">{children}</h2>,
  h3:   ({ children }) => <h3 className="text-sm font-semibold mb-2 mt-3 first:mt-0 text-neutral-800">{children}</h3>,
  ul:   ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-neutral-700">{children}</ul>,
  ol:   ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-neutral-700">{children}</ol>,
  li:   ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <pre className="bg-neutral-100 border border-neutral-200 rounded-lg p-3 mb-3 overflow-x-auto">
          <code className="text-xs font-mono text-neutral-800">{children}</code>
        </pre>
      )
    }
    return <code className="bg-neutral-100 text-neutral-800 text-xs font-mono px-1.5 py-0.5 rounded">{children}</code>
  },
  pre:  ({ children }) => <>{children}</>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-neutral-300 pl-4 italic text-neutral-500 my-3">{children}</blockquote>
  ),
  a:    ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>
  ),
  hr:   () => <hr className="border-neutral-200 my-4" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-neutral-50">{children}</thead>,
  th:   ({ children }) => <th className="text-left px-3 py-2 border border-neutral-200 font-semibold text-neutral-700 text-xs uppercase tracking-wide">{children}</th>,
  td:   ({ children }) => <td className="px-3 py-2 border border-neutral-200 text-neutral-700 align-top">{children}</td>,
  strong: ({ children }) => <strong className="font-semibold text-neutral-900">{children}</strong>,
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('memory')
  const [config, setConfig] = useState<Record<Tab, string>>({ agent: '', context: '', memory: '', skills: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          agent:   data.agents  ?? '',
          context: data.context ?? '',
          memory:  data.memory  ?? '',
          skills:  data.skills  ?? '',
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const current = TABS.find((t) => t.id === activeTab)!

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Configuration</h1>
        <p className="text-neutral-500 text-sm mt-1">Claude Code context, memory, and available tools.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === tab.id
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
            }`}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p className="text-xs text-neutral-400 mb-4">{current.description}</p>

      {/* Content */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-neutral-400 text-sm">Loading…</div>
          </div>
        ) : config[activeTab] ? (
          <div className="text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {config[activeTab]}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-neutral-400 text-sm">
              No data yet — run <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-xs font-mono">node scripts/sync-claude-config.mjs</code> to sync.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

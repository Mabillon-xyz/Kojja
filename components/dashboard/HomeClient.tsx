'use client'

import { useState, useEffect } from 'react'

type Item = { id: string; text: string; done: boolean }

function CheckList({ storageKey, placeholder }: { storageKey: string; placeholder: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [input, setInput] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setItems(JSON.parse(saved))
    } catch {}
    setMounted(true)
  }, [storageKey])

  function save(next: Item[]) {
    setItems(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  function addItem() {
    if (!input.trim()) return
    save([...items, { id: crypto.randomUUID(), text: input.trim(), done: false }])
    setInput('')
  }

  function toggle(id: string) {
    save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
  }

  function remove(id: string) {
    save(items.filter((i) => i.id !== id))
  }

  if (!mounted) return null

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-2.5 group">
          <input
            type="checkbox"
            checked={item.done}
            onChange={() => toggle(item.id)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 cursor-pointer accent-neutral-900"
          />
          <span
            className={`flex-1 text-sm leading-snug ${
              item.done ? 'line-through text-neutral-400' : 'text-neutral-700'
            }`}
          >
            {item.text}
          </span>
          <button
            onClick={() => remove(item.id)}
            className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-neutral-600 text-base leading-none transition-opacity"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder={placeholder}
          className="flex-1 text-sm text-neutral-700 placeholder-neutral-300 bg-transparent focus:outline-none py-1"
        />
        <button
          onClick={addItem}
          className="text-neutral-400 hover:text-neutral-700 text-xl leading-none transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function HomeClient() {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">To Do</h2>
        <CheckList storageKey="koja_todo_items" placeholder="Add a task..." />
      </div>
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-4">Road Map</h2>
        <CheckList storageKey="koja_roadmap_items" placeholder="Add a milestone..." />
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'

export default function HomeClient() {
  const [todo, setTodo] = useState('')
  const [roadmap, setRoadmap] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTodo(localStorage.getItem('koja_todo') ?? '')
    setRoadmap(localStorage.getItem('koja_roadmap') ?? '')
    setMounted(true)
  }, [])

  function handleTodo(value: string) {
    setTodo(value)
    localStorage.setItem('koja_todo', value)
  }

  function handleRoadmap(value: string) {
    setRoadmap(value)
    localStorage.setItem('koja_roadmap', value)
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">To Do</h2>
        <textarea
          value={mounted ? todo : ''}
          onChange={(e) => handleTodo(e.target.value)}
          placeholder="Note tes prochaines actions ici..."
          className="w-full h-48 text-sm text-neutral-700 placeholder-neutral-300 resize-none focus:outline-none leading-relaxed"
        />
      </div>
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Road Map</h2>
        <textarea
          value={mounted ? roadmap : ''}
          onChange={(e) => handleRoadmap(e.target.value)}
          placeholder="Note les prochaines évolutions du produit..."
          className="w-full h-48 text-sm text-neutral-700 placeholder-neutral-300 resize-none focus:outline-none leading-relaxed"
        />
      </div>
    </div>
  )
}

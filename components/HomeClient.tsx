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

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">To Do</h2>
        <textarea
          value={mounted ? todo : ''}
          onChange={(e) => {
            setTodo(e.target.value)
            localStorage.setItem('koja_todo', e.target.value)
          }}
          placeholder="Note your next actions here..."
          className="w-full h-48 text-sm text-foreground placeholder-muted-foreground bg-transparent resize-none focus:outline-none leading-relaxed"
        />
      </div>
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Road Map</h2>
        <textarea
          value={mounted ? roadmap : ''}
          onChange={(e) => {
            setRoadmap(e.target.value)
            localStorage.setItem('koja_roadmap', e.target.value)
          }}
          placeholder="Note upcoming product evolutions here..."
          className="w-full h-48 text-sm text-foreground placeholder-muted-foreground bg-transparent resize-none focus:outline-none leading-relaxed"
        />
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { ImageIcon, X } from 'lucide-react'
import Image from 'next/image'

const STORAGE_KEY = 'dashboard_banner'

export default function DashboardBanner() {
  const [src, setSrc] = useState<string | null>(null)
  const [hovering, setHovering] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setSrc(saved)
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result as string
      localStorage.setItem(STORAGE_KEY, data)
      setSrc(data)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function removeBanner() {
    localStorage.removeItem(STORAGE_KEY)
    setSrc(null)
  }

  if (!src) {
    return (
      <div
        className="-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-6 h-16 bg-neutral-100 border-b border-neutral-200 flex items-center justify-center cursor-pointer group hover:bg-neutral-150 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <span className="flex items-center gap-2 text-xs text-neutral-400 group-hover:text-neutral-600 transition-colors">
          <ImageIcon size={14} />
          Add a banner
        </span>
        <input ref={inputRef} type="file" accept="image/*,.gif" className="hidden" onChange={handleFile} />
      </div>
    )
  }

  return (
    <div
      className="-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-6 relative h-44 md:h-56 overflow-hidden"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <Image
        src={src}
        alt="Dashboard banner"
        fill
        className="object-cover"
        unoptimized
      />

      {/* Hover overlay */}
      <div className={`absolute inset-0 bg-black/20 flex items-end justify-end gap-2 p-3 transition-opacity ${hovering ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-xs font-medium rounded-lg backdrop-blur-sm transition-colors"
        >
          <ImageIcon size={12} />
          Change
        </button>
        <button
          onClick={removeBanner}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-xs font-medium rounded-lg backdrop-blur-sm transition-colors"
        >
          <X size={12} />
          Remove
        </button>
      </div>

      <input ref={inputRef} type="file" accept="image/*,.gif" className="hidden" onChange={handleFile} />
    </div>
  )
}

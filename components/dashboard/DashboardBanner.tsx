'use client'

import { useState, useEffect, useRef } from 'react'
import { ImageIcon, X, Camera } from 'lucide-react'
import Image from 'next/image'

const BANNER_KEY = 'dashboard_banner'
const AVATAR_KEY = 'dashboard_avatar'

export default function DashboardBanner() {
  const [src, setSrc] = useState<string | null>(null)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [hovering, setHovering] = useState(false)
  const [avatarHovering, setAvatarHovering] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(BANNER_KEY)
    if (saved) setSrc(saved)
    const savedAvatar = localStorage.getItem(AVATAR_KEY)
    if (savedAvatar) setAvatarSrc(savedAvatar)
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result as string
      localStorage.setItem(BANNER_KEY, data)
      setSrc(data)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result as string
      localStorage.setItem(AVATAR_KEY, data)
      setAvatarSrc(data)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function removeBanner() {
    localStorage.removeItem(BANNER_KEY)
    setSrc(null)
  }

  const avatar = (
    <div
      className="absolute bottom-0 left-6 lg:left-8 translate-y-1/2 z-10"
      onMouseEnter={() => setAvatarHovering(true)}
      onMouseLeave={() => setAvatarHovering(false)}
      onClick={() => avatarRef.current?.click()}
    >
      <div className="w-20 h-20 rounded-full border-4 border-white bg-neutral-200 overflow-hidden cursor-pointer relative shadow-sm">
        {avatarSrc ? (
          <Image src={avatarSrc} alt="Profile" fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera size={20} className="text-neutral-400" />
          </div>
        )}
        {avatarHovering && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-full">
            <Camera size={16} className="text-white" />
          </div>
        )}
      </div>
      <input ref={avatarRef} type="file" accept="image/png,image/gif,image/jpeg,image/webp" className="hidden" onChange={handleAvatar} />
    </div>
  )

  if (!src) {
    return (
      <div className="-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-14 relative">
        <div
          className="h-16 bg-neutral-100 border-b border-neutral-200 flex items-center justify-center cursor-pointer group hover:bg-neutral-200 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <span className="flex items-center gap-2 text-xs text-neutral-400 group-hover:text-neutral-600 transition-colors">
            <ImageIcon size={14} />
            Add a banner
          </span>
          <input ref={inputRef} type="file" accept="image/*,.gif" className="hidden" onChange={handleFile} />
        </div>
        {avatar}
      </div>
    )
  }

  return (
    <div
      className="-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-14 relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="relative h-44 md:h-56 overflow-hidden">
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
      </div>

      {avatar}
      <input ref={inputRef} type="file" accept="image/*,.gif" className="hidden" onChange={handleFile} />
    </div>
  )
}

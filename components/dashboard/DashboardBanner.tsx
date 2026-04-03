'use client'

import { useState, useEffect, useRef } from 'react'
import { ImageIcon, X, Camera } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

const BANNER_CACHE = 'dashboard_banner_url'
const AVATAR_CACHE = 'dashboard_avatar_url'

export default function DashboardBanner() {
  const [src, setSrc] = useState<string | null>(null)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [hovering, setHovering] = useState(false)
  const [avatarHovering, setAvatarHovering] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Show cached URLs immediately to avoid flicker on first load
    const cachedBanner = localStorage.getItem(BANNER_CACHE)
    const cachedAvatar = localStorage.getItem(AVATAR_CACHE)
    if (cachedBanner) setSrc(cachedBanner)
    if (cachedAvatar) setAvatarSrc(cachedAvatar)

    // Sync from Supabase (source of truth across devices)
    const supabase = createClient()
    async function sync() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_settings')
        .select('banner_url, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle()

      const bannerUrl = data?.banner_url ?? null
      const avatarUrl = data?.avatar_url ?? null

      setSrc(bannerUrl)
      setAvatarSrc(avatarUrl)

      if (bannerUrl) localStorage.setItem(BANNER_CACHE, bannerUrl)
      else localStorage.removeItem(BANNER_CACHE)

      if (avatarUrl) localStorage.setItem(AVATAR_CACHE, avatarUrl)
      else localStorage.removeItem(AVATAR_CACHE)
    }
    sync()
  }, [])

  async function upload(file: File, type: 'banner' | 'avatar') {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const uid = user.id

    const path = `${uid}/${type}`
    const { error } = await supabase.storage
      .from('user-assets')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) { console.error('[DashboardBanner]', error); return }

    const { data: { publicUrl } } = supabase.storage
      .from('user-assets')
      .getPublicUrl(path)

    // Cache-buster since we overwrite the same path
    const url = `${publicUrl}?t=${Date.now()}`

    await supabase.from('user_settings').upsert(
      { user_id: uid, [type === 'banner' ? 'banner_url' : 'avatar_url']: url, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

    if (type === 'banner') {
      setSrc(url)
      localStorage.setItem(BANNER_CACHE, url)
    } else {
      setAvatarSrc(url)
      localStorage.setItem(AVATAR_CACHE, url)
    }
  }

  async function removeBanner() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.storage.from('user-assets').remove([`${user.id}/banner`])
    await supabase.from('user_settings').upsert(
      { user_id: user.id, banner_url: null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    setSrc(null)
    localStorage.removeItem(BANNER_CACHE)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    upload(file, 'banner')
    e.target.value = ''
  }

  function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    upload(file, 'avatar')
    e.target.value = ''
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

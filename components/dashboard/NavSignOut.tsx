'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NavSignOut({ email }: { email: string }) {
  const router = useRouter()
  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-neutral-400 hidden sm:block">{email}</span>
      <button
        onClick={signOut}
        className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        Déconnexion
      </button>
    </div>
  )
}

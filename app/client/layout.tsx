import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavSignOut from '@/components/dashboard/NavSignOut'
import Link from 'next/link'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = (user.user_metadata?.name as string | undefined) ?? user.email ?? 'Client'

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 h-screen border-r border-neutral-200 flex-col bg-white flex-shrink-0 sticky top-0">
        <div className="px-5 py-4 border-b border-neutral-100">
          <span className="text-sm font-bold text-neutral-900 tracking-tight">Koj²a</span>
        </div>
        <nav className="flex-1 px-3 py-4">
          <Link
            href="/client/campaigns"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-blue-50 text-blue-700 font-semibold"
          >
            <span className="text-base leading-none">📈</span>
            Campaigns
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
          </Link>
        </nav>
        <div className="px-5 pb-6">
          <p className="text-xs text-neutral-400 truncate">{name}</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        <header className="bg-white border-b border-neutral-200 px-6 h-12 flex items-center justify-end flex-shrink-0">
          <NavSignOut email={user.email ?? ''} />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8 pb-20 md:pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

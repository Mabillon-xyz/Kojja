import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import NavSignOut from '@/components/dashboard/NavSignOut'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      <Sidebar />
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

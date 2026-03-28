'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Settings, BookOpen, X } from 'lucide-react'

const nav = [
  { label: 'Home', href: '/dashboard', emoji: '🏠' },
  { label: 'CRM', href: '/crm', emoji: '👥' },
  { label: 'Proposals', href: '/proposal-tool', emoji: '📝' },
  { label: 'Calendar', href: '/calendar-sync', emoji: '📅' },
  { label: 'Campaigns', href: '/flows', emoji: '⚡' },
  { label: 'Agent', href: '/agent', emoji: '🤖' },
]

const mobileNav = [
  { label: 'Home', href: '/dashboard', emoji: '🏠' },
  { label: 'CRM', href: '/crm', emoji: '👥' },
  { label: 'Calendar', href: '/calendar-sync', emoji: '📅' },
  { label: 'Agent', href: '/agent', emoji: '🤖' },
  { label: 'Settings', href: '/settings', emoji: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const settingsActive = pathname === '/settings' || pathname.startsWith('/settings/')
  const docsActive = pathname === '/documentation' || pathname.startsWith('/documentation/')

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 h-screen border-r border-neutral-200 flex-col bg-white flex-shrink-0 sticky top-0">
        <div className="px-5 py-4 border-b border-neutral-100">
          <span className="text-sm font-bold text-neutral-900 tracking-tight">Koj²a</span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
                }`}
              >
                <span className="text-base leading-none">{item.emoji}</span>
                {item.label}
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </Link>
            )
          })}
        </nav>

        {/* Settings icon at bottom */}
        <div className="px-3 pb-4 relative">
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-all ${
              settingsActive || docsActive || settingsOpen
                ? 'bg-blue-50 text-blue-700'
                : 'text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700'
            }`}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Settings popover */}
          {settingsOpen && (
            <div className="absolute bottom-14 left-3 right-3 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Settings</span>
                <button onClick={() => setSettingsOpen(false)} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-1.5">
                <Link
                  href="/documentation"
                  onClick={() => setSettingsOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    docsActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4 flex-shrink-0" />
                  Documentation
                </Link>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 flex items-center justify-around px-1 pt-1 pb-5">
        {mobileNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors ${
                active ? 'text-blue-600' : 'text-neutral-400'
              }`}
            >
              <span className="text-lg leading-none">{item.emoji}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

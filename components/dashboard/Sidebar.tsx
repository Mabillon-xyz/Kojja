'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  {
    label: 'Home',
    href: '/dashboard',
    emoji: '🏠',
  },
  {
    label: 'CRM',
    href: '/crm',
    emoji: '👥',
  },
  {
    label: 'Documentation',
    href: '/documentation',
    emoji: '📖',
  },
  {
    label: 'Calendar',
    href: '/calendar-sync',
    emoji: '📅',
  },
  {
    label: 'Flows',
    href: '/flows',
    emoji: '⚡',
  },
  {
    label: 'Settings',
    href: '/settings',
    emoji: '⚙️',
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 h-screen border-r border-neutral-200 flex-col bg-white flex-shrink-0 sticky top-0">
        <div className="px-5 py-4 border-b border-neutral-100">
          <span className="text-sm font-bold text-neutral-900 tracking-tight">Koj²a</span>
        </div>
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
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 flex items-center justify-around px-1 pt-1 pb-5">
        {nav.map((item) => {
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

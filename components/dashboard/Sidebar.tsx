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
      <aside className="hidden md:flex w-52 h-screen border-r border-neutral-200 flex-col bg-white flex-shrink-0 sticky top-0">
        <div className="px-4 py-5 border-b border-neutral-200">
          <span className="text-sm font-semibold text-neutral-900 tracking-tight">Koj²a</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-neutral-100 text-neutral-900 font-medium'
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                <span className="text-base leading-none">{item.emoji}</span>
                {item.label}
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
                active ? 'text-neutral-900' : 'text-neutral-400'
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

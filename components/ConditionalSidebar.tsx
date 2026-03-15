'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function ConditionalSidebar() {
  const pathname = usePathname()
  if (pathname === '/login' || pathname === '/signup' || pathname.startsWith('/p/') || pathname === '/book') return null
  return <Sidebar />
}

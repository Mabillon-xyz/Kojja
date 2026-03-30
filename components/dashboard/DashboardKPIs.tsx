'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, TrendingUp, Users, BarChart2, Target } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = { TrendingUp, Users, BarChart2, Target }

export type KPI = {
  label: string
  value: string
  sub: string
  icon: string
  iconBg: string
  iconColor: string
  valueColor: string
  sensitive?: boolean
}

const STORAGE_KEY = 'koja2:blur-sensitive'

export default function DashboardKPIs({ kpis }: { kpis: KPI[] }) {
  const [blurred, setBlurred] = useState(false)

  // Restore from localStorage after mount
  useEffect(() => {
    setBlurred(localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  function toggle() {
    const next = !blurred
    setBlurred(next)
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  }

  return (
    <div>
      {/* Section header with toggle */}
      <div className="flex items-center justify-end mb-3">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
          title={blurred ? 'Show sensitive data' : 'Hide sensitive data'}
        >
          {blurred ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {blurred ? 'Show' : 'Hide'}
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const hide = blurred && kpi.sensitive
          const Icon = ICONS[kpi.icon]
          return (
            <div key={kpi.label} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">{kpi.label}</p>
                <div className={`p-2 rounded-lg ${kpi.iconBg}`}>
                  {Icon && <Icon className={`w-4 h-4 ${kpi.iconColor}`} />}
                </div>
              </div>
              <p
                className={`text-3xl font-bold transition-all duration-200 select-none ${kpi.valueColor} ${
                  hide ? 'blur-sm' : ''
                }`}
              >
                {kpi.value}
              </p>
              <p
                className={`text-xs text-neutral-400 mt-1.5 transition-all duration-200 select-none ${
                  hide ? 'blur-sm' : ''
                }`}
              >
                {kpi.sub}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

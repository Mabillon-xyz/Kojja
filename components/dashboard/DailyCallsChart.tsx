'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Phone, ChevronLeft, ChevronRight } from 'lucide-react'

export type DayCall = {
  name: string
  time: string | null
  company: string | null
}

export type DayData = {
  label: string     // "18" (day number)
  sublabel: string  // "Mon"
  iso: string       // "2026-03-18"
  count: number
  calls: DayCall[]
  isToday: boolean
  isPast: boolean
}

const WINDOW = 21

type CustomTooltipProps = {
  active?: boolean
  payload?: { payload: DayData }[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-lg px-3 py-2.5 text-xs min-w-[140px]">
      <p className="font-semibold text-neutral-700 mb-1.5">
        {d.sublabel} {d.label}
        {d.isToday && <span className="ml-1.5 text-blue-600 font-bold">· Today</span>}
      </p>
      {d.calls.length === 0 ? (
        <p className="text-neutral-400">No calls</p>
      ) : (
        d.calls.map((c, i) => (
          <p key={i} className="text-neutral-600 leading-5">
            {c.time ? <span className="font-semibold text-neutral-800">{c.time} </span> : null}
            {c.name}
            {c.company ? <span className="text-neutral-400"> · {c.company}</span> : null}
          </p>
        ))
      )}
    </div>
  )
}

type XTickProps = {
  x?: number | string
  y?: number | string
  payload?: { value: string }
  visibleData: DayData[]
}

function CustomXTick({ x = 0, y = 0, payload, visibleData }: XTickProps) {
  const nx = Number(x); const ny = Number(y)
  if (!payload) return null
  const day = visibleData.find((d) => d.iso === payload.value)
  if (!day) return null
  const isToday = day.isToday
  return (
    <g transform={`translate(${nx},${ny})`}>
      {isToday && (
        <circle cx={0} cy={14} r={14} fill="#eff6ff" />
      )}
      <text
        x={0} y={4}
        textAnchor="middle"
        fontSize={10}
        fill={isToday ? '#2563eb' : '#a3a3a3'}
        fontWeight={isToday ? 700 : 400}
      >
        {day.sublabel}
      </text>
      <text
        x={0} y={18}
        textAnchor="middle"
        fontSize={11}
        fill={isToday ? '#2563eb' : '#737373'}
        fontWeight={isToday ? 700 : 500}
      >
        {day.label}
      </text>
    </g>
  )
}

export default function DailyCallsChart({ data }: { data: DayData[] }) {
  const todayIdx = data.findIndex((d) => d.isToday)
  const [offset, setOffset] = useState(Math.max(0, todayIdx - 3))

  const visibleData = data.slice(offset, offset + WINDOW)
  const todayCalls = data.find((d) => d.isToday)?.calls ?? []

  const canPrev = offset > 0
  const canNext = offset + WINDOW < data.length

  const rangeStart = visibleData[0]
  const rangeEnd = visibleData[visibleData.length - 1]
  const rangeLabel = rangeStart && rangeEnd
    ? `${rangeStart.sublabel} ${rangeStart.label} – ${rangeEnd.sublabel} ${rangeEnd.label}`
    : ''

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
      {/* Chart header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">First calls</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Scheduled per day</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-400 mr-2">{rangeLabel}</span>
          <button
            onClick={() => setOffset(o => Math.max(0, o - 7))}
            disabled={!canPrev}
            className="p-1.5 rounded-md hover:bg-neutral-100 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-neutral-500" />
          </button>
          <button
            onClick={() => setOffset(o => Math.min(data.length - WINDOW, o + 7))}
            disabled={!canNext}
            className="p-1.5 rounded-md hover:bg-neutral-100 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Bar chart */}
      <div className="px-2 pb-2">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={visibleData} barSize={20} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="iso"
              tick={(props) => <CustomXTick {...props} visibleData={visibleData} />}
              axisLine={false}
              tickLine={false}
              height={30}
              interval={0}
            />
            <YAxis hide allowDecimals={false} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: '#f5f5f5', radius: 4 }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} minPointSize={0}>
              {visibleData.map((d) => (
                <Cell
                  key={d.iso}
                  fill={d.isToday ? '#3b82f6' : d.isPast ? '#e5e5e5' : '#bfdbfe'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Today's calls */}
      <div className="border-t border-neutral-100">
        <div className="px-5 py-3 flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
            Today · {todayCalls.length} call{todayCalls.length !== 1 ? 's' : ''}
          </span>
        </div>
        {todayCalls.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-neutral-400">No calls scheduled today.</p>
        ) : (
          <div className="px-5 pb-4 space-y-2">
            {todayCalls
              .slice()
              .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
              .map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-blue-600 w-12 shrink-0 tabular-nums">
                    {c.time ?? '—'}
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-neutral-900">{c.name}</span>
                    {c.company && (
                      <span className="text-sm text-neutral-400"> · {c.company}</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

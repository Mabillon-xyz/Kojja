'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type Props = {
  data: { month: string; calls: number }[]
}

export default function CallsChart({ data }: Props) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-neutral-900 mb-1">First calls booked</h2>
      <p className="text-xs text-neutral-400 mb-6">Per month — test leads excluded</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barSize={28}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: '#a3a3a3' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: '#a3a3a3' }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip
            cursor={{ fill: '#f5f5f5' }}
            contentStyle={{
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value) => [value, 'calls']}
          />
          <Bar dataKey="calls" radius={[4, 4, 0, 0]} fill="#171717" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

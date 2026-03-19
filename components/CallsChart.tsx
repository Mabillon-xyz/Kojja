'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

type Props = {
  data: { month: string; calls: number }[]
}

export default function CallsChart({ data }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-sm font-semibold text-foreground mb-1">First calls booked</h2>
      <p className="text-xs text-muted-foreground mb-6">Per month — test leads excluded</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barSize={28}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [value, 'calls']}
          />
          <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="var(--foreground)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

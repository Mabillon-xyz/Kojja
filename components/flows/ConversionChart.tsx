"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { Snapshot } from "@/app/api/lemlist/snapshots/route";

const STORAGE_KEY = 'koja2:blur-sensitive'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function buildDemoData() {
  const today = new Date()
  const rates = [1.1, 1.3, 1.5, 1.8, 2.0, 2.2, 2.5, 2.7, 2.9, 3.0]
  return rates.map((rate, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (rates.length - 1 - i) * 3)
    return { date: d.toISOString(), rate, booked: Math.round(rate * 3), total: 300 }
  })
}

const DEMO_DATA = buildDemoData()

export default function ConversionChart({ snapshots }: { snapshots: Snapshot[] }) {
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    setDemo(localStorage.getItem(STORAGE_KEY) === '1')
    function onToggle(e: Event) {
      setDemo((e as CustomEvent<boolean>).detail)
    }
    window.addEventListener('koja2:presentation-mode', onToggle)
    return () => window.removeEventListener('koja2:presentation-mode', onToggle)
  }, [])

  const data = demo
    ? DEMO_DATA
    : snapshots.map((s) => ({
        date: s.snapshotted_at,
        rate: Number(s.conversion_rate),
        booked: s.booked_leads,
        total: s.total_leads,
      }))

  if (!demo && snapshots.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 py-10 text-center">
        <p className="text-sm text-neutral-400">No history yet — click &ldquo;Sync CRM&rdquo; to record the first data point.</p>
      </div>
    );
  }

  const latest = data[data.length - 1];
  const first = data[0];
  const delta = data.length > 1 ? latest.rate - first.rate : null;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 pt-5 pb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Booking rate over time</p>
          <p className="text-xs text-neutral-400 mt-0.5">% of Coach leads who booked a call (in Lemlist campaign)</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-neutral-900">{latest.rate.toFixed(1)}%</p>
          {delta !== null && (
            <p className={`text-xs font-semibold mt-0.5 ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-500" : "text-neutral-400"}`}>
              {delta > 0 ? "+" : ""}{delta.toFixed(1)}% since first sync
            </p>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            axisLine={false}
            tickLine={false}
            width={36}
            domain={[0, (max: number) => Math.max(max + 2, 5)]}
          />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs shadow-sm space-y-0.5">
                  <p className="font-semibold text-neutral-700">{fmtDate(String(label))}</p>
                  <p className="text-blue-600 font-bold">{Number(payload[0].value).toFixed(1)}% booking rate</p>
                  <p className="text-neutral-400">
                    {(payload[0].payload as { booked: number }).booked} booked / {(payload[0].payload as { total: number }).total} Coach leads
                  </p>
                </div>
              ) : null
            }
          />
          {data.length > 1 && (
            <ReferenceLine y={first.rate} stroke="#e5e5e5" strokeDasharray="4 4" />
          )}
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

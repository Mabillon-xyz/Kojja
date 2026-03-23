"use client";

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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ConversionChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 py-10 text-center">
        <p className="text-sm text-neutral-400">No history yet — click "Sync CRM" to record the first data point.</p>
      </div>
    );
  }

  const data = snapshots.map((s) => ({
    date: s.snapshotted_at,
    rate: Number(s.conversion_rate),
    booked: s.booked_leads,
    total: s.total_leads,
  }));

  const latest = data[data.length - 1];
  const first = data[0];
  const delta = data.length > 1 ? latest.rate - first.rate : null;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 pt-5 pb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Booking rate over time</p>
          <p className="text-xs text-neutral-400 mt-0.5">% of Lemlist leads who booked a call</p>
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
                    {(payload[0].payload as { booked: number }).booked} booked / {(payload[0].payload as { total: number }).total} leads
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

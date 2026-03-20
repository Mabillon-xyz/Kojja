"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DailyCount } from "./FlowsList";

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function FlowsDailyChart({ chartData }: { chartData: DailyCount[] }) {
  const [offset, setOffset] = useState(0); // 0 = most recent 7 days

  if (chartData.length === 0) return null;

  const total = chartData.length;
  const window7 = chartData.slice(
    Math.max(0, total - 7 - offset),
    total - offset
  );

  const canGoBack = offset + 7 < total;
  const canGoForward = offset > 0;

  const windowStart = fmtDay(window7[0]?.date ?? "");
  const windowEnd = fmtDay(window7[window7.length - 1]?.date ?? "");

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 pt-5 pb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          Flows per day
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">
            {windowStart} — {windowEnd}
          </span>
          <button
            onClick={() => setOffset((o) => o + 7)}
            disabled={!canGoBack}
            className="p-1 rounded-md hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-neutral-500" />
          </button>
          <button
            onClick={() => setOffset((o) => Math.max(0, o - 7))}
            disabled={!canGoForward}
            className="p-1 rounded-md hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={window7} barCategoryGap="35%">
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => fmtDay(v)}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip
            cursor={{ fill: "#f5f5f5" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs shadow-sm">
                  <p className="font-semibold text-neutral-700">{label ? fmtDay(String(label)) : ""}</p>
                  <p className="text-violet-600 font-bold">
                    {payload[0].value} flow{Number(payload[0].value) !== 1 ? "s" : ""}
                  </p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="count" fill="#7c3aed" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EmailDaySend, CampaignCount } from "@/lib/lemlist-email-sends";

const WINDOW_SIZE = 21;
const STORAGE_KEY = "koja2:blur-sensitive";

const PALETTE = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#06b6d4", // cyan
  "#6366f1", // indigo
  "#84cc16", // lime
];

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function fmtShort(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "short" })}`;
}

type ChartRow = { date: string; email_count: number; [key: string]: string | number };

function buildFilledData(rows: EmailDaySend[]): { filled: ChartRow[]; campaigns: string[] } {
  if (rows.length === 0) return { filled: [], campaigns: [] };

  const campaignSet: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const b of r.breakdown ?? []) {
      if (b.count > 0 && !seen.has(b.name)) {
        seen.add(b.name);
        campaignSet.push(b.name);
      }
    }
  }
  const campaigns = campaignSet;
  const hasBreakdown = campaigns.length > 0;

  const map = new Map(rows.map((r) => [r.date, r]));
  const today = new Date().toISOString().slice(0, 10);
  const filled: ChartRow[] = [];
  const d = new Date(rows[0].date + "T12:00:00");
  const end = new Date(today + "T12:00:00");

  while (d <= end) {
    const date = d.toISOString().slice(0, 10);
    const row = map.get(date);
    const base: ChartRow = { date, email_count: row?.email_count ?? 0 };

    if (hasBreakdown) {
      for (const name of campaigns) {
        base[name] = row?.breakdown?.find((b: CampaignCount) => b.name === name)?.count ?? 0;
      }
    }

    filled.push(base);
    d.setDate(d.getDate() + 1);
  }

  return { filled, campaigns };
}

function buildDemoData(): { filled: ChartRow[]; campaigns: string[] } {
  const today = new Date();
  const campaigns = ["Coach", "Coachs ex-dirigeants", "Coach Cabinet A"];
  const rawRows = [
    [5, 5, 2], [6, 7, 2], [0, 0, 0], [7, 8, 3], [5, 7, 2],
    [6, 8, 2], [0, 0, 0], [7, 9, 4], [4, 7, 2], [6, 8, 3],
    [4, 5, 2], [7, 8, 4], [6, 7, 2], [3, 4, 1], [0, 0, 0],
    [5, 7, 2], [6, 8, 2], [7, 8, 3], [0, 0, 0], [5, 5, 2], [6, 7, 2],
  ];
  const filled = rawRows.map((counts, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (rawRows.length - 1 - i));
    const row: ChartRow = { date: d.toISOString().slice(0, 10), email_count: counts.reduce((a, b) => a + b, 0) };
    campaigns.forEach((name, j) => { row[name] = counts[j]; });
    return row;
  });
  return { filled, campaigns };
}

export default function EmailSendsChart({ rows }: { rows: EmailDaySend[] }) {
  const [demo, setDemo] = useState(false);
  const [windowStart, setWindowStart] = useState<number | null>(null);

  useEffect(() => {
    setDemo(localStorage.getItem(STORAGE_KEY) === "1");
    function onToggle(e: Event) {
      setDemo((e as CustomEvent<boolean>).detail);
    }
    window.addEventListener("koja2:presentation-mode", onToggle);
    return () => window.removeEventListener("koja2:presentation-mode", onToggle);
  }, []);

  const { filled: allData, campaigns } = useMemo(
    () => (demo ? buildDemoData() : buildFilledData(rows)),
    [demo, rows]
  );

  const total = allData.length;
  const defaultStart = Math.max(0, total - WINDOW_SIZE);
  const currentStart = Math.min(defaultStart, Math.max(0, windowStart ?? defaultStart));
  const windowData = allData.slice(currentStart, currentStart + WINDOW_SIZE);

  const canGoLeft = currentStart > 0;
  const canGoRight = currentStart < defaultStart;

  const workdays = windowData.filter(
    (r) => new Date(r.date + "T12:00:00").getDay() !== 0
  );
  const avg =
    workdays.length > 0
      ? Math.round(workdays.reduce((s, r) => s + r.email_count, 0) / workdays.length)
      : 0;

  const todayCount = allData[total - 1]?.email_count ?? 0;
  const hasBreakdown = campaigns.length > 0;

  const periodLabel =
    windowData.length > 0
      ? `${fmtShort(windowData[0].date)} – ${fmtShort(windowData[windowData.length - 1].date)}`
      : "";

  if (!demo && rows.every((r) => r.email_count === 0)) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 py-10 text-center">
        <p className="text-sm text-neutral-400">No email data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 pt-5 pb-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Emails sent / day
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">Via Lemlist — by campaign</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-600">{todayCount}</p>
          <p className="text-xs text-neutral-400">today</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setWindowStart(Math.max(0, currentStart - WINDOW_SIZE))}
          disabled={!canGoLeft}
          className="p-1 rounded hover:bg-neutral-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-neutral-500" />
        </button>
        <span className="text-xs text-neutral-500 font-medium">{periodLabel}</span>
        <button
          onClick={() => setWindowStart(Math.min(defaultStart, currentStart + WINDOW_SIZE))}
          disabled={!canGoRight}
          className="p-1 rounded hover:bg-neutral-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-neutral-500" />
        </button>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart
          data={windowData}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          barSize={10}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            axisLine={false}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const total = (payload[0]?.payload as ChartRow).email_count;
              return (
                <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs shadow-sm space-y-0.5">
                  <p className="font-semibold text-neutral-700">{fmtDate(String(label))}</p>
                  <p className="text-neutral-500 font-medium">{total} emails total</p>
                  {hasBreakdown && (
                    <div className="pt-1 space-y-0.5 border-t border-neutral-100 mt-1">
                      {payload
                        .filter((p) => (p.value as number) > 0)
                        .map((p, i) => (
                          <p key={i} style={{ color: p.fill }} className="font-medium">
                            {p.name}: {p.value}
                          </p>
                        ))}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <ReferenceLine
            y={avg}
            stroke="#10b981"
            strokeDasharray="4 3"
            strokeOpacity={0.6}
            label={{
              value: `avg ${avg}`,
              position: "insideTopRight",
              fontSize: 10,
              fill: "#10b981",
            }}
          />
          {hasBreakdown ? (
            <>
              {campaigns.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="a"
                  fill={PALETTE[i % PALETTE.length]}
                  radius={i === campaigns.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
              <Legend
                iconType="square"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-neutral-500">{value}</span>
                )}
              />
            </>
          ) : (
            <Bar dataKey="email_count" fill="#10b981" radius={[3, 3, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

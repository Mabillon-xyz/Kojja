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
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EmailDaySend } from "@/lib/lemlist-email-sends";

const WINDOW_SIZE = 21;
const STORAGE_KEY = "koja2:blur-sensitive";

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

function buildFilledData(rows: EmailDaySend[]): EmailDaySend[] {
  if (rows.length === 0) return [];
  const map = new Map(rows.map((r) => [r.date, r.email_count]));
  const today = new Date().toISOString().slice(0, 10);
  const filled: EmailDaySend[] = [];
  const d = new Date(rows[0].date + "T12:00:00");
  const end = new Date(today + "T12:00:00");
  while (d <= end) {
    const date = d.toISOString().slice(0, 10);
    filled.push({ date, email_count: map.get(date) ?? 0 });
    d.setDate(d.getDate() + 1);
  }
  return filled;
}

function buildDemoData(): EmailDaySend[] {
  const today = new Date();
  const counts = [12, 15, 0, 18, 14, 16, 0, 20, 13, 17, 11, 19, 15, 8, 0, 14, 16, 18, 0, 12, 15];
  return counts.map((email_count, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (counts.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), email_count };
  });
}

const DEMO_DATA = buildDemoData();

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

  const allData = useMemo(
    () => (demo ? DEMO_DATA : buildFilledData(rows)),
    [demo, rows]
  );

  const total = allData.length;
  const defaultStart = Math.max(0, total - WINDOW_SIZE);
  const currentStart = Math.min(defaultStart, Math.max(0, windowStart ?? defaultStart));
  const windowData = allData.slice(currentStart, currentStart + WINDOW_SIZE);

  const canGoLeft = currentStart > 0;
  const canGoRight = currentStart < defaultStart;

  function goLeft() {
    setWindowStart(Math.max(0, currentStart - WINDOW_SIZE));
  }
  function goRight() {
    setWindowStart(Math.min(defaultStart, currentStart + WINDOW_SIZE));
  }

  const workdays = windowData.filter(
    (r) => new Date(r.date + "T12:00:00").getDay() !== 0
  );
  const avg =
    workdays.length > 0
      ? Math.round(workdays.reduce((s, r) => s + r.email_count, 0) / workdays.length)
      : 0;

  const todayCount = allData[total - 1]?.email_count ?? 0;

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
          <p className="text-xs text-neutral-400 mt-0.5">Via Lemlist</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-600">{todayCount}</p>
          <p className="text-xs text-neutral-400">today</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goLeft}
          disabled={!canGoLeft}
          className="p-1 rounded hover:bg-neutral-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-neutral-500" />
        </button>
        <span className="text-xs text-neutral-500 font-medium">{periodLabel}</span>
        <button
          onClick={goRight}
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
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs shadow-sm">
                  <p className="font-semibold text-neutral-700">{fmtDate(String(label))}</p>
                  <p className="text-emerald-600 font-medium">{payload[0].value} emails sent</p>
                </div>
              ) : null
            }
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
          <Bar dataKey="email_count" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

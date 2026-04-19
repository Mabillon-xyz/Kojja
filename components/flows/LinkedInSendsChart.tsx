"use client";

import { useState, useEffect } from "react";
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
import type { LinkedInDaySend } from "@/lib/lemlist-linkedin";

const STORAGE_KEY = "koja2:blur-sensitive";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function buildDemoData() {
  const today = new Date();
  const counts = [3, 5, 0, 8, 6, 4, 0, 7, 9, 5, 3, 6, 8, 4];
  return counts.map((sent_count, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (counts.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), sent_count, cumulative_total: 0 };
  });
}

const DEMO_DATA = buildDemoData();

export default function LinkedInSendsChart({ rows }: { rows: LinkedInDaySend[] }) {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(localStorage.getItem(STORAGE_KEY) === "1");
    function onToggle(e: Event) {
      setDemo((e as CustomEvent<boolean>).detail);
    }
    window.addEventListener("koja2:presentation-mode", onToggle);
    return () => window.removeEventListener("koja2:presentation-mode", onToggle);
  }, []);

  const data = demo ? DEMO_DATA : rows;

  if (!demo && rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 py-10 text-center">
        <p className="text-sm text-neutral-400">
          No data yet — sync will run automatically tonight via cron, or{" "}
          <button
            className="underline text-blue-500 hover:text-blue-700"
            onClick={() =>
              fetch("/api/lemlist/linkedin-sends", { method: "POST" }).then(() =>
                window.location.reload()
              )
            }
          >
            sync now
          </button>
          .
        </p>
      </div>
    );
  }

  const todayRow = data[data.length - 1];
  const avgSent =
    data.length > 1
      ? Math.round(data.slice(0, -1).reduce((s, r) => s + r.sent_count, 0) / (data.length - 1))
      : null;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 pt-5 pb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            LinkedIn first messages / day
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">
            New people contacted each day (step 1, Coach campaign)
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-neutral-900">{todayRow.sent_count}</p>
          <p className="text-xs text-neutral-400 mt-0.5">today</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          {avgSent !== null && (
            <ReferenceLine
              y={avgSent}
              stroke="#94a3b8"
              strokeDasharray="4 3"
              label={{ value: `avg ${avgSent}`, position: "right", fontSize: 10, fill: "#94a3b8" }}
            />
          )}
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs shadow-sm space-y-0.5">
                  <p className="font-semibold text-neutral-700">{fmtDate(String(label))}</p>
                  <p className="text-blue-600 font-bold">
                    {Number(payload[0].value)} message{Number(payload[0].value) !== 1 ? "s" : ""} sent
                  </p>
                  <p className="text-neutral-400">
                    {(payload[0].payload as LinkedInDaySend).cumulative_total} total since launch
                  </p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="sent_count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

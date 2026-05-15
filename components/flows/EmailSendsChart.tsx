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
import type { EmailDaySend } from "@/lib/lemlist-email-sends";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function buildDemoData(): EmailDaySend[] {
  const today = new Date();
  const counts = [12, 15, 0, 18, 14, 16, 0, 20, 13, 17, 11, 19, 15, 8];
  return counts.map((email_count, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (counts.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), email_count };
  });
}

const DEMO_DATA = buildDemoData();
const STORAGE_KEY = "koja2:blur-sensitive";

export default function EmailSendsChart({ rows }: { rows: EmailDaySend[] }) {
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
  const workdays = data.filter((r) => new Date(r.date + "T12:00:00").getDay() !== 0);
  const avg = workdays.length > 0
    ? Math.round(workdays.reduce((s, r) => s + r.email_count, 0) / workdays.length)
    : 0;
  const todayCount = data[data.length - 1]?.email_count ?? 0;

  if (!demo && rows.every((r) => r.email_count === 0)) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 py-10 text-center">
        <p className="text-sm text-neutral-400">No email data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 pt-5 pb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Emails sent / day
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">
            Via Lemlist — last 30 days
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-600">{todayCount}</p>
          <p className="text-xs text-neutral-400">today</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={7}>
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
            label={{ value: `avg ${avg}`, position: "insideTopRight", fontSize: 10, fill: "#10b981" }}
          />
          <Bar dataKey="email_count" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

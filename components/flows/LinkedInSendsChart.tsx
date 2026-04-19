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
  Legend,
  ReferenceLine,
} from "recharts";
import type { LinkedInDaySend } from "@/lib/lemlist-linkedin";

const STORAGE_KEY = "koja2:blur-sensitive";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function buildDemoData() {
  const today = new Date();
  const rows = [
    { sent: 3, invite: 18 }, { sent: 5, invite: 20 }, { sent: 0, invite: 0 },
    { sent: 8, invite: 20 }, { sent: 6, invite: 16 }, { sent: 4, invite: 20 },
    { sent: 0, invite: 0 }, { sent: 7, invite: 20 }, { sent: 9, invite: 20 },
    { sent: 5, invite: 18 }, { sent: 3, invite: 20 }, { sent: 6, invite: 20 },
    { sent: 8, invite: 20 }, { sent: 4, invite: 16 },
  ];
  return rows.map(({ sent, invite }, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (rows.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), sent_count: sent, invite_count: invite, cumulative_total: 0 };
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
          No data yet —{" "}
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
        </p>
      </div>
    );
  }

  const todayRow = data[data.length - 1];
  const workdays = data.filter((r) => new Date(r.date + "T12:00:00").getDay() !== 0);
  const avgInvite = workdays.length > 0 ? Math.round(workdays.reduce((s, r) => s + r.invite_count, 0) / workdays.length) : 0;
  const avgSent = workdays.length > 0 ? Math.round(workdays.reduce((s, r) => s + r.sent_count, 0) / workdays.length) : 0;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 pt-5 pb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            LinkedIn outreach / day
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">
            Invites sent &amp; first messages (Coach campaign)
          </p>
        </div>
        <div className="text-right flex gap-4">
          <div>
            <p className="text-lg font-bold text-violet-600">{todayRow.invite_count}</p>
            <p className="text-xs text-neutral-400">invites today</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-600">{todayRow.sent_count}</p>
            <p className="text-xs text-neutral-400">messages today</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={6} barGap={2}>
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
                <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs shadow-sm space-y-0.5">
                  <p className="font-semibold text-neutral-700">{fmtDate(String(label))}</p>
                  <p className="text-violet-600 font-medium">{(payload[0]?.payload as LinkedInDaySend).invite_count} invites</p>
                  <p className="text-blue-600 font-medium">{(payload[0]?.payload as LinkedInDaySend).sent_count} first messages</p>
                </div>
              ) : null
            }
          />
          <Legend
            iconType="square"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-neutral-500">
                {value === "invite_count" ? "Invites" : "First messages"}
              </span>
            )}
          />
          <ReferenceLine
            y={avgInvite}
            stroke="#8b5cf6"
            strokeDasharray="4 3"
            strokeOpacity={0.6}
            label={{ value: `avg ${avgInvite}`, position: "insideTopRight", fontSize: 10, fill: "#8b5cf6" }}
          />
          <ReferenceLine
            y={avgSent}
            stroke="#3b82f6"
            strokeDasharray="4 3"
            strokeOpacity={0.6}
            label={{ value: `avg ${avgSent}`, position: "insideBottomRight", fontSize: 10, fill: "#3b82f6" }}
          />
          <Bar dataKey="invite_count" name="invite_count" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="sent_count" name="sent_count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

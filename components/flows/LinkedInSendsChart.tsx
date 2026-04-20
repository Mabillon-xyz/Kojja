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
import type { EmailDaySend } from "@/lib/lemlist-email-sends";

const STORAGE_KEY = "koja2:blur-sensitive";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type MergedDay = {
  date: string;
  sent_count: number;
  invite_count: number;
  cumulative_total: number;
  email_count: number;
};

function buildDemoData(): MergedDay[] {
  const today = new Date();
  const rows = [
    { sent: 3, invite: 18, email: 12 }, { sent: 5, invite: 20, email: 15 }, { sent: 0, invite: 0, email: 0 },
    { sent: 8, invite: 20, email: 18 }, { sent: 6, invite: 16, email: 10 }, { sent: 4, invite: 20, email: 14 },
    { sent: 0, invite: 0, email: 0 }, { sent: 7, invite: 20, email: 16 }, { sent: 9, invite: 20, email: 20 },
    { sent: 5, invite: 18, email: 11 }, { sent: 3, invite: 20, email: 13 }, { sent: 6, invite: 20, email: 17 },
    { sent: 8, invite: 20, email: 19 }, { sent: 4, invite: 16, email: 9 },
  ];
  return rows.map(({ sent, invite, email }, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (rows.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), sent_count: sent, invite_count: invite, cumulative_total: 0, email_count: email };
  });
}

const DEMO_DATA = buildDemoData();

export default function LinkedInSendsChart({
  rows,
  emailRows = [],
}: {
  rows: LinkedInDaySend[];
  emailRows?: EmailDaySend[];
}) {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(localStorage.getItem(STORAGE_KEY) === "1");
    function onToggle(e: Event) {
      setDemo((e as CustomEvent<boolean>).detail);
    }
    window.addEventListener("koja2:presentation-mode", onToggle);
    return () => window.removeEventListener("koja2:presentation-mode", onToggle);
  }, []);

  let data: MergedDay[];
  if (demo) {
    data = DEMO_DATA;
  } else {
    const emailByDate = new Map(emailRows.map((r) => [r.date, r.email_count]));
    data = rows.map((r) => ({
      ...r,
      email_count: emailByDate.get(r.date) ?? 0,
    }));
    // Add email-only dates not in LinkedIn rows
    for (const er of emailRows) {
      if (!data.find((r) => r.date === er.date)) {
        data.push({ date: er.date, sent_count: 0, invite_count: 0, cumulative_total: 0, email_count: er.email_count });
      }
    }
    data.sort((a, b) => a.date.localeCompare(b.date));
  }

  if (!demo && rows.length === 0 && emailRows.length === 0) {
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
  const avgEmail = workdays.length > 0 ? Math.round(workdays.reduce((s, r) => s + r.email_count, 0) / workdays.length) : 0;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-6 pt-5 pb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Outreach / day — Coach campaign
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">
            LinkedIn invites, first messages &amp; emails sent
          </p>
        </div>
        <div className="text-right flex gap-4">
          <div>
            <p className="text-lg font-bold text-violet-600">{todayRow?.invite_count ?? 0}</p>
            <p className="text-xs text-neutral-400">invites today</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-600">{todayRow?.sent_count ?? 0}</p>
            <p className="text-xs text-neutral-400">messages today</p>
          </div>
          <div>
            <p className="text-lg font-bold text-amber-500">{todayRow?.email_count ?? 0}</p>
            <p className="text-xs text-neutral-400">emails today</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={5} barGap={1}>
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
                  <p className="text-violet-600 font-medium">{(payload[0]?.payload as MergedDay).invite_count} invites</p>
                  <p className="text-blue-600 font-medium">{(payload[0]?.payload as MergedDay).sent_count} first messages</p>
                  <p className="text-amber-500 font-medium">{(payload[0]?.payload as MergedDay).email_count} emails</p>
                </div>
              ) : null
            }
          />
          <Legend
            iconType="square"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-neutral-500">
                {value === "invite_count" ? "Invites" : value === "sent_count" ? "First messages" : "Emails"}
              </span>
            )}
          />
          <ReferenceLine
            y={avgInvite}
            stroke="#8b5cf6"
            strokeDasharray="4 3"
            strokeOpacity={0.5}
            label={{ value: `avg ${avgInvite}`, position: "insideTopRight", fontSize: 10, fill: "#8b5cf6" }}
          />
          <ReferenceLine
            y={avgSent}
            stroke="#3b82f6"
            strokeDasharray="4 3"
            strokeOpacity={0.5}
            label={{ value: `avg ${avgSent}`, position: "insideTopLeft", fontSize: 10, fill: "#3b82f6" }}
          />
          <ReferenceLine
            y={avgEmail}
            stroke="#f59e0b"
            strokeDasharray="4 3"
            strokeOpacity={0.5}
            label={{ value: `avg ${avgEmail}`, position: "insideBottomRight", fontSize: 10, fill: "#f59e0b" }}
          />
          <Bar dataKey="invite_count" name="invite_count" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="sent_count" name="sent_count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="email_count" name="email_count" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

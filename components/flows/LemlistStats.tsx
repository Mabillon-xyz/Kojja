"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type LemlistStatsData = {
  nbLeads?: number;
  nbLeadsLaunched?: number;
  nbLeadsReached?: number;
  nbLeadsOpened?: number;
  nbLeadsAnswered?: number;
  nbLeadsInterested?: number;
  nbLeadsNotInterested?: number;
  nbLeadsUnsubscribed?: number;
  messagesSent?: number;
  messagesBounced?: number;
  opened?: number;
  clicked?: number;
  replied?: number;
  meetingBooked?: number;
};

function pct(num?: number, den?: number) {
  if (!den || !num) return "0%";
  return Math.round((num / den) * 100) + "%";
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
      <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">{label}</p>
      <p className="text-3xl font-bold text-neutral-900">{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function LemlistStats() {
  const [data, setData] = useState<LemlistStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lemlist/stats");
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-400 text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading Lemlist stats…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const launched = data.nbLeadsLaunched ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Campaign stats</h2>
          <p className="text-xs text-neutral-400 mt-0.5">{data.nbLeads ?? 0} leads total · refreshed every 5 min</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Funnel KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Launched" value={launched} sub="leads contacted" />
        <StatCard label="Reached" value={data.nbLeadsReached ?? 0} sub={pct(data.nbLeadsReached, launched) + " of launched"} />
        <StatCard label="Opened" value={data.nbLeadsOpened ?? 0} sub={pct(data.nbLeadsOpened, launched) + " open rate"} />
        <StatCard label="Replied" value={data.nbLeadsAnswered ?? 0} sub={pct(data.nbLeadsAnswered, launched) + " reply rate"} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Interested" value={data.nbLeadsInterested ?? 0} sub={pct(data.nbLeadsInterested, launched)} />
        <StatCard label="Not interested" value={data.nbLeadsNotInterested ?? 0} sub={pct(data.nbLeadsNotInterested, launched)} />
        <StatCard label="Unsubscribed" value={data.nbLeadsUnsubscribed ?? 0} sub={pct(data.nbLeadsUnsubscribed, launched)} />
        <StatCard label="Meetings booked" value={data.meetingBooked ?? 0} sub={pct(data.meetingBooked, launched)} />
      </div>

      {/* Message metrics */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 bg-neutral-50">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Message metrics</p>
        </div>
        <div className="divide-y divide-neutral-100">
          {[
            { label: "Sent", value: data.messagesSent ?? 0 },
            { label: "Opened", value: data.opened ?? 0, rate: pct(data.opened, data.messagesSent) },
            { label: "Clicked", value: data.clicked ?? 0, rate: pct(data.clicked, data.messagesSent) },
            { label: "Replied", value: data.replied ?? 0, rate: pct(data.replied, data.messagesSent) },
            { label: "Bounced", value: data.messagesBounced ?? 0, rate: pct(data.messagesBounced, data.messagesSent) },
          ].map(({ label, value, rate }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-neutral-600">{label}</span>
              <div className="flex items-center gap-4">
                {rate && <span className="text-xs text-neutral-400">{rate}</span>}
                <span className="text-sm font-semibold text-neutral-900 w-12 text-right">{value.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

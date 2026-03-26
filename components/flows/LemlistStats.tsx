"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import type { ConversionData, EnrichedLead } from "@/app/api/lemlist/conversion/route";
import type { Snapshot } from "@/app/api/lemlist/snapshots/route";
import ConversionChart from "./ConversionChart";

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

const STAGE_STYLES: Record<string, { label: string; className: string }> = {
  call_scheduled: { label: "Call scheduled", className: "bg-blue-100 text-blue-700" },
  call_done: { label: "Call done", className: "bg-violet-100 text-violet-700" },
  proposal_sent: { label: "Proposal sent", className: "bg-orange-100 text-orange-700" },
  customer: { label: "Customer", className: "bg-green-100 text-green-700" },
  not_interested: { label: "Not interested", className: "bg-red-100 text-red-600" },
};

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-400">
        Not in CRM
      </span>
    );
  }
  const s = STAGE_STYLES[stage] ?? { label: stage, className: "bg-neutral-100 text-neutral-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${res.url} (${res.status}): ${text.slice(0, 100)}`);
  }
}

export default function LemlistStats({ account = "clement" }: { account?: string }) {
  const [data, setData] = useState<LemlistStatsData | null>(null);
  const [conv, setConv] = useState<(ConversionData & { updatedAt?: string | null }) | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const q = `?account=${account}`;

  // Fast load — reads from cache
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, convRes, snapshotsRes] = await Promise.all([
        fetch(`/api/lemlist/stats${q}`),
        fetch(`/api/lemlist/conversion${q}`),
        fetch(`/api/lemlist/snapshots${q}`),
      ]);

      const [statsData, convData, snapshotsData] = await Promise.all([
        parseJson(statsRes),
        parseJson(convRes),
        parseJson(snapshotsRes),
      ]);

      if (!statsRes.ok) {
        const msg = statsData?.error ?? `Stats error ${statsRes.status}`;
        const detail = statsData?.detail ? ` — ${statsData.detail}` : "";
        throw new Error(msg + detail);
      }
      if (!convRes.ok) {
        const msg = convData?.error ?? `Conversion error ${convRes.status}`;
        const detail = convData?.detail ? ` — ${convData.detail}` : "";
        throw new Error(msg + detail);
      }
      setData(statsData);
      setConv(convData);
      setSnapshots(Array.isArray(snapshotsData) ? snapshotsData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  // Slow sync — re-fetches from Lemlist, rebuilds cache
  async function sync() {
    setSyncing(true);
    setError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`/api/lemlist/conversion${q}`, { method: "POST", signal: controller.signal });
      const d = await parseJson(res);
      if (!res.ok) throw new Error(d?.error ?? `Sync error ${res.status}`);
      setConv(d);
      // Refresh snapshot history after sync
      const snapshotsRes = await fetch(`/api/lemlist/snapshots${q}`);
      const snapshotsData = await parseJson(snapshotsRes);
      setSnapshots(Array.isArray(snapshotsData) ? snapshotsData : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setError(e instanceof Error && e.name === "AbortError" ? "Sync timed out — try again" : msg);
    } finally {
      clearTimeout(timer);
      setSyncing(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [account]);

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
      <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-sm text-red-600 space-y-1">
        <p className="font-semibold">{error.split(":")[0]}</p>
        <p className="font-mono text-xs break-all opacity-80">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const launched = data.nbLeadsLaunched ?? 0;

  // Table shows only CRM-matched leads
  const sortedLeads: EnrichedLead[] = conv
    ? conv.leads.filter((l) => l.inCrm)
    : [];
  const visibleLeads = showAll ? sortedLeads : sortedLeads.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Campaign stats</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {data.nbLeads ?? 0} leads total
            {conv?.updatedAt && (
              <> · CRM synced {new Date(conv.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at {new Date(conv.updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</>
            )}
            {!conv?.updatedAt && <> · CRM not synced yet</>}
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync CRM"}
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

      {/* Conversion rate chart */}
      <ConversionChart snapshots={snapshots} />

      {/* CRM KPIs */}
      {conv && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Customers"
            value={conv.customers}
            sub={conv.coachTotal > 0 ? Math.round((conv.customers / conv.coachTotal) * 100) + "% of Coach leads" : "0%"}
          />
          <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Conversion rate</p>
            <p className="text-3xl font-bold text-green-600">{conv.conversionRate}</p>
            <p className="text-xs text-neutral-400 mt-1">leads → customers</p>
          </div>
        </div>
      )}

      {/* CRM Leads */}
      {conv && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-neutral-900">CRM leads</h3>
            <span className="text-xs text-neutral-400 font-medium">matched against CRM</span>
          </div>

          {/* Leads table */}
          {sortedLeads.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Campaign leads · {conv.total} total
                </p>
                <span className="text-xs text-neutral-400">{conv.inCrm} matched in CRM</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Name</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Email</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Company</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">CRM stage</th>
                      <th className="px-5 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLeads.map((lead, i) => (
                      <tr key={lead.email ?? i} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-neutral-900 whitespace-nowrap">
                          {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-5 py-3 text-neutral-500 text-xs">{lead.email ?? "—"}</td>
                        <td className="px-5 py-3 text-neutral-500 text-xs whitespace-nowrap">{lead.companyName ?? "—"}</td>
                        <td className="px-5 py-3">
                          <StageBadge stage={lead.crmStage} />
                        </td>
                        <td className="px-5 py-3">
                          {lead.linkedinUrl && (
                            <a
                              href={lead.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-neutral-300 hover:text-blue-500 transition-colors"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sortedLeads.length > 10 && (
                <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50">
                  <button
                    onClick={() => setShowAll((v) => !v)}
                    className="text-xs text-neutral-500 hover:text-neutral-700 font-medium transition-colors"
                  >
                    {showAll ? "Show less" : `Show all ${sortedLeads.length} leads`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ExternalLink, Zap, Send } from "lucide-react";
import FlowsDailyChart from "./FlowsDailyChart";
import LemlistStats from "./LemlistStats";

type Lead = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  companyName?: string;
  linkedinUrl?: string;
  campaignName?: string;
};

export type WebhookEvent = {
  id: string;
  created_at: string;
  source: string;
  workflow: string | null;
  leads_count: number;
  payload: { client?: string; leads?: Lead[]; [key: string]: unknown };
};

export type DailyCount = { date: string; count: number };

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

const lemlistAccounts = [
  { id: "clement", label: "Clément" },
  { id: "sandro", label: "Sandro" },
];

type Tab = "flows" | `lemlist-${string}`;

export default function FlowsList({ events, chartData = [] }: { events: WebhookEvent[]; chartData?: DailyCount[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("flows");

  return (
    <div className="flex gap-6">
      {/* Secondary sidebar */}
      <aside className="w-48 flex-shrink-0">
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <nav className="p-2 space-y-0.5">
            <button
              onClick={() => setTab("flows")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                tab === "flows"
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
              }`}
            >
              <Zap className="w-3.5 h-3.5 flex-shrink-0" />
              Flow Runs
              {tab === "flows" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
            </button>

            <div className="pt-2 pb-1 px-3">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Lemlist</span>
            </div>

            {lemlistAccounts.map((account) => {
              const accountTab: Tab = `lemlist-${account.id}`;
              const active = tab === accountTab;
              return (
                <button
                  key={account.id}
                  onClick={() => setTab(accountTab)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                    active
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
                  }`}
                >
                  <Send className="w-3.5 h-3.5 flex-shrink-0" />
                  {account.label}
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-neutral-900">Campaigns</h1>
          <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            <Zap className="w-3.5 h-3.5" />
            Live
          </div>
        </div>

        {tab.startsWith("lemlist-") && <LemlistStats account={tab.replace("lemlist-", "")} />}

        {tab === "flows" && (
          <>
            <div className="mb-6">
              <FlowsDailyChart chartData={chartData} />
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider w-8" />
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Client</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Campaign</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Leads</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-20 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Zap className="w-8 h-8 text-neutral-200" />
                          <p className="text-sm font-medium text-neutral-400">No flows received yet</p>
                          <span className="text-xs text-neutral-300 font-mono">POST → /api/webhook/n8n</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    events.map((ev) => {
                      const isOpen = expanded === ev.id;
                      const client = (ev.payload?.client as string) ?? "—";
                      const campaign = ev.payload?.leads?.[0]?.campaignName ?? ev.workflow ?? "—";
                      const leads = Array.isArray(ev.payload?.leads) ? (ev.payload.leads as Lead[]) : [];

                      return (
                        <Fragment key={ev.id}>
                          <tr
                            onClick={() => setExpanded(isOpen ? null : ev.id)}
                            className={`border-b border-neutral-100 cursor-pointer transition-colors ${isOpen ? "bg-blue-50/40" : "hover:bg-neutral-50"}`}
                          >
                            <td className="pl-5 py-4 text-neutral-400">
                              <ChevronDown
                                size={14}
                                className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-500" : ""}`}
                              />
                            </td>
                            <td className="px-5 py-4 font-semibold text-neutral-900">{client}</td>
                            <td className="px-5 py-4 text-neutral-500 max-w-xs truncate">{campaign}</td>
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                {ev.leads_count}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-neutral-400 text-xs font-medium">{fmt(ev.created_at)}</td>
                          </tr>

                          {isOpen && (
                            <tr key={`${ev.id}-detail`}>
                              <td colSpan={5} className="bg-neutral-50 border-b border-neutral-100 px-0 py-0">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-neutral-200">
                                        <th className="pl-14 pr-4 py-2.5 text-left font-semibold text-neutral-400 uppercase tracking-wider">Name</th>
                                        <th className="px-4 py-2.5 text-left font-semibold text-neutral-400 uppercase tracking-wider">Company</th>
                                        <th className="px-4 py-2.5 text-left font-semibold text-neutral-400 uppercase tracking-wider">Title</th>
                                        <th className="px-4 py-2.5 text-left font-semibold text-neutral-400 uppercase tracking-wider">LinkedIn</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {leads.map((lead, i) => (
                                        <tr key={lead._id ?? i} className="border-b border-neutral-100 last:border-0 hover:bg-white transition-colors">
                                          <td className="pl-14 pr-4 py-2.5 font-semibold text-neutral-700 whitespace-nowrap">
                                            {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
                                          </td>
                                          <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">{lead.companyName ?? "—"}</td>
                                          <td className="px-4 py-2.5 text-neutral-500 max-w-xs truncate">{lead.jobTitle ?? "—"}</td>
                                          <td className="px-4 py-2.5">
                                            {lead.linkedinUrl ? (
                                              <a
                                                href={lead.linkedinUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                                              >
                                                <ExternalLink size={10} /> View
                                              </a>
                                            ) : "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

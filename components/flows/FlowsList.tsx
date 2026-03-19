"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";

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

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function FlowsList({ events }: { events: WebhookEvent[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Flows</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {events.length} run{events.length !== 1 ? "s" : ""} received
        </p>
      </div>

      <div className="bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-neutral-200 bg-white">
              <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide w-8" />
              <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">Client</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">Campaign</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">Leads</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">Sent</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-sm text-neutral-400">
                  No flows received yet.
                  <span className="block mt-1 text-xs text-neutral-300">POST → /api/webhook/n8n</span>
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
                      className={`border-b border-neutral-200 cursor-pointer transition-colors ${isOpen ? "bg-neutral-100" : "hover:bg-neutral-100/60"}`}
                    >
                      <td className="pl-5 py-3.5 text-neutral-400">
                        <ChevronDown
                          size={14}
                          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </td>
                      <td className="px-5 py-3.5 font-medium text-neutral-900">{client}</td>
                      <td className="px-5 py-3.5 text-neutral-500">{campaign}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-200 text-neutral-600">
                          {ev.leads_count}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-neutral-400 text-xs">{fmt(ev.created_at)}</td>
                    </tr>

                    {isOpen && (
                      <tr key={`${ev.id}-detail`}>
                        <td colSpan={5} className="bg-neutral-50 border-b border-neutral-200 px-0 py-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-neutral-200 bg-neutral-100">
                                  <th className="pl-14 pr-4 py-2 text-left font-medium text-neutral-400 uppercase tracking-wide">Name</th>
                                  <th className="px-4 py-2 text-left font-medium text-neutral-400 uppercase tracking-wide">Company</th>
                                  <th className="px-4 py-2 text-left font-medium text-neutral-400 uppercase tracking-wide">Title</th>
                                  <th className="px-4 py-2 text-left font-medium text-neutral-400 uppercase tracking-wide">LinkedIn</th>
                                </tr>
                              </thead>
                              <tbody>
                                {leads.map((lead, i) => (
                                  <tr key={lead._id ?? i} className="border-b border-neutral-200 last:border-0 hover:bg-neutral-100/60 transition-colors">
                                    <td className="pl-14 pr-4 py-2.5 font-medium text-neutral-700 whitespace-nowrap">
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
                                          className="flex items-center gap-1 text-blue-500 hover:underline whitespace-nowrap"
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
    </div>
  );
}

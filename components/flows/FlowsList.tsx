"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";

type Lead = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  companyName?: string;
  linkedinUrl?: string;
  campaignName?: string;
  contactId?: string;
};

export type WebhookEvent = {
  id: string;
  created_at: string;
  source: string;
  workflow: string | null;
  leads_count: number;
  payload: { leads?: Lead[]; [key: string]: unknown };
};

function fmt(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function FlowsList({ events }: { events: WebhookEvent[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div className="p-10 max-w-3xl">
        <h1 className="text-xl font-semibold text-gray-900">Flows</h1>
        <p className="mt-1 text-sm text-gray-400">
          n8n webhook results — chaque run apparaît ici automatiquement.
        </p>
        <div className="mt-10 py-16 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl">
          Aucun flow reçu pour l&apos;instant.
          <p className="mt-1 text-xs text-gray-300">POST → /api/webhook/n8n</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Flows</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {events.length} run{events.length > 1 ? "s" : ""} reçu{events.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {events.map((ev) => {
          const isOpen = expanded === ev.id;
          const leads = ev.payload?.leads ?? [];
          const { date, time } = fmt(ev.created_at);

          return (
            <div key={ev.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header row */}
              <button
                onClick={() => setExpanded(isOpen ? null : ev.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{ev.workflow ?? ev.source}</p>
                    <p className="text-xs text-gray-400">{date} · {time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                    {ev.leads_count} lead{ev.leads_count > 1 ? "s" : ""}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {/* Leads table */}
              {isOpen && (
                <div className="border-t border-gray-100 overflow-x-auto">
                  {leads.length === 0 ? (
                    <p className="px-5 py-4 text-xs text-gray-400">Aucun lead dans ce payload.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500">Nom</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500">Entreprise</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500">Titre</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500">Campagne</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500">LinkedIn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead, i) => (
                          <tr key={lead._id ?? i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                            <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                              {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{lead.companyName ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-500 max-w-[220px] truncate">{lead.jobTitle ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{lead.campaignName ?? "—"}</td>
                            <td className="px-4 py-3">
                              {lead.linkedinUrl ? (
                                <a
                                  href={lead.linkedinUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-blue-600 hover:underline whitespace-nowrap"
                                >
                                  <ExternalLink size={11} /> Voir
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function FlowsList({ events }: { events: WebhookEvent[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Flows</h1>
        <p className="mt-0.5 text-sm text-gray-400">
          {events.length} run{events.length > 1 ? "s" : ""} reçu{events.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-8" />
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Campagne</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Leads</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Envoyé</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-sm text-gray-400">
                  Aucun flow reçu pour l&apos;instant.
                  <span className="block mt-1 text-xs text-gray-300">POST → /api/webhook/n8n</span>
                </td>
              </tr>
            ) : (
              events.map((ev) => {
                const isOpen = expanded === ev.id;
                const client = (ev.payload?.client as string) ?? "—";
                const campaign = ev.payload?.leads?.[0]?.campaignName ?? ev.workflow ?? "—";
                const leads = ev.payload?.leads ?? [];

                return (
                  <>
                    {/* Summary row */}
                    <tr
                      key={ev.id}
                      onClick={() => setExpanded(isOpen ? null : ev.id)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors ${isOpen ? "bg-gray-50" : "hover:bg-gray-50/50"}`}
                    >
                      <td className="pl-5 py-3.5 text-gray-400">
                        <ChevronDown
                          size={14}
                          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-900">{client}</td>
                      <td className="px-5 py-3.5 text-gray-600">{campaign}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {ev.leads_count}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{fmt(ev.created_at)}</td>
                    </tr>

                    {/* Expanded leads */}
                    {isOpen && (
                      <tr key={`${ev.id}-detail`}>
                        <td colSpan={5} className="bg-gray-50 border-b border-gray-100 px-0 py-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-200 bg-gray-100">
                                  <th className="pl-14 pr-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Nom</th>
                                  <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Entreprise</th>
                                  <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Titre</th>
                                  <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">LinkedIn</th>
                                </tr>
                              </thead>
                              <tbody>
                                {leads.map((lead, i) => (
                                  <tr key={lead._id ?? i} className="border-b border-gray-100 last:border-0 hover:bg-white/60 transition-colors">
                                    <td className="pl-14 pr-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                                      {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{lead.companyName ?? "—"}</td>
                                    <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{lead.jobTitle ?? "—"}</td>
                                    <td className="px-4 py-2.5">
                                      {lead.linkedinUrl ? (
                                        <a
                                          href={lead.linkedinUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1 text-blue-600 hover:underline whitespace-nowrap"
                                        >
                                          <ExternalLink size={10} /> Voir
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
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

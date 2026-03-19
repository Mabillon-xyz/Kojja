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
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function FlowsList({ events }: { events: WebhookEvent[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">⚡ Flows</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {events.length} run{events.length > 1 ? "s" : ""} reçu{events.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="bg-muted rounded-xl border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-border bg-secondary">
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-8" />
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Client</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Campagne</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Leads</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Envoyé</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-sm text-muted-foreground">
                  Aucun flow reçu pour l&apos;instant.
                  <span className="block mt-1 text-xs text-muted-foreground/60">POST → /api/webhook/n8n</span>
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
                      className={`border-b border-border cursor-pointer transition-colors ${isOpen ? "bg-secondary" : "hover:bg-secondary/60"}`}
                    >
                      <td className="pl-5 py-3.5 text-muted-foreground">
                        <ChevronDown
                          size={14}
                          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">{client}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{campaign}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-border text-muted-foreground">
                          {ev.leads_count}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{fmt(ev.created_at)}</td>
                    </tr>

                    {isOpen && (
                      <tr key={`${ev.id}-detail`}>
                        <td colSpan={5} className="bg-secondary/60 border-b border-border px-0 py-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border bg-muted">
                                  <th className="pl-14 pr-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide">Name</th>
                                  <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide">Company</th>
                                  <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide">Title</th>
                                  <th className="px-4 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide">LinkedIn</th>
                                </tr>
                              </thead>
                              <tbody>
                                {leads.map((lead, i) => (
                                  <tr key={lead._id ?? i} className="border-b border-border last:border-0 hover:bg-secondary/60 transition-colors">
                                    <td className="pl-14 pr-4 py-2.5 font-medium text-foreground/80 whitespace-nowrap">
                                      {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
                                    </td>
                                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{lead.companyName ?? "—"}</td>
                                    <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">{lead.jobTitle ?? "—"}</td>
                                    <td className="px-4 py-2.5">
                                      {lead.linkedinUrl ? (
                                        <a
                                          href={lead.linkedinUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1 text-blue-400 hover:underline whitespace-nowrap"
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

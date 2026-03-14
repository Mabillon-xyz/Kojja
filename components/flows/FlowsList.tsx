"use client";

type Lead = {
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
  return `${d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  })} · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function FlowsList({ events }: { events: WebhookEvent[] }) {
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
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Campagne</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Leads</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Envoyé</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center text-sm text-gray-400">
                  Aucun flow reçu pour l&apos;instant.
                  <span className="block mt-1 text-xs text-gray-300">POST → /api/webhook/n8n</span>
                </td>
              </tr>
            ) : (
              events.map((ev) => {
                const client = (ev.payload?.client as string) ?? "—";
                const campaign = ev.payload?.leads?.[0]?.campaignName ?? ev.workflow ?? "—";

                return (
                  <tr key={ev.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{client}</td>
                    <td className="px-5 py-3.5 text-gray-600">{campaign}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {ev.leads_count}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{fmt(ev.created_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

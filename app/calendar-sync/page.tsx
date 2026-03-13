"use client";

import { useState } from "react";

type SyncResult = {
  created: number;
  skipped: number;
  total: number;
  createdTitles: string[];
  errors: string[];
  syncedUntil: string;
};

export default function CalendarSyncPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSync() {
    setStatus("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/calendar-sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Sync failed");
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("success");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Network error");
      setStatus("error");
    }
  }

  const syncedUntil = result
    ? new Date(result.syncedUntil).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="p-10 max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900">Calendar Sync</h1>
      <p className="mt-1 text-sm text-gray-400">
        EdenRed → clement.guiraudpro@gmail.com · 3 semaines à venir
      </p>

      <div className="mt-8">
        <button
          onClick={handleSync}
          disabled={status === "loading"}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Synchronisation…
            </>
          ) : (
            <>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
              Synchroniser
            </>
          )}
        </button>
      </div>

      {status === "success" && result && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-gray-900">Synchronisation terminée</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{result.created}</p>
                <p className="text-xs text-gray-400 mt-0.5">ajouté{result.created > 1 ? "s" : ""}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{result.skipped}</p>
                <p className="text-xs text-gray-400 mt-0.5">déjà synchro</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                <p className="text-xs text-gray-400 mt-0.5">total</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Jusqu'au {syncedUntil}</p>
          </div>

          {result.createdTitles.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Événements ajoutés
              </p>
              <ul className="space-y-1">
                {result.createdTitles.map((title, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    {title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.created === 0 && (
            <p className="text-sm text-gray-400">Tout est déjà à jour.</p>
          )}

          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">Erreurs</p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-sm text-red-400">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4">
          <p className="text-sm text-red-500">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

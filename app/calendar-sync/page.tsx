"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, RefreshCw, Video, Calendar, X, Save,
  RotateCw, Copy, Check, Clock, Globe, Plus, Trash2,
} from "lucide-react";
import type { AvailabilityConfig, DaySchedule } from "@/app/api/settings/availability/route";

// ── Types ──────────────────────────────────────────────────────
type CalEvent = {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string; self?: boolean }[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { uri: string; entryPointType: string }[] };
  location?: string;
  htmlLink?: string;
};

type Invite = {
  id: string;
  name: string;
  email: string;
  date: string;
  time: string;
  meetLink: string | null;
  calLink: string | null;
  createdAt: number;
};

type Tab = "calendar" | "scheduling" | "availability";

// ── Constants ──────────────────────────────────────────────────
const MY_EMAIL = "clement.guiraudpro@gmail.com";
const HOUR_START = 8;
const HOUR_END = 21;
const SLOT_H = 60; // px per hour
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEAD_KW = ["call", "appel", "discovery", "first", "premier", "lead", "demo", "rendez", "rdv", "intro"];
const BOOK_URL = "https://kojja.vercel.app/book";

const DAY_LABELS: Record<string, string> = {
  "1": "Lundi",
  "2": "Mardi",
  "3": "Mercredi",
  "4": "Jeudi",
  "5": "Vendredi",
  "6": "Samedi",
  "7": "Dimanche",
};

const DEFAULT_CONFIG: AvailabilityConfig = {
  days: {
    "1": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "2": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "3": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "4": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "5": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
  },
};

// ── Helpers ─────────────────────────────────────────────────────
function getMondayOfWeek(d: Date): Date {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function fmt(d: Date, opts: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString("fr-FR", opts);
}

function isLeadEvent(ev: CalEvent): boolean {
  const title = (ev.summary ?? "").toLowerCase();
  const hasExternal = (ev.attendees ?? []).some(
    (a) => !a.self && a.email.toLowerCase() !== MY_EMAIL && !a.email.includes("resource.calendar")
  );
  return hasExternal || LEAD_KW.some((kw) => title.includes(kw));
}

function getMeetLink(ev: CalEvent): string | null {
  return (
    ev.hangoutLink ??
    ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null
  );
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Availability editor subcomponent ────────────────────────────
function AvailabilityTab() {
  const [config, setConfig] = useState<AvailabilityConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/availability")
      .then((r) => r.json())
      .then((data) => { setConfig(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function isDayActive(day: string) {
    return !!(config.days[day] && config.days[day].length > 0);
  }

  function toggleDay(day: string) {
    setConfig((prev) => {
      const updated = { ...prev, days: { ...prev.days } };
      if (isDayActive(day)) {
        delete updated.days[day];
      } else {
        updated.days[day] = [{ start: "09:00", end: "17:00" }];
      }
      return updated;
    });
  }

  function updateSlot(day: string, idx: number, field: "start" | "end", value: string) {
    setConfig((prev) => {
      const slots = [...(prev.days[day] ?? [])];
      slots[idx] = { ...slots[idx], [field]: value };
      return { ...prev, days: { ...prev.days, [day]: slots } };
    });
  }

  function addSlot(day: string) {
    setConfig((prev) => {
      const slots = [...(prev.days[day] ?? [])];
      const lastEnd = slots[slots.length - 1]?.end ?? "17:00";
      const [lh, lm] = lastEnd.split(":").map(Number);
      const newStart = `${String(lh + 1).padStart(2, "0")}:${String(lm).padStart(2, "0")}`;
      const newEnd = `${String(lh + 2).padStart(2, "0")}:${String(lm).padStart(2, "0")}`;
      slots.push({ start: newStart, end: newEnd });
      return { ...prev, days: { ...prev.days, [day]: slots } };
    });
  }

  function removeSlot(day: string, idx: number) {
    setConfig((prev) => {
      const slots = (prev.days[day] ?? []).filter((_, i) => i !== idx);
      const updated = { ...prev, days: { ...prev.days } };
      if (slots.length === 0) delete updated.days[day];
      else updated.days[day] = slots;
      return updated;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch("/api/settings/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Heures de disponibilité</h2>
        <p className="text-xs text-gray-400">Définissez vos créneaux disponibles pour les appels de découverte.</p>
      </div>

      <div className="space-y-3">
        {["1", "2", "3", "4", "5", "6", "7"].map((day) => {
          const active = isDayActive(day);
          const slots: DaySchedule = config.days[day] ?? [];
          return (
            <div
              key={day}
              className={`rounded-xl border px-4 py-3 transition-colors ${
                active ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleDay(day)}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                      active ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        active ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span className={`text-sm font-medium w-24 ${active ? "text-gray-800" : "text-gray-400"}`}>
                    {DAY_LABELS[day]}
                  </span>
                </div>

                {active && (
                  <button
                    onClick={() => addSlot(day)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={12} /> Ajouter
                  </button>
                )}
              </div>

              {active && slots.length > 0 && (
                <div className="mt-3 space-y-2 pl-12">
                  {slots.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={slot.start}
                        onChange={(e) => updateSlot(day, idx, "start", e.target.value)}
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      />
                      <span className="text-xs text-gray-400">–</span>
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) => updateSlot(day, idx, "end", e.target.value)}
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      />
                      {slots.length > 1 && (
                        <button
                          onClick={() => removeSlot(day, idx)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!active && (
                <p className="pl-12 mt-1 text-xs text-gray-400">Indisponible</p>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {saved ? <Check size={14} /> : <Save size={14} />}
        {saving ? "Enregistrement…" : saved ? "Enregistré !" : "Enregistrer"}
      </button>
    </div>
  );
}

// ── Scheduling tab subcomponent ──────────────────────────────────
function SchedulingTab() {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(BOOK_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="max-w-sm">
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Lien de réservation</h2>
        <p className="text-xs text-gray-400">Partagez ce lien avec vos leads pour qu&apos;ils réservent un créneau.</p>
      </div>

      {/* Event card — Calendly style */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm mb-3 select-none">
            CG
          </div>
          <p className="text-xs text-gray-400 mb-0.5">Clément Guiraud</p>
          <h3 className="text-base font-semibold text-gray-900">Discovery Call</h3>
        </div>
        <div className="p-5 space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm text-gray-500">
            <Clock size={14} className="text-gray-400 flex-shrink-0" />
            <span>30 minutes</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-gray-500">
            <Video size={14} className="text-gray-400 flex-shrink-0" />
            <span>Google Meet</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-gray-500">
            <Globe size={14} className="text-gray-400 flex-shrink-0" />
            <span>Europe/Paris</span>
          </div>
        </div>
      </div>

      {/* Copy link row */}
      <div className="mt-5 flex items-center gap-2">
        <div className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 truncate select-all font-mono">
          {BOOK_URL}
        </div>
        <button
          onClick={copyLink}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
            copied
              ? "bg-green-100 text-green-700"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copié !" : "Copier"}
        </button>
      </div>

      <a
        href={BOOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block text-center text-xs text-blue-600 hover:underline"
      >
        Ouvrir la page de réservation →
      </a>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function CalendarSyncPage() {
  const [tab, setTab] = useState<Tab>("calendar");

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState(false);

  const [invForm, setInvForm] = useState({ name: "", email: "", date: todayStr(), time: "10:00" });
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function triggerSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await fetch("/api/calendar-sync", { method: "POST" });
      const data = await r.json();
      if (!r.ok) {
        setSyncMsg({ ok: false, text: data.error ?? "Sync failed" });
      } else {
        setSyncMsg({ ok: true, text: `${data.created} added, ${data.skipped} already synced` });
        fetchEvents();
      }
    } catch (e: unknown) {
      setSyncMsg({ ok: false, text: e instanceof Error ? e.message : "Network error" });
    }
    setSyncing(false);
  }

  useEffect(() => {
    const n = localStorage.getItem("cal_notes");
    if (n) setNotes(JSON.parse(n));
    const inv = localStorage.getItem("cal_invites");
    if (inv) setInvites(JSON.parse(inv));
  }, []);

  const saveNotes = (updated: Record<string, string>) => {
    setNotes(updated);
    localStorage.setItem("cal_notes", JSON.stringify(updated));
  };

  const saveInvites = (updated: Invite[]) => {
    setInvites(updated);
    localStorage.setItem("cal_invites", JSON.stringify(updated));
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 7);
      const r = await fetch(
        `/api/calendly?start=${weekStart.toISOString()}&end=${end.toISOString()}`
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error fetching events");
      setEvents(data.items ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const prevWeek = () => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; });
  const nextWeek = () => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; });
  const goToday  = () => setWeekStart(getMondayOfWeek(new Date()));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const totalPx = (HOUR_END - HOUR_START) * SLOT_H;

  function dayEvents(d: Date) {
    return events.filter((ev) => {
      const dt = ev.start.dateTime ? new Date(ev.start.dateTime) : null;
      if (!dt) return false;
      const same = new Date(dt); same.setHours(0, 0, 0, 0);
      return same.getTime() === d.getTime();
    });
  }

  function eventStyle(ev: CalEvent) {
    const start = new Date(ev.start.dateTime!);
    const end   = new Date(ev.end?.dateTime ?? start.getTime() + 3600000);
    const startH = start.getHours() + start.getMinutes() / 60;
    const endH   = end.getHours()   + end.getMinutes()   / 60;
    const top    = Math.max(0, (startH - HOUR_START) * SLOT_H);
    const height = Math.max(18, (endH - startH) * SLOT_H - 2);
    return { top, height };
  }

  async function sendInvite() {
    if (!invForm.name || !invForm.email || !invForm.date || !invForm.time) {
      setSendMsg({ ok: false, text: "Please fill in all fields." });
      return;
    }
    setSending(true);
    setSendMsg(null);
    try {
      const r = await fetch("/api/calendly/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invForm),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to create invite");

      const newInvite: Invite = {
        id: data.eventId ?? crypto.randomUUID(),
        name: invForm.name,
        email: invForm.email,
        date: invForm.date,
        time: invForm.time,
        meetLink: data.meetLink ?? null,
        calLink: data.calLink ?? null,
        createdAt: Date.now(),
      };
      saveInvites([newInvite, ...invites]);
      setSendMsg({ ok: true, text: `Invite sent to ${invForm.name}!` });
      setInvForm({ name: "", email: "", date: todayStr(), time: "10:00" });
      fetchEvents();
    } catch (e: unknown) {
      setSendMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setSending(false);
  }

  const weekLabel = `${fmt(days[0], { day: "numeric", month: "short" })} – ${fmt(days[6], { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header with tabs ── */}
      <div className="flex items-center justify-between px-6 py-0 border-b border-gray-100 flex-shrink-0 bg-white">
        {/* Tabs */}
        <div className="flex items-center gap-0">
          {(["calendar", "scheduling", "availability"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = {
              calendar: "Calendrier",
              scheduling: "Scheduling",
              availability: "Disponibilités",
            };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Calendar-tab controls (only shown on calendar tab) */}
        {tab === "calendar" && (
          <div className="flex items-center gap-4 py-2">
            <div className="flex items-center gap-2">
              <button onClick={prevWeek} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-gray-800 w-48 text-center">{weekLabel}</span>
              <button onClick={nextWeek} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
                <ChevronRight size={16} />
              </button>
              <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
                Today
              </button>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-blue-100 border-l-2 border-blue-500 inline-block" />
                My events
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-red-100 border-l-2 border-red-500 inline-block" />
                Lead calls
              </span>
            </div>
            <div className="flex items-center gap-2">
              {syncMsg && (
                <span className={`text-xs ${syncMsg.ok ? "text-green-600" : "text-red-500"}`}>{syncMsg.text}</span>
              )}
              <button onClick={triggerSync} disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition-colors">
                <RotateCw size={12} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Syncing…" : "EdenRed sync"}
              </button>
              <button onClick={fetchEvents} disabled={loading} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-auto">

        {/* ── Calendar tab ── */}
        {tab === "calendar" && (
          <div className="flex gap-4 p-5 min-h-full items-start">
            <div className="flex-1 min-w-0">
              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl">{error}</div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Day headers */}
                <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
                  <div />
                  {days.map((d, i) => {
                    const isToday = d.getTime() === todayDate.getTime();
                    return (
                      <div key={i} className="py-2.5 text-center border-l border-gray-50">
                        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{DAYS_SHORT[i]}</div>
                        <div className={`mx-auto mt-0.5 w-7 h-7 flex items-center justify-center text-base font-bold rounded-full ${isToday ? "bg-red-600 text-white" : "text-gray-700"}`}>
                          {d.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Time grid */}
                <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
                  <div className="grid" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
                    <div className="relative" style={{ height: totalPx }}>
                      {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                        <div key={i} style={{ position: "absolute", top: i * SLOT_H, right: 6, fontSize: 10, color: "#d1d5db", paddingTop: 2 }}>
                          {HOUR_START + i}:00
                        </div>
                      ))}
                    </div>
                    {days.map((d, di) => (
                      <div key={di} className="relative border-l border-gray-50" style={{ height: totalPx }}>
                        {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                          <div key={i} style={{ position: "absolute", top: i * SLOT_H, left: 0, right: 0, borderTop: "1px solid #f9fafb", pointerEvents: "none" }} />
                        ))}
                        {dayEvents(d).map((ev) => {
                          const { top, height } = eventStyle(ev);
                          const lead = isLeadEvent(ev);
                          const isSelected = selected?.id === ev.id;
                          return (
                            <button
                              key={ev.id}
                              onClick={() => setSelected(ev.id === selected?.id ? null : ev)}
                              style={{ position: "absolute", left: 2, right: 2, top, height, zIndex: 1 }}
                              className={`rounded-md px-1.5 py-0.5 text-left overflow-hidden text-[10px] font-medium leading-tight transition-all border-l-2 ${
                                lead
                                  ? `bg-red-50 text-red-800 border-red-500 ${isSelected ? "ring-1 ring-red-400" : ""}`
                                  : `bg-blue-50 text-blue-800 border-blue-400 ${isSelected ? "ring-1 ring-blue-400" : ""}`
                              }`}
                            >
                              <span className="block truncate">{ev.summary ?? "(no title)"}</span>
                              {height > 26 && (
                                <span className="block opacity-70 text-[9px]">
                                  {new Date(ev.start.dateTime!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Send invite section */}
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-gray-800 mb-1">Send a call invite</h2>
                  <p className="text-xs text-gray-400 mb-4">30-min Google Meet · sent to the lead</p>
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Lead name</label>
                      <input value={invForm.name} onChange={(e) => setInvForm({ ...invForm, name: e.target.value })}
                        placeholder="Jean Dupont"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Lead email</label>
                      <input type="email" value={invForm.email} onChange={(e) => setInvForm({ ...invForm, email: e.target.value })}
                        placeholder="jean@entreprise.fr"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                        <input type="date" value={invForm.date} onChange={(e) => setInvForm({ ...invForm, date: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                        <input type="time" value={invForm.time} onChange={(e) => setInvForm({ ...invForm, time: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
                      </div>
                    </div>
                  </div>
                  <button onClick={sendInvite} disabled={sending}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
                    <Video size={14} />
                    {sending ? "Creating…" : "Send 30-min Meet invite"}
                  </button>
                  {sendMsg && (
                    <p className={`mt-2 text-xs text-center ${sendMsg.ok ? "text-green-600" : "text-red-600"}`}>{sendMsg.text}</p>
                  )}
                </div>

                <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-800">Sent invites</h2>
                    <span className="text-xs text-gray-400">{invites.length} invite{invites.length !== 1 ? "s" : ""}</span>
                  </div>
                  {invites.length === 0 ? (
                    <div className="py-10 text-center text-xs text-gray-400">No invites sent yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="px-4 py-2.5 text-left font-medium text-gray-500">Lead</th>
                            <th className="px-4 py-2.5 text-left font-medium text-gray-500">Date</th>
                            <th className="px-4 py-2.5 text-left font-medium text-gray-500">Meet</th>
                            <th className="px-4 py-2.5 text-left font-medium text-gray-500">Status</th>
                            <th className="px-4 py-2.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {invites.map((inv) => {
                            const dt = new Date(`${inv.date}T${inv.time}`);
                            const past = dt < new Date();
                            return (
                              <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                <td className="px-4 py-2.5">
                                  <div className="font-medium text-gray-800">{inv.name}</div>
                                  <div className="text-gray-400">{inv.email}</div>
                                </td>
                                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                                  {fmt(dt, { day: "numeric", month: "short" })} {inv.time}
                                </td>
                                <td className="px-4 py-2.5">
                                  {inv.meetLink ? (
                                    <a href={inv.meetLink} target="_blank" rel="noreferrer"
                                      className="flex items-center gap-1 text-blue-600 hover:underline">
                                      <Video size={12} /> Join
                                    </a>
                                  ) : inv.calLink ? (
                                    <a href={inv.calLink} target="_blank" rel="noreferrer"
                                      className="flex items-center gap-1 text-gray-400 hover:text-blue-600">
                                      <Calendar size={12} /> Calendar
                                    </a>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full font-medium ${past ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}>
                                    {past ? "Past" : "Upcoming"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <button onClick={() => saveInvites(invites.filter((i) => i.id !== inv.id))}
                                    className="text-gray-300 hover:text-red-500 transition-colors">
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Event detail panel */}
            <div className="w-64 flex-shrink-0 sticky top-0">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Event detail</h3>
                {!selected ? (
                  <p className="text-xs text-gray-400 py-8 text-center">Click an event to see details</p>
                ) : (
                  <div>
                    <div className="mb-3">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full mb-2 ${
                        isLeadEvent(selected) ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {isLeadEvent(selected) ? "Lead call" : "My event"}
                      </span>
                      <h4 className="text-sm font-semibold text-gray-900 leading-snug">{selected.summary ?? "(no title)"}</h4>
                    </div>
                    {selected.start.dateTime && (
                      <p className="text-xs text-gray-500 mb-1.5">
                        📅 {fmt(new Date(selected.start.dateTime), { weekday: "long", day: "numeric", month: "long" })}
                        <br />
                        {new Date(selected.start.dateTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        {selected.end?.dateTime && ` – ${new Date(selected.end.dateTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                      </p>
                    )}
                    {getMeetLink(selected) && (
                      <a href={getMeetLink(selected)!} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline mb-3">
                        <Video size={12} /> Join Google Meet
                      </a>
                    )}
                    {(selected.attendees ?? []).filter((a) => !a.self).length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Attendees</p>
                        {selected.attendees!.filter((a) => !a.self).map((a, i) => (
                          <div key={i} className="flex items-center gap-2 mb-1.5">
                            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[10px] font-bold text-red-600 flex-shrink-0">
                              {(a.displayName ?? a.email)[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              {a.displayName && <p className="text-xs font-medium text-gray-800 truncate">{a.displayName}</p>}
                              <p className="text-[10px] text-gray-400 truncate">{a.email}</p>
                            </div>
                            <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              a.responseStatus === "accepted" ? "bg-green-100 text-green-700" :
                              a.responseStatus === "declined" ? "bg-red-100 text-red-600" :
                              "bg-gray-100 text-gray-500"
                            }`}>{a.responseStatus ?? "?"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes</p>
                      <textarea
                        rows={3}
                        value={notes[selected.id] ?? ""}
                        onChange={(e) => saveNotes({ ...notes, [selected.id]: e.target.value })}
                        placeholder="Add notes about this lead…"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:border-red-400 resize-none"
                      />
                      <button
                        onClick={() => { setSavingNote(true); setTimeout(() => setSavingNote(false), 800); }}
                        className="mt-1 flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        <Save size={11} /> {savingNote ? "Saved!" : "Save note"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Scheduling tab ── */}
        {tab === "scheduling" && (
          <div className="p-8">
            <SchedulingTab />
          </div>
        )}

        {/* ── Availability tab ── */}
        {tab === "availability" && (
          <div className="p-8">
            <AvailabilityTab />
          </div>
        )}
      </div>
    </div>
  );
}

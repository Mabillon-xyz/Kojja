"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, RefreshCw, Video, Calendar, X, Save,
  RotateCw, Copy, Check, Clock, Globe, Plus, Trash2, Zap, Mail,
  ChevronDown, ChevronUp, Power,
} from "lucide-react";
import type { AvailabilityConfig, DaySchedule } from "@/lib/availability-types";
import type { AutomationStep, Automation } from "@/lib/automation-types";

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

type Tab = "calendar" | "scheduling" | "availability" | "automations";

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
        <h2 className="text-sm font-semibold text-[#e6e6e6] mb-0.5">🗓 Heures de disponibilité</h2>
        <p className="text-xs text-[#666]">Définissez vos créneaux disponibles pour les appels de découverte.</p>
      </div>

      <div className="space-y-3">
        {["1", "2", "3", "4", "5", "6", "7"].map((day) => {
          const active = isDayActive(day);
          const slots: DaySchedule = config.days[day] ?? [];
          return (
            <div
              key={day}
              className={`rounded-xl border px-4 py-3 transition-colors ${
                active ? "border-[#383838] bg-[#252525]" : "border-[#252525] bg-[#2f2f2f]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleDay(day)}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                      active ? "bg-blue-600" : "bg-[#383838]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        active ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span className={`text-sm font-medium w-24 ${active ? "text-[#d4d4d4]" : "text-[#666]"}`}>
                    {DAY_LABELS[day]}
                  </span>
                </div>

                {active && (
                  <button
                    onClick={() => addSlot(day)}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
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
                        className="border border-[#383838] rounded-lg px-2.5 py-1.5 text-sm text-[#c0c0c0] bg-[#252525] focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]/30"
                      />
                      <span className="text-xs text-[#666]">–</span>
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) => updateSlot(day, idx, "end", e.target.value)}
                        className="border border-[#383838] rounded-lg px-2.5 py-1.5 text-sm text-[#c0c0c0] bg-[#252525] focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]/30"
                      />
                      {slots.length > 1 && (
                        <button
                          onClick={() => removeSlot(day, idx)}
                          className="text-[#555] hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!active && (
                <p className="pl-12 mt-1 text-xs text-[#555]">Indisponible</p>
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
        <h2 className="text-sm font-semibold text-[#e6e6e6] mb-0.5">🔗 Lien de réservation</h2>
        <p className="text-xs text-[#666]">Partagez ce lien avec vos leads pour qu&apos;ils réservent un créneau.</p>
      </div>

      {/* Event card — Calendly style */}
      <div className="border border-[#383838] rounded-2xl overflow-hidden bg-[#252525] shadow-sm">
        <div className="p-5 border-b border-[#383838]">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm mb-3 select-none">
            CG
          </div>
          <p className="text-xs text-[#666] mb-0.5">Clément Guiraud</p>
          <h3 className="text-base font-semibold text-[#e6e6e6]">Discovery Call</h3>
        </div>
        <div className="p-5 space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm text-[#9b9b9b]">
            <Clock size={14} className="text-[#666] flex-shrink-0" />
            <span>30 minutes</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-[#9b9b9b]">
            <Video size={14} className="text-[#666] flex-shrink-0" />
            <span>Google Meet</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-[#9b9b9b]">
            <Globe size={14} className="text-[#666] flex-shrink-0" />
            <span>Europe/Paris</span>
          </div>
        </div>
      </div>

      {/* Copy link row */}
      <div className="mt-5 flex items-center gap-2">
        <div className="flex-1 px-3 py-2.5 bg-[#2f2f2f] border border-[#383838] rounded-xl text-xs text-[#9b9b9b] truncate select-all font-mono">
          {BOOK_URL}
        </div>
        <button
          onClick={copyLink}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
            copied
              ? "bg-green-900/40 text-green-400"
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
        className="mt-3 block text-center text-xs text-blue-400 hover:underline"
      >
        Ouvrir la page de réservation →
      </a>
    </div>
  );
}

// ── Automation templates ─────────────────────────────────────────
const ORGANIZER_EMAIL_DISPLAY = "clement.guiraudpro@gmail.com";

const TEMPLATES: { name: string; description: string; steps: Omit<AutomationStep, "id">[] }[] = [
  {
    name: "Confirmation seule",
    description: "Un email immédiat pour confirmer le call.",
    steps: [
      {
        type: "send_email",
        when: "immediately",
        delay_minutes: 0,
        recipient: "both",
        subject: "✓ Call confirmé — {{date}} à {{time}}",
        body: "Bonjour {{name}},\n\nVotre discovery call de 30 minutes avec Clément Guiraud est confirmé.\n\n📅 {{date}} à {{time}} (heure de Paris)\n🎥 Rejoindre le Meet : {{meetLink}}\n\nÀ très vite,\nClément",
      },
    ],
  },
  {
    name: "Confirmation + Rappel 24h",
    description: "Confirmation immédiate, puis rappel la veille.",
    steps: [
      {
        type: "send_email",
        when: "immediately",
        delay_minutes: 0,
        recipient: "both",
        subject: "✓ Call confirmé — {{date}} à {{time}}",
        body: "Bonjour {{name}},\n\nVotre discovery call de 30 minutes avec Clément Guiraud est confirmé.\n\n📅 {{date}} à {{time}} (heure de Paris)\n🎥 Rejoindre le Meet : {{meetLink}}\n\nÀ très vite,\nClément",
      },
      {
        type: "send_email",
        when: "before_event",
        delay_minutes: 1440,
        recipient: "lead",
        subject: "Rappel : votre call demain à {{time}}",
        body: "Bonjour {{name}},\n\nUn petit rappel — votre discovery call de 30 minutes avec Clément est demain.\n\n📅 {{date}} à {{time}} (heure de Paris)\n🎥 Rejoindre le Meet : {{meetLink}}\n\nÀ demain !\nClément",
      },
    ],
  },
  {
    name: "Séquence complète",
    description: "Confirmation + rappel 24h + rappel 1h avant.",
    steps: [
      {
        type: "send_email",
        when: "immediately",
        delay_minutes: 0,
        recipient: "both",
        subject: "✓ Call confirmé — {{date}} à {{time}}",
        body: "Bonjour {{name}},\n\nVotre discovery call de 30 minutes avec Clément Guiraud est confirmé.\n\n📅 {{date}} à {{time}} (heure de Paris)\n🎥 Rejoindre le Meet : {{meetLink}}\n\nÀ très vite,\nClément",
      },
      {
        type: "send_email",
        when: "before_event",
        delay_minutes: 1440,
        recipient: "lead",
        subject: "Rappel : votre call demain à {{time}}",
        body: "Bonjour {{name}},\n\nUn petit rappel — votre discovery call de 30 minutes avec Clément est demain.\n\n📅 {{date}} à {{time}} (heure de Paris)\n🎥 Rejoindre le Meet : {{meetLink}}\n\nÀ demain !\nClément",
      },
      {
        type: "send_email",
        when: "before_event",
        delay_minutes: 60,
        recipient: "lead",
        subject: "Dans 1 heure : votre call à {{time}} 🎥",
        body: "Bonjour {{name}},\n\nVotre call avec Clément commence dans 1 heure !\n\n🎥 Rejoindre le Meet : {{meetLink}}\n\nÀ tout de suite,\nClément",
      },
    ],
  },
];

function newStepId() {
  return Math.random().toString(36).slice(2);
}

function stepWhenLabel(step: AutomationStep): string {
  if (step.when === "immediately") return "Immédiatement";
  if (step.when === "delay_after_booking") {
    const h = step.delay_minutes / 60;
    return h >= 1 ? `${h}h après la réservation` : `${step.delay_minutes}min après la réservation`;
  }
  // before_event
  if (step.delay_minutes >= 1440) return `${step.delay_minutes / 1440}j avant le call`;
  return `${step.delay_minutes / 60}h avant le call`;
}

function recipientLabel(r: AutomationStep["recipient"]): string {
  return r === "lead" ? "Lead" : r === "organizer" ? "Moi" : "Lead + Moi";
}

// ── Automations tab ──────────────────────────────────────────────
function AutomationsTab() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Automation | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/automations")
      .then((r) => r.json())
      .then((data) => { setAutomations(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function toggleEnabled(automation: Automation) {
    const updated = { ...automation, enabled: !automation.enabled };
    setAutomations((prev) => prev.map((a) => (a.id === automation.id ? updated : a)));
    await fetch(`/api/automations/${automation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: updated.enabled }),
    });
  }

  async function deleteAutomation(id: string) {
    if (!confirm("Supprimer cette automation ?")) return;
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
  }

  async function saveEdit() {
    if (!editDraft) return;
    setSaving(true);
    const r = await fetch(`/api/automations/${editDraft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editDraft.name, steps: editDraft.steps }),
    });
    const data = await r.json();
    setAutomations((prev) => prev.map((a) => (a.id === editDraft.id ? data : a)));
    setEditDraft(null);
    setExpandedId(null);
    setSaving(false);
  }

  async function createFromTemplate(tpl: typeof TEMPLATES[0]) {
    setCreating(true);
    const r = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tpl.name,
        enabled: true,
        steps: tpl.steps.map((s) => ({ ...s, id: newStepId() })),
      }),
    });
    const data = await r.json();
    setAutomations((prev) => [...prev, data]);
    setCreating(false);
  }

  function startEdit(automation: Automation) {
    setEditDraft(JSON.parse(JSON.stringify(automation)));
    setExpandedId(automation.id);
  }

  function updateDraftStep(idx: number, field: keyof AutomationStep, value: string | number) {
    if (!editDraft) return;
    const steps = [...editDraft.steps];
    steps[idx] = { ...steps[idx], [field]: value } as AutomationStep;
    setEditDraft({ ...editDraft, steps });
  }

  function addDraftStep() {
    if (!editDraft) return;
    const newStep: AutomationStep = {
      id: newStepId(),
      type: "send_email",
      when: "before_event",
      delay_minutes: 1440,
      recipient: "lead",
      subject: "Rappel : votre call {{date}}",
      body: "Bonjour {{name}},\n\nRappel de votre call à {{time}}.\n\n🎥 {{meetLink}}\n\nClément",
    };
    setEditDraft({ ...editDraft, steps: [...editDraft.steps, newStep] });
  }

  function removeDraftStep(idx: number) {
    if (!editDraft || editDraft.steps.length <= 1) return;
    setEditDraft({ ...editDraft, steps: editDraft.steps.filter((_, i) => i !== idx) });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-[#e6e6e6] mb-0.5">✉️ Séquences d&apos;emails</h2>
          <p className="text-xs text-[#666]">Déclenché automatiquement quand un call est réservé.</p>
        </div>
      </div>

      {/* Automation list */}
      {automations.length > 0 && (
        <div className="space-y-3 mb-8">
          {automations.map((auto) => {
            const isEditing = expandedId === auto.id && editDraft?.id === auto.id;
            const draft = isEditing ? editDraft! : auto;
            return (
              <div key={auto.id} className="border border-[#383838] rounded-xl bg-[#252525] overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Enable toggle */}
                  <button
                    onClick={() => toggleEnabled(auto)}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                      auto.enabled ? "bg-blue-600" : "bg-[#383838]"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${auto.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#e6e6e6] truncate">{auto.name}</span>
                      <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-400 flex items-center gap-1">
                        <Zap size={9} /> Call réservé
                      </span>
                    </div>
                    <p className="text-xs text-[#666] mt-0.5">
                      {auto.steps.length} email{auto.steps.length > 1 ? "s" : ""} ·{" "}
                      {auto.steps.map((s) => stepWhenLabel(s)).join(" → ")}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        if (isEditing) { setExpandedId(null); setEditDraft(null); }
                        else startEdit(auto);
                      }}
                      className="p-1.5 rounded-lg text-[#666] hover:text-[#e6e6e6] hover:bg-[#383838] transition-colors text-xs font-medium"
                    >
                      {isEditing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      onClick={() => deleteAutomation(auto.id)}
                      className="p-1.5 rounded-lg text-[#555] hover:text-red-500 hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Inline editor */}
                {isEditing && (
                  <div className="border-t border-[#383838] bg-[#2f2f2f] px-4 pt-4 pb-5">
                    {/* Name */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-[#9b9b9b] mb-1">Nom</label>
                      <input
                        value={draft.name}
                        onChange={(e) => setEditDraft({ ...draft, name: e.target.value })}
                        className="w-full border border-[#383838] rounded-lg px-3 py-2 text-sm bg-[#252525] text-[#e6e6e6] focus:outline-none focus:border-[#5865f2]"
                      />
                    </div>

                    {/* Steps */}
                    <div className="space-y-4 mb-4">
                      {draft.steps.map((step, idx) => (
                        <div key={step.id} className="bg-[#252525] border border-[#383838] rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-blue-900/40 flex items-center justify-center text-[10px] font-bold text-blue-400">
                                {idx + 1}
                              </div>
                              <span className="text-xs font-semibold text-[#c0c0c0] flex items-center gap-1">
                                <Mail size={11} /> Email
                              </span>
                            </div>
                            {draft.steps.length > 1 && (
                              <button onClick={() => removeDraftStep(idx)} className="text-[#555] hover:text-red-500 transition-colors">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-3">
                            {/* When */}
                            <div>
                              <label className="block text-[10px] font-medium text-[#888] mb-1">Quand</label>
                              <select
                                value={step.when === "immediately" ? "immediately" : `${step.when}:${step.delay_minutes}`}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "immediately") {
                                    updateDraftStep(idx, "when", "immediately");
                                    updateDraftStep(idx, "delay_minutes", 0);
                                  } else {
                                    const [when, mins] = val.split(":");
                                    updateDraftStep(idx, "when", when);
                                    updateDraftStep(idx, "delay_minutes", parseInt(mins));
                                  }
                                }}
                                className="w-full border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs bg-[#252525] text-[#e6e6e6] focus:outline-none focus:border-[#5865f2]"
                              >
                                <option value="immediately">Immédiatement</option>
                                <option value="before_event:60">1h avant le call</option>
                                <option value="before_event:180">3h avant le call</option>
                                <option value="before_event:1440">24h avant le call</option>
                                <option value="before_event:2880">48h avant le call</option>
                                <option value="delay_after_booking:60">1h après la réservation</option>
                                <option value="delay_after_booking:1440">24h après la réservation</option>
                              </select>
                            </div>

                            {/* Recipient */}
                            <div>
                              <label className="block text-[10px] font-medium text-[#888] mb-1">Destinataire</label>
                              <select
                                value={step.recipient}
                                onChange={(e) => updateDraftStep(idx, "recipient", e.target.value)}
                                className="w-full border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs bg-[#252525] text-[#e6e6e6] focus:outline-none focus:border-[#5865f2]"
                              >
                                <option value="both">Lead + Moi</option>
                                <option value="lead">Lead uniquement</option>
                                <option value="organizer">Moi uniquement</option>
                              </select>
                            </div>
                          </div>

                          {/* Subject */}
                          <div className="mb-2">
                            <label className="block text-[10px] font-medium text-[#888] mb-1">Objet</label>
                            <input
                              value={step.subject}
                              onChange={(e) => updateDraftStep(idx, "subject", e.target.value)}
                              className="w-full border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs bg-[#252525] text-[#e6e6e6] focus:outline-none focus:border-[#5865f2]"
                            />
                          </div>

                          {/* Body */}
                          <div>
                            <label className="block text-[10px] font-medium text-[#888] mb-1">Corps</label>
                            <textarea
                              rows={4}
                              value={step.body}
                              onChange={(e) => updateDraftStep(idx, "body", e.target.value)}
                              className="w-full border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs bg-[#252525] text-[#e6e6e6] focus:outline-none focus:border-[#5865f2] resize-y"
                            />
                            <p className="mt-1 text-[10px] text-[#555]">Variables : {"{{name}} {{date}} {{time}} {{meetLink}}"}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add step */}
                    <button
                      onClick={addDraftStep}
                      className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium mb-4"
                    >
                      <Plus size={12} /> Ajouter une étape
                    </button>

                    {/* Save / Cancel */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Save size={12} /> {saving ? "Enregistrement…" : "Enregistrer"}
                      </button>
                      <button
                        onClick={() => { setExpandedId(null); setEditDraft(null); }}
                        className="px-4 py-2 text-xs text-[#9b9b9b] hover:text-[#e6e6e6] font-medium rounded-lg hover:bg-[#383838] transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Templates section */}
      <div>
        <p className="text-xs font-semibold text-[#888] uppercase tracking-wide mb-3">
          {automations.length === 0 ? "Démarrer avec un modèle" : "Ajouter depuis un modèle"}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.name}
              onClick={() => createFromTemplate(tpl)}
              disabled={creating}
              className="text-left border border-[#383838] rounded-xl p-4 hover:border-blue-500 hover:bg-blue-900/20 transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-blue-900/40 flex items-center justify-center">
                  <Zap size={12} className="text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-[#d4d4d4] group-hover:text-blue-400">{tpl.name}</span>
              </div>
              <p className="text-[11px] text-[#666] leading-relaxed">{tpl.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {tpl.steps.map((s, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#383838] text-[#888] rounded-full">
                    {s.when === "immediately" ? "Immédiat" : s.when === "before_event" ? `-${s.delay_minutes / 60}h` : `+${s.delay_minutes / 60}h`}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Info box */}
      <div className="mt-6 flex items-start gap-2.5 bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3">
        <Power size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-400 leading-relaxed">
          Les emails sont envoyés via <strong>Resend</strong> depuis <strong>{ORGANIZER_EMAIL_DISPLAY}</strong>.
          Les rappels planifiés sont traités toutes les 5 minutes par le cron Vercel.
        </p>
      </div>
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
      <div className="flex flex-col border-b border-[#383838] flex-shrink-0 bg-[#191919]">
        {/* Tabs row */}
        <div className="flex items-center overflow-x-auto scrollbar-none">
          {(["calendar", "scheduling", "availability", "automations"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = {
              calendar: "Calendrier",
              scheduling: "🔗 Lien de réservation",
              availability: "🗓 Heures de disponibilité",
              automations: "✉️ Séquences d'emails",
            };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-shrink-0 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-[#9b9b9b] hover:text-[#e6e6e6]"
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Calendar-tab controls (only shown on calendar tab) */}
        {tab === "calendar" && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button onClick={prevWeek} className="p-1.5 rounded-lg hover:bg-[#383838] text-[#9b9b9b] hover:text-[#e6e6e6] transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-[#d4d4d4] text-center whitespace-nowrap">{weekLabel}</span>
              <button onClick={nextWeek} className="p-1.5 rounded-lg hover:bg-[#383838] text-[#9b9b9b] hover:text-[#e6e6e6] transition-colors">
                <ChevronRight size={16} />
              </button>
              <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium bg-[#383838] hover:bg-[#2f2f2f] text-[#9b9b9b] rounded-lg transition-colors">
                Today
              </button>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {syncMsg && (
                <span className={`text-xs hidden sm:inline ${syncMsg.ok ? "text-green-400" : "text-red-400"}`}>{syncMsg.text}</span>
              )}
              <button onClick={triggerSync} disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#383838] hover:bg-[#2f2f2f] disabled:opacity-50 text-[#e6e6e6] rounded-lg transition-colors">
                <RotateCw size={12} className={syncing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">{syncing ? "Syncing…" : "EdenRed sync"}</span>
                {!syncing && <span className="sm:hidden">Sync</span>}
              </button>
              <button onClick={fetchEvents} disabled={loading} className="p-1.5 rounded-lg hover:bg-[#383838] text-[#666] hover:text-[#e6e6e6] transition-colors disabled:opacity-40">
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
          <div className="flex gap-4 p-3 md:p-5 min-h-full items-start">
            <div className="flex-1 min-w-0">
              {error && (
                <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-500/40 text-red-300 text-sm rounded-xl">{error}</div>
              )}

              <div className="bg-[#252525] rounded-2xl border border-[#383838] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                {/* Day headers */}
                <div className="grid border-b border-[#383838]" style={{ gridTemplateColumns: "52px repeat(7, minmax(80px, 1fr))" }}>
                  <div />
                  {days.map((d, i) => {
                    const isToday = d.getTime() === todayDate.getTime();
                    return (
                      <div key={i} className="py-2.5 text-center border-l border-[#2f2f2f]">
                        <div className="text-[10px] font-medium text-[#666] uppercase tracking-wide">{DAYS_SHORT[i]}</div>
                        <div className={`mx-auto mt-0.5 w-7 h-7 flex items-center justify-center text-base font-bold rounded-full ${isToday ? "bg-red-600 text-white" : "text-[#c0c0c0]"}`}>
                          {d.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Time grid */}
                <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
                  <div className="grid" style={{ gridTemplateColumns: "52px repeat(7, minmax(80px, 1fr))" }}>
                    <div className="relative" style={{ height: totalPx }}>
                      {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                        <div key={i} style={{ position: "absolute", top: i * SLOT_H, right: 6, fontSize: 10, color: "#555", paddingTop: 2 }}>
                          {HOUR_START + i}:00
                        </div>
                      ))}
                    </div>
                    {days.map((d, di) => (
                      <div key={di} className="relative border-l border-[#2f2f2f]" style={{ height: totalPx }}>
                        {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                          <div key={i} style={{ position: "absolute", top: i * SLOT_H, left: 0, right: 0, borderTop: "1px solid #2f2f2f", pointerEvents: "none" }} />
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
                                  ? `bg-red-900/30 text-red-300 border-red-500 ${isSelected ? "ring-1 ring-red-400" : ""}`
                                  : `bg-blue-900/30 text-blue-300 border-blue-400 ${isSelected ? "ring-1 ring-blue-400" : ""}`
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
                </div>{/* end overflow-x-auto */}
              </div>

              {/* Send invite section */}
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 bg-[#252525] rounded-2xl border border-[#383838] shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-[#d4d4d4] mb-1">📞 Send a call invite</h2>
                  <p className="text-xs text-[#666] mb-4">30-min Google Meet · sent to the lead</p>
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-[#9b9b9b] mb-1">Lead name</label>
                      <input value={invForm.name} onChange={(e) => setInvForm({ ...invForm, name: e.target.value })}
                        placeholder="Jean Dupont"
                        className="w-full border border-[#383838] rounded-lg px-3 py-2 text-sm bg-[#252525] text-[#e6e6e6] focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#9b9b9b] mb-1">Lead email</label>
                      <input type="email" value={invForm.email} onChange={(e) => setInvForm({ ...invForm, email: e.target.value })}
                        placeholder="jean@entreprise.fr"
                        className="w-full border border-[#383838] rounded-lg px-3 py-2 text-sm bg-[#252525] text-[#e6e6e6] focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]/30" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-[#9b9b9b] mb-1">Date</label>
                        <input type="date" value={invForm.date} onChange={(e) => setInvForm({ ...invForm, date: e.target.value })}
                          className="w-full border border-[#383838] rounded-lg px-3 py-2 text-sm bg-[#252525] text-[#e6e6e6] focus:outline-none focus:border-[#5865f2]" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#9b9b9b] mb-1">Time</label>
                        <input type="time" value={invForm.time} onChange={(e) => setInvForm({ ...invForm, time: e.target.value })}
                          className="w-full border border-[#383838] rounded-lg px-3 py-2 text-sm bg-[#252525] text-[#e6e6e6] focus:outline-none focus:border-[#5865f2]" />
                      </div>
                    </div>
                  </div>
                  <button onClick={sendInvite} disabled={sending}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
                    <Video size={14} />
                    {sending ? "Creating…" : "Send 30-min Meet invite"}
                  </button>
                  {sendMsg && (
                    <p className={`mt-2 text-xs text-center ${sendMsg.ok ? "text-green-400" : "text-red-400"}`}>{sendMsg.text}</p>
                  )}
                </div>

                <div className="lg:col-span-3 bg-[#252525] rounded-2xl border border-[#383838] shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#383838] flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#d4d4d4]">📨 Sent invites</h2>
                    <span className="text-xs text-[#666]">{invites.length} invite{invites.length !== 1 ? "s" : ""}</span>
                  </div>
                  {invites.length === 0 ? (
                    <div className="py-10 text-center text-xs text-[#666]">No invites sent yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#383838] bg-[#2f2f2f]">
                            <th className="px-4 py-2.5 text-left font-medium text-[#888]">Lead</th>
                            <th className="px-4 py-2.5 text-left font-medium text-[#888]">Date</th>
                            <th className="px-4 py-2.5 text-left font-medium text-[#888]">Meet</th>
                            <th className="px-4 py-2.5 text-left font-medium text-[#888]">Status</th>
                            <th className="px-4 py-2.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {invites.map((inv) => {
                            const dt = new Date(`${inv.date}T${inv.time}`);
                            const past = dt < new Date();
                            return (
                              <tr key={inv.id} className="border-b border-[#383838] hover:bg-[#2f2f2f]">
                                <td className="px-4 py-2.5">
                                  <div className="font-medium text-[#d4d4d4]">{inv.name}</div>
                                  <div className="text-[#666]">{inv.email}</div>
                                </td>
                                <td className="px-4 py-2.5 text-[#9b9b9b] whitespace-nowrap">
                                  {fmt(dt, { day: "numeric", month: "short" })} {inv.time}
                                </td>
                                <td className="px-4 py-2.5">
                                  {inv.meetLink ? (
                                    <a href={inv.meetLink} target="_blank" rel="noreferrer"
                                      className="flex items-center gap-1 text-blue-400 hover:underline">
                                      <Video size={12} /> Join
                                    </a>
                                  ) : inv.calLink ? (
                                    <a href={inv.calLink} target="_blank" rel="noreferrer"
                                      className="flex items-center gap-1 text-[#666] hover:text-blue-400">
                                      <Calendar size={12} /> Calendar
                                    </a>
                                  ) : (
                                    <span className="text-[#555]">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full font-medium ${past ? "bg-[#383838] text-[#888]" : "bg-green-900/40 text-green-400"}`}>
                                    {past ? "Past" : "Upcoming"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <button onClick={() => saveInvites(invites.filter((i) => i.id !== inv.id))}
                                    className="text-[#555] hover:text-red-500 transition-colors">
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

            {/* Event detail panel — hidden on mobile */}
            <div className="hidden md:block w-64 flex-shrink-0 sticky top-0">
              <div className="bg-[#252525] rounded-2xl border border-[#383838] shadow-sm p-4">
                <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wide mb-3">🔍 Event detail</h3>
                {!selected ? (
                  <p className="text-xs text-[#666] py-8 text-center">Click an event to see details</p>
                ) : (
                  <div>
                    <div className="mb-3">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full mb-2 ${
                        isLeadEvent(selected) ? "bg-red-900/40 text-red-400" : "bg-blue-900/40 text-blue-400"
                      }`}>
                        {isLeadEvent(selected) ? "Lead call" : "My event"}
                      </span>
                      <h4 className="text-sm font-semibold text-[#e6e6e6] leading-snug">{selected.summary ?? "(no title)"}</h4>
                    </div>
                    {selected.start.dateTime && (
                      <p className="text-xs text-[#9b9b9b] mb-1.5">
                        📅 {fmt(new Date(selected.start.dateTime), { weekday: "long", day: "numeric", month: "long" })}
                        <br />
                        {new Date(selected.start.dateTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        {selected.end?.dateTime && ` – ${new Date(selected.end.dateTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                      </p>
                    )}
                    {getMeetLink(selected) && (
                      <a href={getMeetLink(selected)!} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline mb-3">
                        <Video size={12} /> Join Google Meet
                      </a>
                    )}
                    {(selected.attendees ?? []).filter((a) => !a.self).length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1.5">Attendees</p>
                        {selected.attendees!.filter((a) => !a.self).map((a, i) => (
                          <div key={i} className="flex items-center gap-2 mb-1.5">
                            <div className="w-6 h-6 rounded-full bg-red-900/40 flex items-center justify-center text-[10px] font-bold text-red-400 flex-shrink-0">
                              {(a.displayName ?? a.email)[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              {a.displayName && <p className="text-xs font-medium text-[#d4d4d4] truncate">{a.displayName}</p>}
                              <p className="text-[10px] text-[#666] truncate">{a.email}</p>
                            </div>
                            <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              a.responseStatus === "accepted" ? "bg-green-900/40 text-green-400" :
                              a.responseStatus === "declined" ? "bg-red-900/40 text-red-400" :
                              "bg-[#383838] text-[#888]"
                            }`}>{a.responseStatus ?? "?"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold text-[#888] uppercase tracking-wide mb-1.5">Notes</p>
                      <textarea
                        rows={3}
                        value={notes[selected.id] ?? ""}
                        onChange={(e) => saveNotes({ ...notes, [selected.id]: e.target.value })}
                        placeholder="Add notes about this lead…"
                        className="w-full border border-[#383838] rounded-lg px-2.5 py-2 text-xs text-[#d4d4d4] bg-[#252525] focus:outline-none focus:border-[#5865f2] resize-none"
                      />
                      <button
                        onClick={() => { setSavingNote(true); setTimeout(() => setSavingNote(false), 800); }}
                        className="mt-1 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-medium"
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

        {/* ── Automations tab ── */}
        {tab === "automations" && (
          <div className="p-8">
            <AutomationsTab />
          </div>
        )}
      </div>
    </div>
  );
}

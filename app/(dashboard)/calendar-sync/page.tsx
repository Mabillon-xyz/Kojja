"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, RefreshCw, Video, Save,
  RotateCw, Copy, Check, Clock, Globe, Plus, Trash2, Zap, Mail,
  ChevronDown, ChevronUp, Power, X, ExternalLink, MapPin, Users,
} from "lucide-react";
import type { AvailabilityConfig, DaySchedule } from "@/lib/availability-types";
import type { AutomationStep, Automation } from "@/lib/automation-types";
import { getEmailLogs, type EmailLog } from "@/app/actions/email-logs";

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

type Tab = "calendar" | "scheduling" | "availability" | "automations" | "logs";

// ── Constants ──────────────────────────────────────────────────
const MY_EMAIL = "clement.guiraudpro@gmail.com";
const HOUR_START = 8;
const HOUR_END = 21;
const SLOT_H = 60; // px per hour
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEAD_KW = ["call", "appel", "discovery", "first", "premier", "lead", "demo", "rendez", "rdv", "intro"];
const BOOK_URL = "https://kojja.vercel.app/book";
const FOLLOWUP_BASE_URL = "https://kojja.vercel.app/book/followup";

const DAY_LABELS: Record<string, string> = {
  "1": "Monday",
  "2": "Tuesday",
  "3": "Wednesday",
  "4": "Thursday",
  "5": "Friday",
  "6": "Saturday",
  "7": "Sunday",
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
  return d.toLocaleDateString("en-GB", opts);
}

function isLeadEvent(ev: CalEvent): boolean {
  const title = (ev.summary ?? "").toLowerCase();
  const hasExternal = (ev.attendees ?? []).some(
    (a) => !a.self && a.email.toLowerCase() !== MY_EMAIL && !a.email.includes("resource.calendar")
  );
  return hasExternal || LEAD_KW.some((kw) => title.includes(kw));
}

// ── Event detail drawer ──────────────────────────────────────────
const STATUS_ICON: Record<string, { icon: string; color: string }> = {
  accepted:     { icon: "✓", color: "text-green-600 dark:text-green-400" },
  declined:     { icon: "✗", color: "text-red-600 dark:text-red-400" },
  tentative:    { icon: "?", color: "text-yellow-600 dark:text-yellow-400" },
  needsAction:  { icon: "…", color: "text-muted-foreground" },
};

function EventDrawer({ event, onClose, onDelete }: { event: CalEvent; onClose: () => void; onDelete: (id: string) => Promise<void> }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const start = event.start.dateTime ? new Date(event.start.dateTime) : null;
  const end   = event.end?.dateTime  ? new Date(event.end.dateTime)   : null;
  const lead  = isLeadEvent(event);

  const meetLink =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null;

  const durationMin = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
  const durationLabel = durationMin
    ? durationMin >= 60
      ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? `${durationMin % 60}min` : ""}`
      : `${durationMin} min`
    : null;

  const external = (event.attendees ?? []).filter(
    (a) => !a.self && a.email.toLowerCase() !== MY_EMAIL && !a.email.includes("resource.calendar")
  );
  const others = (event.attendees ?? []).filter(
    (a) => a.self || a.email.toLowerCase() === MY_EMAIL
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-card shadow-xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-200 dark:border-border">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${lead ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"}`}>
                {lead ? "Lead call" : "Event"}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-foreground leading-snug">
              {event.summary ?? "(no title)"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-muted rounded-md text-neutral-400 dark:text-muted-foreground hover:text-neutral-600 dark:hover:text-foreground/70 transition-colors flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Date / time / duration */}
          {start && (
            <div className="flex items-start gap-3">
              <Clock size={14} className="text-neutral-400 dark:text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-neutral-900 dark:text-foreground font-medium">
                  {start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
                <p className="text-neutral-500 dark:text-muted-foreground text-xs mt-0.5">
                  {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  {end ? ` → ${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  {durationLabel ? ` · ${durationLabel}` : ""}
                </p>
              </div>
            </div>
          )}

          {/* Meet link */}
          {meetLink && (
            <div className="flex items-start gap-3">
              <Video size={14} className="text-neutral-400 dark:text-muted-foreground mt-0.5 flex-shrink-0" />
              <a
                href={meetLink}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
              >
                Join Google Meet <ExternalLink size={11} />
              </a>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin size={14} className="text-neutral-400 dark:text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-neutral-700 dark:text-foreground/80">{event.location}</p>
            </div>
          )}

          {/* Attendees */}
          {(external.length > 0 || others.length > 0) && (
            <div className="flex items-start gap-3">
              <Users size={14} className="text-neutral-400 dark:text-muted-foreground mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-neutral-500 dark:text-muted-foreground uppercase tracking-wide mb-2">
                  Attendees · {(event.attendees ?? []).filter(a => !a.email.includes("resource.calendar")).length}
                </p>
                <div className="space-y-2">
                  {[...external, ...others].filter(a => !a.email.includes("resource.calendar")).map((a) => {
                    const s = STATUS_ICON[a.responseStatus ?? "needsAction"] ?? STATUS_ICON.needsAction;
                    return (
                      <div key={a.email} className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-4 text-center ${s.color}`}>{s.icon}</span>
                        <div className="min-w-0">
                          {a.displayName && (
                            <p className="text-xs font-medium text-neutral-900 dark:text-foreground truncate">
                              {a.displayName}{a.self ? " (moi)" : ""}
                            </p>
                          )}
                          <p className={`text-xs truncate ${a.displayName ? "text-neutral-400 dark:text-muted-foreground" : "text-neutral-700 dark:text-foreground/80"}`}>
                            {a.email}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-muted-foreground uppercase tracking-wide mb-1.5">Description</p>
              <p className="text-sm text-neutral-700 dark:text-foreground/80 whitespace-pre-line leading-relaxed">
                {event.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 dark:border-border space-y-2">
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-neutral-600 dark:text-foreground/70 hover:text-neutral-900 dark:hover:text-foreground border border-neutral-200 dark:border-border rounded-lg hover:border-neutral-400 dark:hover:border-muted-foreground transition-colors"
            >
              Open in Google Calendar <ExternalLink size={11} />
            </a>
          )}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg transition-colors"
            >
              <Trash2 size={12} /> Delete event
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 py-2 text-xs font-medium text-neutral-600 dark:text-foreground/70 border border-neutral-200 dark:border-border rounded-lg hover:bg-neutral-50 dark:hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  await onDelete(event.id);
                  setDeleting(false);
                }}
                disabled={deleting}
                className="flex-1 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Confirm"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
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
        <h2 className="text-sm font-semibold text-foreground mb-0.5">🗓 Availability hours</h2>
        <p className="text-xs text-muted-foreground">Set your available slots for discovery calls.</p>
      </div>

      <div className="space-y-3">
        {["1", "2", "3", "4", "5", "6", "7"].map((day) => {
          const active = isDayActive(day);
          const slots: DaySchedule = config.days[day] ?? [];
          return (
            <div
              key={day}
              className={`rounded-xl border px-4 py-3 transition-colors ${
                active ? "border-border bg-muted" : "border-muted bg-secondary"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleDay(day)}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                      active ? "bg-blue-600" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        active ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span className={`text-sm font-medium w-24 ${active ? "text-foreground/80" : "text-muted-foreground"}`}>
                    {DAY_LABELS[day]}
                  </span>
                </div>

                {active && (
                  <button
                    onClick={() => addSlot(day)}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                  >
                    <Plus size={12} /> Add
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
                        className="border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground/70 bg-muted focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]/30"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) => updateSlot(day, idx, "end", e.target.value)}
                        className="border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground/70 bg-muted focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]/30"
                      />
                      {slots.length > 1 && (
                        <button
                          onClick={() => removeSlot(day, idx)}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!active && (
                <p className="pl-12 mt-1 text-xs text-muted-foreground">Unavailable</p>
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
        {saving ? "Saving…" : saved ? "Saved!" : "Save"}
      </button>
    </div>
  );
}

// ── Scheduling tab subcomponent ──────────────────────────────────
function SchedulingTab() {
  const [copied, setCopied] = useState(false);
  const [copiedFollowup, setCopiedFollowup] = useState(false);
  const [followupEmail, setFollowupEmail] = useState("");

  const followupUrl = followupEmail.trim()
    ? `${FOLLOWUP_BASE_URL}?email=${encodeURIComponent(followupEmail.trim())}`
    : FOLLOWUP_BASE_URL;

  function copyLink() {
    navigator.clipboard.writeText(BOOK_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyFollowupLink() {
    navigator.clipboard.writeText(followupUrl).then(() => {
      setCopiedFollowup(true);
      setTimeout(() => setCopiedFollowup(false), 2000);
    });
  }

  return (
    <div className="max-w-sm space-y-8">

      {/* ── Discovery Call ── */}
      <div>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-0.5">🔗 Booking links</h2>
          <p className="text-xs text-muted-foreground">Share these links with your leads to let them book a slot.</p>
        </div>

        <div className="border border-border rounded-2xl overflow-hidden bg-muted shadow-sm">
          <div className="p-5 border-b border-border">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm mb-3 select-none">
              CG
            </div>
            <p className="text-xs text-muted-foreground mb-0.5">Clément Guiraud</p>
            <h3 className="text-base font-semibold text-foreground">Discovery Call</h3>
          </div>
          <div className="p-5 space-y-2.5">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Clock size={14} className="flex-shrink-0" />
              <span>30 minutes</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Video size={14} className="flex-shrink-0" />
              <span>Google Meet</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Globe size={14} className="flex-shrink-0" />
              <span>Europe/Paris</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 px-3 py-2.5 bg-secondary border border-border rounded-xl text-xs text-muted-foreground truncate select-all font-mono">
            {BOOK_URL}
          </div>
          <button
            onClick={copyLink}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
              copied ? "bg-green-900/40 text-green-400" : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <a href={BOOK_URL} target="_blank" rel="noopener noreferrer"
          className="mt-2 block text-center text-xs text-blue-600 dark:text-blue-400 hover:underline">
          Open booking page →
        </a>
      </div>

      {/* ── Follow-up Call ── */}
      <div>
        <div className="border border-violet-200 dark:border-violet-800 rounded-2xl overflow-hidden bg-muted shadow-sm">
          <div className="p-5 border-b border-violet-100 dark:border-violet-900">
            <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold text-sm mb-3 select-none">
              CG
            </div>
            <p className="text-xs text-muted-foreground mb-0.5">Clément Guiraud</p>
            <h3 className="text-base font-semibold text-foreground">Follow-up Call</h3>
          </div>
          <div className="p-5 space-y-2.5">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Clock size={14} className="flex-shrink-0" />
              <span>30 minutes</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Video size={14} className="flex-shrink-0" />
              <span>Google Meet</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Globe size={14} className="flex-shrink-0" />
              <span>Europe/Paris</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-muted-foreground mb-1.5">Lead email (personalizes the link)</label>
          <input
            type="email"
            value={followupEmail}
            onChange={e => setFollowupEmail(e.target.value)}
            placeholder="jean@entreprise.com"
            className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 px-3 py-2.5 bg-secondary border border-border rounded-xl text-xs text-muted-foreground truncate select-all font-mono">
            {followupUrl}
          </div>
          <button
            onClick={copyFollowupLink}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 ${
              copiedFollowup ? "bg-green-900/40 text-green-400" : "bg-violet-600 hover:bg-violet-700 text-white"
            }`}
          >
            {copiedFollowup ? <Check size={14} /> : <Copy size={14} />}
            {copiedFollowup ? "Copied!" : "Copy"}
          </button>
        </div>
        <a href={followupUrl} target="_blank" rel="noopener noreferrer"
          className="mt-2 block text-center text-xs text-violet-600 dark:text-violet-400 hover:underline">
          Open follow-up page →
        </a>
      </div>

    </div>
  );
}

// ── Automation templates ─────────────────────────────────────────
const ORGANIZER_EMAIL_DISPLAY = "clement.guiraudpro@gmail.com";

const TEMPLATES: { name: string; description: string; steps: Omit<AutomationStep, "id">[] }[] = [
  {
    name: "Confirmation only",
    description: "One immediate email to confirm the call.",
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
    name: "Confirmation + 24h reminder",
    description: "Immediate confirmation, then reminder the day before.",
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
    name: "Full sequence",
    description: "Confirmation + 24h reminder + 1h reminder.",
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
  if (step.when === "immediately") return "Immediately";
  if (step.when === "delay_after_booking") {
    const h = step.delay_minutes / 60;
    return h >= 1 ? `${h}h after booking` : `${step.delay_minutes}min after booking`;
  }
  // before_event
  if (step.delay_minutes >= 1440) return `${step.delay_minutes / 1440}d before call`;
  return `${step.delay_minutes / 60}h before call`;
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
    if (!confirm("Delete this automation?")) return;
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
      subject: "Reminder: your call {{date}}",
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
          <h2 className="text-sm font-semibold text-foreground mb-0.5">✉️ Email sequences</h2>
          <p className="text-xs text-muted-foreground">Triggered automatically when a call is booked.</p>
        </div>
      </div>

      {/* Automation list */}
      {automations.length > 0 && (
        <div className="space-y-3 mb-8">
          {automations.map((auto) => {
            const isEditing = expandedId === auto.id && editDraft?.id === auto.id;
            const draft = isEditing ? editDraft! : auto;
            return (
              <div key={auto.id} className="border border-border rounded-xl bg-muted overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Enable toggle */}
                  <button
                    onClick={() => toggleEnabled(auto)}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                      auto.enabled ? "bg-blue-600" : "bg-muted"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${auto.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{auto.name}</span>
                      <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Zap size={9} /> Call booked
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium"
                    >
                      {isEditing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      onClick={() => deleteAutomation(auto.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Inline editor */}
                {isEditing && (
                  <div className="border-t border-border bg-secondary px-4 pt-4 pb-5">
                    {/* Name */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                      <input
                        value={draft.name}
                        onChange={(e) => setEditDraft({ ...draft, name: e.target.value })}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted text-foreground focus:outline-none focus:border-[#5865f2]"
                      />
                    </div>

                    {/* Steps */}
                    <div className="space-y-4 mb-4">
                      {draft.steps.map((step, idx) => (
                        <div key={step.id} className="bg-muted border border-border rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                {idx + 1}
                              </div>
                              <span className="text-xs font-semibold text-foreground/70 flex items-center gap-1">
                                <Mail size={11} /> Email
                              </span>
                            </div>
                            {draft.steps.length > 1 && (
                              <button onClick={() => removeDraftStep(idx)} className="text-muted-foreground hover:text-red-500 transition-colors">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-3">
                            {/* When */}
                            <div>
                              <label className="block text-[10px] font-medium text-muted-foreground mb-1">When</label>
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
                                className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-muted text-foreground focus:outline-none focus:border-[#5865f2]"
                              >
                                <option value="immediately">Immediately</option>
                                <option value="before_event:60">1h before call</option>
                                <option value="before_event:180">3h before call</option>
                                <option value="before_event:1440">24h before call</option>
                                <option value="before_event:2880">48h before call</option>
                                <option value="delay_after_booking:60">1h after booking</option>
                                <option value="delay_after_booking:1440">24h after booking</option>
                              </select>
                            </div>

                            {/* Recipient */}
                            <div>
                              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Recipient</label>
                              <select
                                value={step.recipient}
                                onChange={(e) => updateDraftStep(idx, "recipient", e.target.value)}
                                className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-muted text-foreground focus:outline-none focus:border-[#5865f2]"
                              >
                                <option value="both">Lead + Me</option>
                                <option value="lead">Lead only</option>
                                <option value="organizer">Me only</option>
                              </select>
                            </div>
                          </div>

                          {/* Subject */}
                          <div className="mb-2">
                            <label className="block text-[10px] font-medium text-muted-foreground mb-1">Subject</label>
                            <input
                              value={step.subject}
                              onChange={(e) => updateDraftStep(idx, "subject", e.target.value)}
                              className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-muted text-foreground focus:outline-none focus:border-[#5865f2]"
                            />
                          </div>

                          {/* Body */}
                          <div>
                            <label className="block text-[10px] font-medium text-muted-foreground mb-1">Body</label>
                            <textarea
                              rows={4}
                              value={step.body}
                              onChange={(e) => updateDraftStep(idx, "body", e.target.value)}
                              className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs bg-muted text-foreground focus:outline-none focus:border-[#5865f2] resize-y"
                            />
                            <p className="mt-1 text-[10px] text-muted-foreground">Variables : {"{{name}} {{date}} {{time}} {{meetLink}}"}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add step */}
                    <button
                      onClick={addDraftStep}
                      className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium mb-4"
                    >
                      <Plus size={12} /> Add step
                    </button>

                    {/* Save / Cancel */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Save size={12} /> {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setExpandedId(null); setEditDraft(null); }}
                        className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground font-medium rounded-lg hover:bg-muted transition-colors"
                      >
                        Cancel
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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {automations.length === 0 ? "Start from a template" : "Add from a template"}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.name}
              onClick={() => createFromTemplate(tpl)}
              disabled={creating}
              className="text-left border border-border rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <Zap size={12} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-foreground/80 group-hover:text-blue-600 dark:group-hover:text-blue-400">{tpl.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{tpl.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {tpl.steps.map((s, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full">
                    {s.when === "immediately" ? "Now" : s.when === "before_event" ? `-${s.delay_minutes / 60}h` : `+${s.delay_minutes / 60}h`}
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
          Emails are sent via <strong>Gmail</strong> from <strong>{ORGANIZER_EMAIL_DISPLAY}</strong>.
          Scheduled reminders are processed every 5 minutes by the Vercel cron.
        </p>
      </div>
    </div>
  );
}

// ── Email Logs Tab ─────────────────────────────────────────────
const EMAIL_LOGS_PAGE_SIZE = 20;

function EmailLogsTab() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "success" | "error">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  function loadLogs() {
    setLoading(true);
    getEmailLogs().then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }

  useEffect(() => { loadLogs(); }, []);

  function handleFilterChange(f: "all" | "success" | "error") {
    setFilter(f);
    setPage(1);
    setExpanded(null);
  }

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  const filtered = filter === "all" ? logs : logs.filter((l) => l.status === filter);
  const errorCount = logs.filter((l) => l.status === "error").length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / EMAIL_LOGS_PAGE_SIZE));
  const paged = filtered.slice((page - 1) * EMAIL_LOGS_PAGE_SIZE, page * EMAIL_LOGS_PAGE_SIZE);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Email logs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {logs.length} email{logs.length !== 1 ? "s" : ""} sent
            {errorCount > 0 && (
              <span className="ml-2 text-red-500 font-medium">· {errorCount} error{errorCount !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "success", "error"] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
                filter === f
                  ? f === "error"
                    ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700"
                    : f === "success"
                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700"
                    : "bg-muted text-foreground border-border"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={loadLogs}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center">
          {filter === "all" ? "No emails logged yet." : `No ${filter} emails.`}
        </div>
      ) : (
        <>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">To</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Subject</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Source</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Sent</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-foreground font-mono text-xs truncate max-w-[180px]">{log.to_email}</td>
                      <td className="px-4 py-3 text-foreground truncate max-w-[220px]">{log.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          log.status === "success"
                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                            : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${log.status === "success" ? "bg-green-500" : "bg-red-500"}`} />
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{log.source ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs text-right whitespace-nowrap">{relativeTime(log.sent_at)}</td>
                    </tr>
                    {expanded === log.id && (
                      <tr key={`${log.id}-detail`} className="border-b border-border last:border-0 bg-muted/20">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">To</span>
                              <p className="font-mono text-foreground mt-0.5">{log.to_email}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Sent at</span>
                              <p className="text-foreground mt-0.5">
                                {new Date(log.sent_at).toLocaleString("en-GB", {
                                  day: "numeric", month: "short", year: "numeric",
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Subject</span>
                              <p className="text-foreground mt-0.5">{log.subject}</p>
                            </div>
                            {log.error && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Error</span>
                                <p className="font-mono text-red-600 dark:text-red-400 mt-0.5 whitespace-pre-wrap break-all">{log.error}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {(page - 1) * EMAIL_LOGS_PAGE_SIZE + 1}–{Math.min(page * EMAIL_LOGS_PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-muted-foreground px-2 min-w-[60px] text-center">
                  Page {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
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

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

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

  const weekLabel = `${fmt(days[0], { day: "numeric", month: "short" })} – ${fmt(days[6], { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header with tabs ── */}
      <div className="flex flex-col border-b border-border flex-shrink-0 bg-background">
        {/* Tabs row */}
        <div className="flex items-center overflow-x-auto scrollbar-none">
          {(["calendar", "scheduling", "availability", "automations", "logs"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = {
              calendar: "Calendar",
              scheduling: "🔗 Booking link",
              availability: "🗓 Availability",
              automations: "✉️ Email sequences",
              logs: "📧 Email logs",
            };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-shrink-0 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
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
              <button onClick={prevWeek} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-foreground/80 text-center whitespace-nowrap">{weekLabel}</span>
              <button onClick={nextWeek} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight size={16} />
              </button>
              <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium bg-muted hover:bg-secondary text-muted-foreground rounded-lg transition-colors">
                Today
              </button>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {syncMsg && (
                <span className={`text-xs hidden sm:inline ${syncMsg.ok ? "text-green-400" : "text-red-400"}`}>{syncMsg.text}</span>
              )}
              <button onClick={triggerSync} disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-secondary disabled:opacity-50 text-foreground rounded-lg transition-colors">
                <RotateCw size={12} className={syncing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">{syncing ? "Syncing…" : "EdenRed sync"}</span>
                {!syncing && <span className="sm:hidden">Sync</span>}
              </button>
              <button onClick={fetchEvents} disabled={loading} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
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
          <div className="p-3 md:p-5">
            {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 text-sm rounded-xl">{error}</div>
              )}

              <div className="bg-muted rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                {/* Day headers */}
                <div className="grid border-b border-border" style={{ gridTemplateColumns: "52px repeat(7, minmax(80px, 1fr))" }}>
                  <div />
                  {days.map((d, i) => {
                    const isToday = d.getTime() === todayDate.getTime();
                    return (
                      <div key={i} className="py-2.5 text-center border-l border-border">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{DAYS_SHORT[i]}</div>
                        <div className={`mx-auto mt-0.5 w-7 h-7 flex items-center justify-center text-base font-bold rounded-full ${isToday ? "bg-red-600 text-white" : "text-foreground/70"}`}>
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
                        <div key={i} style={{ position: "absolute", top: i * SLOT_H, right: 6, fontSize: 10, color: "var(--color-muted-foreground)", paddingTop: 2 }}>
                          {HOUR_START + i}:00
                        </div>
                      ))}
                    </div>
                    {days.map((d, di) => (
                      <div key={di} className="relative border-l border-border" style={{ height: totalPx }}>
                        {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                          <div key={i} style={{ position: "absolute", top: i * SLOT_H, left: 0, right: 0, borderTop: "1px solid var(--color-border)", pointerEvents: "none" }} />
                        ))}
                        {dayEvents(d).map((ev) => {
                          const { top, height } = eventStyle(ev);
                          const lead = isLeadEvent(ev);
                          return (
                            <div
                              key={ev.id}
                              style={{ position: "absolute", left: 2, right: 2, top, height, zIndex: 1 }}
                              onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                              className={`rounded-md px-1.5 py-0.5 overflow-hidden text-[10px] font-medium leading-tight border-l-2 cursor-pointer hover:brightness-95 transition-all ${
                                lead
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-400 dark:border-red-500"
                                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-400"
                              }`}
                            >
                              <span className="block truncate">{ev.summary ?? "(no title)"}</span>
                              {height > 26 && (
                                <span className="block opacity-70 text-[9px]">
                                  {new Date(ev.start.dateTime!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                </div>{/* end overflow-x-auto */}
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

        {/* ── Email logs tab ── */}
        {tab === "logs" && (
          <div className="p-6">
            <EmailLogsTab />
          </div>
        )}
      </div>

      {/* ── Event detail drawer ── */}
      {selectedEvent && (
        <EventDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={async (id) => {
            const attendeeEmail = selectedEvent.attendees?.find((a) => !a.self)?.email;
            const params = new URLSearchParams({ eventId: id });
            if (attendeeEmail) params.set("attendeeEmail", attendeeEmail);
            await fetch(`/api/calendly?${params}`, { method: "DELETE" });
            setEvents((prev) => prev.filter((e) => e.id !== id));
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}

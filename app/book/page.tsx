"use client";

import { useState, useCallback } from "react";
import { Clock, Video, ChevronLeft, ChevronRight, Globe, ArrowLeft, Check, Calendar } from "lucide-react";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Returns 0=Mon ... 6=Sun for the first day of the month
function getFirstDayOffset(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function toYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTodayParis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

type Step = "calendar" | "form" | "confirmed";

export default function BookPage() {
  const today = getTodayParis();
  const [displayYear, setDisplayYear] = useState(() => parseInt(today.slice(0, 4)));
  const [displayMonth, setDisplayMonth] = useState(() => parseInt(today.slice(5, 7)) - 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [step, setStep] = useState<Step>("calendar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ meetLink: string | null; calLink: string | null } | null>(null);

  const todayYear = parseInt(today.slice(0, 4));
  const todayMonth = parseInt(today.slice(5, 7)) - 1;

  const fetchSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    setSlots([]);
    try {
      const res = await fetch(`/api/availability?date=${date}`);
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const handleDateClick = (date: string) => {
    if (date === selectedDate) {
      setSelectedDate(null);
      setSlots([]);
      return;
    }
    setSelectedDate(date);
    setSelectedTime(null);
    fetchSlots(date);
  };

  const handleTimeClick = (time: string) => {
    setSelectedTime(time);
    setStep("form");
  };

  const handleBack = () => {
    setStep("calendar");
    setSelectedTime(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime || !name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/calendly/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), date: selectedDate, time: selectedTime }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de la réservation");
      setConfirmed({ meetLink: data.meetLink, calLink: data.calLink });
      setStep("confirmed");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const canGoPrev =
    displayYear > todayYear || (displayYear === todayYear && displayMonth > todayMonth);

  const daysInMonth = getDaysInMonth(displayYear, displayMonth);
  const firstDayOffset = getFirstDayOffset(displayYear, displayMonth);

  const prevMonth = () => {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
    else setDisplayMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1); }
    else setDisplayMonth(m => m + 1);
  };

  // ─── Left info panel ────────────────────────────────────────────────────────
  const infoPanel = (
    <div className="w-60 flex-shrink-0 border-r border-gray-100 p-8 flex flex-col">
      <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-base mb-4 select-none">
        CG
      </div>
      <p className="text-xs text-gray-400 mb-0.5">Clément Guiraud</p>
      <h1 className="text-lg font-semibold text-gray-900 mb-5">Discovery Call</h1>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock size={14} className="text-gray-400 flex-shrink-0" />
          <span>30 minutes</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Video size={14} className="text-gray-400 flex-shrink-0" />
          <span>Google Meet</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Globe size={14} className="text-gray-400 flex-shrink-0" />
          <span>Europe/Paris</span>
        </div>
      </div>
    </div>
  );

  // ─── Calendar panel ──────────────────────────────────────────────────────────
  const calendarPanel = (
    <div className="flex-1 p-8 min-w-0">
      <h2 className="text-sm font-semibold text-gray-900 mb-6">Sélectionner une date</h2>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {MONTH_NAMES[displayMonth]} {displayYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((h, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-400 py-1">
            {h}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = toYMD(displayYear, displayMonth, day);
          const dow = new Date(displayYear, displayMonth, day).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isPast = dateStr < today;
          const isDisabled = isWeekend || isPast;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;

          return (
            <div key={day} className="flex items-center justify-center py-0.5">
              <button
                onClick={() => !isDisabled && handleDateClick(dateStr)}
                disabled={isDisabled}
                className={[
                  "w-9 h-9 rounded-full text-sm transition-all font-medium",
                  isSelected
                    ? "bg-blue-600 text-white"
                    : isDisabled
                    ? "text-gray-300 cursor-not-allowed"
                    : isToday
                    ? "border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                    : "text-gray-800 hover:bg-blue-50 hover:text-blue-700 cursor-pointer",
                ].join(" ")}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-xs text-gray-400">Tous les créneaux sont affichés en heure de Paris</p>
    </div>
  );

  // ─── Time slots panel ────────────────────────────────────────────────────────
  const timePanel = (
    <div className="w-52 flex-shrink-0 border-l border-gray-100 p-6">
      <p className="text-sm font-semibold text-gray-900 mb-4 capitalize leading-tight">
        {selectedDate ? formatDateLong(selectedDate) : ""}
      </p>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {loadingSlots ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            Aucun créneau disponible
          </p>
        ) : (
          slots.map(slot => (
            <button
              key={slot}
              onClick={() => handleTimeClick(slot)}
              className="w-full py-2.5 border-2 border-blue-600 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-600 hover:text-white transition-all"
            >
              {slot}
            </button>
          ))
        )}
      </div>
    </div>
  );

  // ─── Booking form ────────────────────────────────────────────────────────────
  const formPanel = (
    <div className="flex-1 p-8">
      <button
        onClick={handleBack}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Retour
      </button>

      {/* Selected slot summary */}
      <div className="bg-blue-50 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-800 mb-0.5">
          <Calendar size={14} />
          <span className="capitalize">{selectedDate ? formatDateLong(selectedDate) : ""}</span>
        </div>
        <p className="text-sm text-blue-600 ml-5">{selectedTime} · 30 min · Google Meet</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nom complet <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="Jean Dupont"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="jean@entreprise.com"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !name.trim() || !email.trim()}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1"
        >
          {submitting ? "Réservation en cours…" : "Confirmer le rendez-vous"}
        </button>
      </form>
    </div>
  );

  // ─── Confirmation ────────────────────────────────────────────────────────────
  const confirmPanel = (
    <div className="flex-1 p-8">
      <div className="max-w-sm">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-5">
          <Check size={22} className="text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">C&apos;est confirmé !</h2>
        <p className="text-sm text-gray-500 mb-6">
          Un e-mail de confirmation vous a été envoyé. À très vite !
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-gray-900 capitalize mb-0.5">
            {selectedDate ? formatDateLong(selectedDate) : ""}
          </p>
          <p className="text-sm text-gray-500">{selectedTime} · 30 minutes · Google Meet</p>
        </div>

        <div className="flex gap-2.5">
          {confirmed?.meetLink && (
            <a
              href={confirmed.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Video size={14} />
              Rejoindre Meet
            </a>
          )}
          {confirmed?.calLink && (
            <a
              href={confirmed.calLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Calendar size={14} />
              Voir dans Calendar
            </a>
          )}
        </div>
      </div>
    </div>
  );

  // ─── Layout ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex overflow-hidden w-full"
           style={{ maxWidth: selectedDate && step === "calendar" ? 860 : 720 }}>
        {infoPanel}

        {step === "calendar" && (
          <div className="flex flex-1 overflow-hidden">
            {calendarPanel}
            {selectedDate && timePanel}
          </div>
        )}

        {step === "form" && formPanel}
        {step === "confirmed" && confirmPanel}
      </div>
    </div>
  );
}

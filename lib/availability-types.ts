// Shared types used by both server (app/api/settings/availability) and client components.
// This file must NOT import from any server-only modules.

export type DaySchedule = { start: string; end: string }[];

export type AvailabilityConfig = {
  days: Record<string, DaySchedule>;
};

export const DEFAULT_AVAILABILITY: AvailabilityConfig = {
  days: {
    "1": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "2": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "3": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "4": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
    "5": [{ start: "10:00", end: "12:30" }, { start: "14:00", end: "19:00" }],
  },
};

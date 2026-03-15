// Shared types used by both server (app/api/settings/availability) and client components.
// This file must NOT import from any server-only modules.

export type DaySchedule = { start: string; end: string }[];

export type AvailabilityConfig = {
  days: Record<string, DaySchedule>;
};

// Shared types used by both server (lib/automations.ts) and client components.
// This file must NOT import from any server-only modules.

export type AutomationStep = {
  id: string;
  type: "send_email";
  when: "immediately" | "delay_after_booking" | "before_event";
  delay_minutes: number;
  recipient: "lead" | "organizer" | "both";
  subject: string;
  body: string;
};

export type Automation = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  steps: AutomationStep[];
  created_at: string;
};

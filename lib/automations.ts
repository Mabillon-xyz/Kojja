import { createClient } from "@supabase/supabase-js";
import type { AutomationStep, Automation } from "@/lib/automation-types";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Re-export so existing imports from this file still work
export type { AutomationStep, Automation };

const ORGANIZER_EMAIL = "clement.guiraudpro@gmail.com";
const ORGANIZER_NAME = "Clément Guiraud";

export type BookingContext = {
  name: string;
  email: string;         // lead email
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM
  meetLink: string | null;
  calLink: string | null;
  eventStartIso: string; // ISO 8601 of event start
};

// ── Variable interpolation ────────────────────────────────────────────────────
function formatDateFR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function interpolate(str: string, ctx: BookingContext): string {
  return str
    .replace(/\{\{name\}\}/g, ctx.name)
    .replace(/\{\{email\}\}/g, ctx.email)
    .replace(/\{\{date\}\}/g, formatDateFR(ctx.date))
    .replace(/\{\{time\}\}/g, ctx.time)
    .replace(/\{\{meetLink\}\}/g, ctx.meetLink ?? "(Le lien Google Meet sera partagé avant le call)")
    .replace(/\{\{calLink\}\}/g, ctx.calLink ?? "");
}

// ── HTML email builder ────────────────────────────────────────────────────────
export function buildEmailHtml(body: string, ctx: BookingContext): string {
  const interpolated = interpolate(body, ctx);

  const lines = interpolated.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    const meetUrlMatch = trimmed.match(/(https:\/\/meet\.google\.com\/[^\s]+)/);
    if (meetUrlMatch) {
      const url = meetUrlMatch[1];
      const label = trimmed.replace(url, "").trim() || "Rejoindre le Meet";
      return `<a href="${url}" style="display:inline-block;background:#1a73e8;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:8px 0;">${label}</a>`;
    }
    return `<p style="margin:0 0 8px;color:#374151;line-height:1.6;">${trimmed}</p>`;
  });

  const content = lines.filter(Boolean).join("\n");

  const avatarUrl = process.env.ORGANIZER_AVATAR_URL;
  const avatar = avatarUrl
    ? `<img src="${avatarUrl}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;" />`
    : `<span style="font-size:36px;line-height:1;">🤝</span>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:40px 32px;">
    <div style="margin-bottom:28px;">${avatar}</div>
    ${content}
    <hr style="margin:28px 0;border:none;border-top:1px solid #f3f4f6;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">${ORGANIZER_NAME} · <a href="https://kojja.vercel.app/book" style="color:#2563eb;text-decoration:none;">kojja.vercel.app/book</a></p>
  </div>
</body>
</html>`;
}

// ── Core trigger function ─────────────────────────────────────────────────────
export async function triggerAutomations(ctx: BookingContext): Promise<void> {

  const supabase = getSupabase();

  const { data: automations } = await supabase
    .from("automations")
    .select("*")
    .eq("enabled", true)
    .eq("trigger", "call_booked");

  if (!automations?.length) return;

  const bookingTime = new Date();
  const eventStart = new Date(ctx.eventStartIso);

  for (const automation of automations as Automation[]) {
    for (const step of automation.steps) {
      if (step.type !== "send_email") continue;

      const recipients: string[] = [];
      if (step.recipient === "lead" || step.recipient === "both") recipients.push(ctx.email);
      if (step.recipient === "organizer" || step.recipient === "both") recipients.push(ORGANIZER_EMAIL);

      const subject = interpolate(step.subject, ctx);
      const bodyHtml = buildEmailHtml(step.body, ctx);

      if (step.when === "immediately") {
        // Skipped: the invite route already sends immediate confirmation emails directly.
        continue;
      } else {
        let sendAt: Date;
        if (step.when === "delay_after_booking") {
          sendAt = new Date(bookingTime.getTime() + step.delay_minutes * 60 * 1000);
        } else {
          sendAt = new Date(eventStart.getTime() - step.delay_minutes * 60 * 1000);
        }

        if (sendAt <= bookingTime) continue;

        for (const to of recipients) {
          await supabase.from("scheduled_emails").insert({
            automation_id: automation.id,
            send_at: sendAt.toISOString(),
            to_email: to,
            subject,
            body_html: bodyHtml,
            context: ctx,
          });
        }
      }
    }
  }
}

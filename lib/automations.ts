import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";

const ORGANIZER_EMAIL = "clement.guiraudpro@gmail.com";
const ORGANIZER_NAME = "Clément Guiraud";

export type AutomationStep = {
  id: string;
  type: "send_email";
  when: "immediately" | "delay_after_booking" | "before_event";
  delay_minutes: number;
  recipient: "lead" | "organizer" | "both";
  subject: string;
  body: string; // plain text with {{name}} {{date}} {{time}} {{meetLink}} vars
};

export type Automation = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  steps: AutomationStep[];
  created_at: string;
};

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
    .replace(/\{\{meetLink\}\}/g, ctx.meetLink ?? "")
    .replace(/\{\{calLink\}\}/g, ctx.calLink ?? "");
}

// ── HTML email builder ────────────────────────────────────────────────────────
export function buildEmailHtml(body: string, ctx: BookingContext): string {
  const interpolated = interpolate(body, ctx);

  // Convert plain text to HTML paragraphs, handling the Meet link as a button
  const lines = interpolated.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    // If line contains a Meet URL, render it as a button
    const meetUrlMatch = trimmed.match(/(https:\/\/meet\.google\.com\/[^\s]+)/);
    if (meetUrlMatch) {
      const url = meetUrlMatch[1];
      const label = trimmed.replace(url, "").trim() || "Rejoindre le Meet";
      return `<a href="${url}" style="display:inline-block;background:#1a73e8;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:8px 0;">${label}</a>`;
    }
    return `<p style="margin:0 0 8px;color:#374151;line-height:1.6;">${trimmed}</p>`;
  });

  const content = lines.filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:40px 32px;">
    <div style="margin-bottom:28px;">
      <div style="width:36px;height:36px;background:#2563eb;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;">CG</div>
    </div>
    ${content}
    <hr style="margin:28px 0;border:none;border-top:1px solid #f3f4f6;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">${ORGANIZER_NAME} · <a href="https://kojja.vercel.app/book" style="color:#2563eb;text-decoration:none;">kojja.vercel.app/book</a></p>
  </div>
</body>
</html>`;
}

// ── Core trigger function ─────────────────────────────────────────────────────
export async function triggerAutomations(ctx: BookingContext): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const from = process.env.RESEND_FROM_EMAIL!;

  let supabase: Awaited<ReturnType<typeof createServiceClient>>;
  try {
    supabase = await createServiceClient();
  } catch {
    return;
  }

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
        // Send right now
        for (const to of recipients) {
          try {
            await resend.emails.send({ from, to, subject, html: bodyHtml });
          } catch { /* best effort */ }
        }
      } else {
        // Queue in scheduled_emails
        let sendAt: Date;
        if (step.when === "delay_after_booking") {
          sendAt = new Date(bookingTime.getTime() + step.delay_minutes * 60 * 1000);
        } else {
          // before_event
          sendAt = new Date(eventStart.getTime() - step.delay_minutes * 60 * 1000);
        }

        // Don't schedule emails in the past
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

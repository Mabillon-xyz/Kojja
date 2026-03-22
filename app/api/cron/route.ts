import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { logEmail } from "@/lib/email-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        // Bypass Next.js data cache for all Supabase fetch calls
        fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}

function getTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function GET() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error("[cron] GMAIL_USER or GMAIL_APP_PASSWORD not set");
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  const supabase = getSupabase();

  // Fetch ALL rows — zero PostgREST filters (all filtering/comparison done in JS)
  const { data: allRows, error: fetchError } = await supabase
    .from("scheduled_emails")
    .select("*");

  if (fetchError) {
    console.error("[cron] Failed to fetch scheduled emails:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const nowMs = Date.now();
  const pending = (allRows ?? []).filter((row) => {
    const sendAtMs = new Date(row.send_at).getTime();
    const isDue = sendAtMs <= nowMs;
    const isUnsent = row.sent_at === null && row.sent !== true;
    return isDue && isUnsent;
  });

  console.log(`[cron] total=${allRows?.length ?? 0} rows, pending=${pending.length} at`, new Date().toISOString());
  console.log("[cron] pending ids:", pending.map((r) => r.id).join(", ") || "none");

  if (pending.length === 0) {
    return NextResponse.json({ sent: 0, message: "No emails due" });
  }

  const transporter = getTransporter();
  const from = `Clément Guiraud <${process.env.GMAIL_USER}>`;
  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      await transporter.sendMail({
        from,
        to: row.to_email,
        subject: row.subject,
        html: row.body_html,
      });

      const { error: updateError } = await supabase
        .from("scheduled_emails")
        .update({ sent_at: new Date().toISOString(), sent: true })
        .eq("id", row.id);

      if (updateError) console.error(`[cron] Update failed for ${row.id}:`, updateError.message);

      await logEmail({ to_email: row.to_email, subject: row.subject, status: "success", source: "cron" });
      sent++;
    } catch (e) {
      failed++;
      const errMsg = String(e);
      console.error(`[cron] Failed to send email ${row.id}:`, errMsg);
      await logEmail({ to_email: row.to_email, subject: row.subject, status: "error", error: errMsg, source: "cron" });
      await supabase
        .from("scheduled_emails")
        .update({ error: errMsg })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ sent, failed, total: pending.length });
}

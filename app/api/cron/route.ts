import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { logEmail } from "@/lib/email-log";

export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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

  // Fetch pending emails due now (filter on `sent` bool — more reliable than IS NULL)
  const { data: pending, error: fetchError } = await supabase
    .from("scheduled_emails")
    .select("*")
    .lte("send_at", new Date().toISOString())
    .eq("sent", false)
    .limit(50);

  if (fetchError) {
    console.error("[cron] Failed to fetch scheduled emails:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Diagnostic: show all rows due (ignoring sent filter) to debug sent=null issue
  const { data: allDue } = await supabase
    .from("scheduled_emails")
    .select("id, send_at, sent, sent_at, to_email")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: false })
    .limit(20);
  console.log("[cron] allDue (ignoring sent filter):", JSON.stringify(allDue));

  console.log(`[cron] ${pending?.length ?? 0} email(s) due at`, new Date().toISOString());

  if (!pending || pending.length === 0) {
    return NextResponse.json({ sent: 0, message: "No emails due", debug_allDue: allDue });
  }

  const transporter = getTransporter();
  const from = `Clément Guiraud <${process.env.GMAIL_USER}>`;
  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    // Extra guard: skip rows already sent (belt-and-suspenders)
    if (row.sent_at !== null) continue;
    try {
      await transporter.sendMail({
        from,
        to: row.to_email,
        subject: row.subject,
        html: row.body_html,
      });

      await supabase
        .from("scheduled_emails")
        .update({ sent_at: new Date().toISOString(), sent: true })
        .eq("id", row.id);

      await logEmail({ to_email: row.to_email, subject: row.subject, status: "success", source: "cron" });
      sent++;
      console.log(`[cron] Sent email ${row.id} → ${row.to_email}`);
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

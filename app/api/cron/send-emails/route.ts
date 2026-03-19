import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createServiceClient } from "@/lib/supabase/server";
import { logEmail } from "@/lib/email-log";

export async function GET(req: NextRequest) {
  // Auth via CRON_SECRET (Vercel sets this automatically for cron jobs)
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  const from = `Clément Guiraud <${process.env.GMAIL_USER}>`;
  const supabase = await createServiceClient();

  // Fetch up to 50 pending emails that are due
  const { data: pending, error } = await supabase
    .from("scheduled_emails")
    .select("*")
    .eq("sent", false)
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pending?.length) return NextResponse.json({ processed: 0 });

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
      await supabase
        .from("scheduled_emails")
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq("id", row.id);
      await logEmail({ to_email: row.to_email, subject: row.subject, status: "success", source: "cron" });
      sent++;
    } catch (e) {
      await logEmail({ to_email: row.to_email, subject: row.subject, status: "error", error: String(e), source: "cron" });
      failed++;
    }
  }

  return NextResponse.json({ processed: pending.length, sent, failed });
}

"use server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type EmailLog = {
  id: string;
  to_email: string;
  subject: string;
  status: "success" | "error";
  error: string | null;
  source: string | null;
  sent_at: string;
};

export async function getEmailLogs(): Promise<EmailLog[]> {
  const { data } = await getSupabase()
    .from("email_logs")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(200);
  return (data as EmailLog[]) ?? [];
}

"use server";
import { createServiceClient } from "@/lib/supabase/server";

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
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("email_logs")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(200);
  return (data as EmailLog[]) ?? [];
}

import { createServiceClient } from "@/lib/supabase/server";

export async function logEmail(data: {
  to_email: string;
  subject: string;
  status: "success" | "error";
  error?: string;
  source: string;
}) {
  try {
    const supabase = await createServiceClient();
    await supabase.from("email_logs").insert(data);
  } catch {
    // Never let logging failures break the calling code
  }
}

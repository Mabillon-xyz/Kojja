import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function logEmail(data: {
  to_email: string;
  subject: string;
  status: "success" | "error";
  error?: string;
  source: string;
}) {
  try {
    const { error } = await getSupabase().from("email_logs").insert(data);
    if (error) console.error("logEmail insert failed:", error.message);
  } catch (e) {
    console.error("logEmail threw:", e);
  }
}

import { createClient } from "@supabase/supabase-js";

// Server-only client that bypasses RLS. Use sparingly — for sending pushes,
// cron tasks, and other system operations where the caller's identity isn't
// the same as the row owner.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or URL");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

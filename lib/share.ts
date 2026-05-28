import type { SupabaseClient } from "@supabase/supabase-js";

// 22-char URL-safe id from 16 random bytes. Sufficient to keep tokens
// unguessable; collisions are astronomically unlikely.
function newShareToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return Buffer.from(str, "binary")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function getOrCreateShareToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("share_token")
    .eq("id", userId)
    .maybeSingle();
  if (existing?.share_token) return existing.share_token;

  const token = newShareToken();
  const { error } = await supabase
    .from("profiles")
    .update({ share_token: token })
    .eq("id", userId);
  if (error) {
    console.error("[share] set token failed:", error);
    return null;
  }
  return token;
}

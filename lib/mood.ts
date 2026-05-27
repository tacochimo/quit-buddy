import type { SupabaseClient } from "@supabase/supabase-js";

export type Mood = "good" | "steady" | "irritable" | "anxious" | "low" | "tired";

export const MOOD_CHIPS: Array<{ mood: Mood; emoji: string; label: string }> = [
  { mood: "good", emoji: "🙂", label: "Good" },
  { mood: "steady", emoji: "😐", label: "Steady" },
  { mood: "irritable", emoji: "😤", label: "Irritable" },
  { mood: "anxious", emoji: "🫨", label: "Anxious" },
  { mood: "low", emoji: "😞", label: "Low" },
  { mood: "tired", emoji: "🥱", label: "Tired" },
];

export function moodLabel(mood: Mood): string {
  return MOOD_CHIPS.find((c) => c.mood === mood)?.label ?? mood;
}

export function moodEmoji(mood: Mood): string {
  return MOOD_CHIPS.find((c) => c.mood === mood)?.emoji ?? "•";
}

export function isMood(value: string): value is Mood {
  return MOOD_CHIPS.some((c) => c.mood === value);
}

export async function getTodaysMood(
  supabase: SupabaseClient,
  userId: string,
  localDate: string,
): Promise<Mood | null> {
  const { data } = await supabase
    .from("mood_logs")
    .select("mood")
    .eq("user_id", userId)
    .eq("log_date", localDate)
    .maybeSingle();
  return (data?.mood as Mood | undefined) ?? null;
}

// Most recent mood within the lookback window (used to feed coach context
// when today hasn't been logged yet).
export async function getRecentMood(
  supabase: SupabaseClient,
  userId: string,
  withinDays = 3,
): Promise<{ mood: Mood; daysAgo: number } | null> {
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);
  const { data } = await supabase
    .from("mood_logs")
    .select("mood, log_date")
    .eq("user_id", userId)
    .gte("log_date", since.toISOString().slice(0, 10))
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const daysAgo = Math.max(
    0,
    Math.round(
      (Date.now() - new Date(data.log_date).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );
  return { mood: data.mood as Mood, daysAgo };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Route } from "next";

export type PrepStep = {
  id: string;
  label: string;
  body: string;
  href?: Route;
  hrefLabel?: string;
};

export const PREP_STEPS: PrepStep[] = [
  {
    id: "cigs_disposed",
    label: "Throw out the smoking gear",
    body: "Cigarettes, ashtrays, lighters — and the spare pack in the glovebox. Make it inconvenient to start.",
  },
  {
    id: "told_people",
    label: "Tell at least 3 people",
    body: "Pick people who'll ask how it's going next week. Social accountability roughly doubles success rates.",
  },
  {
    id: "triggers_identified",
    label: "Log your top triggers",
    body: "Spend 2 minutes adding the times, places, and feelings that make you reach for one.",
    href: "/app/cravings",
    hrefLabel: "Go to Cravings",
  },
  {
    id: "plan_for_each",
    label: "Write an if-then plan for each trigger",
    body: "\"When X happens, I will Y.\" Decide once, in calm. Don't decide again under pressure.",
    href: "/app/cravings",
    hrefLabel: "Open plans",
  },
  {
    id: "meds_arranged",
    label: "Talk to a clinician about NRT or meds",
    body: "Patches, gum, varenicline — anything that takes the edge off the first 2 weeks. Then log them.",
    href: "/app/meds",
    hrefLabel: "Go to Meds",
  },
  {
    id: "buddy_invited",
    label: "Get a buddy or a channel",
    body: "One person who knows you're quitting and roots for you, in real time.",
    href: "/app/buddy",
    hrefLabel: "Set up a buddy",
  },
  {
    id: "home_screen",
    label: "Add Quit Buddy to your home screen",
    body: "Long-press in your browser → \"Add to Home Screen\". Notifications and quick-actions work better.",
  },
];

export async function getCompletedSteps(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("prep_steps")
    .select("step_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.step_id));
}

const STEP_IDS = new Set(PREP_STEPS.map((s) => s.id));

export function isValidStepId(id: string): boolean {
  return STEP_IDS.has(id);
}

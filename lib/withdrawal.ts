// Cessation withdrawal timeline. The shape and headlines are derived from
// public cessation literature (CDC / Surgeon General / Mayo). Tone here is
// deliberately reassuring rather than clinical — this is what a user reads
// at 11pm on day 2 when they're miserable.

export type WithdrawalStage = {
  id: string;
  startDay: number;
  endDay: number | null; // null = open-ended (final stage)
  headline: string;
  summary: string;
  symptoms: string[];
  reassurance: string;
};

export const WITHDRAWAL_STAGES: WithdrawalStage[] = [
  {
    id: "first-day",
    startDay: 0,
    endDay: 1,
    headline: "First 24 hours. Nicotine is dropping fast.",
    summary:
      "Your body is recalibrating. Symptoms will ramp up over the next day or two — that's the chemistry leaving, not a sign anything is wrong.",
    symptoms: [
      "Restlessness",
      "Mild headache",
      "Increased appetite",
      "Irritability creeping in",
    ],
    reassurance:
      "What you're feeling is normal. It gets sharper before it gets easier.",
  },
  {
    id: "peak",
    startDay: 1,
    endDay: 3,
    headline: "Peak withdrawal. This is the worst it gets.",
    summary:
      "Days 1–3 are the chemical bottom. Most quitters who get through this window keep going. Your brain is rewiring without nicotine for the first time in years.",
    symptoms: [
      "Strong cravings (each one lasts 3–5 minutes)",
      "Irritability, short fuse",
      "Trouble concentrating",
      "Disrupted sleep",
      "Hunger",
    ],
    reassurance: "Tomorrow this gets easier. The day after, easier still.",
  },
  {
    id: "taper",
    startDay: 3,
    endDay: 7,
    headline: "Past the peak. Nicotine is out of your system.",
    summary:
      "Physical withdrawal is fading. Cravings still hit, but they're shorter and further apart.",
    symptoms: [
      "Fewer, shorter cravings",
      "Mood still up and down",
      "Energy starting to come back",
      "Coughing more (lungs clearing out)",
    ],
    reassurance:
      "Each day past now, your brain is one day further from needing it.",
  },
  {
    id: "psychological",
    startDay: 7,
    endDay: 28,
    headline: "Physical is done. The fight is now psychological.",
    summary:
      "Triggers, not chemistry. Cravings now come from places, people, and habits — not your bloodstream.",
    symptoms: [
      "Situational cravings (after meals, with coffee, when stressed)",
      "Boredom",
      "Occasional low mood",
      "A sense that something is 'missing'",
    ],
    reassurance:
      "Every craving you ride out is a path you're not building.",
  },
  {
    id: "rewiring",
    startDay: 28,
    endDay: 90,
    headline: "Cravings are mostly situational now.",
    summary:
      "Your brain has largely adjusted. Cravings come when triggered, not on their own. Identify and avoid; don't white-knuckle every one.",
    symptoms: [
      "Cravings tied to specific places or events",
      "Occasional vivid dreams",
      "Sleep mostly back to normal",
    ],
    reassurance:
      "You're not 'quitting' anymore. You're a non-smoker with a history.",
  },
  {
    id: "rebuilt",
    startDay: 90,
    endDay: null,
    headline: "You're a non-smoker now.",
    summary:
      "Cravings are rare and almost always situational. A slip here doesn't undo your work — but it's also no longer required.",
    symptoms: ["Rare, brief cravings", "Habit fully rewired"],
    reassurance: "You did the hardest part months ago. Keep going.",
  },
];

export type WithdrawalPosition = {
  current: WithdrawalStage;
  next: WithdrawalStage | null;
  daysIntoStage: number;
  daysUntilNext: number | null;
};

export function getWithdrawalStage(streakDays: number): WithdrawalPosition {
  for (let i = 0; i < WITHDRAWAL_STAGES.length; i += 1) {
    const s = WITHDRAWAL_STAGES[i];
    if (s.endDay === null || streakDays < s.endDay) {
      const next = WITHDRAWAL_STAGES[i + 1] ?? null;
      return {
        current: s,
        next,
        daysIntoStage: Math.max(0, streakDays - s.startDay),
        daysUntilNext: next ? Math.max(0, next.startDay - streakDays) : null,
      };
    }
  }
  const last = WITHDRAWAL_STAGES[WITHDRAWAL_STAGES.length - 1];
  return {
    current: last,
    next: null,
    daysIntoStage: streakDays - last.startDay,
    daysUntilNext: null,
  };
}

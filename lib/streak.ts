export const MILESTONES = [1, 7, 30, 90, 180, 365, 730] as const;
export type Milestone = (typeof MILESTONES)[number];

export function milestoneKind(days: Milestone): string {
  return `milestone_${days}d`;
}

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export type StreakState =
  | { kind: "quit"; quitDate: Date; days: number }
  | { kind: "relapse"; relapseDate: Date }
  | { kind: "none" };

export function computeStreak(
  latestEvent: { type: "quit" | "relapse"; occurred_at: string } | null,
  now = new Date(),
): StreakState {
  if (!latestEvent) return { kind: "none" };
  const occurredAt = new Date(latestEvent.occurred_at);
  if (latestEvent.type === "quit") {
    return {
      kind: "quit",
      quitDate: occurredAt,
      days: Math.max(0, daysBetween(occurredAt, now)),
    };
  }
  return { kind: "relapse", relapseDate: occurredAt };
}

export function computeSavings(args: {
  days: number;
  cigsPerDay: number | null;
  costPerPack: number | null;
  cigsPerPack: number | null;
}): { cigsAvoided: number; moneySaved: number } {
  const cigsPerDay = args.cigsPerDay ?? 0;
  const costPerPack = args.costPerPack ?? 0;
  const cigsPerPack = args.cigsPerPack ?? 20;
  const cigsAvoided = args.days * cigsPerDay;
  const moneySaved = cigsPerPack > 0 ? (cigsAvoided / cigsPerPack) * costPerPack : 0;
  return {
    cigsAvoided: Math.round(cigsAvoided),
    moneySaved: Math.round(moneySaved * 100) / 100,
  };
}

export function earnedMilestones(streakDays: number): Milestone[] {
  return MILESTONES.filter((m) => streakDays >= m);
}

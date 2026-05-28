export type CompanionId =
  | "dog"
  | "cat"
  | "owl"
  | "fox"
  | "otter"
  | "turtle";

export type Companion = {
  id: CompanionId;
  emoji: string;
  label: string;
  // Optional one-line flavor for the picker.
  blurb: string;
};

export const COMPANIONS: Companion[] = [
  { id: "dog", emoji: "🐕", label: "Dog", blurb: "Settles next to you." },
  { id: "cat", emoji: "🐈", label: "Cat", blurb: "Watches from a polite distance." },
  { id: "owl", emoji: "🦉", label: "Owl", blurb: "Quiet, watchful." },
  { id: "fox", emoji: "🦊", label: "Fox", blurb: "Curious and calm." },
  { id: "otter", emoji: "🦦", label: "Otter", blurb: "Floats along with you." },
  { id: "turtle", emoji: "🐢", label: "Turtle", blurb: "Slow and steady." },
];

const BY_ID = new Map(COMPANIONS.map((c) => [c.id, c]));

export function getCompanion(id: string | null | undefined): Companion | null {
  if (!id) return null;
  return BY_ID.get(id as CompanionId) ?? null;
}

export function isCompanionId(value: string): value is CompanionId {
  return BY_ID.has(value as CompanionId);
}

// CDC/Surgeon General-aligned health recovery milestones after quitting.
// Days are approximations chosen for a clean progress UI.

export type HealthMilestone = {
  days: number;
  label: string;
  summary: string;
};

export const HEALTH_MILESTONES: HealthMilestone[] = [
  {
    days: 0.014, // ~20 minutes
    label: "20 minutes",
    summary: "Heart rate and blood pressure drop toward normal.",
  },
  {
    days: 0.5,
    label: "12 hours",
    summary: "Carbon monoxide level in your blood returns to normal.",
  },
  {
    days: 1,
    label: "24 hours",
    summary: "Risk of heart attack begins to drop.",
  },
  {
    days: 2,
    label: "48 hours",
    summary: "Nerve endings start regrowing. Taste and smell improve.",
  },
  {
    days: 14,
    label: "2 weeks",
    summary: "Circulation improves. Walking gets easier.",
  },
  {
    days: 90,
    label: "3 months",
    summary: "Lung function increases up to 30%.",
  },
  {
    days: 270,
    label: "9 months",
    summary: "Coughing and shortness of breath decrease.",
  },
  {
    days: 365,
    label: "1 year",
    summary: "Excess risk of coronary heart disease is cut in half.",
  },
  {
    days: 1825,
    label: "5 years",
    summary: "Stroke risk and several cancer risks drop sharply.",
  },
  {
    days: 3650,
    label: "10 years",
    summary: "Risk of dying from lung cancer falls to about half a smoker's.",
  },
  {
    days: 5475,
    label: "15 years",
    summary: "Heart disease risk matches that of someone who never smoked.",
  },
];

export function nextMilestone(streakDays: number) {
  return HEALTH_MILESTONES.find((m) => m.days > streakDays) ?? null;
}

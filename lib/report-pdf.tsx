// PDF rendering for the doctor-ready report. Uses @react-pdf/renderer
// (React component model that emits a PDF binary). Server-only — never
// imported into a client bundle.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { fmtHour } from "./craving-insights";
import type { ReportData } from "./report";

const PALETTE = {
  ink: "#0a0a0a",
  muted: "#6b7280",
  rule: "#e5e7eb",
  accent: "#047857",
  accentBg: "#ecfdf5",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: PALETTE.ink,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.ink,
    paddingBottom: 8,
    marginBottom: 14,
  },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: PALETTE.muted, marginTop: 2 },
  generatedAt: { fontSize: 9, color: PALETTE.muted },
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: PALETTE.muted,
    marginTop: 16,
    marginBottom: 6,
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 140, color: PALETTE.muted },
  value: { flex: 1 },
  highlight: {
    backgroundColor: PALETTE.accentBg,
    borderLeftWidth: 3,
    borderLeftColor: PALETTE.accent,
    padding: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  highlightHeading: {
    fontSize: 9,
    color: PALETTE.accent,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  bigNumber: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
  },
  metricsGrid: { flexDirection: "row", gap: 16, marginTop: 6, marginBottom: 4 },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: PALETTE.rule,
    borderRadius: 4,
    padding: 10,
  },
  metricLabel: {
    fontSize: 8,
    color: PALETTE.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metricValue: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4 },
  metricHint: { fontSize: 8, color: PALETTE.muted, marginTop: 2 },
  paragraph: { marginTop: 4, lineHeight: 1.4 },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletDot: { width: 10, color: PALETTE.muted },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: PALETTE.muted,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: PALETTE.rule,
    paddingTop: 6,
  },
});

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function fmtCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

function scheduleLabel(s: "daily" | "twice-daily" | "prn"): string {
  if (s === "daily") return "Daily";
  if (s === "twice-daily") return "Twice daily";
  return "As needed";
}

export function ReportDocument({ data }: { data: ReportData }) {
  const streakLine =
    data.streak.kind === "quit"
      ? `${data.streak.days} day${data.streak.days === 1 ? "" : "s"} smoke-free (since ${DATE_FMT.format(data.streak.quitDate)})`
      : data.streak.kind === "relapse"
        ? `Restarting after relapse on ${DATE_FMT.format(data.streak.relapseDate)}`
        : "No quit recorded yet";

  return (
    <Document
      title={`Lastember report — ${data.patient.displayName}`}
      author="Lastember"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Smoking Cessation Report</Text>
            <Text style={styles.subtitle}>
              Self-tracked data from Lastember — share with your clinician
            </Text>
          </View>
          <Text style={styles.generatedAt}>
            Generated {DATETIME_FMT.format(data.generatedAt)}
          </Text>
        </View>

        {/* PATIENT */}
        <Text style={styles.sectionHeading}>Patient</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{data.patient.displayName}</Text>
        </View>
        {data.patient.email && (
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{data.patient.email}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Quit date</Text>
          <Text style={styles.value}>
            {DATE_FMT.format(data.patient.quitDate)}
          </Text>
        </View>
        {data.patient.baselineCigsPerDay != null && (
          <View style={styles.row}>
            <Text style={styles.label}>Baseline use</Text>
            <Text style={styles.value}>
              {data.patient.baselineCigsPerDay} cigarettes/day
              {data.patient.costPerPack != null
                ? ` · ${fmtCurrency(Number(data.patient.costPerPack))}/pack · ${data.patient.cigsPerPack}/pack`
                : ""}
            </Text>
          </View>
        )}

        {/* CURRENT STATUS */}
        <Text style={styles.sectionHeading}>Current status</Text>
        <View style={styles.highlight}>
          <Text style={styles.highlightHeading}>Streak</Text>
          <Text style={styles.bigNumber}>{streakLine}</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Cigarettes avoided</Text>
            <Text style={styles.metricValue}>
              {data.savings.cigsAvoided.toLocaleString("en-US")}
            </Text>
            <Text style={styles.metricHint}>since current quit date</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Money saved</Text>
            <Text style={styles.metricValue}>
              {fmtCurrency(data.savings.moneySaved)}
            </Text>
            <Text style={styles.metricHint}>self-reported pack price</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Longest streak</Text>
            <Text style={styles.metricValue}>
              {data.history.longestStreakDays} d
            </Text>
            <Text style={styles.metricHint}>across all attempts</Text>
          </View>
        </View>

        {/* HISTORY */}
        <Text style={styles.sectionHeading}>Quit history</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total quit attempts</Text>
          <Text style={styles.value}>{data.history.totalQuitAttempts}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total relapses</Text>
          <Text style={styles.value}>{data.history.totalRelapses}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Milestones reached</Text>
          <Text style={styles.value}>
            {data.milestones.length === 0
              ? "None yet"
              : data.milestones.map((d) => `${d}d`).join(" · ")}
          </Text>
        </View>

        {/* MEDICATIONS */}
        {(data.meds.active.length > 0 ||
          data.meds.past.length > 0 ||
          data.meds.sideEffects.length > 0) && (
          <>
            <Text style={styles.sectionHeading}>Medications &amp; NRT</Text>
            {data.meds.active.length === 0 ? (
              <Text style={styles.paragraph}>None currently active.</Text>
            ) : (
              data.meds.active.map((m, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.label}>{m.name}</Text>
                  <Text style={styles.value}>
                    {scheduleLabel(m.schedule)}
                    {m.doseMg != null ? ` · ${m.doseMg} mg` : ""}
                    {" · "}
                    {m.daysOn} day{m.daysOn === 1 ? "" : "s"} on
                    {m.adherencePct != null
                      ? ` · ${m.adherencePct}% adherence (30d)`
                      : m.schedule === "prn"
                        ? ` · ${m.prnTotal30d} doses in last 30d`
                        : ""}
                  </Text>
                </View>
              ))
            )}
            {data.meds.past.length > 0 && (
              <>
                <Text style={[styles.metricLabel, { marginTop: 6 }]}>
                  Past regimens
                </Text>
                {data.meds.past.map((m, i) => (
                  <View key={i} style={styles.bullet}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.value}>
                      {m.name} ({DATE_FMT.format(m.startedOn)} →{" "}
                      {DATE_FMT.format(m.endedOn)})
                    </Text>
                  </View>
                ))}
              </>
            )}
            {data.meds.sideEffects.length > 0 && (
              <>
                <Text style={[styles.metricLabel, { marginTop: 6 }]}>
                  Reported side effects (last 30d)
                </Text>
                {data.meds.sideEffects.map((s, i) => (
                  <View key={i} style={styles.bullet}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.value}>
                      {s.label} — {s.count} time{s.count === 1 ? "" : "s"}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* CRAVINGS */}
        <Text style={styles.sectionHeading}>Craving log</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total cravings logged</Text>
          <Text style={styles.value}>{data.cravings.total}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Last 30 days</Text>
          <Text style={styles.value}>{data.cravings.last30dCount}</Text>
        </View>
        {data.cravings.avgIntensity != null && (
          <View style={styles.row}>
            <Text style={styles.label}>Average intensity</Text>
            <Text style={styles.value}>
              {data.cravings.avgIntensity}/5 (self-rated)
            </Text>
          </View>
        )}

        {(data.cravings.insights.peakWindow ||
          data.cravings.insights.topTrigger ||
          data.cravings.insights.intensityTrend) && (
          <>
            <Text style={styles.sectionHeading}>Patterns</Text>
            {data.cravings.insights.peakWindow && (
              <View style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.value}>
                  Most cravings cluster between{" "}
                  {fmtHour(data.cravings.insights.peakWindow.startHour)} and{" "}
                  {fmtHour(data.cravings.insights.peakWindow.endHour)} (
                  {data.cravings.insights.peakWindow.count} of{" "}
                  {data.cravings.insights.total}).
                </Text>
              </View>
            )}
            {data.cravings.insights.topTrigger && (
              <View style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.value}>
                  Most common trigger:{" "}
                  {data.cravings.insights.topTrigger.name} (
                  {data.cravings.insights.topTrigger.count} cravings, avg
                  intensity {data.cravings.insights.topTrigger.avgIntensity}
                  /5).
                </Text>
              </View>
            )}
            {data.cravings.insights.intensityTrend && (
              <View style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.value}>
                  Intensity trend (last 2 weeks vs prior 2 weeks):{" "}
                  {data.cravings.insights.intensityTrend.prior}/5 →{" "}
                  {data.cravings.insights.intensityTrend.recent}/5 (
                  {data.cravings.insights.intensityTrend.direction}).
                </Text>
              </View>
            )}
            {data.cravings.insights.frequencyTrend && (
              <View style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.value}>
                  Weekly frequency:{" "}
                  {data.cravings.insights.frequencyTrend.recent} this week vs{" "}
                  {data.cravings.insights.frequencyTrend.prior} last week (
                  {data.cravings.insights.frequencyTrend.direction}).
                </Text>
              </View>
            )}
          </>
        )}

        {/* MOTIVATION */}
        {data.patient.reasons && (
          <>
            <Text style={styles.sectionHeading}>
              Reasons for quitting (patient&apos;s words)
            </Text>
            <Text style={styles.paragraph}>{data.patient.reasons}</Text>
          </>
        )}

        <Text style={styles.footer}>
          Self-reported data from the Lastember app. Not a medical record.
          Intended to support discussion with a healthcare provider.
        </Text>
      </Page>
    </Document>
  );
}

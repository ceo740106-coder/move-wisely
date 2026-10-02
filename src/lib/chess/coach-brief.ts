import { WEAKNESS_META, type AnalysisReport } from "./types";

export function buildCoachBrief(report: AnalysisReport): string {
  const focuses = report.topWeaknesses.filter((item) => item.count > 0).slice(0, 3);
  const topIssue = report.issues[0];
  const lines = [
    `MOVEWISELY COACH HANDOFF`,
    `${report.profile.name ?? report.profile.username} · ${report.gamesAnalyzed} ${report.timeClass} games`,
    `Engine: ${report.engineVersion} · verified depth ${report.analysisMeta?.confirmDepth ?? report.engineDepth}`,
    "",
    `Performance: ${report.accuracy}% MoveWisely accuracy · ${report.overallAcpl} average CPL · ${report.wins}-${report.draws}-${report.losses}`,
    `Competition: ${report.competition.countdownLabel}`,
    "",
    "PRIORITIES",
    ...(focuses.length ? focuses.map((item, index) => `${index + 1}. ${WEAKNESS_META[item.key].label} — ${item.count} tagged occurrences`) : ["1. No recurring weakness reached the reporting threshold in this sample."]),
    "",
    `OPENING: ${report.competition.openingFocus}`,
    `LOW-CLOCK SIGNAL: ${Math.round(report.competition.lowClockRate * 100)}% of moves with recorded clocks were under the pressure threshold in significant-error analysis.`,
    "",
    "READINESS ACTIONS",
    ...report.competition.readinessActions.map((action, index) => `${index + 1}. ${action}`),
    "",
    "NEXT REVIEW",
    topIssue ? `Start with move ${topIssue.moveNumber}. ${topIssue.san} against ${topIssue.opponent}. Engine preference: ${topIssue.bestMoveSan ?? topIssue.bestMoveUci ?? "see report"}.` : "No mistake-level review position was found.",
    report.competition.simulationRecommendation,
    report.competition.taperRecommendation,
  ];
  return lines.join("\n");
}

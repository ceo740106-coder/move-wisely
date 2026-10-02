import type { AnalysisReport, Severity, TimeClass, WeaknessKey } from "./types";

const TIME_CLASSES = new Set<TimeClass>(["bullet", "blitz", "rapid", "daily"]);
const WEAKNESSES = new Set<WeaknessKey>(["opening", "timeTrouble", "tactics", "calculation", "endgame", "pawnStructure", "hangingPieces"]);
const SEVERITIES = new Set<Severity>(["inaccuracy", "mistake", "blunder"]);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const isString = (value: unknown) => typeof value === "string";

/**
 * Defensive validation for JSON returned by Supabase. RLS protects ownership,
 * while this guard protects the UI from malformed or unexpectedly edited rows.
 */
export function isAnalysisReport(value: unknown): value is AnalysisReport {
  if (!isObject(value)) return false;
  if (!isObject(value.profile) || !isString(value.profile.username)) return false;
  if (!TIME_CLASSES.has(value.timeClass as TimeClass)) return false;
  if (!isFiniteNumber(value.gamesAnalyzed) || value.gamesAnalyzed < 1 || value.gamesAnalyzed > 30) return false;
  if (!isFiniteNumber(value.totalPlayerMoves) || value.totalPlayerMoves < 0 || value.totalPlayerMoves > 50000) return false;
  if (!isFiniteNumber(value.overallAcpl) || !isFiniteNumber(value.accuracy)) return false;
  if (value.accuracy < 0 || value.accuracy > 100 || value.overallAcpl < 0 || value.overallAcpl > 5000) return false;
  if (!Array.isArray(value.games) || !Array.isArray(value.issues) || !Array.isArray(value.topWeaknesses)) return false;
  if (!Array.isArray(value.dimensions) || !Array.isArray(value.openings) || !Array.isArray(value.opponentBands)) return false;
  if (!isObject(value.plan) || !Array.isArray(value.plan.days) || !isObject(value.competition)) return false;
  if (!isString(value.engineVersion) || !isFiniteNumber(value.engineDepth) || value.engineDepth < 8 || value.engineDepth > 20) return false;
  if (!isFiniteNumber(value.createdAt)) return false;
  if (value.games.length !== value.gamesAnalyzed || value.issues.length > 120 || value.games.length > 30) return false;

  for (const item of value.topWeaknesses) {
    if (!isObject(item) || !WEAKNESSES.has(item.key as WeaknessKey) || !isFiniteNumber(item.count) || !isFiniteNumber(item.share)) return false;
  }
  for (const issue of value.issues) {
    if (!isObject(issue) || !SEVERITIES.has(issue.severity as Severity) || !isFiniteNumber(issue.cpLoss) || issue.cpLoss < 0) return false;
    if (!isString(issue.fenBefore) || !isString(issue.fenAfter) || !Array.isArray(issue.tags)) return false;
    if (!issue.tags.every((tag) => WEAKNESSES.has(tag as WeaknessKey))) return false;
  }
  return true;
}

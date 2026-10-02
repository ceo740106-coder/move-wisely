import type { AnalysisReport, TimeClass } from "@/lib/chess/types";
import { isAnalysisReport } from "@/lib/chess/report-validation";
import { getSupabase } from "@/lib/auth/client";

export interface ReportRow {
  id: string;
  created_at: string;
  chess_username: string;
  time_class: TimeClass;
  games_analyzed: number;
  engine_version: string;
  engine_depth: number;
  overall_cpl: number;
  accuracy: number;
  source?: string;
  verified_issues?: number;
  primary_focus?: string;
}

export function toPersistedReport(report: AnalysisReport): AnalysisReport {
  return {
    ...report,
    games: report.games.map((game) => ({
      ...game,
      tagged: game.tagged.slice(0, 40),
      game: { ...game.game, pgn: "" },
    })),
  };
}

export async function saveReport(userId: string, report: AnalysisReport) {
  const db = getSupabase();
  if (!db) throw new Error("Supabase is not configured.");
  const slim = toPersistedReport(report);
  const { data, error } = await db.from("analysis_reports").insert({
    user_id: userId,
    chess_username: report.profile.username,
    time_class: report.timeClass,
    games_analyzed: report.gamesAnalyzed,
    engine_version: report.engineVersion,
    engine_depth: report.engineDepth,
    overall_cpl: report.overallAcpl,
    accuracy: report.accuracy,
    source: report.source ?? "chesscom",
    verified_issues: report.analysisMeta?.verifiedIssues ?? 0,
    primary_focus: report.topWeaknesses.find((item) => item.count > 0)?.key ?? null,
    report: slim,
  }).select("id").single();
  if (error) throw error;
  return String(data.id);
}

export async function listReports(userId: string): Promise<ReportRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db.from("analysis_reports")
    .select("id,created_at,chess_username,time_class,games_analyzed,engine_version,engine_depth,overall_cpl,accuracy,source,verified_issues,primary_focus")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []) as ReportRow[];
}

export async function loadReport(userId: string, id: string): Promise<AnalysisReport | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db.from("analysis_reports")
    .select("id,report")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.report || !isAnalysisReport(data.report)) return null;
  return { ...data.report, id: String(data.id) };
}

export async function deleteReport(userId: string, id: string) {
  const db = getSupabase();
  if (!db) throw new Error("Supabase is not configured.");
  const { error } = await db.from("analysis_reports").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

export async function getProfile(userId: string) {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db.from("profiles")
    .select("display_name,chess_username,default_time_class,competition_date")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProfile(userId: string, values: { displayName?: string; chessUsername?: string; defaultTimeClass?: TimeClass; competitionDate?: string }) {
  const db = getSupabase();
  if (!db) throw new Error("Supabase is not configured.");
  const payload = {
    id: userId,
    display_name: values.displayName?.trim() || null,
    chess_username: values.chessUsername?.trim() || null,
    default_time_class: values.defaultTimeClass ?? null,
    competition_date: values.competitionDate || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw error;
}

export async function toggleTrainingTask(userId: string, reportId: string, taskKey: string, completed: boolean) {
  const db = getSupabase();
  if (!db) throw new Error("Supabase is not configured.");
  if (completed) {
    const { error } = await db.from("training_progress").upsert({ user_id: userId, report_id: reportId, task_key: taskKey, completed_at: new Date().toISOString() }, { onConflict: "user_id,report_id,task_key" });
    if (error) throw error;
    return;
  }
  const { error } = await db.from("training_progress").delete().eq("user_id", userId).eq("report_id", reportId).eq("task_key", taskKey);
  if (error) throw error;
}

export async function getCompletedTasks(userId: string, reportId: string): Promise<string[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db.from("training_progress").select("task_key").eq("user_id", userId).eq("report_id", reportId);
  if (error) throw error;
  return (data ?? []).map((row) => String(row.task_key));
}

export async function deleteAllUserData(userId: string) {
  const db = getSupabase();
  if (!db) throw new Error("Supabase is not configured.");
  const { error: trainingError } = await db.from("training_progress").delete().eq("user_id", userId);
  if (trainingError) throw trainingError;
  const { error: reportsError } = await db.from("analysis_reports").delete().eq("user_id", userId);
  if (reportsError) throw reportsError;
  const { error: profileError } = await db.from("profiles").delete().eq("id", userId);
  if (profileError) throw profileError;
}

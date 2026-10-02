import { create } from "zustand";
import type { AnalysisReport, TimeClass } from "@/lib/chess/types";

type View = "home" | "analyzing" | "report";
interface State {
  view: View;
  username: string;
  timeClass: TimeClass;
  limit: number;
  competitionDate: string;
  error: string | null;
  progress: { done: number; total: number; label: string };
  report: AnalysisReport | null;
  selectedIssue: number;
  source: "chesscom" | "pgn";
  setUsername: (value: string) => void;
  setTimeClass: (value: TimeClass) => void;
  setLimit: (value: number) => void;
  setCompetitionDate: (value: string) => void;
  setSource: (value: "chesscom" | "pgn") => void;
  startAnalyze: () => void;
  setProgress: (done: number, total: number, label?: string) => void;
  finish: (report: AnalysisReport, userId?: string) => void;
  fail: (error: string) => void;
  backHome: () => void;
  setSelectedIssue: (index: number) => void;
}

export function slimReport(report: AnalysisReport): AnalysisReport {
  return { ...report, games: report.games.map((game) => ({ ...game, tagged: game.tagged.slice(0, 40), game: { ...game.game, pgn: "" } })) };
}

function storageKey(userId: string) { return `movewisely:last-report:${userId}`; }

export function clearSavedReport(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  try { localStorage.removeItem(storageKey(userId)); } catch { /* optional local cache */ }
}

export function loadSavedReport(userId: string): AnalysisReport | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as AnalysisReport) : null;
  } catch { return null; }
}

export const useSession = create<State>((set) => ({
  view: "home",
  username: "",
  timeClass: "blitz",
  limit: 20,
  competitionDate: "",
  error: null,
  progress: { done: 0, total: 0, label: "" },
  report: null,
  selectedIssue: 0,
  source: "chesscom",
  setUsername: (username) => set({ username, error: null }),
  setTimeClass: (timeClass) => set({ timeClass }),
  setLimit: (limit) => set({ limit }),
  setCompetitionDate: (competitionDate) => set({ competitionDate }),
  setSource: (source) => set({ source, error: null }),
  startAnalyze: () => set({ view: "analyzing", error: null, progress: { done: 0, total: 1, label: "Preparing engine…" } }),
  setProgress: (done, total, label = "") => set({ progress: { done, total, label } }),
  finish: (report, userId) => {
    const slim = slimReport(report);
    if (typeof window !== "undefined" && userId) {
      try { localStorage.setItem(storageKey(userId), JSON.stringify(slim)); } catch { /* local cache is optional */ }
    }
    set({ view: "report", report: slim, selectedIssue: 0, error: null });
  },
  fail: (error) => set({ view: "home", error }),
  backHome: () => set({ view: "home", report: null }),
  setSelectedIssue: (selectedIssue) => set({ selectedIssue }),
}));

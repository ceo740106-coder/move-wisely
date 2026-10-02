import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppFooter } from "@/components/app/app-footer";
import { AppHeader } from "@/components/app/app-header";
import { AnalyzingView } from "@/components/app/analyzing-view";
import { HomeView } from "@/components/app/home-view";
import { ReportView } from "@/components/app/report-view";
import { analyzeInChunks } from "@/lib/chess/analyze";
import { pgnsToGames } from "@/lib/chess/pgn";
import { fetchChessComGames } from "@/lib/chess/fetch-games";
import { getProfile, loadReport, saveReport, upsertProfile } from "@/lib/db/supabase";
import { useAuth } from "@/lib/auth/use-auth";
import { loadSavedReport, useSession } from "@/store/session";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const auth = useAuth();
  const session = useSession();

  useEffect(() => {
    if (!auth.user) return;
    void getProfile(auth.user.id).then((profile) => {
      if (profile?.chess_username) session.setUsername(profile.chess_username);
      if (profile?.default_time_class && ["bullet", "blitz", "rapid", "daily"].includes(profile.default_time_class)) session.setTimeClass(profile.default_time_class as typeof session.timeClass);
      if (profile?.competition_date) session.setCompetitionDate(profile.competition_date);
    }).catch(() => undefined);
  }, [auth.user?.id]);

  async function runAnalysis(pgnText?: string) {
    if (!auth.user || !auth.session) { session.fail("Your session is not ready. Sign in again."); return; }
    const username = session.username.trim();
    if (!username) { session.fail("Enter the player's Chess.com username or exact player name from the PGN."); return; }
    session.startAnalyze();
    try {
      let games;
      let profile;
      const source = session.source;

      if (pgnText !== undefined) {
        const parsed = pgnsToGames(pgnText, session.timeClass, username);
        if (!parsed.games.length) throw new Error(`No ${session.timeClass} games in this PGN matched ${username}.`);
        games = parsed.games.slice(0, 30);
        profile = { username };
        session.setProgress(0, games.length, `${games.length} games loaded · starting engine analysis`);
      } else {
        const token = auth.session.access_token;
        const response = await fetchChessComGames({ data: { username, timeClass: session.timeClass, limit: session.limit, accessToken: token } });
        if (!response.ok) throw new Error(response.error);
        games = response.games;
        profile = response.profile;
        session.setProgress(0, games.length, `${games.length} Chess.com games loaded · starting engine analysis`);
      }

      await upsertProfile(auth.user.id, {
        displayName: auth.user.user_metadata?.display_name ?? auth.user.email?.split("@")[0],
        chessUsername: username,
        defaultTimeClass: session.timeClass,
        competitionDate: session.competitionDate || undefined,
      });

      const report = await analyzeInChunks(games, profile, session.timeClass, session.competitionDate || undefined, (done, total, label) => session.setProgress(done, total, label), source);
      try {
        const id = await saveReport(auth.user.id, report);
        report.id = id;
      } catch {
        // The report remains usable locally even if a transient database write fails.
      }
      session.finish(report, auth.user.id);
    } catch (error) {
      session.fail(error instanceof Error ? error.message : "Analysis failed. Try again.");
    }
  }

  function openSaved() {
    if (!auth.user) return;
    const saved = loadSavedReport(auth.user.id);
    if (saved) session.finish(saved, auth.user.id);
  }

  async function openHistory(id: string) {
    if (!auth.user) return;
    try {
      const report = await loadReport(auth.user.id, id);
      if (report) session.finish(report, auth.user.id);
    } catch {
      session.fail("That saved report could not be loaded.");
    }
  }

  return <div className="min-h-dvh bg-bg pb-2 text-fg"><AppHeader />{session.view === "home" && <HomeView onSubmit={runAnalysis} onOpenSaved={openSaved} onOpenReport={openHistory} />}{session.view === "analyzing" && <AnalyzingView done={session.progress.done} total={session.progress.total} username={session.username} label={session.progress.label} />}{session.view === "report" && session.report && <ReportView report={session.report} onBack={() => session.backHome()} />}<AppFooter /></div>;
}

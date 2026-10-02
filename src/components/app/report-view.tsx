import { Chess, type PieceSymbol, type Square } from "chess.js";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Clipboard, Download, Flag, Gauge, Printer, RotateCcw, ShieldCheck, Sparkles, Target, Trophy, Clock3, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChessBoard } from "@/components/chess/board";
import { Button } from "@/components/ui/button";
import { buildCoachBrief } from "@/lib/chess/coach-brief";
import { getChessEngine } from "@/lib/chess/engine";
import { WEAKNESS_META, type AnalysisReport, type Severity } from "@/lib/chess/types";
import { deleteReport, getCompletedTasks, toggleTrainingTask } from "@/lib/db/supabase";
import { useAuth } from "@/lib/auth/use-auth";
import { cn } from "@/lib/utils";
import { clearSavedReport, useSession } from "@/store/session";

const TAB_META = [
  ["overview", "Overview"],
  ["review", "Mistake Lab"],
  ["competition", "Competition"],
  ["training", "Training"] as const,
] as const;
type Tab = typeof TAB_META[number][0];
const severityClass: Record<Severity, string> = { inaccuracy: "text-warn", mistake: "text-warn", blunder: "text-danger" };

function scoreLabel(cp: number) {
  if (Math.abs(cp) >= 99_000) return cp > 0 ? "+M" : "−M";
  return `${cp >= 0 ? "+" : "−"}${(Math.abs(cp) / 100).toFixed(2)}`;
}

export function ReportView({ report, onBack }: { report: AnalysisReport; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const { selectedIssue, setSelectedIssue } = useSession();
  const auth = useAuth();
  const issue = report.issues[selectedIssue] ?? report.issues[0];
  const brief = useMemo(() => buildCoachBrief(report), [report]);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-24 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border py-7">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="mt-1">
            <ArrowLeft /> New analysis
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{report.profile.name || report.profile.username}</h1>
              {report.profile.title && <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold">{report.profile.title}</span>}
            </div>
            <p className="mt-2 text-sm text-muted">@{report.profile.username} · {report.gamesAnalyzed} {report.timeClass} games · {report.totalPlayerMoves.toLocaleString()} player moves <span className="mx-1 text-subtle">·</span><span className="text-primary">{report.id ? "Saved to account" : "Local copy"}</span></p>
          </div>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> Print</Button>
          <Button variant="outline" size="sm" onClick={() => downloadReport(report)}><Download /> Export</Button>
          {report.id && auth.user && <Button variant="outline" size="sm" className="hover:border-danger hover:text-danger" onClick={async () => { if (!window.confirm("Delete this saved report? The current on-screen copy will remain until you leave it.")) return; try { await deleteReport(auth.user!.id, report.id!); clearSavedReport(auth.user!.id); onBack(); } catch { /* keep report visible when deletion fails */ } }}><Trash2 /> Delete</Button>}
        </div>
      </div>

      <div className="no-print sticky top-16 z-30 -mx-4 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mw-scroll flex gap-2 overflow-x-auto">
          {TAB_META.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={cn("h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition", tab === id ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-muted hover:text-fg")}>
              {label}{id === "review" && report.issues.length > 0 ? ` · ${report.issues.length}` : ""}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <Overview report={report} brief={brief} />}
      {tab === "review" && <ReviewPanel report={report} issue={issue} index={selectedIssue} setIndex={setSelectedIssue} />}
      {tab === "competition" && <CompetitionPanel report={report} />}
      {tab === "training" && <TrainingPanel report={report} />}

      <div className="no-print mt-10 rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-sm text-muted">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><p><span className="font-medium text-fg">Analysis integrity:</span> MoveWisely measures engine centipawn loss and validates significant errors at a deeper search. Accuracy is a MoveWisely metric, not Chess.com's proprietary CAPS2 score. Engine results are strongest when a position is also understood in opening, clock, and practical context.</p></div>
      </div>
    </div>
  );
}

function Overview({ report, brief }: { report: AnalysisReport; brief: string }) {
  const top = report.topWeaknesses.filter((item) => item.count > 0).slice(0, 5);
  const strongest = [...report.openings].filter((item) => item.games >= 2).sort((a, b) => b.scorePct - a.scorePct)[0];
  const riskiest = [...report.openings].filter((item) => item.games >= 2).sort((a, b) => b.avgCpl - a.avgCpl)[0];
  return (
    <section className="py-7">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<Gauge />} label="Accuracy" value={`${report.accuracy}%`} hint="MoveWisely engine metric" />
        <Metric icon={<Target />} label="Average CPL" value={`${report.overallAcpl}`} hint="Lower is better" />
        <Metric icon={<Trophy />} label="Record" value={`${report.wins}-${report.draws}-${report.losses}`} hint="Wins · draws · losses" />
        <Metric icon={<Clock3 />} label="Low-clock" value={`${Math.round(report.competition.lowClockRate * 100)}%`} hint="Recorded-clock moves" />
        <Metric icon={<Flag />} label="Competition" value={`${report.competition.daysUntilCompetition ?? "—"}`} hint={report.competition.daysUntilCompetition === undefined ? "Days until" : "days left"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-6">
          <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Your training signal</p><h2 className="mt-1 font-display text-2xl">Fix the patterns that repeat.</h2></div><span className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted">{report.issues.length} review positions</span></div>
            <div className="mt-6 space-y-4">
              {top.length ? top.map((item) => (
                <div key={item.key}>
                  <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{WEAKNESS_META[item.key].label}</p><p className="mt-0.5 text-xs text-muted">{WEAKNESS_META[item.key].blurb}</p></div><span className="font-mono text-xs text-muted">{item.count}</span></div>
                  <div className="mt-2 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(3, Math.round(item.share * 2200)))}%` }} /></div>
                </div>
              )) : <Empty text="No recurring weakness reached the reporting threshold in this sample." />}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-center gap-2"><BookOpen className="size-4 text-primary" /><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Opening profile</p></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {report.openings.slice(0, 6).map((opening) => <div key={opening.name} className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium">{opening.name}</p><p className="mt-1 text-xs text-muted">{opening.eco ?? opening.family} · {opening.games} game{opening.games === 1 ? "" : "s"}</p></div><span className="font-mono text-xs">{opening.scorePct}%</span></div><div className="mt-3 flex items-center justify-between text-xs text-muted"><span>Average CPL</span><span className="font-mono">{opening.avgCpl}</span></div></div>)}
              {!report.openings.length && <Empty text="Opening tags were not available in the analysed games." />}
            </div>
            {riskiest && <p className="mt-4 text-xs text-muted">Most expensive recurring opening sample: <span className="text-fg">{riskiest.name}</span> at {riskiest.avgCpl} CPL.</p>}
            {strongest && <p className="mt-1 text-xs text-muted">Best scoring opening sample with at least two games: <span className="text-fg">{strongest.name}</span> at {strongest.scorePct}%.</p>}
          </section>

          <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Game-by-game evidence</p><h2 className="mt-1 font-display text-2xl">The sample behind the report.</h2></div><span className="font-mono text-xs text-muted">{report.games.length} games</span></div>
            <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-border">
              {report.games.slice(0, 12).map((game, index) => { const gameUrl = game.game.url; const opponent = game.playerColor === "w" ? game.game.black.username : game.game.white.username; return <div key={`${game.game.url}-${game.game.endTime}-${index}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 last:border-b-0">
                <div className="min-w-0"><p className="truncate text-sm font-medium">vs {opponent}</p><p className="mt-1 text-xs text-muted">{game.openingName ?? game.openingEco ?? "Opening unavailable"} · {game.playerMoves} moves · {formatGameDate(game.game.endTime)}</p></div>
                <div className="flex items-center gap-4"><div className="text-right"><p className="font-mono text-xs">{game.averageCpl} CPL</p><p className="text-[11px] text-muted">{game.tagged.length} issues</p></div><span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase", game.result === "win" ? "border-primary/30 bg-primary/5 text-primary" : game.result === "loss" ? "border-danger/30 bg-danger/5 text-danger" : "border-border bg-surface-2 text-muted")}>{game.result}</span>{gameUrl && <a href={gameUrl} target="_blank" rel="noreferrer" className="text-xs text-muted underline underline-offset-4 hover:text-fg">Game</a>}</div>
              </div>; })}
            </div>
            {report.games.length > 12 && <p className="mt-3 text-xs text-subtle">Showing the latest 12 games in the saved report. The full source PGNs are intentionally not retained.</p>}
          </section>
        </div>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
            <div className="border-b border-border bg-surface-2 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Competition command center</p><p className="mt-2 font-display text-3xl">{report.competition.countdownLabel}</p><p className="mt-2 text-sm text-muted">Primary prep: {report.competition.primaryFocuses.map((key) => WEAKNESS_META[key].label).join(" · ") || "your top engine-confirmed mistakes"}</p></div>
            <div className="p-5 space-y-3">{report.competition.readinessActions.map((action, index) => <div key={action} className="flex gap-3 rounded-[var(--radius-md)] border border-border p-4"><span className="font-mono text-xs text-subtle">0{index + 1}</span><p className="text-sm leading-relaxed">{action}</p></div>)}</div>
          </section>
          <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Coach handoff</p></div>
            <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-fg">{brief}</pre>
            <div className="no-print mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(brief)}><Clipboard /> Copy brief</Button></div>
          </section>
        </div>
      </div>
    </section>
  );
}

function ReviewPanel({ report, issue, index, setIndex }: { report: AnalysisReport; issue?: AnalysisReport["issues"][number]; index: number; setIndex: (index: number) => void }) {
  const [mode, setMode] = useState<"review" | "puzzle">("review");
  const [orientation, setOrientation] = useState<"w" | "b">(issue?.playerColor ?? "w");
  const [fen, setFen] = useState(issue?.fenBefore ?? new Chess().fen());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [solved, setSolved] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setFen(issue?.fenBefore ?? new Chess().fen());
    setOrientation(issue?.playerColor ?? "w");
    setMode("review"); setFeedback(null); setBusy(false); setSolved(false); setRevealed(false);
  }, [issue?.ply, issue?.fenBefore]);

  const playedMove = useMemo(() => parseUci(issue?.playedMoveUci), [issue?.playedMoveUci]);
  const bestMove = useMemo(() => parseUci(issue?.bestMoveUci), [issue?.bestMoveUci]);
  const bestArrow = bestMove ? [{ from: bestMove.from, to: bestMove.to }] : [];

  if (!issue) return <div className="py-10"><Empty text="No mistake-level positions were found in this sample." /></div>;

  async function tryMove(from: string, to: string, promotion?: PieceSymbol) {
    if (busy) return false;
    const moveUci = `${from}${to}${promotion ?? ""}`;
    const check = new Chess(issue.fenBefore);
    let move;
    try { move = check.move({ from: from as never, to: to as never, promotion }); } catch { return false; }
    if (!move) return false;
    setBusy(true);
    try {
      const depth = Math.max(issue.engineDepth, issue.confirmedAtDepth ?? issue.engineDepth);
      const candidate = await getChessEngine().analyze(issue.fenBefore, depth, [moveUci]);
      const loss = Math.max(0, Math.round(issue.bestMoveScoreCp - candidate.scoreCp));
      if (moveUci === issue.bestMoveUci || loss <= 50) {
        setSolved(true); setFen(check.fen()); setFeedback(`Correct direction. ${move.san} is within 0.50 pawn of the stored engine choice at depth ${depth}.`);
      } else {
        setSolved(false); setFen(issue.fenBefore); setFeedback(`${move.san} still concedes about ${loss} cp. Try again and calculate checks, captures, and threats first.`);
      }
      return true;
    } catch {
      setFeedback("The engine could not verify that attempt. Please try again.");
      return false;
    } finally { setBusy(false); }
  }

  function changeIssue(delta: number) { const next = index + delta; if (next >= 0 && next < report.issues.length) setIndex(next); }

  return (
    <section className="py-7">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,760px)_360px] xl:items-start">
        <div>
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-3 sm:p-5">
            <ChessBoard
              fen={mode === "puzzle" ? fen : issue.fenBefore}
              orientation={orientation}
              lastMove={mode === "review" && playedMove ? playedMove : undefined}
              arrows={mode === "review" && revealed ? bestArrow : []}
              interactive={mode === "puzzle" && !solved && !busy}
              onMove={tryMove}
              showEvaluationBar={mode === "review"}
              evaluationCp={issue.color === "w" ? issue.bestMoveScoreCp : -issue.bestMoveScoreCp}
            />
          </div>
          <div className="no-print mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted">{mode === "puzzle" ? (busy ? "Stockfish is verifying your move…" : "Find the best practical move before revealing the answer.") : "Yellow squares mark the move that was played."}</p><div className="flex items-center gap-2"><button type="button" onClick={() => setOrientation((value) => value === "w" ? "b" : "w")} className="mw-focus inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:text-fg"><RotateCcw className="size-3" /> Flip board</button><span className="font-mono text-xs text-subtle">{index + 1} / {report.issues.length}</span></div></div>
          {feedback && <div className={cn("mt-3 rounded-[var(--radius-md)] border p-4 text-sm", solved ? "border-primary/40 bg-primary/5 text-fg" : "border-border bg-surface text-muted")}>{feedback}</div>}
        </div>

        <aside className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" disabled={index === 0} onClick={() => changeIssue(-1)}><ChevronLeft /> Previous</Button>
            <Button variant="outline" size="sm" disabled={index === report.issues.length - 1} onClick={() => changeIssue(1)}>Next <ChevronRight /></Button>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-2"><span className={cn("text-xs font-semibold uppercase tracking-[0.15em]", severityClass[issue.severity])}>{issue.severity}</span><span className="font-mono text-xs text-muted">−{issue.cpLoss} cp</span></div>
            <h2 className="mt-2 font-display text-3xl">{issue.moveNumber}. {issue.san}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{issue.note}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">{issue.tags.map((tag) => <span key={tag} className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted">{WEAKNESS_META[tag].label}</span>)}</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-md bg-surface-2 p-3"><p className="text-subtle">Played</p><p className="mt-1 font-mono text-fg">{scoreLabel(issue.playedMoveScoreCp)}</p></div><div className="rounded-md bg-surface-2 p-3"><p className="text-subtle">Best</p><p className="mt-1 font-mono text-fg">{scoreLabel(issue.bestMoveScoreCp)}</p></div></div>
            <p className="mt-4 text-xs text-muted">{issue.opponent}{issue.openingName ? ` · ${issue.openingName}` : issue.eco ? ` · ${issue.eco}` : ""}{issue.clockSeconds !== undefined ? ` · ${Math.round(issue.clockSeconds)}s` : ""}</p>
          </div>

          <div className="no-print grid grid-cols-2 gap-2">
            <Button variant={mode === "review" ? "default" : "outline"} onClick={() => { setMode("review"); setFen(issue.fenBefore); setFeedback(null); setSolved(false); }}>Review</Button>
            <Button variant={mode === "puzzle" ? "default" : "outline"} onClick={() => { setMode("puzzle"); setFen(issue.fenBefore); setFeedback("Your turn. The engine answer is hidden."); setSolved(false); setRevealed(false); }}>Fix it</Button>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Engine answer</p><span className="rounded-full border border-border px-2 py-1 text-[10px] font-mono text-subtle">depth {issue.engineDepth}</span></div>
            <p className="mt-2 font-display text-2xl">{issue.bestMoveSan ?? issue.bestMoveUci ?? "Unavailable"}</p>
            {revealed || mode === "review" ? <><p className="mt-3 font-mono text-xs leading-relaxed text-muted">{issue.principalVariation.join(" ") || "No principal variation captured."}</p><p className="mt-3 text-xs text-muted">Deep verification: {issue.confirmedAtDepth ? `confirmed at depth ${issue.confirmedAtDepth}` : "not required by the significance threshold"}.</p></> : <button type="button" className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-fg" onClick={() => setRevealed(true)}>Reveal line</button>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function CompetitionPanel({ report }: { report: AnalysisReport }) {
  return (
    <section className="py-7">
      <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
          <div className="bg-surface-2 p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Countdown</p><p className="mt-2 font-display text-5xl tracking-tight">{report.competition.countdownLabel}</p><p className="mt-3 text-sm text-muted">Opening focus: <span className="text-fg">{report.competition.openingFocus}</span></p></div>
          <div className="p-6 space-y-4">
            <PrepCard title="Simulation" text={report.competition.simulationRecommendation} />
            <PrepCard title="Taper" text={report.competition.taperRecommendation} />
          </div>
        </div>
        <div className="space-y-4">
          {report.competition.readinessActions.map((action, index) => <PrepCard key={action} title={`Readiness step ${index + 1}`} text={action} />)}
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Opponent bands</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{report.opponentBands.map((band) => <div key={band.label} className="rounded-[var(--radius-md)] bg-surface-2 p-4"><div className="flex justify-between"><span className="text-sm font-medium">{band.label}</span><span className="font-mono text-xs">{band.scorePct}%</span></div><p className="mt-1 text-xs text-muted">{band.games} games · {band.wins}-{band.draws}-{band.losses}</p></div>)}</div></div>
        </div>
      </div>
    </section>
  );
}

function TrainingPanel({ report }: { report: AnalysisReport }) {
  const auth = useAuth();
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => { if (auth.user && report.id) void getCompletedTasks(auth.user.id, report.id).then((keys) => setCompleted(new Set(keys))).catch(() => undefined); }, [auth.user?.id, report.id]);
  const doneCount = [...completed].length;
  const totalTasks = report.plan.days.reduce((sum, day) => sum + day.tasks.length, 0);

  async function toggle(key: string) {
    const next = !completed.has(key);
    setCompleted((prev) => { const nextSet = new Set(prev); next ? nextSet.add(key) : nextSet.delete(key); return nextSet; });
    if (!auth.user || !report.id) return;
    setSaving(key);
    try { await toggleTrainingTask(auth.user.id, report.id, key, next); } catch { setCompleted((prev) => { const rollback = new Set(prev); next ? rollback.delete(key) : rollback.add(key); return rollback; }); }
    finally { setSaving(null); }
  }

  return (
    <section className="py-7">
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Training plan</p><h2 className="mt-1 font-display text-3xl">{report.plan.headline}</h2><p className="mt-2 max-w-3xl text-sm text-muted">{report.plan.summary}</p></div><div className="text-right"><p className="text-2xl font-display">{doneCount}/{totalTasks}</p><p className="text-xs text-muted">tasks completed</p></div></div>
        <div className="mt-5 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${totalTasks ? Math.round((doneCount / totalTasks) * 100) : 0}%` }} /></div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{report.plan.days.map((day) => <article key={day.day} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Day {day.day} · {day.minutes} min</p><h3 className="mt-1 font-display text-xl">{day.title}</h3></div>{day.issueIndices.length > 0 && <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-[10px] text-muted">{day.issueIndices.length} own positions</span>}</div><div className="mt-4 space-y-2">{day.tasks.map((task, taskIndex) => { const key = `d${day.day}-t${taskIndex}`; const checked = completed.has(key); return <label key={key} className="flex cursor-pointer gap-3 rounded-[var(--radius-md)] bg-surface-2 p-3 text-sm text-muted transition hover:text-fg"><input type="checkbox" checked={checked} disabled={saving === key} onChange={() => void toggle(key)} className="mt-0.5 size-4 accent-[var(--mw-primary)]" /><span className={checked ? "line-through opacity-60" : ""}>{task}</span></label>; })}</div></article>)}</div>
    </section>
  );
}

function Metric({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"><div className="flex items-center gap-2 text-muted">{icon}<span className="text-xs font-semibold uppercase tracking-[0.13em]">{label}</span></div><p className="mt-2 font-display text-3xl tracking-tight">{value}</p><p className="mt-1 text-xs text-subtle">{hint}</p></div>;
}
function PrepCard({ title, text }: { title: string; text: string }) { return <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</p><p className="mt-2 text-sm leading-relaxed">{text}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2 p-5 text-center text-sm text-muted">{text}</div>; }
function parseUci(uci?: string) { if (!uci || !/^(?:[a-h][1-8]){2}[qrbn]?$/.test(uci)) return undefined; return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square }; }
function formatGameDate(epochSeconds: number) { if (!epochSeconds) return "Date unavailable"; try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(epochSeconds * 1000)); } catch { return "Date unavailable"; } }
function downloadReport(report: AnalysisReport) {
  const safe = JSON.stringify({ ...report, games: report.games.map((game) => ({ ...game, game: { ...game.game, pgn: "" } })) }, null, 2);
  const blob = new Blob([safe], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `movewisely-${report.profile.username}-${new Date(report.createdAt).toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

import { ArrowRight, BarChart3, BookOpen, Brain, CalendarDays, CheckCircle2, Clock3, History, LockKeyhole, LogIn, ShieldCheck, Sparkles, Target, Trash2, Trophy, Upload, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/use-auth";
import { deleteAllUserData, getProfile, listReports, type ReportRow } from "@/lib/db/supabase";
import { WEAKNESS_META, type AnalysisReport, type TimeClass } from "@/lib/chess/types";
import { cn } from "@/lib/utils";
import { clearSavedReport, loadSavedReport, useSession } from "@/store/session";

const TIME: Array<{ id: TimeClass; label: string; description: string }> = [
  { id: "bullet", label: "Bullet", description: "< 3 minutes" },
  { id: "blitz", label: "Blitz", description: "3–10 minutes" },
  { id: "rapid", label: "Rapid", description: "10–30 minutes" },
  { id: "daily", label: "Daily", description: "Days per move" },
];
const LIMITS = [10, 20, 30];
type AuthMode = "signIn" | "signUp" | "reset";

export function HomeView({ onSubmit, onOpenSaved, onOpenReport }: { onSubmit: (pgn?: string) => void; onOpenSaved: () => void; onOpenReport: (id: string) => void }) {
  const auth = useAuth();
  const session = useSession();
  const [history, setHistory] = useState<ReportRow[]>([]);
  const [saved, setSaved] = useState<AnalysisReport | null>(null);
  const [pgn, setPgn] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [busyAuth, setBusyAuth] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!auth.user) {
      setSaved(null);
      setHistory([]);
      return;
    }
    setSaved(loadSavedReport(auth.user.id));
    void getProfile(auth.user.id).then((profile) => {
      if (profile?.chess_username) session.setUsername(profile.chess_username);
      if (profile?.competition_date) session.setCompetitionDate(profile.competition_date);
      if (profile?.default_time_class && TIME.some((item) => item.id === profile.default_time_class)) session.setTimeClass(profile.default_time_class as TimeClass);
    }).catch(() => undefined);
    void listReports(auth.user.id).then(setHistory).catch(() => setHistory([]));
  }, [auth.user?.id]);

  useEffect(() => {
    if (auth.passwordRecovery) {
      setAuthError(null);
      setAuthInfo(null);
      setPassword("");
      setPasswordConfirm("");
    }
  }, [auth.passwordRecovery]);

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setBusyAuth(true);
    try {
      if (auth.passwordRecovery) {
        if (password.length < 10) { setAuthError("Use a password with at least 10 characters."); return; }
        if (password !== passwordConfirm) { setAuthError("The passwords do not match."); return; }
        const result = await auth.updatePassword(password);
        if (result.error) setAuthError(result.error);
        else setAuthInfo("Password updated successfully. Your account is ready to use.");
        return;
      }
      if (authMode === "reset") {
        const result = await auth.resetPassword(email);
        if (result.error) setAuthError(result.error); else setAuthInfo("If that email is registered, Supabase will send a password-reset link.");
        return;
      }
      if (authMode === "signUp") {
        if (password.length < 10) { setAuthError("Use a password with at least 10 characters."); return; }
        if (password !== passwordConfirm) { setAuthError("The passwords do not match."); return; }
        const result = await auth.signUp(email, password);
        if (result.error) setAuthError(result.error);
        else if (result.needsConfirmation) setAuthInfo("Account created. Check your email to confirm the account, then sign in.");
      } else {
        const result = await auth.signIn(email, password);
        if (result.error) setAuthError(result.error);
      }
    } finally {
      setBusyAuth(false);
    }
  }

  async function deleteMyData() {
    if (!auth.user || deletingData) return;
    if (!window.confirm("Delete all MoveWisely reports, training progress, and profile settings? This does not delete your Supabase account.")) return;
    setDeletingData(true);
    setDataMessage(null);
    try {
      await deleteAllUserData(auth.user.id);
      clearSavedReport(auth.user.id);
      setHistory([]);
      setSaved(null);
      setDataMessage("Your MoveWisely data has been deleted.");
      session.backHome();
    } catch {
      setDataMessage("We could not delete all of your data. Try again or contact the site administrator.");
    } finally {
      setDeletingData(false);
    }
  }

  function chooseFile(file: File) {
    if (file.size > 2_000_000) { session.fail("PGN file is too large. Keep imports under 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setPgn(String(reader.result ?? "")); session.setSource("pgn"); };
    reader.onerror = () => session.fail("The PGN file could not be read.");
    reader.readAsText(file);
  }

  if (auth.loading) return <LoadingScreen />;

  if (!auth.configured) {
    return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><div className="rounded-[var(--radius-xl)] border border-border bg-surface p-7 shadow-sm"><div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-fg"><LockKeyhole className="size-5" /></div><h1 className="mt-5 font-display text-4xl tracking-tight">Connect Supabase to start.</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">Create your Supabase project, add the two client-safe environment variables, run the included migration, and reload the app.</p><pre className="mt-5 overflow-auto rounded-[var(--radius-md)] bg-surface-2 p-4 text-xs leading-relaxed text-muted">VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co{`\n`}VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…</pre><p className="mt-4 text-xs text-subtle">Only the publishable key belongs in the browser. User-owned tables are protected by Row Level Security.</p></div></div>;
  }

  if (auth.passwordRecovery) {
    return <div className="mx-auto flex w-full max-w-xl justify-center px-4 py-16 sm:px-6"><form onSubmit={submitAuth} className="w-full rounded-[var(--radius-xl)] border border-border bg-surface p-6 shadow-[0_24px_80px_rgb(0_0_0/0.08)] sm:p-8"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-fg"><LockKeyhole className="size-5" /></div><div><p className="text-sm font-semibold">Set a new password</p><p className="text-xs text-muted">Choose a new password for your MoveWisely account.</p></div></div><Input className="mt-6" type="password" autoComplete="new-password" placeholder="New password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required /><Input className="mt-3" type="password" autoComplete="new-password" placeholder="Confirm new password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} minLength={10} required /><p className="mt-3 text-xs text-subtle">Use at least 10 characters. Avoid reusing a password from another service.</p>{authError && <p className="mt-3 rounded-md border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{authError}</p>}{authInfo && <p className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted">{authInfo}</p>}<Button type="submit" className="mt-5 w-full" size="lg" disabled={busyAuth}>Update password <ArrowRight /></Button></form></div>;
  }

  if (!auth.user) {
    return <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8 lg:py-16">
      <section>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted"><span className="size-1.5 rounded-full bg-primary" /> Competition chess preparation</div>
        <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">Turn your games into a preparation system.</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg">MoveWisely reviews real games with Stockfish, identifies repeatable decision patterns, creates engine-verified training positions, and builds a practical plan around your competition date.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3"><Feature icon={<Brain />} title="Engine-backed" text="Stockfish 19 runs locally in a dedicated browser worker." /><Feature icon={<Target />} title="Own mistakes" text="Practice the positions that actually cost you evaluation." /><Feature icon={<Trophy />} title="Competition mode" text="Prepare around your time control and countdown." /></div>
        <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-muted"><span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> No chess-engine API key</span><span className="inline-flex items-center gap-2"><LockKeyhole className="size-4 text-primary" /> Supabase RLS</span><span className="inline-flex items-center gap-2"><Sparkles className="size-4 text-primary" /> No external AI dependency</span></div>
      </section>
      <form onSubmit={submitAuth} className="rounded-[var(--radius-xl)] border border-border bg-surface p-5 shadow-[0_24px_80px_rgb(0_0_0/0.08)] sm:p-6">
        <div className="flex items-center gap-2"><div className="grid size-9 place-items-center rounded-lg bg-surface-2"><LogIn className="size-4" /></div><div><p className="text-sm font-semibold">{authMode === "signIn" ? "Welcome back" : authMode === "signUp" ? "Create your account" : "Reset your password"}</p><p className="text-xs text-muted">Your reports stay isolated to your account.</p></div></div>
        <Input className="mt-6" type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
        {authMode !== "reset" && <Input className="mt-3" type="password" autoComplete={authMode === "signIn" ? "current-password" : "new-password"} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={authMode === "signUp" ? 10 : 1} required />}
        {authMode === "signUp" && <Input className="mt-3" type="password" autoComplete="new-password" placeholder="Confirm password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} minLength={10} required />}
        {authError && <p className="mt-3 rounded-md border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{authError}</p>}
        {authInfo && <p className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted">{authInfo}</p>}
        <Button type="submit" className="mt-5 w-full" size="lg" disabled={busyAuth}>{authMode === "signIn" ? "Sign in" : authMode === "signUp" ? "Create account" : "Send reset link"}<ArrowRight /></Button>
        <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs"><button type="button" className="mw-focus rounded text-muted underline underline-offset-4 hover:text-fg" onClick={() => { setAuthMode(authMode === "signIn" ? "signUp" : "signIn"); setAuthError(null); setAuthInfo(null); }}>{authMode === "signIn" ? "Create an account" : "I already have an account"}</button>{authMode === "signIn" && <button type="button" className="mw-focus rounded text-muted underline underline-offset-4 hover:text-fg" onClick={() => { setAuthMode("reset"); setAuthError(null); setAuthInfo(null); }}>Forgot password?</button>}{authMode === "reset" && <button type="button" className="mw-focus rounded text-muted underline underline-offset-4 hover:text-fg" onClick={() => setAuthMode("signIn")}>Back to sign in</button>}</div>
        <div className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-subtle">Your chess analysis runs locally with Stockfish 19. MoveWisely does not require a paid AI service to generate the training report.</div>
      </form>
    </div>;
  }

  return <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
    <section className="grid gap-6 lg:grid-cols-[1.08fr_.92fr] lg:items-stretch">
      <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Competition command center</p><h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Find the decisions worth fixing.</h1></div>{session.competitionDate ? <div className="rounded-full border border-border bg-surface-2 px-3 py-2 text-xs text-muted"><CalendarDays className="mr-1 inline size-3.5" /> {daysLabel(session.competitionDate)}</div> : null}</div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">Scan recent games, confirm serious engine losses at greater depth, then convert the strongest evidence into a training schedule.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3"><Feature icon={<Brain />} title="Stockfish 19" text="Two-pass verification with deeper review for serious losses." /><Feature icon={<BookOpen />} title="Opening profile" text="See recurring openings and their practical cost." /><Feature icon={<Clock3 />} title="Clock signals" text="Pressure is interpreted relative to the game control." /></div>
        {session.error && <p className="mt-5 rounded-[var(--radius-md)] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{session.error}</p>}
      </div>
      <AnalysisForm pgn={pgn} setPgn={setPgn} fileRef={fileRef} chooseFile={chooseFile} onSubmit={onSubmit} />
    </section>

    <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="size-4 text-primary" /><p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Recent reports</p></div>{saved && <Button variant="outline" size="sm" onClick={onOpenSaved}>Open local report</Button>}</div>{history.length ? <div>
        {history.length > 1 && <div className="mt-4 rounded-[var(--radius-md)] bg-surface-2 p-4"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Recent trend</p><div className="mt-2 flex flex-wrap items-end gap-4"><div><p className="font-display text-3xl">{history[0]?.accuracy}%</p><p className="text-xs text-muted">latest accuracy</p></div><div className="pb-1 text-sm text-muted">{trendDelta(history[0]?.accuracy ?? 0, history[1]?.accuracy ?? 0)}</div><div className="pb-1 text-xs text-subtle">{history[0]?.overall_cpl ?? 0} CPL now · {history[1]?.overall_cpl ?? 0} before</div></div></div>}
        <div className="mt-4 divide-y divide-border">{history.map((row) => <button type="button" key={row.id} onClick={() => onOpenReport(row.id)} className="mw-focus flex w-full items-center justify-between gap-4 py-4 text-left hover:bg-surface-2/40"><div className="min-w-0"><p className="truncate text-sm font-medium">{row.chess_username} · {row.time_class}</p><p className="mt-1 text-xs text-muted">{formatDate(row.created_at)} · {row.games_analyzed} games · {row.source === "pgn" ? "PGN" : "Chess.com"}{row.primary_focus && WEAKNESS_META[row.primary_focus as keyof typeof WEAKNESS_META] ? ` · ${WEAKNESS_META[row.primary_focus as keyof typeof WEAKNESS_META].label}` : ""}</p></div><div className="shrink-0 text-right"><p className="font-mono text-sm">{row.accuracy}%</p><p className="text-[11px] text-muted">{row.overall_cpl} CPL</p></div></button>)}</div></div> : <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-border bg-surface-2 p-6 text-center"><BarChart3 className="mx-auto size-5 text-primary" /><p className="mt-3 text-sm text-muted">Your saved analyses will appear here.</p></div>}</div>
      <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:p-6"><div className="flex items-center gap-2"><UserRound className="size-4 text-primary" /><p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">First club-pilot checklist</p></div><div className="mt-4 space-y-3"><Checklist icon={<CheckCircle2 />} text="Import a competition PGN when the game was played over the board or on another platform." /><Checklist icon={<CheckCircle2 />} text="Review your three highest-cost positions before reading the full report." /><Checklist icon={<CheckCircle2 />} text="Run at least one exact-time-control simulation before competition day." /><Checklist icon={<CheckCircle2 />} text="Mark training tasks complete so your next report has measurable context." /></div><div className="mt-5 rounded-[var(--radius-md)] border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted"><span className="font-semibold text-fg">National-level roadmap:</span> repeated reports build your personal baseline. The product is designed so coach/team workflows can be added without moving private data out of your account.</div></div>
    </section>

    <section className="mt-6 rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-surface-2"><ShieldCheck className="size-4 text-primary" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Privacy & data</p><h2 className="mt-1 font-display text-2xl">You control your training data.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">MoveWisely stores only the profile, reports, and training progress needed for your account. Saved report content is protected by Supabase Row Level Security.</p></div></div>
        <Button type="button" variant="outline" onClick={() => void deleteMyData()} disabled={deletingData} className="border-danger/30 text-danger hover:bg-danger/5"><Trash2 /> {deletingData ? "Deleting…" : "Delete my MoveWisely data"}</Button>
      </div>
      {dataMessage && <p className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-2 p-3 text-xs text-muted">{dataMessage}</p>}
    </section>
  </div>;
}

function AnalysisForm({ pgn, setPgn, fileRef, chooseFile, onSubmit }: { pgn: string; setPgn: (value: string) => void; fileRef: RefObject<HTMLInputElement | null>; chooseFile: (file: File) => void; onSubmit: (pgn?: string) => void }) {
  const session = useSession();
  const { username, timeClass, limit, competitionDate, source, setUsername, setTimeClass, setLimit, setCompetitionDate, setSource } = session;
  return <form className="rounded-[var(--radius-xl)] border border-border bg-surface p-5 shadow-sm sm:p-6" onSubmit={(event) => { event.preventDefault(); onSubmit(source === "pgn" ? pgn : undefined); }}>
    <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1"><button type="button" aria-pressed={source === "chesscom"} className={cn("h-10 rounded-full text-sm font-medium", source === "chesscom" ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")} onClick={() => setSource("chesscom")}>Chess.com</button><button type="button" aria-pressed={source === "pgn"} className={cn("h-10 rounded-full text-sm font-medium", source === "pgn" ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")} onClick={() => setSource("pgn")}>Import PGN</button></div>
    <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted" htmlFor="player">Player</label><Input id="player" className="mt-2" placeholder={source === "chesscom" ? "Chess.com username" : "Exact player name in PGN"} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" required />
    {source === "pgn" && <><textarea value={pgn} onChange={(event) => setPgn(event.target.value.slice(0, 2_000_000))} maxLength={2_000_000} placeholder={'Paste one or more PGNs…\n[Event "Club Championship"]\n[White "Player"]\n[Black "Opponent"]'} className="mt-3 min-h-36 w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface-2 p-3 text-xs leading-5 text-fg outline-none placeholder:text-subtle focus:ring-2 focus:ring-primary/30"/><div className="mt-2 flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload /> Upload PGN</Button><span className="text-xs text-subtle">2 MB max · {pgn.length.toLocaleString()} chars</span><input ref={fileRef} hidden type="file" accept=".pgn,.txt,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) chooseFile(file); event.currentTarget.value = ""; }} /></div></>}
    <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Time control</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{TIME.map((item) => <button key={item.id} type="button" aria-pressed={timeClass === item.id} onClick={() => setTimeClass(item.id)} className={cn("min-h-16 rounded-[var(--radius-sm)] border px-3 text-left transition", timeClass === item.id ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface-2 text-muted hover:text-fg")}><span className="block text-sm font-medium">{item.label}</span><span className="text-[11px] opacity-75">{item.description}</span></button>)}</div>
    {source === "chesscom" && <><p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Games to scan</p><div className="mt-2 grid grid-cols-3 gap-2">{LIMITS.map((value) => <button type="button" aria-pressed={limit === value} key={value} onClick={() => setLimit(value)} className={cn("h-11 rounded-[var(--radius-sm)] border text-sm font-medium tabular-nums transition", limit === value ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface-2 text-muted hover:text-fg")}>{value}</button>)}</div><p className="mt-2 text-[11px] leading-relaxed text-subtle">10 games is the fastest pilot. 20–30 games give a steadier pattern signal.</p></>}
    <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted" htmlFor="competitionDate">Competition date <span className="font-normal normal-case tracking-normal text-subtle">(optional)</span></label><Input id="competitionDate" className="mt-2" type="date" value={competitionDate} onChange={(event) => setCompetitionDate(event.target.value)} />
    <Button type="submit" size="lg" className="mt-6 w-full">Analyse & prepare <ArrowRight /></Button>
    <p className="mt-3 text-center text-[11px] leading-relaxed text-subtle">Stockfish runs locally · serious losses receive deeper confirmation · raw PGNs are removed before a report is persisted</p>
  </form>;
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-4"><div className="flex items-center gap-2 text-primary">{icon}</div><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted">{text}</p></div>; }
function Checklist({ icon, text }: { icon: ReactNode; text: string }) { return <div className="flex gap-3 rounded-[var(--radius-md)] bg-surface-2 p-3"><span className="text-primary">{icon}</span><p className="text-sm text-muted">{text}</p></div>; }
function LoadingScreen() { return <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-4"><div className="animate-pulse"><div className="h-3 w-32 rounded bg-surface-2"/><div className="mt-4 h-12 w-4/5 rounded bg-surface-2"/><div className="mt-3 h-4 w-full rounded bg-surface-2"/><div className="mt-8 h-28 rounded-[var(--radius-lg)] bg-surface-2"/></div></div>; }
function trendDelta(latest: number, previous: number) { const delta = latest - previous; if (delta === 0) return "No change from the previous saved report"; return `${delta > 0 ? "+" : ""}${delta} points vs previous report`; }
function formatDate(value: string) { try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); } catch { return value.slice(0, 10); } }
function daysLabel(date: string) { const days = Math.max(0, Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000)); return days === 0 ? "Competition day" : `${days}d to go`; }

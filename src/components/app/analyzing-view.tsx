import { Activity, Cpu, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AnalyzingView({ done, total, username, label }: { done: number; total: number; username: string; label?: string }) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return <main className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
    <div className="w-full rounded-[var(--radius-xl)] border border-border bg-surface p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted"><Activity className="size-4 text-primary" /> Engine analysis</div>
      <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">Reading {username}'s games.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">Every player move is compared with Stockfish. Significant losses are rechecked at a deeper search before they enter the mistake library.</p>
      <div className="mt-8 overflow-hidden rounded-full bg-surface-2 p-1"><div className="h-3 rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>
      <div className="mt-3 flex items-start justify-between gap-4 text-xs"><span className="text-muted">{label || "Starting…"}</span><span className="font-mono text-fg">{pct}%</span></div>
      <div className="mt-7 grid gap-3 sm:grid-cols-3"><Info icon={<Cpu />} title="Local engine" text="Stockfish 19 in a browser worker." /><Info icon={<ShieldCheck />} title="Deeper checks" text="Serious losses are re-analysed before tagging." /><Info icon={<Activity />} title="No API key" text="Chess evaluation does not depend on an AI service." /></div>
      <p className="mt-6 text-xs leading-relaxed text-subtle">Keep this tab open while the engine runs. Processing time depends on the number of games, position complexity, and your device.</p>
    </div>
  </main>;
}
function Info({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="rounded-[var(--radius-md)] bg-surface-2 p-3"><div className="flex items-center gap-2 text-primary">{icon}<span className="text-xs font-semibold">{title}</span></div><p className="mt-2 text-[11px] leading-relaxed text-muted">{text}</p></div>; }

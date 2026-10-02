import type { ErrorComponentProps } from "@tanstack/react-router";
import { ArrowLeft, TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center text-fg">
    <span className="grid size-12 place-items-center rounded-full border border-danger/30 bg-danger/5 text-danger"><TriangleAlert className="size-6" /></span>
    <h1 className="mt-5 font-display text-3xl">MoveWisely hit an unexpected error.</h1>
    <p className="mt-3 max-w-md text-sm leading-6 text-muted">{errorMessage(error)}</p>
    <button type="button" className="mw-focus mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2" onClick={() => window.location.reload()}><ArrowLeft className="size-4" /> Reload</button>
  </main>;
}

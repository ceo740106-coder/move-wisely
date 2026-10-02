import type { TimeClass } from "./types";

export function parseClkMap(pgn: string): Record<number, number> {
  const values: Record<number, number> = {};
  const clocks = [...pgn.matchAll(/\[%clk\s+([0-9:]+)\]/gi)];
  clocks.forEach((match, index) => {
    const raw = match[1];
    if (raw) values[index] = clockToSeconds(raw);
  });
  return values;
}

function clockToSeconds(value: string): number {
  const parts = value.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

export function parsePgnTimeControl(pgn: string, fallback: TimeClass): { initialSeconds?: number; incrementSeconds?: number; timeClass: TimeClass } {
  const match = pgn.match(/\[TimeControl\s+"([^"]+)"\]/i)?.[1];
  if (!match || match === "-") return { timeClass: fallback };
  const [initialRaw, incrementRaw] = match.split("+").map(Number);
  const initialSeconds = Number.isFinite(initialRaw) ? initialRaw : undefined;
  const incrementSeconds = Number.isFinite(incrementRaw) ? incrementRaw : 0;
  const timeClass = initialSeconds === undefined ? fallback : initialSeconds < 180 ? "bullet" : initialSeconds < 600 ? "blitz" : initialSeconds < 1800 ? "rapid" : "daily";
  return { initialSeconds, incrementSeconds, timeClass };
}

export function relativeClock(seconds: number | undefined, control: { initialSeconds?: number }): number | undefined {
  if (seconds === undefined || !control.initialSeconds || control.initialSeconds <= 0) return undefined;
  return Math.max(0, Math.min(1, seconds / control.initialSeconds));
}

export function troubleThreshold(control: { initialSeconds?: number; timeClass: TimeClass }): number | null {
  if (!control.initialSeconds) {
    if (control.timeClass === "bullet") return 20;
    if (control.timeClass === "blitz") return 45;
    if (control.timeClass === "rapid") return 180;
    return null;
  }
  const ratio = control.timeClass === "bullet" ? 0.12 : control.timeClass === "blitz" ? 0.10 : control.timeClass === "rapid" ? 0.12 : 0.08;
  return Math.max(control.timeClass === "rapid" ? 45 : 10, Math.round(control.initialSeconds * ratio));
}

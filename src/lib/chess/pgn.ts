import { Chess } from "chess.js";
import { parsePgnTimeControl } from "./clocks";
import type { IngestedGame, TimeClass } from "./types";

function tag(pgn: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return pgn.match(new RegExp(`\\[${escaped}\\s+"([^"]*)"\\]`, "i"))?.[1]?.trim() || undefined;
}

function rating(pgn: string, side: "White" | "Black") {
  const value = Number(tag(pgn, `${side}Elo`));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function splitPgnCollection(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const matches = normalized.match(/(?=\[Event\s+")/gi);
  if (!matches) return [normalized];
  const parts = normalized.split(/(?=\[Event\s+")/gi).map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : [normalized];
}

export function inferTimeClassFromPgn(pgn: string, fallback: TimeClass): TimeClass {
  return parsePgnTimeControl(pgn, fallback).timeClass;
}

function gameResult(result: string | undefined) {
  if (result === "1-0") return { white: "win", black: "loss" } as const;
  if (result === "0-1") return { white: "loss", black: "win" } as const;
  if (result === "1/2-1/2") return { white: "draw", black: "draw" } as const;
  return { white: undefined, black: undefined } as const;
}

export function pgnsToGames(text: string, selected: TimeClass, playerName: string): { games: IngestedGame[]; skipped: number } {
  const chunks = splitPgnCollection(text);
  const out: IngestedGame[] = [];
  let skipped = 0;
  const selectedLower = playerName.trim().toLowerCase();

  for (const pgn of chunks) {
    const white = tag(pgn, "White");
    const black = tag(pgn, "Black");
    if (!white || !black) {
      skipped += 1;
      continue;
    }

    try {
      const chess = new Chess();
      chess.loadPgn(pgn, { strict: false });
      if (chess.history().length === 0) {
        skipped += 1;
        continue;
      }
    } catch {
      skipped += 1;
      continue;
    }

    const inferred = inferTimeClassFromPgn(pgn, selected);
    if (inferred !== selected) {
      skipped += 1;
      continue;
    }

    const isPlayer = !!selectedLower && (white.toLowerCase() === selectedLower || black.toLowerCase() === selectedLower);
    if (!isPlayer) {
      skipped += 1;
      continue;
    }

    const result = gameResult(tag(pgn, "Result"));
    const endTimeRaw = Number(tag(pgn, "EndTime"));
    const url = tag(pgn, "Site") ?? "";
    out.push({
      url: /^https?:\/\//i.test(url) ? url : "",
      pgn,
      timeClass: inferred,
      endTime: Number.isFinite(endTimeRaw) ? endTimeRaw : 0,
      eco: tag(pgn, "ECO"),
      rated: /^(1|true|yes)$/i.test(tag(pgn, "Rated") ?? ""),
      white: { username: white, rating: rating(pgn, "White"), result: result.white },
      black: { username: black, rating: rating(pgn, "Black"), result: result.black },
    });
  }

  return { games: out, skipped };
}

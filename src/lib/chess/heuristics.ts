import { Chess, SQUARES, type Color, type PieceSymbol, type Square } from "chess.js";
import type { Severity, WeaknessKey } from "./types";

const PIECE_VALUE: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20_000 };

export function pieceValue(type: PieceSymbol) {
  return PIECE_VALUE[type];
}

function opponent(color: Color): Color {
  return color === "w" ? "b" : "w";
}

function fileOf(square: Square) {
  return square.charCodeAt(0) - 97;
}

function rankOf(square: Square) {
  return Number(square[1]);
}

function inside(file: number, rank: number) {
  return file >= 0 && file < 8 && rank >= 1 && rank <= 8;
}

function squareOf(file: number, rank: number): Square {
  return `${String.fromCharCode(97 + file)}${rank}` as Square;
}

/** Squares a specific piece attacks, including occupied enemy squares. This is deliberately
 * piece-specific so a fork tag cannot be caused by two unrelated attackers. */
export function attackedTargetsByPiece(chess: Chess, from: Square, color: Color): Square[] {
  const piece = chess.get(from);
  if (!piece || piece.color !== color) return [];
  const targets: Square[] = [];
  const file = fileOf(from);
  const rank = rankOf(from);

  const add = (f: number, r: number, stopOnOccupied = true) => {
    if (!inside(f, r)) return false;
    const sq = squareOf(f, r);
    const occupant = chess.get(sq);
    if (!occupant) {
      if (!stopOnOccupied) targets.push(sq);
      return true;
    }
    if (occupant.color !== color) targets.push(sq);
    return false;
  };

  if (piece.type === "p") {
    const dr = color === "w" ? 1 : -1;
    for (const df of [-1, 1]) {
      const r = rank + dr;
      if (inside(file + df, r)) targets.push(squareOf(file + df, r));
    }
  } else if (piece.type === "n") {
    for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
      if (inside(file + df, rank + dr)) {
        const sq = squareOf(file + df, rank + dr);
        const occupant = chess.get(sq);
        if (!occupant || occupant.color !== color) targets.push(sq);
      }
    }
  } else if (piece.type === "k") {
    for (let df = -1; df <= 1; df += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (!df && !dr) continue;
        if (inside(file + df, rank + dr)) {
          const sq = squareOf(file + df, rank + dr);
          const occupant = chess.get(sq);
          if (!occupant || occupant.color !== color) targets.push(sq);
        }
      }
    }
  } else {
    const diagonals = piece.type === "b" || piece.type === "q" ? [[1, 1], [1, -1], [-1, -1], [-1, 1]] : [];
    const orthogonals = piece.type === "r" || piece.type === "q" ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [];
    for (const [df, dr] of [...diagonals, ...orthogonals]) {
      let f = file + df;
      let r = rank + dr;
      while (inside(f, r)) {
        if (!add(f, r, true)) break;
        f += df;
        r += dr;
      }
    }
  }

  return targets;
}

export function hangingPieces(chess: Chess, color: Color): Square[] {
  const enemy = opponent(color);
  return SQUARES.filter((sq) => {
    const piece = chess.get(sq);
    if (!piece || piece.color !== color || piece.type === "k") return false;
    const attacked = chess.isAttacked(sq, enemy);
    const defended = chess.isAttacked(sq, color);
    return attacked && !defended;
  });
}

export function newlyHangingPieces(before: Chess, after: Chess, color: Color): Square[] {
  const beforeHanging = new Set(hangingPieces(before, color));
  return hangingPieces(after, color).filter((sq) => !beforeHanging.has(sq));
}

export function forkTargetsAfterMove(chess: Chess, destination: Square, color: Color): Square[] {
  const targets = attackedTargetsByPiece(chess, destination, color)
    .filter((sq) => {
      const target = chess.get(sq);
      return !!target && target.color !== color && target.type !== "p" && target.type !== "k";
    })
    .filter((sq) => (PIECE_VALUE[chess.get(sq)!.type] ?? 0) >= 300);
  return [...new Set(targets)];
}

export function forkOnBoard(chess: Chess, color: Color): boolean {
  return SQUARES.some((sq) => forkTargetsAfterMove(chess, sq, color).length >= 2);
}

export function forkFromMove(chess: Chess, destination: Square, color: Color): boolean {
  return forkTargetsAfterMove(chess, destination, color).length >= 2;
}

export function hasPinOrSkewer(chess: Chess, color: Color): boolean {
  const enemy = opponent(color);
  for (const sq of SQUARES) {
    const p = chess.get(sq);
    if (!p || p.color !== color || !["b", "r", "q"].includes(p.type)) continue;
    const attacks = attackedTargetsByPiece(chess, sq, color);
    for (const targetSq of attacks) {
      const target = chess.get(targetSq);
      if (!target || target.color !== enemy || target.type === "k") continue;
      const tf = fileOf(targetSq);
      const tr = rankOf(targetSq);
      const sf = fileOf(sq);
      const sr = rankOf(sq);
      const df = Math.sign(tf - sf);
      const dr = Math.sign(tr - sr);
      let f = tf + df;
      let r = tr + dr;
      let behind: PieceSymbol | null = null;
      while (inside(f, r)) {
        const p2 = chess.get(squareOf(f, r));
        if (p2) {
          if (p2.color === enemy) behind = p2.type;
          break;
        }
        f += df;
        r += dr;
      }
      if (behind === "k" || (behind && PIECE_VALUE[behind] > PIECE_VALUE[target.type] + 200)) return true;
    }
  }
  return false;
}

function pawnStructurePenalty(chess: Chess, color: Color): number {
  const files = Array<number>(8).fill(0);
  for (const sq of SQUARES) {
    const p = chess.get(sq);
    if (p?.type === "p" && p.color === color) files[fileOf(sq)] += 1;
  }
  let doubled = 0;
  let isolated = 0;
  for (let f = 0; f < 8; f += 1) {
    if (files[f] > 1) doubled += files[f] - 1;
    if (files[f] === 1 && (files[f - 1] ?? 0) === 0 && (files[f + 1] ?? 0) === 0) isolated += 1;
  }
  return doubled * 25 + isolated * 18;
}

export function phaseLabel(chess: Chess, moveNumber = 1): "opening" | "middlegame" | "endgame" {
  const pieces = SQUARES.reduce((n, sq) => {
    const p = chess.get(sq);
    return n + (p && p.type !== "p" && p.type !== "k" ? 1 : 0);
  }, 0);
  if (moveNumber <= 12) return "opening";
  if (pieces <= 4) return "endgame";
  return "middlegame";
}

export function classifyMoveTags(args: {
  moveNumber: number;
  relativeClock?: number;
  newlyHanging: boolean;
  forkCreated: boolean;
  pinOrSkewer: boolean;
  pawnPenaltyDelta: number;
  phase: "opening" | "middlegame" | "endgame";
  cpLoss: number;
}): WeaknessKey[] {
  const tags: WeaknessKey[] = [];
  if (args.moveNumber <= 12 && args.cpLoss >= 50) tags.push("opening");
  if (args.relativeClock !== undefined && args.relativeClock <= 0.20 && args.cpLoss >= 80) tags.push("timeTrouble");
  if (args.newlyHanging) tags.push("hangingPieces");
  if (args.forkCreated || args.pinOrSkewer) tags.push("tactics");
  if (args.phase === "endgame" && args.cpLoss >= 80) tags.push("endgame");
  if (args.pawnPenaltyDelta >= 25 && args.cpLoss >= 70) tags.push("pawnStructure");
  if (args.cpLoss >= 100 && !tags.includes("tactics") && !tags.includes("hangingPieces") && !tags.includes("pawnStructure") && !tags.includes("endgame")) tags.push("calculation");
  return [...new Set(tags)];
}

export function noteForTags(tags: WeaknessKey[], hanging: Square[], san: string, bestMoveSan?: string): string {
  const notes: string[] = [];
  if (bestMoveSan) notes.push(`The engine prefers ${bestMoveSan} over ${san}.`);
  if (tags.includes("hangingPieces") && hanging.length) notes.push(`After the move, ${hanging.slice(0, 3).join(", ")} ${hanging.length === 1 ? "is" : "are"} left vulnerable.`);
  if (tags.includes("opening")) notes.push("The loss happens early enough to be useful for opening preparation.");
  if (tags.includes("timeTrouble")) notes.push("The move was made under the selected time-pressure threshold.");
  if (tags.includes("calculation")) notes.push("No single concrete motif explains the whole loss, so calculate candidate moves and the opponent's strongest reply before settling on a plan.");
  if (tags.includes("endgame")) notes.push("The position is simplified, so this is a useful technique position.");
  return notes.join(" ") || "The engine found a meaningful loss worth reviewing in context.";
}

export function materialSwingCp(before: Chess, after: Chess, color: Color): number {
  let beforeCp = 0;
  let afterCp = 0;
  for (const sq of SQUARES) {
    const a = before.get(sq);
    const b = after.get(sq);
    if (a) beforeCp += a.color === color ? PIECE_VALUE[a.type] : -PIECE_VALUE[a.type];
    if (b) afterCp += b.color === color ? PIECE_VALUE[b.type] : -PIECE_VALUE[b.type];
  }
  return afterCp - beforeCp;
}

export function moveIsForcing(san: string): boolean {
  return /x|\+|#/.test(san) || /^(?:O-O|O-O-O)/.test(san);
}

export function severityOf(cpLoss: number): Severity | null {
  if (cpLoss >= 300) return "blunder";
  if (cpLoss >= 100) return "mistake";
  if (cpLoss >= 50) return "inaccuracy";
  return null;
}

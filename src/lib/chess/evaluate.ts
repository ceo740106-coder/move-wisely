import { Chess, SQUARES, type Color, type PieceSymbol } from "chess.js";
import { pieceValue as heuristicPieceValue } from "./heuristics";

export function pieceValue(type: PieceSymbol): number {
  return heuristicPieceValue(type);
}

export function materialCp(chess: Chess, perspective: Color): number {
  let score = 0;
  for (const sq of SQUARES) {
    const piece = chess.get(sq);
    if (!piece) continue;
    score += piece.color === perspective ? heuristicPieceValue(piece.type) : -heuristicPieceValue(piece.type);
  }
  return score;
}

export function pawnStructureScore(chess: Chess, color: Color): number {
  const files = Array<number>(8).fill(0);
  for (const sq of SQUARES) {
    const piece = chess.get(sq);
    if (piece?.type === "p" && piece.color === color) files[sq.charCodeAt(0) - 97] += 1;
  }
  let doubled = 0;
  let isolated = 0;
  for (let file = 0; file < 8; file += 1) {
    if (files[file] > 1) doubled += files[file] - 1;
    if (files[file] === 1 && (files[file - 1] ?? 0) === 0 && (files[file + 1] ?? 0) === 0) isolated += 1;
  }
  return doubled * 25 + isolated * 18;
}

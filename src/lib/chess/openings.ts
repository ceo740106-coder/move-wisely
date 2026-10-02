import { Chess } from "chess.js";

const NAMED: Array<{ sequence: string[]; name: string; family: string; eco: string }> = [
  { sequence: ["e4", "c5"], name: "Sicilian Defence", family: "Sicilian", eco: "B20" },
  { sequence: ["e4", "e5", "Nf3", "Nc6", "Bb5"], name: "Ruy Lopez", family: "Open Game", eco: "C60" },
  { sequence: ["e4", "e5", "Nf3", "Nc6", "Bc4"], name: "Italian Game", family: "Open Game", eco: "C50" },
  { sequence: ["e4", "e5", "Nf3", "Nc6", "d4"], name: "Scotch Game", family: "Open Game", eco: "C45" },
  { sequence: ["e4", "e5", "Nf3", "d6"], name: "Philidor Defence", family: "Open Game", eco: "C41" },
  { sequence: ["e4", "e5", "Nc3"], name: "Vienna Game", family: "Open Game", eco: "C25" },
  { sequence: ["e4", "e5", "f4"], name: "King's Gambit", family: "Open Game", eco: "C30" },
  { sequence: ["e4", "c6"], name: "Caro-Kann Defence", family: "Semi-Open Game", eco: "B10" },
  { sequence: ["e4", "e6"], name: "French Defence", family: "Semi-Open Game", eco: "C00" },
  { sequence: ["e4", "d5"], name: "Scandinavian Defence", family: "Semi-Open Game", eco: "B01" },
  { sequence: ["e4", "d6"], name: "Pirc Defence", family: "Semi-Open Game", eco: "B07" },
  { sequence: ["e4", "Nf6"], name: "Alekhine Defence", family: "Semi-Open Game", eco: "B02" },
  { sequence: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"], name: "Nimzo-Indian Defence", family: "Indian Game", eco: "E20" },
  { sequence: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"], name: "King's Indian Defence", family: "Indian Game", eco: "E60" },
  { sequence: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"], name: "Queen's Indian Defence", family: "Indian Game", eco: "E12" },
  { sequence: ["d4", "f5"], name: "Dutch Defence", family: "Semi-Closed Game", eco: "A80" },
  { sequence: ["d4", "d5", "c4", "e6"], name: "Queen's Gambit Declined", family: "Closed Game", eco: "D30" },
  { sequence: ["d4", "d5", "c4", "dxc4"], name: "Queen's Gambit Accepted", family: "Closed Game", eco: "D20" },
  { sequence: ["d4", "d5", "c4", "c6"], name: "Slav Defence", family: "Closed Game", eco: "D10" },
  { sequence: ["d4", "d5", "Nf3", "Nf6", "c4"], name: "Queen's Gambit", family: "Closed Game", eco: "D30" },
  { sequence: ["c4"], name: "English Opening", family: "Flank Opening", eco: "A10" },
  { sequence: ["Nf3"], name: "Réti Opening", family: "Flank Opening", eco: "A04" },
  { sequence: ["f4"], name: "Bird Opening", family: "Flank Opening", eco: "A02" },
];

function normalize(sequence: string[]) {
  return sequence.map((move) => move.replace(/[+#?!]+$/g, ""));
}

function gameSanPrefix(pgn: string): string[] {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn, { strict: false });
    return normalize(chess.history().slice(0, 12));
  } catch {
    return [];
  }
}

export interface OpeningInfo {
  name: string;
  family: string;
  eco?: string;
}

export function identifyOpening(pgn: string, eco?: string): OpeningInfo {
  const san = gameSanPrefix(pgn);
  let best: (typeof NAMED)[number] | undefined;
  for (const candidate of NAMED) {
    const seq = normalize(candidate.sequence);
    if (seq.every((move, index) => san[index] === move)) {
      if (!best || candidate.sequence.length > best.sequence.length) best = candidate;
    }
  }
  if (best) return { name: best.name, family: best.family, eco: eco ?? best.eco };
  if (eco) return { name: `ECO ${eco}`, family: `ECO ${eco.slice(0, 1).toUpperCase()}` , eco };
  if (san[0] === "e4") return { name: "King's Pawn Opening", family: "Open Game" };
  if (san[0] === "d4") return { name: "Queen's Pawn Opening", family: "Closed Game" };
  return { name: "Other Opening", family: "Other" };
}

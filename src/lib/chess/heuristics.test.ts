import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { classifyMoveTags, forkFromMove, hangingPieces, newlyHangingPieces, severityOf, phaseLabel } from "./heuristics.ts";
import { parsePgnTimeControl, parseClkMap, relativeClock, troubleThreshold } from "./clocks.ts";
import { pgnsToGames } from "./pgn.ts";
import { parseEngineInfo } from "./engine.ts";

test("fork detection is specific to the moved piece", () => {
  const chess = new Chess("4k3/4q3/8/3N1r2/8/8/8/4K3 w - - 0 1");
  assert.equal(forkFromMove(chess, "d5", "w"), true);
});

test("hanging-piece detection requires the piece to be undefended", () => {
  const undefended = new Chess("r3k3/8/8/8/8/8/8/R3K3 b - - 0 1");
  assert.deepEqual(hangingPieces(undefended, "w"), ["a1"]);
  const defended = new Chess("r3k3/8/8/8/8/8/R7/R3K3 b - - 0 1");
  assert.deepEqual(hangingPieces(defended, "w"), []);
});

test("newly hanging pieces only reports newly exposed pieces", () => {
  const before = new Chess("r3k3/8/8/8/8/8/R7/R3K3 b - - 0 1");
  const after = new Chess("r3k3/8/8/8/8/8/8/R3K3 b - - 0 1");
  assert.deepEqual(newlyHangingPieces(before, after, "w"), ["a1"]);
});

test("clock pressure scales from the PGN time control", () => {
  const blitz = parsePgnTimeControl(`[TimeControl "300+5"]`, "blitz");
  assert.equal(blitz.initialSeconds, 300);
  assert.equal(blitz.incrementSeconds, 5);
  assert.equal(blitz.timeClass, "blitz");
  assert.ok((troubleThreshold(blitz) ?? 0) >= 30);
  assert.ok((relativeClock(30, blitz) ?? 1) < 0.12);
  const rapid = parsePgnTimeControl(`[TimeControl "600+5"]`, "blitz");
  assert.equal(rapid.timeClass, "rapid");
});

test("clock tags are mapped in move order", () => {
  const pgn = `1. e4 {[%clk 9:59]} e5 {[%clk 9:58]} 2. Nf3 {[%clk 9:57]}`;
  assert.deepEqual(parseClkMap(pgn), { 0: 599, 1: 598, 2: 597 });
});

test("engine UCI parser handles centipawn and mate scores", () => {
  const cp = parseEngineInfo("info depth 16 score cp 42 nodes 123 pv e2e4 e7e5");
  assert.equal(cp?.scoreCp, 42);
  assert.equal(cp?.depth, 16);
  assert.deepEqual(cp?.pv, ["e2e4", "e7e5"]);
  const mate = parseEngineInfo("info depth 18 score mate -2 pv e7e8");
  assert.equal(mate?.mate, -2);
  assert.equal(mate?.scoreCp, -99800);
});

test("PGN importer filters by selected time class and player", () => {
  const pgn = `[Event "Club"]\n[Site "Local"]\n[White "Player"]\n[Black "Opponent"]\n[Result "1-0"]\n[TimeControl "600+5"]\n[ECO "C20"]\n\n1. e4 e5 2. Nf3 Nc6 1-0`;
  const parsed = pgnsToGames(pgn, "rapid", "Player");
  assert.equal(parsed.games.length, 1);
  assert.equal(parsed.games[0]?.white.username, "Player");
});

test("severity thresholds are monotonic", () => {
  assert.equal(severityOf(49), null);
  assert.equal(severityOf(50), "inaccuracy");
  assert.equal(severityOf(100), "mistake");
  assert.equal(severityOf(300), "blunder");
});


test("unexplained engine loss is classified as calculation, not automatically as tactics", () => {
  const tags = classifyMoveTags({
    moveNumber: 24,
    newlyHanging: false,
    forkCreated: false,
    pinOrSkewer: false,
    pawnPenaltyDelta: 0,
    phase: "middlegame",
    cpLoss: 180,
  });
  assert.deepEqual(tags, ["calculation"]);
});

test("phase detection uses the real move number when the position comes from a FEN", () => {
  assert.equal(phaseLabel(new Chess("4k3/8/8/8/8/8/8/4K3 w - - 0 20"), 20), "endgame");
});

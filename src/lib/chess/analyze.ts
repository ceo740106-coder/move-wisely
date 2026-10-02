import { Chess, type Color } from "chess.js";
import { pawnStructureScore } from "./evaluate";
import { DEFAULT_ENGINE_DEPTH, CONFIRM_ENGINE_DEPTH, ANALYSIS_VERSION, ENGINE_HASH_MB, ENGINE_THREADS, ENGINE_VERSION, getChessEngine } from "./engine";
import { parseClkMap, parsePgnTimeControl, relativeClock, troubleThreshold } from "./clocks";
import { classifyMoveTags, forkFromMove, hangingPieces, newlyHangingPieces, hasPinOrSkewer, noteForTags, phaseLabel, moveIsForcing, materialSwingCp, severityOf } from "./heuristics";
import { identifyOpening } from "./openings";
import { buildCompetitionPlan, buildCompetitionPrep } from "./routine";
import type { AnalysisReport, AnalysisSource, GameAnalysis, IngestedGame, OpeningStat, OpponentBand, PlayerProfile, TaggedMove, TaggedMoveWithGame, TimeClass, WeaknessKey, WeaknessScore } from "./types";
import { ENGINE_MATE_CP } from "./types";

function depthFor(timeClass: TimeClass): number {
  if (timeClass === "bullet") return 11;
  if (timeClass === "blitz") return 13;
  if (timeClass === "rapid") return 14;
  return 14;
}

function uciOf(move: { from: string; to: string; promotion?: string }) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function comparableScore(cp: number, mate?: number): number {
  if (mate === undefined) return cp;
  return mate > 0 ? ENGINE_MATE_CP - Math.abs(mate) * 100 : -ENGINE_MATE_CP + Math.abs(mate) * 100;
}

function centipawnLoss(bestScore: number, playedScore: number): number {
  if (!Number.isFinite(bestScore) || !Number.isFinite(playedScore)) return 0;
  return Math.max(0, Math.min(5000, Math.round(bestScore - playedScore)));
}

const REPORT_CPL_CAP = 1000;

function accuracyFromCpl(cpl: number): number {
  // MoveWisely accuracy is a monotonic transformation of engine CPL, not Chess.com's CAPS2 score.
  return Math.max(0, Math.min(100, Math.round(100 * Math.exp(-cpl / 300))));
}

function principalVariationSan(fen: string, pv: string[]): string[] {
  if (!pv.length) return [];
  try {
    const chess = new Chess(fen);
    const san: string[] = [];
    for (const uci of pv.slice(0, 10)) {
      if (!/^(?:[a-h][1-8]){2}[qrbn]?$/.test(uci)) break;
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] as "q" | "r" | "b" | "n" | undefined,
      });
      if (!move) break;
      san.push(move.san);
    }
    return san;
  } catch {
    return [];
  }
}

function gameResult(game: IngestedGame, username: string): "win" | "loss" | "draw" {
  const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
  const result = (isWhite ? game.white.result : game.black.result ?? "").toLowerCase();
  if (result === "win") return "win";
  if (result === "loss") return "loss";
  return "draw";
}

function resultFromPgn(chess: Chess, game: IngestedGame, username: string) {
  const result = gameResult(game, username);
  if (result !== "draw") return result;
  if (chess.isCheckmate()) {
    const winner: Color = chess.turn() === "w" ? "b" : "w";
    const playerIsWhite = game.white.username.toLowerCase() === username.toLowerCase();
    const playerColor: Color = playerIsWhite ? "w" : "b";
    return winner === playerColor ? "win" : "loss";
  }
  return result;
}

function bestMoveSan(fen: string, uci?: string): string | undefined {
  if (!uci || !/^(?:[a-h][1-8]){2}[qrbn]?$/.test(uci)) return undefined;
  try {
    const chess = new Chess(fen);
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as "q" | "r" | "b" | "n" | undefined })?.san;
  } catch {
    return undefined;
  }
}

function shouldConfirm(cpLoss: number, san: string) {
  const threshold = 50;
  return cpLoss >= threshold || /[+#x]/.test(san);
}

export async function analyzeGame(
  game: IngestedGame,
  username: string,
  depth = DEFAULT_ENGINE_DEPTH,
  onMove?: (done: number, total: number) => void,
): Promise<GameAnalysis | null> {
  const playerIsWhite = game.white.username.toLowerCase() === username.toLowerCase();
  const playerIsBlack = game.black.username.toLowerCase() === username.toLowerCase();
  if (!playerIsWhite && !playerIsBlack) return null;

  const playerColor: Color = playerIsWhite ? "w" : "b";
  const parser = new Chess();
  try {
    parser.loadPgn(game.pgn, { strict: false });
  } catch {
    return null;
  }
  const history = parser.history({ verbose: true });
  if (!history.length) return null;

  const clocks = parseClkMap(game.pgn);
  const control = parsePgnTimeControl(game.pgn, game.timeClass as TimeClass);
  const threshold = troubleThreshold(control);
  const opening = identifyOpening(game.pgn, game.eco);
  const chess = new Chess();
  const engine = getChessEngine();
  const tagged: TaggedMove[] = [];
  const lossValues: number[] = [];
  let playerMoves = 0;
  let lowClockErrors = 0;
  let clockedPlayerMoves = 0;

  for (let ply = 0; ply < history.length; ply += 1) {
    const move = history[ply]!;
    const isPlayerMove = move.color === playerColor;
    const fenBefore = chess.fen();
    const before = new Chess(fenBefore);
    const pawnBefore = isPlayerMove ? pawnStructureScore(before, playerColor) : 0;
    const moveNumber = Math.floor(ply / 2) + 1;
    const phase = phaseLabel(before, moveNumber);

    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    if (!isPlayerMove) continue;

    playerMoves += 1;
    onMove?.(playerMoves, Math.ceil(history.length / 2));
    const clockSeconds = clocks[ply];
    if (clockSeconds !== undefined) clockedPlayerMoves += 1;
    const rel = relativeClock(clockSeconds, control);
    const lowClock = threshold !== null && clockSeconds !== undefined && clockSeconds <= threshold;
    const playedUci = uciOf(move);

    const quickBest = await engine.analyze(fenBefore, depth);
    let best = quickBest;
    let played = quickBest.bestMoveUci === playedUci ? quickBest : await engine.analyze(fenBefore, depth, [playedUci]);
    let bestScore = comparableScore(best.scoreCp, best.mate);
    let playedScore = comparableScore(played.scoreCp, played.mate);
    let cpLoss = centipawnLoss(bestScore, playedScore);
    let usedDepth = depth;
    let confirmedAtDepth: number | undefined;

    if (shouldConfirm(cpLoss, move.san)) {
      const confirmDepth = Math.min(CONFIRM_ENGINE_DEPTH, depth + 5);
      const confirmedBest = await engine.analyze(fenBefore, confirmDepth);
      const confirmedPlayed = confirmedBest.bestMoveUci === playedUci ? confirmedBest : await engine.analyze(fenBefore, confirmDepth, [playedUci]);
      best = confirmedBest;
      played = confirmedPlayed;
      bestScore = comparableScore(best.scoreCp, best.mate);
      playedScore = comparableScore(played.scoreCp, played.mate);
      cpLoss = centipawnLoss(bestScore, playedScore);
      usedDepth = confirmDepth;
      confirmedAtDepth = confirmDepth;
    }

    lossValues.push(Math.min(cpLoss, REPORT_CPL_CAP));
    const severity = severityOf(cpLoss);
    if (lowClock && severity) lowClockErrors += 1;
    if (!severity) continue;

    const fenAfter = chess.fen();
    const after = new Chess(fenAfter);
    const hanging = newlyHangingPieces(before, after, playerColor);
    const fork = forkFromMove(after, move.to, playerColor);
    const pin = hasPinOrSkewer(after, playerColor);
    const pawnAfter = pawnStructureScore(after, playerColor);

    const tags = classifyMoveTags({
      moveNumber: Math.floor(ply / 2) + 1,
      relativeClock: rel,
      newlyHanging: hanging.length > 0,
      forkCreated: fork,
      pinOrSkewer: pin,
      pawnPenaltyDelta: pawnAfter - pawnBefore,
      phase,
      cpLoss,
    });

    const forcing = moveIsForcing(move.san) || Math.abs(materialSwingCp(before, after, playerColor)) >= 150;
    if (forcing && !tags.includes("tactics")) tags.push("tactics");
    if (tags.length === 0) tags.push(phase === "endgame" ? "endgame" : "calculation");

    const bestSan = bestMoveSan(fenBefore, best.bestMoveUci);
    const pvSan = principalVariationSan(fenBefore, best.pv);
    tagged.push({
      ply,
      moveNumber: Math.floor(ply / 2) + 1,
      san: move.san,
      fenBefore,
      fenAfter,
      color: move.color,
      cpLoss,
      severity,
      tags: [...new Set(tags)],
      clockSeconds,
      relativeClock: rel,
      note: noteForTags([...new Set(tags)], hanging, move.san, bestSan),
      bestMoveUci: best.bestMoveUci,
      bestMoveSan: bestSan,
      bestMoveScoreCp: best.scoreCp,
      playedMoveScoreCp: played.scoreCp,
      principalVariation: pvSan,
      engineDepth: usedDepth,
      quickDepth: depth,
      confirmedAtDepth,
      classificationSource: "stockfish",
    });
  }

  const result = resultFromPgn(chess, game, username);
  const averageCpl = playerMoves ? Math.round(lossValues.reduce((sum, value) => sum + value, 0) / playerMoves) : 0;
  return {
    game,
    playerColor,
    result,
    averageCpl,
    playerMoves,
    tagged,
    openingEco: game.eco,
    openingName: opening.name,
    lowClockErrors,
    clockedPlayerMoves,
  };
}

function ecoFamily(eco?: string) {
  const prefix = eco?.slice(0, 1).toUpperCase();
  return prefix && /^[ABCDE]$/.test(prefix) ? `ECO ${prefix}` : "Other";
}

export async function assembleReport(
  analyzed: GameAnalysis[],
  profile: PlayerProfile,
  timeClass: TimeClass,
  competitionDate?: string,
  engineDepth = DEFAULT_ENGINE_DEPTH,
  source: AnalysisSource = "chesscom",
): Promise<AnalysisReport> {
  const keys: WeaknessKey[] = ["opening", "timeTrouble", "tactics", "calculation", "endgame", "pawnStructure", "hangingPieces"];
  const counts: Record<WeaknessKey, number> = { opening: 0, timeTrouble: 0, tactics: 0, calculation: 0, endgame: 0, pawnStructure: 0, hangingPieces: 0 };
  const issues: TaggedMoveWithGame[] = [];
  const openingMap = new Map<string, { name: string; eco?: string; games: number; wins: number; draws: number; losses: number; cpl: number }>();
  const opponentMap = new Map<OpponentBand["label"], { games: number; wins: number; draws: number; losses: number }>();
  let totalMoves = 0;
  let cplSum = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let whiteGames = 0;
  let blackGames = 0;
  let whiteWins = 0;
  let blackWins = 0;
  let lowClockErrors = 0;
  let clockedPlayerMovesTotal = 0;
  let deepChecks = 0;
  let quickMovesAnalyzed = 0;
  let deepMovesAnalyzed = 0;

  for (const game of analyzed) {
    totalMoves += game.playerMoves;
    cplSum += game.averageCpl * game.playerMoves;
    lowClockErrors += game.lowClockErrors;
    clockedPlayerMovesTotal += game.clockedPlayerMoves;
    quickMovesAnalyzed += game.playerMoves;
    deepMovesAnalyzed += game.tagged.filter((issue) => issue.confirmedAtDepth).length;
    if (game.result === "win") wins += 1;
    else if (game.result === "loss") losses += 1;
    else draws += 1;
    if (game.playerColor === "w") {
      whiteGames += 1;
      if (game.result === "win") whiteWins += 1;
    } else {
      blackGames += 1;
      if (game.result === "win") blackWins += 1;
    }

    const openingInfo = identifyOpening(game.game.pgn, game.openingEco);
    const openingKey = openingInfo.name;
    const openingRow = openingMap.get(openingKey) ?? { name: openingInfo.name, eco: openingInfo.eco, games: 0, wins: 0, draws: 0, losses: 0, cpl: 0 };
    openingRow.games += 1;
    openingRow.cpl += game.averageCpl;
    if (game.result === "win") openingRow.wins += 1;
    else if (game.result === "draw") openingRow.draws += 1;
    else openingRow.losses += 1;
    openingMap.set(openingKey, openingRow);

    const opponentRating = game.playerColor === "w" ? game.game.black.rating : game.game.white.rating;
    const playerRating = game.playerColor === "w" ? game.game.white.rating : game.game.black.rating;
    const band: OpponentBand["label"] = !opponentRating || !playerRating ? "Unknown" : opponentRating - playerRating >= 100 ? "Stronger" : opponentRating - playerRating <= -100 ? "Lower" : "Similar";
    const opponentRow = opponentMap.get(band) ?? { games: 0, wins: 0, draws: 0, losses: 0 };
    opponentRow.games += 1;
    if (game.result === "win") opponentRow.wins += 1;
    else if (game.result === "draw") opponentRow.draws += 1;
    else opponentRow.losses += 1;
    opponentMap.set(band, opponentRow);

    for (const issue of game.tagged) {
      for (const tag of issue.tags) counts[tag] += 1;
      if (issue.confirmedAtDepth) deepChecks += 1;
      if (issue.severity !== "inaccuracy" || issue.confirmedAtDepth) {
        issues.push({
          ...issue,
          gameUrl: game.game.url,
          eco: game.openingEco,
          opponent: game.playerColor === "w" ? game.game.black.username : game.game.white.username,
          playerColor: game.playerColor,
          openingName: game.openingName,
        });
      }
    }
  }

  const topWeaknesses: WeaknessScore[] = keys
    .map((key) => ({ key, count: counts[key], share: totalMoves ? counts[key] / totalMoves : 0 }))
    .sort((a, b) => b.count - a.count);
  const dimensions = keys.map((key) => ({ key, value: totalMoves ? Math.min(100, Math.round((counts[key] / totalMoves) * 1000)) : 0 }));
  issues.sort((a, b) => b.cpLoss - a.cpLoss);

  const openings: OpeningStat[] = [...openingMap.values()]
    .map((row) => ({
      family: ecoFamily(row.eco),
      name: row.name,
      eco: row.eco,
      games: row.games,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      scorePct: Math.round(((row.wins + row.draws * 0.5) / row.games) * 100),
      avgCpl: Math.round(row.cpl / row.games),
    }))
    .sort((a, b) => b.games - a.games || a.avgCpl - b.avgCpl);

  const opponentBands: OpponentBand[] = ["Stronger", "Similar", "Lower", "Unknown"]
    .filter((label) => opponentMap.has(label as OpponentBand["label"]))
    .map((label) => {
      const row = opponentMap.get(label as OpponentBand["label"])!;
      return { label: label as OpponentBand["label"], ...row, scorePct: Math.round(((row.wins + row.draws * 0.5) / row.games) * 100) };
    });

  const avgCpl = totalMoves ? Math.round(cplSum / totalMoves) : 0;
  const accuracy = accuracyFromCpl(avgCpl);
  const lowClockRate = clockedPlayerMovesTotal ? Math.min(1, lowClockErrors / clockedPlayerMovesTotal) : 0;
  const daysUntil = competitionDate
    ? Math.max(0, Math.ceil((new Date(`${competitionDate}T23:59:59`).getTime() - Date.now()) / 86400000))
    : undefined;
  const dayCount = daysUntil === undefined ? 14 : Math.max(1, Math.min(21, daysUntil));
  const plan = buildCompetitionPlan(topWeaknesses, issues, timeClass, dayCount);
  const competition = buildCompetitionPrep(topWeaknesses, openings, issues, lowClockRate, opponentBands, competitionDate);
  const analysisMeta = {
    analysisVersion: ANALYSIS_VERSION,
    source,
    sampleLabel: `${analyzed.length} ${timeClass} game${analyzed.length === 1 ? "" : "s"}`,
    quickDepth: Math.max(8, engineDepth),
    confirmDepth: Math.min(CONFIRM_ENGINE_DEPTH, engineDepth + 5),
    deepChecks,
    verifiedIssues: issues.filter((issue) => !!issue.confirmedAtDepth).length,
    verificationRate: issues.length ? issues.filter((issue) => !!issue.confirmedAtDepth).length / issues.length : 0,
    quickMovesAnalyzed,
    deepMovesAnalyzed,
    engineHashMb: ENGINE_HASH_MB,
    engineThreads: ENGINE_THREADS,
    accuracyMethod: "100 × exp(−average engine loss / 300), rounded and capped at 0–100; aggregate CPL is capped at 1000 cp per move",
    cplCapCp: REPORT_CPL_CAP,
  };

  return {
    profile: { ...profile, competitionDate },
    source,
    timeClass,
    gamesAnalyzed: analyzed.length,
    totalPlayerMoves: totalMoves,
    whiteWinPct: whiteGames ? Math.round((whiteWins / whiteGames) * 100) : 0,
    blackWinPct: blackGames ? Math.round((blackWins / blackGames) * 100) : 0,
    drawPct: analyzed.length ? Math.round((draws / analyzed.length) * 100) : 0,
    overallAcpl: avgCpl,
    accuracy,
    wins,
    losses,
    draws,
    dimensions,
    topWeaknesses,
    openings,
    opponentBands,
    games: analyzed,
    issues: issues.slice(0, 120),
    plan,
    competition,
    engineVersion: ENGINE_VERSION,
    engineDepth,
    analysisMeta,
    createdAt: Date.now(),
  };
}

export async function analyzeInChunks(
  games: IngestedGame[],
  profile: PlayerProfile,
  timeClass: TimeClass,
  competitionDate: string | undefined,
  onProgress: (done: number, total: number, label: string) => void,
  source: AnalysisSource = "chesscom",
) {
  const depth = depthFor(timeClass);
  const analyzed: GameAnalysis[] = [];
  let done = 0;
  const total = games.length;
  const resolvedProfile = { ...profile };
  if (!resolvedProfile.rating) {
    const firstPlayer = games.find((game) => game.white.username.toLowerCase() === profile.username.toLowerCase() || game.black.username.toLowerCase() === profile.username.toLowerCase());
    if (firstPlayer) resolvedProfile.rating = firstPlayer.white.username.toLowerCase() === profile.username.toLowerCase() ? firstPlayer.white.rating : firstPlayer.black.rating;
  }

  for (const game of games) {
    const analysis = await analyzeGame(game, profile.username, depth, (move, moves) => {
      onProgress(done, total, `Game ${done + 1}/${total} · analysing move ${move}/${moves}`);
    });
    if (analysis) analyzed.push(analysis);
    done += 1;
    onProgress(done, total, `Completed ${done} of ${total} games · verified engine review`);
  }

  if (!analyzed.length) throw new Error("No valid games could be analysed. Check the player name and PGN data.");
  return assembleReport(analyzed, resolvedProfile, timeClass, competitionDate, depth, source);
}

export { CP_INACCURACY, CP_MISTAKE };

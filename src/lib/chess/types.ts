export type TimeClass = "rapid" | "blitz" | "bullet" | "daily";
export type WeaknessKey =
  | "opening"
  | "timeTrouble"
  | "tactics"
  | "calculation"
  | "endgame"
  | "pawnStructure"
  | "hangingPieces";
export type Severity = "inaccuracy" | "mistake" | "blunder";
export type AnalysisSource = "chesscom" | "pgn";

export const WEAKNESS_META: Record<WeaknessKey, { label: string; blurb: string }> = {
  opening: {
    label: "Opening discipline",
    blurb: "Early losses in evaluation or repeated move-order problems that show up before move 12.",
  },
  timeTrouble: {
    label: "Time management",
    blurb: "Significant errors that occur while the remaining clock is under pressure for the selected time control.",
  },
  tactics: {
    label: "Tactical vision",
    blurb: "Engine-confirmed losses with a concrete tactical consequence or a missed forcing opportunity.",
  },
  calculation: {
    label: "Calculation",
    blurb: "Engine-confirmed losses without a concrete motif tag; candidate-move selection and deeper calculation deserve focused review.",
  },
  endgame: {
    label: "Endgame conversion",
    blurb: "Significant losses in simplified positions where technique, calculation, or defence decides the result.",
  },
  pawnStructure: {
    label: "Pawn structure",
    blurb: "Recurring structural concessions that coincide with measurable engine loss.",
  },
  hangingPieces: {
    label: "Hanging pieces",
    blurb: "A non-king piece is left attacked without enough practical defenders after the move.",
  },
};

export interface ChessComPlayer {
  username: string;
  rating?: number;
  result?: string;
  uuid?: string;
}

export interface IngestedGame {
  url: string;
  pgn: string;
  timeClass: string;
  endTime: number;
  eco?: string;
  rated?: boolean;
  white: ChessComPlayer;
  black: ChessComPlayer;
}

export interface PlayerProfile {
  username: string;
  name?: string;
  title?: string;
  avatar?: string;
  country?: string;
  rating?: number;
  competitionDate?: string;
}

export interface EngineLine {
  scoreCp: number;
  mate?: number;
  depth: number;
  bestMoveUci?: string;
  pv: string[];
  nodes?: number;
  timeMs?: number;
}

export interface TaggedMove {
  ply: number;
  moveNumber: number;
  san: string;
  playedMoveUci: string;
  fenBefore: string;
  fenAfter: string;
  color: "w" | "b";
  cpLoss: number;
  severity: Severity;
  tags: WeaknessKey[];
  clockSeconds?: number;
  relativeClock?: number;
  note: string;
  bestMoveUci?: string;
  bestMoveSan?: string;
  bestMoveScoreCp: number;
  playedMoveScoreCp: number;
  principalVariation: string[];
  engineDepth: number;
  quickDepth?: number;
  confirmedAtDepth?: number;
  classificationSource: "stockfish";
}

export interface GameAnalysis {
  game: IngestedGame;
  playerColor: "w" | "b";
  result: "win" | "loss" | "draw";
  averageCpl: number;
  playerMoves: number;
  tagged: TaggedMove[];
  openingEco?: string;
  openingName?: string;
  lowClockErrors: number;
  clockedPlayerMoves: number;
}

export interface WeaknessScore {
  key: WeaknessKey;
  count: number;
  share: number;
}

export interface DimensionScore {
  key: WeaknessKey;
  value: number;
}

export interface OpeningStat {
  family: string;
  name: string;
  eco?: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  scorePct: number;
  avgCpl: number;
}

export interface OpponentBand {
  label: "Stronger" | "Similar" | "Lower" | "Unknown";
  games: number;
  wins: number;
  draws: number;
  losses: number;
  scorePct: number;
}

export interface CompetitionTask {
  day: number;
  title: string;
  minutes: number;
  focus: WeaknessKey | "mixed";
  tasks: string[];
  issueIndices: number[];
}

export interface TrainingPlan {
  days: CompetitionTask[];
  dailyMinutes: number;
  headline: string;
  summary: string;
}

export interface CompetitionPrep {
  daysUntilCompetition?: number;
  countdownLabel: string;
  primaryFocuses: WeaknessKey[];
  openingFocus: string;
  lowClockRate: number;
  opponentBands: OpponentBand[];
  readinessActions: string[];
  simulationRecommendation: string;
  taperRecommendation: string;
}

export interface TaggedMoveWithGame extends TaggedMove {
  gameUrl: string;
  eco?: string;
  opponent: string;
  playerColor: "w" | "b";
  openingName?: string;
}

export interface AnalysisMeta {
  analysisVersion: string;
  source: AnalysisSource;
  sampleLabel: string;
  quickDepth: number;
  confirmDepth: number;
  deepChecks: number;
  verifiedIssues: number;
  verificationRate: number;
  quickMovesAnalyzed: number;
  deepMovesAnalyzed: number;
  engineHashMb: number;
  engineThreads: number;
  accuracyMethod: string;
  cplCapCp: number;
}

export interface AnalysisReport {
  id?: string;
  profile: PlayerProfile;
  source?: AnalysisSource;
  timeClass: TimeClass;
  gamesAnalyzed: number;
  totalPlayerMoves: number;
  whiteWinPct: number;
  blackWinPct: number;
  drawPct: number;
  overallAcpl: number;
  accuracy: number;
  wins: number;
  losses: number;
  draws: number;
  dimensions: DimensionScore[];
  topWeaknesses: WeaknessScore[];
  openings: OpeningStat[];
  opponentBands: OpponentBand[];
  games: GameAnalysis[];
  issues: TaggedMoveWithGame[];
  plan: TrainingPlan;
  competition: CompetitionPrep;
  engineVersion: string;
  engineDepth: number;
  analysisMeta?: AnalysisMeta;
  createdAt: number;
}

export const CP_INACCURACY = 50;
export const CP_MISTAKE = 100;
export const CP_BLUNDER = 300;
export const ENGINE_MATE_CP = 100000;

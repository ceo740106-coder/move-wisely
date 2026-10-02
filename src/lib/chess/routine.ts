import { WEAKNESS_META, type CompetitionPrep, type CompetitionTask, type OpponentBand, type OpeningStat, type TaggedMoveWithGame, type TimeClass, type WeaknessKey, type WeaknessScore, type TrainingPlan } from "./types";

const DRILLS: Record<WeaknessKey, string[]> = {
  tactics: [
    "Solve 5 positions from your own games without moving pieces first.",
    "For every position, list checks, captures, and threats before choosing a move.",
    "Replay missed tactics until you can find the idea in under 30 seconds.",
  ],
  calculation: [
    "Solve the position yourself first and name three candidate moves before checking the engine.",
    "Compare your candidate moves by checks, captures, threats, and the opponent's strongest reply.",
    "Repeat missed calculation positions later without the engine until the critical idea is found unaided.",
  ],
  hangingPieces: [
    "Replay the position and identify every attacked piece before calculating.",
    "Use a one-move blunder check: checks, captures, attacks, and loose pieces.",
    "Repeat the missed positions from memory later in the week.",
  ],
  opening: [
    "Write your intended move order for the opening positions you reached most often.",
    "Rehearse the first critical decision from your own games before looking at the engine line.",
    "Play a 10-minute opening-only practice game and stop after move 15 to self-review.",
  ],
  timeTrouble: [
    "Play one full time-control training game using a 10-second blunder-check rule.",
    "Review every significant error made below the time-pressure threshold.",
    "Practise spending 20–30 seconds on critical positions instead of moving automatically.",
  ],
  endgame: [
    "Take one of your own endgame positions and play it out against the engine.",
    "Review king activity, pawn races, passed pawns, and conversion decisions.",
    "Repeat the position from both sides and explain the defensive plan aloud.",
  ],
  pawnStructure: [
    "Mark every structural pawn move in your own games and identify what it weakened.",
    "Compare the engine recommendation before and after the structural concession.",
    "Practise choosing between a pawn break and a piece improvement in five positions.",
  ],
};

export function buildCompetitionPlan(top: WeaknessScore[], issues: TaggedMoveWithGame[], timeClass: TimeClass, days: number): TrainingPlan {
  const impact = new Map<WeaknessKey, number>();
  for (const issue of issues) {
    const severityWeight = issue.severity === "blunder" ? 1.35 : issue.severity === "mistake" ? 1.15 : 1;
    for (const tag of issue.tags) impact.set(tag, (impact.get(tag) ?? 0) + Math.min(issue.cpLoss, 500) * severityWeight);
  }
  const rankedByImpact = [...impact.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  const ranked = [...new Set([...rankedByImpact, ...top.filter((item) => item.count > 0).map((item) => item.key)])].slice(0, 3);
  const focus: WeaknessKey[] = [...ranked];
  for (const fallback of ["tactics", "calculation", "hangingPieces", "opening", "timeTrouble", "endgame", "pawnStructure"] as WeaknessKey[]) {
    if (focus.length >= 3) break;
    if (!focus.includes(fallback)) focus.push(fallback);
  }

  const totalDays = Math.max(1, Math.min(21, days));
  const tasks: CompetitionTask[] = [];
  for (let day = 1; day <= totalDays; day += 1) {
    const isSimulation = day % 5 === 0 || day === totalDays;
    const isTaper = totalDays - day <= 2;
    const focusKey = focus[(day - 1) % focus.length]!;
    const issueIndices = issues.map((issue, index) => ({ issue, index })).filter(({ issue }) => issue.tags.includes(focusKey)).slice(0, 4).map(({ index }) => index);
    let title = isSimulation ? "Competition simulation" : isTaper ? "Taper & sharpen" : `Repair: ${WEAKNESS_META[focusKey].label}`;
    let dayTasks = [...DRILLS[focusKey]];
    if (isSimulation) {
      title = "Competition simulation";
      dayTasks = [
        `Play one serious ${timeClass} game with the exact competition time control or closest available control.`,
        "Annotate the game from memory before checking the engine.",
        "Record one opening decision, one critical calculation, and one clock decision to review.",
      ];
    } else if (isTaper) {
      title = "Taper & sharpen";
      dayTasks = [
        "Review only your top three recurring mistakes from this report.",
        "Rehearse your main opening move orders without introducing new theory.",
        "Finish with 10 minutes of calm calculation and stop before fatigue sets in.",
      ];
    }
    tasks.push({ day, title, minutes: isSimulation ? 50 : isTaper ? 25 : 30, focus: isSimulation ? "mixed" : focusKey, tasks: dayTasks, issueIndices });
  }

  const dailyMinutes = Math.round(tasks.reduce((sum, task) => sum + task.minutes, 0) / tasks.length);
  return {
    days: tasks,
    dailyMinutes,
    headline: `${totalDays}-day competition plan`,
    summary: `The schedule is built from your engine-confirmed positions: repair the highest-impact weakness, rehearse the same decision in new contexts, simulate tournament conditions, then taper before competition day.`,
  };
}

export function buildCompetitionPrep(
  top: WeaknessScore[],
  openings: OpeningStat[],
  issues: TaggedMoveWithGame[],
  lowClockRate: number,
  opponentBands: OpponentBand[],
  competitionDate?: string,
): CompetitionPrep {
  const impact = new Map<WeaknessKey, number>();
  for (const issue of issues) for (const tag of issue.tags) impact.set(tag, (impact.get(tag) ?? 0) + Math.min(issue.cpLoss, 500));
  const impactKeys = [...impact.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  const primaryFocuses = impactKeys.length
    ? impactKeys.slice(0, 3)
    : top.filter((item) => item.count > 0).slice(0, 3).map((item) => item.key);
  const daysUntilCompetition = competitionDate
    ? Math.max(0, Math.ceil((new Date(`${competitionDate}T23:59:59`).getTime() - Date.now()) / 86400000))
    : undefined;
  const countdownLabel = daysUntilCompetition === undefined ? "No competition date set" : daysUntilCompetition === 0 ? "Competition day" : `${daysUntilCompetition} day${daysUntilCompetition === 1 ? "" : "s"} to competition`;
  const mostPlayedOpening = openings[0];
  const largestOpeningRisk = [...openings].filter((opening) => opening.games >= 2).sort((a, b) => b.avgCpl - a.avgCpl)[0];
  const strongerGames = opponentBands.find((band) => band.label === "Stronger");
  const topIssue = issues[0];

  const readinessActions = [
    primaryFocuses[0] ? `Repair ${WEAKNESS_META[primaryFocuses[0]].label.toLowerCase()} using your highest-cost positions first.` : "Start with the highest-cost engine-confirmed positions in the Mistake Lab.",
    largestOpeningRisk ? `Rehearse ${largestOpeningRisk.name}; its sample average is ${largestOpeningRisk.avgCpl} CPL across ${largestOpeningRisk.games} game${largestOpeningRisk.games === 1 ? "" : "s"}.` : mostPlayedOpening ? `Rehearse ${mostPlayedOpening.name}; it is the most frequent opening in this sample.` : "Build one repeatable opening plan for White and one for Black.",
    lowClockRate >= 0.2 ? "Schedule two serious time-control simulations and enforce a final 10-second blunder check." : "Schedule at least one serious time-control simulation and review the clock decisions afterward.",
  ];

  const simulationRecommendation = strongerGames && strongerGames.games >= 2
    ? "Include opponents or engine settings that are at least approximately your current rating; the report has enough stronger-opponent games to review the decision quality in that band."
    : "Before competition, complete two serious games without multitasking and annotate them before looking at the engine.";
  const taperRecommendation = daysUntilCompetition !== undefined && daysUntilCompetition <= 3
    ? "Do not add major new opening material. Review the top three recurring mistakes, one model line, and one calm calculation block each day."
    : topIssue
      ? `Keep ${topIssue.bestMoveSan ?? "the engine's preferred move"} and the surrounding position in your review queue; repeat it until the decision becomes familiar.`
      : "Keep the final preparation phase focused on familiar positions and competition rhythm.";

  return {
    daysUntilCompetition,
    countdownLabel,
    primaryFocuses,
    openingFocus: largestOpeningRisk?.name ?? mostPlayedOpening?.name ?? "Build an opening repertoire",
    lowClockRate,
    opponentBands,
    readinessActions,
    simulationRecommendation,
    taperRecommendation,
  };
}

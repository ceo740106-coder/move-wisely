# MoveWisely analysis methodology

MoveWisely uses Stockfish 19 lite single-threaded through the UCI protocol in a browser Web Worker. Every player move receives a quick engine evaluation; significant losses are rechecked at a deeper search before being surfaced as training issues.

## Move loss

The evaluator compares the engine's best line with the actual played move from the player's perspective. Large mate changes are normalized to a dedicated high centipawn sentinel so decisive mate losses are treated as blunders rather than ordinary score swings.

Current severity bands:

- Inaccuracy: 50–99 cp lost
- Mistake: 100–299 cp lost
- Blunder: 300+ cp lost

The per-move contribution used in the report aggregate is capped at 1000 cp to stop a single forced-mate outlier from dominating the entire sample.

## Accuracy

`MoveWisely Accuracy = 100 × exp(-averageCPL / 300)` with the result capped to 0–100. This is deliberately labeled as a MoveWisely metric and is not presented as Chess.com's proprietary CAPS2 score.

## Secondary classification

Secondary tags never override the engine loss used for severity. Concrete tactical tags require concrete evidence from the board state. A loss without a defensible concrete motif is classified as **Calculation** rather than automatically being called a tactic. Opening, endgame, pawn-structure, hanging-piece, and time-pressure tags are independent signals that can overlap on the same move.

## Time pressure

Clock pressure is normalized against the game's initial time control when PGN clock annotations are available. A fixed minimum threshold is retained for PGNs without a usable TimeControl tag so the feature remains useful rather than silently disappearing.

## Competition preparation

The preparation planner ranks weaknesses by cumulative engine impact, not only by raw occurrence count. It uses the player's own positions, opening recurrence, clock-pressure signals, opponent rating bands, competition countdown, simulation days, and a taper period to create the schedule.

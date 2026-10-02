# Chess-analysis correctness benchmark

MoveWisely uses Stockfish 19 lite single-threaded as its browser engine. The product should not claim a numeric correctness guarantee until it has been benchmarked against a fixed reference suite.

## Release gate

Before a national paid launch, maintain a private benchmark of at least 100 positions sampled across openings, middlegames, endgames, tactical positions and time-pressure situations.

For each position record:

- reference engine best move and score at a fixed reference depth or node budget
- MoveWisely best move and score at its production setting
- played move when testing real games
- expected classification, if a motif label is being evaluated

Track separately:

1. best-move agreement
2. sign-of-evaluation agreement
3. large-error classification precision/recall
4. motif-tag precision/recall
5. principal-variation legality
6. clock-pressure classification accuracy

Do not combine these into a single number until the benchmark methodology is fixed. A target of >90% should mean at least 90% on the declared metric and benchmark population.

## Why this gate exists

Stockfish is an engine, not a ground-truth oracle. Depth, time, hardware, position type and engine build can change results. The benchmark is therefore part of the product's quality system, not an optional demo test.

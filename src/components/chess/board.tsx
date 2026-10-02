import { Chess, SQUARES, type PieceSymbol, type Square } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PieceGlyph } from "./pieces";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PROMOTIONS: PieceSymbol[] = ["q", "r", "b", "n"];

export interface BoardArrow {
  from: Square;
  to: Square;
}

export function ChessBoard({
  fen,
  orientation = "w",
  lastMove,
  arrows = [],
  interactive = false,
  showCoordinates = true,
  showLegalMoves = true,
  showEvaluationBar = false,
  evaluationCp = 0,
  onMove,
}: {
  fen: string;
  orientation?: "w" | "b";
  lastMove?: { from: Square; to: Square };
  arrows?: BoardArrow[];
  interactive?: boolean;
  showCoordinates?: boolean;
  showLegalMoves?: boolean;
  showEvaluationBar?: boolean;
  evaluationCp?: number;
  onMove?: (from: Square, to: Square, promotion?: PieceSymbol) => boolean | Promise<boolean>;
}) {
  const chess = useMemo(() => {
    const game = new Chess();
    try { game.load(fen); } catch { return new Chess(); }
    return game;
  }, [fen]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [fen]);

  const legalTargets = useMemo(() => {
    if (!selected || !interactive) return [] as Square[];
    try { return chess.moves({ square: selected, verbose: true }).map((move) => move.to); } catch { return []; }
  }, [chess, interactive, selected]);

  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "w" ? FILES : [...FILES].reverse();
  const checkSquare = chess.isCheck() ? SQUARES.find((square) => {
    const piece = chess.get(square);
    return piece?.type === "k" && piece.color === chess.turn();
  }) : undefined;

  async function commitMove(from: Square, to: Square, promote?: PieceSymbol) {
    const accepted = await onMove?.(from, to, promote);
    if (accepted !== false) setSelected(null);
  }

  function chooseSquare(square: Square) {
    if (!interactive) return;
    if (selected && legalTargets.includes(square)) {
      const piece = chess.get(selected);
      const targetRank = Number(square[1]);
      if (piece?.type === "p" && (targetRank === 1 || targetRank === 8)) {
        setPromotion({ from: selected, to: square });
      } else {
        void commitMove(selected, square);
      }
      return;
    }
    const piece = chess.get(square);
    if (piece?.color === chess.turn()) setSelected(square);
    else setSelected(null);
  }

  function arrowPoints(arrow: BoardArrow) {
    const x = (files.indexOf(arrow.from[0]) + 0.5) * 12.5;
    const y = (ranks.indexOf(Number(arrow.from[1])) + 0.5) * 12.5;
    const x2 = (files.indexOf(arrow.to[0]) + 0.5) * 12.5;
    const y2 = (ranks.indexOf(Number(arrow.to[1])) + 0.5) * 12.5;
    return { x, y, x2, y2 };
  }

  const normalizedEvaluation = Math.max(-1000, Math.min(1000, Number.isFinite(evaluationCp) ? evaluationCp : 0));
  const whiteShare = 50 + (normalizedEvaluation / 20);
  const evaluationText = Math.abs(evaluationCp) >= 99_000 ? (evaluationCp >= 0 ? "+M" : "−M") : `${evaluationCp >= 0 ? "+" : "−"}${(Math.abs(evaluationCp) / 100).toFixed(2)}`;

  return (
    <div className={cn("relative mx-auto w-full", showEvaluationBar ? "grid grid-cols-[20px_minmax(0,1fr)] items-stretch gap-1.5" : "")}>
      {showEvaluationBar && (
        <div className="relative min-h-0 overflow-hidden rounded-[3px] bg-black shadow-sm ring-1 ring-black/15" aria-label={`Engine evaluation ${evaluationText}`}>
          <div className="absolute inset-x-0 top-0 rounded-t-[3px] bg-white" style={{ height: `${whiteShare}%` }}>
            <span className="absolute inset-x-0 top-1 text-center text-[8px] font-semibold leading-none text-black/70">{evaluationText}</span>
          </div>
        </div>
      )}
      <div className="board-shell relative aspect-square w-full overflow-hidden rounded-[var(--radius-md)] shadow-[0_18px_50px_rgb(0_0_0/0.2)] ring-1 ring-black/10">
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        {ranks.flatMap((rank) => files.map((file) => {
          const square = `${file}${rank}` as Square;
          const piece = chess.get(square);
          const dark = (file.charCodeAt(0) + rank) % 2 === 0;
          const isSelected = selected === square;
          const isLegal = legalTargets.includes(square);
          const isLast = !!lastMove && (lastMove.from === square || lastMove.to === square);
          const isCheck = checkSquare === square;
          const coordinateRank = file === files[0] ? String(rank) : "";
          const coordinateFile = rank === ranks[ranks.length - 1] ? file : "";
          return (
            <button
              key={square}
              type="button"
              draggable={interactive && !!piece && piece.color === chess.turn()}
              aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : " empty"}`}
              aria-pressed={isSelected}
              onClick={() => chooseSquare(square)}
              onDragStart={() => {
                if (interactive && piece?.color === chess.turn()) setSelected(square);
              }}
              onDragOver={(event) => { if (interactive && selected) event.preventDefault(); }}
              onDrop={(event) => {
                event.preventDefault();
                if (interactive && selected) chooseSquare(square);
              }}
              className={cn(
                "board-square relative flex min-w-0 items-center justify-center border-0 p-0 outline-none",
                dark ? "bg-board-dark" : "bg-board-light",
                interactive && "cursor-pointer hover:brightness-[1.02] focus-visible:z-40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
              )}
            >
              {isLast && <span className="pointer-events-none absolute inset-0 z-[1] bg-board-highlight/70" />}
              {isCheck && <span className="pointer-events-none absolute inset-[3%] z-[2] rounded-sm bg-board-check/75 shadow-[inset_0_0_18px_rgb(255_255_255/0.18)]" />}
              {isSelected && <span className="pointer-events-none absolute inset-0 z-[4] ring-4 ring-inset ring-primary/90" />}
              {piece && <PieceGlyph type={piece.type} color={piece.color} className="board-piece relative z-10 h-[93%] w-[93%]" />}
              {showLegalMoves && isLegal && !piece && <span className="absolute z-20 size-[20%] rounded-full bg-black/25" />}
              {showLegalMoves && isLegal && piece && <span className="absolute z-20 inset-[5%] rounded-sm border-4 border-primary/70" />}
              {showCoordinates && coordinateRank && <span className={cn("absolute bottom-[3%] left-[4%] z-30 text-[clamp(8px,1.8vw,13px)] font-semibold leading-none", dark ? "text-board-light/90" : "text-board-dark/90")}>{coordinateRank}</span>}
              {showCoordinates && coordinateFile && <span className={cn("absolute bottom-[3%] right-[4%] z-30 text-[clamp(8px,1.8vw,13px)] font-semibold leading-none", dark ? "text-board-light/90" : "text-board-dark/90")}>{coordinateFile}</span>}
            </button>
          );
        }))}
      </div>
      {arrows.length > 0 && (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 z-[25] h-full w-full">
          <defs><marker id="mw-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.3" markerHeight="3.3" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--mw-accent)" /></marker></defs>
          {arrows.map((arrow, index) => {
            const p = arrowPoints(arrow);
            return <line key={`${arrow.from}-${arrow.to}-${index}`} x1={p.x} y1={p.y} x2={p.x2} y2={p.y2} stroke="var(--mw-accent)" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" markerEnd="url(#mw-arrow)" />;
          })}
        </svg>
      )}
      {promotion && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Choose promotion piece">
          <div className="w-full max-w-64 rounded-[var(--radius-lg)] border border-border bg-surface p-3 shadow-2xl">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Choose promotion</p>
            <div className="grid grid-cols-4 gap-2">
              {PROMOTIONS.map((type) => (
                <button key={type} type="button" className="grid aspect-square place-items-center rounded-[var(--radius-sm)] border border-border bg-surface-2 hover:border-primary" onClick={() => { const pending = promotion; setPromotion(null); void commitMove(pending.from, pending.to, type); }}>
                  <PieceGlyph type={type} color={chess.turn()} className="size-10" />
                </button>
              ))}
            </div>
            <button type="button" className="mt-2 w-full rounded-[var(--radius-sm)] px-3 py-2 text-xs text-muted hover:bg-surface-2 hover:text-fg" onClick={() => setPromotion(null)}>Cancel</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export function fenSquares(_fen: string) { return SQUARES; }

import type { PieceSymbol } from "chess.js";

export function PieceGlyph({
  type,
  color,
  className,
}: {
  type: PieceSymbol;
  color: "w" | "b";
  className?: string;
}) {
  const fill = color === "w" ? "var(--color-fg)" : "var(--color-bg)";
  const stroke = color === "w" ? "var(--color-bg)" : "var(--color-board-light)";
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden>
      {type === "k" && (
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.5 11.63V6M20 8h5" fill="none" />
          <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="none" />
          <path d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7" />
        </g>
      )}
      {type === "q" && (
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round">
          <circle cx="6" cy="12" r="2" />
          <circle cx="14" cy="9" r="2" />
          <circle cx="22.5" cy="8" r="2" />
          <circle cx="31" cy="9" r="2" />
          <circle cx="39" cy="12" r="2" />
          <path d="M9 26c8.5-9 18.5-9 27 0l-3 11H12z" />
          <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5H35s0-1.5-1.5-2.5c-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4" fill="none" />
        </g>
      )}
      {type === "r" && (
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 39h27v-3H9zM12 36v-4h21v4M11 14V9h4v2h5V9h5v2h5V9h4v5" />
          <path d="M34 14l-3 3H14l-3-3" />
          <path d="M31 17v12.5H14V17" />
          <path d="M31 29.5L32.5 32H12.5L14 29.5" />
        </g>
      )}
      {type === "b" && (
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <g fill="none">
            <path d="M9 36c3.4-1 10.2-1.8 13.5-2 3.3.2 10.1 1 13.5 2 0 0 1.65.5 1.5 2-.15 1.5-1.5 1.5-1.5 1.5H9s-1.35 0-1.5-1.5C7.35 36.5 9 36 9 36z" />
            <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
            <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
          </g>
          <path d="M17.5 26h10M15 30h15M22.5 15.5l-3 8 3-2 3 2z" />
        </g>
      )}
      {type === "n" && (
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
          <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" />
        </g>
      )}
      {type === "p" && (
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round">
          <path d="M22.5 9a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
          <path d="M22.5 17c3 0 7 2 7 6.5 0 2.5-1.5 4-4 5.5H19.5c-2.5-1.5-4-3-4-5.5 0-4.5 4-6.5 7-6.5z" />
          <path d="M11.5 37.5h22v-4s-3-2-5-3.5h-12c-2 1.5-5 3.5-5 3.5z" />
        </g>
      )}
    </svg>
  );
}

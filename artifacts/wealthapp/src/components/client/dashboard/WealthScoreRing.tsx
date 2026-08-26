import { useEffect, useRef } from "react";

interface Props {
  score: number;
}

const SIZE = 80;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

/**
 * Small self-contained ring just for the wealth score card — deliberately not
 * shared with components/shared/HealthScoreRing.tsx, which the free tier's
 * page also depends on.
 */
export default function WealthScoreRing({ score }: Props) {
  const clamped = Math.min(100, Math.max(0, score));
  const offset = CIRC - (clamped / 100) * CIRC;
  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.strokeDashoffset = String(CIRC);
    const raf = requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 800ms ease-out";
      el.style.strokeDashoffset = String(offset);
    });
    return () => cancelAnimationFrame(raf);
    // Animate once on mount only — intentionally not depending on `offset`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--hairline)" strokeWidth={STROKE} />
        <circle
          ref={circleRef}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--green)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[22px] font-bold leading-none text-green">{Math.round(clamped)}</span>
        <span className="text-[10px] font-semibold text-ink-30 mt-0.5">/100</span>
      </div>
    </div>
  );
}

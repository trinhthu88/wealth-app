import { useEffect, useRef } from "react";

interface Props {
  score: number;
  size?: number;
}

const STROKE = 6;

/**
 * Small self-contained ring just for the wealth score card — deliberately not
 * shared with components/shared/HealthScoreRing.tsx, which the free tier's
 * page also depends on.
 */
export default function WealthScoreRing({ score, size = 72 }: Props) {
  const radius = (size - STROKE) / 2;
  const circ = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circ - (clamped / 100) * circ;
  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.strokeDashoffset = String(circ);
    const raf = requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 800ms ease-out";
      el.style.strokeDashoffset = String(offset);
    });
    return () => cancelAnimationFrame(raf);
    // Animate once on mount only — intentionally not depending on `offset`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const numSize = size >= 90 ? 22 : 18;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--hairline)" strokeWidth={STROKE} />
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--green)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold leading-none text-green" style={{ fontSize: numSize }}>{Math.round(clamped)}</span>
        <span className="text-[10px] font-semibold text-ink-30 mt-0.5">/100</span>
      </div>
    </div>
  );
}

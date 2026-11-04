import { useEffect, useRef } from "react";

interface Props {
  score: number;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  darkMode?: boolean;
}

// lg matches the free Health score hero (132px ring, 12px stroke).
const SIZES = { sm: 56, md: 100, lg: 132 };
const STROKE = { sm: 5, md: 8, lg: 12 };
// Fraunces light (font-display + tabular-nums forces weight 300).
const NUM_SIZE = { sm: "text-[18px]", md: "text-[30px]", lg: "text-[52px]" };

export default function HealthScoreRing({ score, size = "md", animate = true, darkMode = false }: Props) {
  const px = SIZES[size];
  const stroke = STROKE[size];
  const r = (px - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circ - (clamped / 100) * circ;

  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!animate || !circleRef.current) return;
    circleRef.current.style.strokeDashoffset = String(circ);
    const timeout = setTimeout(() => {
      if (circleRef.current) {
        circleRef.current.style.transition = "stroke-dashoffset 0.8s ease-out";
        circleRef.current.style.strokeDashoffset = String(offset);
      }
    }, 80);
    return () => clearTimeout(timeout);
  }, [score, animate, circ, offset]);

  // Light surfaces: Cobalt ring on the soft track, Sunset Pop only when the
  // score needs attention. On a Cobalt hero card (darkMode) the ring is always
  // Spring Field on a translucent white track, as in the approved design.
  const needsAttention = !darkMode && clamped > 0 && clamped < 40;
  const color = darkMode ? "var(--field)" : needsAttention ? "var(--sun)" : "var(--forest)";
  const trackColor = darkMode ? "rgba(255, 255, 255, 0.16)" : "var(--track)";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: px, height: px }}
      role="img"
      aria-label={`Health score: ${Math.round(clamped)} out of 100`}
    >
      <svg width={px} height={px} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          ref={circleRef}
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={animate ? circ : offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span
          className={`font-display tabular-nums leading-none tracking-[-0.05em] ${NUM_SIZE[size]} ${darkMode ? "text-paper" : "text-forest"}`}
        >
          {Math.round(clamped)}
        </span>
      </div>
    </div>
  );
}

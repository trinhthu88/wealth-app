import { useEffect, useRef } from "react";

interface Props {
  score: number;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  darkMode?: boolean;
}

const SIZES = { sm: 56, md: 100, lg: 160 };
const STROKE = { sm: 5, md: 8, lg: 12 };

export default function HealthScoreRing({ score, size = "md", animate = true, darkMode = false }: Props) {
  const px = SIZES[size];
  const stroke = STROKE[size];
  const r = (px - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, score)) / 100) * circ;

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

  // Token colors (index.css): green #1D9E75, sun #FFB627, clay #E8663D —
  // matches the same 3-tier scale used elsewhere for score/status coloring.
  const color = darkMode ? "white"
    : score >= 70 ? "var(--green)"
    : score >= 40 ? "var(--sun)"
    : "var(--clay)";

  const trackColor = darkMode ? "rgba(255,255,255,0.2)" : "var(--track)";

  const fontSize = { sm: "text-xs", md: "text-base", lg: "text-2xl" }[size];

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: px, height: px }}
      role="img"
      aria-label={`Health score: ${Math.round(score)} out of 100`}
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
          style={!animate ? {} : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className={`font-bold ${fontSize}`} style={{ color: darkMode ? "white" : color }}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}

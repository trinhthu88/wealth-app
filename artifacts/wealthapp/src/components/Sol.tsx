import { cn } from "@/lib/utils";

type SolSize = "xs" | "sm" | "md" | "lg" | "xl";
type SolAnimate = "none" | "idle" | "breathe" | "spin" | "pulse" | "float";

interface SolProps {
  size?: SolSize;
  animate?: SolAnimate;
  showFace?: boolean;
  showRays?: boolean;
  className?: string;
  fill?: string;       // Default var(--sun)
  rayStroke?: string;  // Default var(--sun-deep)
  faceFill?: string;   // Default var(--sun-ink)
  bodyStroke?: string; // Default #E8963D (clay-like from spec)
}

const SIZES: Record<SolSize, number> = {
  xs: 24,
  sm: 34,
  md: 64,
  lg: 108,
  xl: 160,
};

export default function Sol({
  size = "md",
  animate = "idle",
  showFace = true,
  showRays = true,
  className,
  fill = "var(--sun)",
  rayStroke = "var(--sun-deep)",
  faceFill = "var(--sun-ink)",
  bodyStroke = "#E8963D"
}: SolProps) {
  const px = SIZES[size];
  const scale = px / 64; // The reference SVG is 64x64

  const isAnimated = animate !== "none";
  const breatheClass = animate === "breathe" || animate === "idle" || animate === "float" ? "animate-sol-breathe" : "";
  const spinClass = isAnimated ? "animate-sol-spin" : "";
  const blinkClass = isAnimated && showFace ? "animate-sol-blink" : "";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center flex-none", breatheClass, className)}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 64 64"
        style={{ width: px, height: px, overflow: "visible" }}
        aria-hidden="true"
      >
        {/* Rays */}
        {showRays && (
          <g className={spinClass} style={{ transformOrigin: "32px 32px" }}>
            <g stroke={rayStroke} strokeWidth="3" strokeLinecap="round">
              <line x1="32" y1="2" x2="32" y2="9"></line>
              <line x1="32" y1="55" x2="32" y2="62"></line>
              <line x1="2" y1="32" x2="9" y2="32"></line>
              <line x1="55" y1="32" x2="62" y2="32"></line>
              <line x1="11" y1="11" x2="16" y2="16"></line>
              <line x1="48" y1="48" x2="53" y2="53"></line>
              <line x1="53" y1="11" x2="48" y2="16"></line>
              <line x1="16" y1="48" x2="11" y2="53"></line>
            </g>
          </g>
        )}

        {/* Core circle */}
        <circle cx="32" cy="32" r="21" fill={fill}></circle>
        <circle cx="32" cy="32" r="21" fill="none" stroke={bodyStroke} strokeWidth="1.5"></circle>

        {/* Face */}
        {showFace && (
          <>
            <g className={blinkClass} style={{ transformOrigin: "32px 29px" }}>
              <circle cx="25" cy="29" r="2.6" fill={faceFill}></circle>
              <circle cx="39" cy="29" r="2.6" fill={faceFill}></circle>
            </g>
            <path
              d="M25 37.5 Q32 43 39 37.5"
              fill="none"
              stroke={faceFill}
              strokeWidth="2.4"
              strokeLinecap="round"
            ></path>
          </>
        )}
      </svg>
    </div>
  );
}

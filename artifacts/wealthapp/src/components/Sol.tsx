import { cn } from "@/lib/utils";

type SolSize = "xs" | "sm" | "md" | "lg" | "xl";
type SolAnimate = "none" | "idle" | "breathe" | "spin" | "pulse" | "float";

interface SolProps {
  size?: SolSize;
  animate?: SolAnimate;
  showFace?: boolean;
  /** Shows the soft scalloped halo around Sol (the "rays" of the earlier mark). */
  showRays?: boolean;
  className?: string;
  fill?: string;       // Body. Default var(--sun) — Sunset Pop
  rayStroke?: string;  // Halo. Default #FFC98F — a light Sunset tint
  faceFill?: string;   // Eyes and smile. Default var(--forest) — Cobalt Pulse
  bodyStroke?: string; // Optional outline; none by default (flat style)
}

const SIZES: Record<SolSize, number> = {
  xs: 24,
  sm: 34,
  md: 64,
  lg: 108,
  xl: 160,
};

// Eight soft lobes on a circle of radius 25 around the centre (32, 32).
const HALO_LOBES = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4;
  return { cx: 32 + 25 * Math.cos(angle), cy: 32 + 25 * Math.sin(angle) };
});

/**
 * Sol — tala's money buddy. Flat, calm style: a scalloped sun halo, a warm
 * round body with no outline, and a content closed-eye face.
 */
export default function Sol({
  size = "md",
  animate = "idle",
  showFace = true,
  showRays = true,
  className,
  fill = "var(--sun)",
  rayStroke = "#FFC98F",
  faceFill = "var(--forest)",
  bodyStroke,
}: SolProps) {
  const px = SIZES[size];
  const isAnimated = animate !== "none";
  const breatheClass = animate === "breathe" || animate === "idle" || animate === "float" ? "animate-sol-breathe" : "";
  const blinkClass = isAnimated && showFace ? "animate-sol-blink" : "";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center flex-none", breatheClass, className)}
      style={{ width: px, height: px }}
    >
      <svg viewBox="0 0 64 64" style={{ width: px, height: px, overflow: "visible" }} aria-hidden="true">
        {showRays && (
          <g fill={rayStroke}>
            {HALO_LOBES.map((lobe, i) => (
              <circle key={i} cx={lobe.cx} cy={lobe.cy} r="7" />
            ))}
            <circle cx="32" cy="32" r="25" />
          </g>
        )}

        <circle cx="32" cy="33" r="20" fill={fill} stroke={bodyStroke} strokeWidth={bodyStroke ? 1.5 : undefined} />

        {showFace && (
          <>
            <g
              className={blinkClass}
              style={{ transformOrigin: "32px 33px" }}
              fill="none"
              stroke={faceFill}
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M22.5 32.5 q3 2.8 6 0" />
              <path d="M35.5 32.5 q3 2.8 6 0" />
            </g>
            <path d="M28.5 39 q3.5 2.6 7 0" fill="none" stroke={faceFill} strokeWidth="2.4" strokeLinecap="round" />
            <ellipse cx="21" cy="37.5" rx="2.6" ry="1.6" fill="#FFC2A8" opacity="0.55" />
            <ellipse cx="43" cy="37.5" rx="2.6" ry="1.6" fill="#FFC2A8" opacity="0.55" />
          </>
        )}
      </svg>
    </div>
  );
}

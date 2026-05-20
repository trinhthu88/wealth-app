import { motion } from "framer-motion";

type SolSize = "xs" | "sm" | "md" | "lg" | "xl";
type SolAnimate = "none" | "idle" | "float" | "pulse";

interface SolProps {
  size?: SolSize;
  animate?: SolAnimate;
  showFace?: boolean;
  className?: string;
}

const SIZES: Record<SolSize, number> = {
  xs: 28,
  sm: 44,
  md: 72,
  lg: 108,
  xl: 160,
};

const floatVariants = {
  animate: {
    y: [0, -10, 0],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
};

const idleVariants = {
  animate: {
    scale: [1, 1.04, 1],
    transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
  },
};

const rayPulseVariants = {
  animate: {
    scale: [1, 1.18, 1],
    opacity: [0.7, 1, 0.7],
    transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
  },
};

const corePulseVariants = {
  animate: {
    scale: [1, 1.06, 1],
    transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 },
  },
};

export default function Sol({ size = "md", animate = "float", showFace = true, className }: SolProps) {
  const px = SIZES[size];
  const vb = 100;
  const cx = 50;
  const cy = 50;
  const r = 22;
  const rayLen1 = 8;
  const rayLen2 = 18;

  const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const x1 = cx + Math.cos(rad) * (r + 4);
    const y1 = cy + Math.sin(rad) * (r + 4);
    const x2 = cx + Math.cos(rad) * (r + 4 + (deg % 90 === 0 ? rayLen2 : rayLen1));
    const y2 = cy + Math.sin(rad) * (r + 4 + (deg % 90 === 0 ? rayLen2 : rayLen1));
    return { x1, y1, x2, y2 };
  });

  const wrapperMotion =
    animate === "float" ? floatVariants :
    animate === "idle" ? idleVariants :
    {};

  const rayMotion = animate === "pulse" ? rayPulseVariants : {};
  const coreMotion = animate === "pulse" ? corePulseVariants : {};

  return (
    <motion.div
      className={className}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      variants={wrapperMotion}
      animate={animate !== "none" && animate !== "pulse" ? "animate" : undefined}
    >
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${vb} ${vb}`}
        fill="none"
        aria-hidden="true"
      >
        {/* Rays */}
        <motion.g
          stroke="hsl(var(--primary))"
          strokeWidth="5.5"
          strokeLinecap="round"
          variants={rayMotion}
          animate={animate === "pulse" ? "animate" : undefined}
          style={{ originX: "50px", originY: "50px" }}
        >
          {rays.map((r, i) => (
            <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
          ))}
        </motion.g>

        {/* Core circle */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="hsl(var(--primary))"
          variants={coreMotion}
          animate={animate === "pulse" ? "animate" : undefined}
          style={{ originX: "50px", originY: "50px" }}
        />

        {/* Face */}
        {showFace && (
          <>
            <circle cx="42" cy="47" r="2.8" fill="white" />
            <circle cx="58" cy="47" r="2.8" fill="white" />
            <path
              d="M41 57 Q50 64 59 57"
              stroke="white"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </motion.div>
  );
}

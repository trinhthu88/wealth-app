import { cn } from "@/lib/utils";

const PHASE_LABELS = ["Who you are", "Your investments", "Your plan"];
const PHASE_SCREEN_RANGES = [[1, 2], [3, 5], [6, 8]];

function phaseOf(screen: number): number {
  for (let i = 0; i < PHASE_SCREEN_RANGES.length; i++) {
    const [start, end] = PHASE_SCREEN_RANGES[i];
    if (screen >= start && screen <= end) return i + 1;
  }
  return 1;
}

interface OnboardingShellProps {
  currentScreen: number;
  totalScreens: number;
  children: React.ReactNode;
  nav: React.ReactNode;
}

function SolLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="22" fill="#1D9E75" />
      <g stroke="#1D9E75" strokeWidth="6" strokeLinecap="round">
        <line x1="50" y1="6" x2="50" y2="18" />
        <line x1="50" y1="82" x2="50" y2="94" />
        <line x1="6" y1="50" x2="18" y2="50" />
        <line x1="82" y1="50" x2="94" y2="50" />
        <line x1="20" y1="20" x2="28" y2="28" />
        <line x1="72" y1="72" x2="80" y2="80" />
        <line x1="80" y1="20" x2="72" y2="28" />
        <line x1="28" y1="72" x2="20" y2="80" />
      </g>
    </svg>
  );
}

export default function OnboardingShell({ currentScreen, totalScreens, children, nav }: OnboardingShellProps) {
  const phase = phaseOf(currentScreen);
  const progressPct = (currentScreen / totalScreens) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shrink-0">
        <div className="max-w-[560px] mx-auto px-5">
          {/* Top row: logo + screen counter */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2.5">
              <SolLogo />
              <span className="font-bold text-[#042C53] text-lg leading-none">tala</span>
            </div>
            <span className="text-xs font-medium text-slate-400 font-mono">
              {currentScreen} of {totalScreens}
            </span>
          </div>

          {/* Phase dots + label */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((p) => (
                <div
                  key={p}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    p < phase && "bg-[#1D9E75]",
                    p === phase && "bg-[#1D9E75] ring-2 ring-[#1D9E75]/30 ring-offset-1",
                    p > phase && "bg-slate-200"
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-slate-500">
              Phase {phase} of 3 — {PHASE_LABELS[phase - 1]}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-slate-100 rounded-full mb-0 overflow-hidden">
            <div
              className="h-full bg-[#1D9E75] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[560px] mx-auto px-5 py-8">
          {children}
        </div>
      </div>

      {/* Sticky nav */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 shrink-0">
        <div className="max-w-[560px] mx-auto px-5 py-4">
          {nav}
        </div>
      </div>
    </div>
  );
}

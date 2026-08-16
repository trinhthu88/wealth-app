import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingNavProps {
  onBack?: () => void;
  onContinue: () => void;
  onSkip?: () => void;
  canContinue?: boolean;
  isLoading?: boolean;
  showSkip?: boolean;
  continueLabel?: string;
  showBack?: boolean;
}

export default function OnboardingNav({
  onBack,
  onContinue,
  onSkip,
  canContinue = true,
  isLoading = false,
  showSkip = false,
  continueLabel = "Continue",
  showBack = true,
}: OnboardingNavProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Back */}
      {showBack && onBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <div className="w-[76px]" />
      )}

      {/* Skip */}
      {showSkip && onSkip && (
        <button
          onClick={onSkip}
          className="flex-1 text-center text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
        >
          Skip
        </button>
      )}

      {/* Continue */}
      <button
        onClick={onContinue}
        disabled={!canContinue || isLoading}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
          canContinue && !isLoading
            ? "bg-[#1D9E75] text-white hover:bg-[#0F6E56]"
            : "bg-slate-100 text-slate-400 cursor-not-allowed"
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            {continueLabel}
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}

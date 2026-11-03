import { Loader2 } from "lucide-react";
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
  continueTestId?: string;
}

export default function OnboardingNav({
  onBack,
  onContinue,
  onSkip,
  canContinue = true,
  isLoading = false,
  showSkip = false,
  continueLabel = "Next",
  showBack = true,
  continueTestId = "button-onboarding-continue",
}: OnboardingNavProps) {
  return (
    <div className="flex gap-3">
      {showBack && onBack && (
        <button
          onClick={onBack}
          type="button"
          data-testid="button-onboarding-back"
          className="h-12 min-w-[88px] px-5 border-[1.5px] border-forest rounded-full bg-transparent text-forest font-sans text-[15px] font-semibold cursor-pointer hover:bg-surface transition-colors"
        >
          Back
        </button>
      )}

      {showSkip && onSkip && (
        <button
          onClick={onSkip}
          type="button"
          data-testid="button-onboarding-skip"
          className="h-12 px-5 border-[1.5px] border-hairline-2 rounded-full bg-transparent text-ink-40 font-sans text-[15px] font-semibold cursor-pointer hover:bg-surface transition-colors"
        >
          Skip
        </button>
      )}

      <button
        type="button"
        onClick={onContinue}
        data-testid={continueTestId}
        disabled={!canContinue || isLoading}
        className={cn(
          "h-12 flex-1 px-5 border-none rounded-full font-sans text-[15px] font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2",
          canContinue && !isLoading
            ? "bg-forest text-paper hover:bg-forest-700"
            : "bg-surface text-ink-40 cursor-not-allowed"
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          continueLabel
        )}
      </button>
    </div>
  );
}

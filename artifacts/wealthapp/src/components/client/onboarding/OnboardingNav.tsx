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
          className="min-h-[48px] min-w-[80px] border border-[#E3E9FD] rounded-[16px] bg-white text-[#0C21A4] font-sans text-sm font-semibold cursor-pointer hover:bg-[#F1F4FE] transition-colors"
        >
          Back
        </button>
      )}

      {showSkip && onSkip && (
        <button
          onClick={onSkip}
          type="button"
          data-testid="button-onboarding-skip"
          className="min-h-[48px] px-4 border border-[#E3E9FD] rounded-[16px] bg-white text-[#4A5590] font-sans text-sm font-semibold cursor-pointer hover:bg-[#F1F4FE] transition-colors"
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
          "min-h-[48px] flex-1 border-none rounded-[16px] font-sans text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2",
          canContinue && !isLoading
            ? "bg-[#0C21A4] text-white hover:bg-[#1A30B8]"
            : "bg-[#E3E9FD] text-[#8F98C8] cursor-not-allowed"
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

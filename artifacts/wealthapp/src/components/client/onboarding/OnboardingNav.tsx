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
          className="min-h-[48px] min-w-[80px] border border-[#E6E1D8] rounded-[16px] bg-white text-[#042C53] font-sans text-sm font-semibold cursor-pointer hover:bg-[#F2EFE9] transition-colors"
        >
          Back
        </button>
      )}

      {showSkip && onSkip && (
        <button
          onClick={onSkip}
          type="button"
          data-testid="button-onboarding-skip"
          className="min-h-[48px] px-4 border border-[#E6E1D8] rounded-[16px] bg-white text-[#6B6459] font-sans text-sm font-semibold cursor-pointer hover:bg-[#F2EFE9] transition-colors"
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
            ? "bg-[#1D9E75] text-white hover:bg-[#17805F]"
            : "bg-[#E6E1D8] text-[#A8A095] cursor-not-allowed"
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

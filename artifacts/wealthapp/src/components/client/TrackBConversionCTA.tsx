import { Sparkles, X } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useClientTrack } from "@/hooks/useClientTrack";
import { formatCurrency } from "@/lib/currencyUtils";
import { cn } from "@/lib/utils";

type CTAContext = "dashboard" | "goals" | "budget" | "scenarios" | "networth";

interface TrackBConversionCTAProps {
  context: CTAContext;
  relevantValue?: number;
  relevantGoal?: string;
  className?: string;
}

const PROJECTED_10Y = (monthly: number) =>
  Math.round(monthly * 12 * ((Math.pow(1.08, 10) - 1) / 0.08));

function getCopy(context: CTAContext, relevantValue?: number, relevantGoal?: string): { body: string; cta: string } {
  switch (context) {
    case "dashboard":
      return {
        body: "Professional investment management could accelerate your returns.",
        cta: "Talk to an advisor →",
      };
    case "goals":
      return {
        body: relevantGoal
          ? `An advised investment plan could help you reach "${relevantGoal}" faster.`
          : "An advised investment plan could help you reach your goals faster.",
        cta: "See how →",
      };
    case "budget": {
      const surplus = relevantValue ?? 0;
      const projected = PROJECTED_10Y(surplus);
      return {
        body: surplus > 0
          ? `You have ${formatCurrency(surplus, "USD", true)} monthly surplus. A regular savings plan could turn this into ${formatCurrency(projected, "USD", true)} over 10 years.`
          : "A regular savings plan could significantly grow your wealth over time.",
        cta: "Run the numbers →",
      };
    }
    case "scenarios":
      return {
        body: "These projections assume market returns. Advised plans have historically delivered higher net returns.",
        cta: "Book a free review →",
      };
    case "networth":
      return {
        body: "Structured investment planning typically accelerates net worth growth 2–3×.",
        cta: "Learn more →",
      };
  }
}

export default function TrackBConversionCTA({ context, relevantValue, relevantGoal, className }: TrackBConversionCTAProps) {
  const { isTrackB, loading } = useClientTrack();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(`cta_dismissed_${context}`) === "1";
  });

  if (loading || !isTrackB || dismissed) return null;

  const { body, cta } = getCopy(context, relevantValue, relevantGoal);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(`cta_dismissed_${context}`, "1");
  }

  return (
    <div className={cn(
      "relative flex items-start gap-3 p-4 pr-12 rounded-[24px] bg-breeze",
      className
    )}>
      <Sparkles className="h-4 w-4 text-forest shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-forest leading-snug">
          {body}{" "}
          <Link href="/client/advisor/messages" className="text-forest font-semibold underline underline-offset-4">
            {cta}
          </Link>
        </p>
      </div>
      <button
        onClick={dismiss}
        className="absolute right-1 top-1 h-11 w-11 flex items-center justify-center text-forest rounded-full hover:bg-forest/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

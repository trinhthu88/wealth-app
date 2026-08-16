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
      "flex items-start gap-3 p-3 rounded-xl bg-teal-50 border-l-4 border-[#1D9E75]",
      className
    )}>
      <Sparkles className="h-4 w-4 text-[#1D9E75] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-slate-700 leading-snug">
          {body}{" "}
          <Link href="/client/messages" className="text-[#1D9E75] font-medium hover:underline">
            {cta}
          </Link>
        </p>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 h-5 w-5 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

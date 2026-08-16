import { useState } from "react";
import { Link } from "wouter";
import { Sparkles, X } from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";
import type { DashboardGoal } from "@/hooks/useDashboardData";

interface Props {
  totalPortfolioValue: number;
  overallCagr: number | null;
  topGoals: DashboardGoal[];
  displayCurrency: string;
}

function buildCopy(totalPortfolioValue: number, overallCagr: number | null, topGoals: DashboardGoal[], currency: string): { body: string; cta: string } {
  if (totalPortfolioValue > 50000 && overallCagr !== null) {
    return {
      body: `Your portfolio of ${formatCurrency(totalPortfolioValue, currency, true)} is growing. Professional investment management typically targets higher net returns.`,
      cta: "Talk to an advisor →",
    };
  }
  const offTrackGoal = topGoals.find(g => g.status === "off_track");
  if (offTrackGoal) {
    return {
      body: `You're behind on your "${offTrackGoal.title}" goal. An advised investment plan could help you close the gap.`,
      cta: "See how →",
    };
  }
  return {
    body: "Professional investment advice could accelerate your financial goals. Book a free 30-minute call — no obligation.",
    cta: "Talk to an advisor →",
  };
}

export default function ConversionCTASection({ totalPortfolioValue, overallCagr, topGoals, displayCurrency }: Props) {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem("cta_dismissed_dashboard") === "1"
  );

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("cta_dismissed_dashboard", "1");
  }

  const { body, cta } = buildCopy(totalPortfolioValue, overallCagr, topGoals, displayCurrency);

  return (
    <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-100 border-l-4 border-l-[#1D9E75] rounded-xl">
      <Sparkles className="h-4 w-4 text-[#1D9E75] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#042C53] leading-snug">
          {body}{" "}
          <Link href="/client/messages">
            <span className="text-[#1D9E75] font-semibold hover:text-[#0F6E56] cursor-pointer">{cta}</span>
          </Link>
        </p>
      </div>
      <button onClick={handleDismiss} aria-label="Dismiss" className="text-[#64748B] hover:text-[#042C53] shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

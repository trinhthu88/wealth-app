import { motion } from "framer-motion";
import { CheckCircle2, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/currencyUtils";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";

interface Props {
  isTrackA: boolean;
  advisedPlans: AdvisedPlan[];
  totalPortfolioValue: number;
  goalName: string;
  savingsRate: number;
  preferredCurrency: string;
  advisorName?: string;
  onComplete: () => void;
  isLoading: boolean;
}

export default function Phase3Screen8Complete({
  isTrackA, advisedPlans, totalPortfolioValue, goalName, savingsRate, preferredCurrency, advisorName, onComplete, isLoading,
}: Props) {
  const [ctaDismissed, setCtaDismissed] = useState(() => localStorage.getItem("onboarding_cta_dismissed") === "1");

  function dismissCta() {
    setCtaDismissed(true);
    localStorage.setItem("onboarding_cta_dismissed", "1");
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        {/* Animated checkmark — single entrance animation allowed */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 200 }}
          className="flex justify-center"
        >
          <div className="h-16 w-16 rounded-full bg-[#1D9E75]/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-[#1D9E75]" />
          </div>
        </motion.div>

        <div>
          <h1 className="text-2xl font-bold text-[#042C53]">
            {isTrackA ? "You're all set! 🎉" : "Your tracker is ready! 🎉"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isTrackA
              ? "Your investment portal is live. Here's your summary."
              : "Your financial tracker is live. Add more investments and track your progress over time."}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Portfolio value</p>
          <p className="text-base font-bold text-[#042C53] leading-tight">
            {totalPortfolioValue > 0 ? formatCurrency(totalPortfolioValue, preferredCurrency, true) : "—"}
          </p>
        </div>
        <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Your goal</p>
          <p className="text-base font-bold text-[#042C53] leading-tight truncate w-full text-center">
            {goalName || "—"}
          </p>
        </div>
        <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Savings rate</p>
          <p className="text-base font-bold text-[#042C53] leading-tight">
            {savingsRate > 0 ? `${savingsRate.toFixed(0)}%` : "—"}
          </p>
        </div>
      </div>

      {/* Advisor chip (Track A only) */}
      {isTrackA && advisorName && (
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="h-9 w-9 rounded-full bg-[#042C53] flex items-center justify-center text-white text-sm font-bold shrink-0">
            {advisorName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#042C53]">{advisorName}</p>
            <p className="text-xs text-slate-400">Your advisor — reach out via Messages any time</p>
          </div>
        </div>
      )}

      {/* Go to dashboard button */}
      <button
        onClick={onComplete}
        disabled={isLoading}
        className="w-full py-3.5 rounded-xl bg-[#1D9E75] text-white font-semibold text-sm hover:bg-[#0F6E56] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? "Setting up your dashboard…" : "Go to my dashboard →"}
      </button>

      {/* Track B conversion CTA */}
      {!isTrackA && !ctaDismissed && (
        <div className="relative p-4 rounded-xl bg-teal-50 border border-teal-200">
          <button
            onClick={dismissCta}
            className="absolute top-3 right-3 h-5 w-5 flex items-center justify-center text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-start gap-3 pr-4">
            <Sparkles className="h-4 w-4 text-[#1D9E75] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#042C53] mb-1">Interested in professional investment advice?</p>
              <p className="text-xs text-slate-600 mb-2">Book a free 30-minute call with one of our advisors. No obligation.</p>
              <a
                href="/client/messages"
                className="text-xs font-semibold text-[#1D9E75] hover:underline"
              >
                Book a free call →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

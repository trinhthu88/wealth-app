import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TRIAL_DAYS } from "@workspace/tier-policy";
import { annualSavingPct, formatStripeAmount } from "@/lib/formatPrice";

type PlanKey = "monthly" | "annual";

interface PriceInfo {
  plan: "member_monthly" | "member_annual";
  label: string;
  amount: number; // In the currency's smallest unit, from Stripe.
  currency: string;
  interval: string;
}

interface PricesResponse {
  monthly: PriceInfo;
  annual: PriceInfo;
}

export default function PlanPicker({ hasTrial }: { hasTrial: boolean }) {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("annual");
  const [loading, setLoading] = useState(false);

  const { data: prices, isError } = useQuery<PricesResponse>({
    queryKey: ["billing-prices"],
    queryFn: () => apiFetch<PricesResponse>("/billing/prices"),
    staleTime: 5 * 60 * 1000,
  });

  function selectPlan(plan: PlanKey) {
    setSelectedPlan(plan);
    const price = prices?.[plan];
    if (price) track("plan_selected", { plan, price: price.amount / 100 });
  }

  async function handleGetStarted() {
    const price = prices?.[selectedPlan];
    if (!price) return;
    track("checkout_started", { plan: selectedPlan, price: price.amount / 100 });
    setLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/membership/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: price.plan }),
      });
      window.location.href = data.url;
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const monthly = prices?.monthly;
  const annual = prices?.annual;
  const saving = monthly && annual && monthly.currency === annual.currency ? annualSavingPct(monthly.amount, annual.amount) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => selectPlan("monthly")}
          aria-pressed={selectedPlan === "monthly"}
          className={cn(
            "text-left rounded-2xl border-2 bg-surface p-4 transition-colors",
            selectedPlan === "monthly" ? "border-green" : "border-hairline"
          )}
        >
          <p className="text-[13px] font-semibold text-forest">Monthly</p>
          <p className="font-display text-[22px] font-bold text-forest mt-1 leading-none">
            {monthly ? formatStripeAmount(monthly.amount, monthly.currency) : "—"}
            <span className="text-[13px] font-medium text-ink-40"> / month</span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => selectPlan("annual")}
          aria-pressed={selectedPlan === "annual"}
          className={cn(
            "relative text-left rounded-2xl border-2 bg-surface p-4 transition-colors",
            selectedPlan === "annual" ? "border-green" : "border-hairline"
          )}
        >
          {saving !== null && (
            <span className="absolute -top-2.5 right-4 rounded-full bg-green text-white text-[10px] font-semibold px-2.5 py-1">
              Best value
            </span>
          )}
          <p className="text-[13px] font-semibold text-forest">Annual</p>
          <p className="font-display text-[22px] font-bold text-forest mt-1 leading-none">
            {annual ? formatStripeAmount(annual.amount, annual.currency) : "—"}
            <span className="text-[13px] font-medium text-ink-40"> / year</span>
          </p>
          {annual && saving !== null && (
            <p className="text-[12px] text-ink-40 mt-1">
              {formatStripeAmount(Math.round(annual.amount / 12), annual.currency)} / month · save {saving}%
            </p>
          )}
        </button>
      </div>

      {isError && (
        <p role="status" className="text-[13px] text-ink-40">Membership sign-up isn't available right now. Please try again soon.</p>
      )}
      <button
        type="button"
        onClick={handleGetStarted}
        disabled={loading || !prices}
        className="flex items-center justify-center w-full h-12 rounded-xl bg-green text-white text-[15px] font-semibold hover:bg-forest-700 transition-colors disabled:opacity-60"
      >
        {loading ? "Redirecting…" : hasTrial ? `Start my ${TRIAL_DAYS}-day free trial →` : "Continue to payment →"}
      </button>
    </div>
  );
}

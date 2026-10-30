import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PlanKey = "monthly" | "yearly";

interface PriceInfo {
  label: string;
  amount: number; // cents
  interval: string;
}

interface PricesResponse {
  monthly: PriceInfo;
  yearly: PriceInfo;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PlanPicker() {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("yearly");
  const [loading, setLoading] = useState(false);

  const { data: prices } = useQuery<PricesResponse>({
    queryKey: ["billing-prices"],
    queryFn: () => apiFetch<PricesResponse>("/billing/prices"),
    staleTime: Infinity,
  });

  function selectPlan(plan: PlanKey) {
    setSelectedPlan(plan);
    const price = prices?.[plan];
    if (price) track("plan_selected", { plan, price: price.amount / 100 });
  }

  async function handleGetStarted() {
    const price = prices?.[selectedPlan];
    if (price) track("checkout_started", { plan: selectedPlan, price: price.amount / 100 });
    setLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ plan: selectedPlan }),
      });
      window.location.href = data.url;
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const monthly = prices?.monthly;
  const yearly = prices?.yearly;
  const yearlyMonthlyEquivalent = yearly ? yearly.amount / 100 / 12 : null;
  const savePct = monthly && yearly ? Math.round((1 - yearly.amount / (monthly.amount * 12)) * 100) : null;

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
            {monthly ? formatDollars(monthly.amount) : "—"}
            <span className="text-[13px] font-medium text-ink-40"> / month</span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => selectPlan("yearly")}
          aria-pressed={selectedPlan === "yearly"}
          className={cn(
            "relative text-left rounded-2xl border-2 bg-surface p-4 transition-colors",
            selectedPlan === "yearly" ? "border-green" : "border-hairline"
          )}
        >
          <span className="absolute -top-2.5 right-4 rounded-full bg-green text-white text-[10px] font-semibold px-2.5 py-1">
            Best value
          </span>
          <p className="text-[13px] font-semibold text-forest">Yearly</p>
          <p className="font-display text-[22px] font-bold text-forest mt-1 leading-none">
            {yearly ? formatDollars(yearly.amount) : "—"}
            <span className="text-[13px] font-medium text-ink-40"> / year</span>
          </p>
          {yearlyMonthlyEquivalent !== null && (
            <p className="text-[12px] text-ink-40 mt-1">
              ${yearlyMonthlyEquivalent.toFixed(2)} / month{savePct !== null ? ` · save ${savePct}%` : ""}
            </p>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={handleGetStarted}
        disabled={loading || !prices}
        className="flex items-center justify-center w-full h-12 rounded-xl bg-green text-white text-[15px] font-semibold hover:bg-forest-700 transition-colors disabled:opacity-60"
      >
        {loading ? "Redirecting…" : "Start my plan →"}
      </button>
    </div>
  );
}

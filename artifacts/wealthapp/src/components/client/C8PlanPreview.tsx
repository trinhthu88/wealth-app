import { useQuery } from "@tanstack/react-query";
import { projectRegularSavings } from "@workspace/goal-math";
import CurrencyField from "@/components/shared/CurrencyField";
import { apiFetch } from "@/lib/api";

interface StrategyReturn {
  planType: string;
  label: string;
  targetAnnualReturnPct: string;
}

export default function C8PlanPreview({ monthlySurplus }: { monthlySurplus: number }) {
  const { data: strategies = [] } = useQuery<StrategyReturn[]>({
    queryKey: ["advised-strategy-returns"],
    queryFn: () => apiFetch("/client/advised-strategy-returns"),
  });
  // DECISION: use the recurring-savings return for monthly contributions; if an
  // admin has configured no RSP row, reuse the comparison tool's first configured rate.
  const strategy = strategies.find((row) => row.planType === "rsp") ?? strategies[0];
  const targetReturn = strategy ? Number(strategy.targetAnnualReturnPct) : NaN;

  if (!strategy || !Number.isFinite(targetReturn) || monthlySurplus <= 0) return null;

  const tenYear = projectRegularSavings(monthlySurplus, targetReturn, 10);
  const twentyFiveYear = projectRegularSavings(monthlySurplus, targetReturn, 25);

  return (
    <div className="mt-3 rounded-[18px] bg-paper/75 p-3" aria-label="Example, not a plan">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-40">Example, not a plan</p>
      <p className="mt-1 text-[12px] leading-relaxed text-forest">
        If you contributed <CurrencyField amountUsd={monthlySurplus} compact /> each month at {targetReturn}% a year:
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[14px] bg-surface p-3">
          <p className="text-[11px] text-ink-40">10 years</p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-forest">
            <CurrencyField amountUsd={tenYear} compact />
          </p>
        </div>
        <div className="rounded-[14px] bg-surface p-3">
          <p className="text-[11px] text-ink-40">25 years</p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-forest">
            <CurrencyField amountUsd={twentyFiveYear} compact />
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-40">
        Illustrative projection only; target returns are not guaranteed.
      </p>
    </div>
  );
}

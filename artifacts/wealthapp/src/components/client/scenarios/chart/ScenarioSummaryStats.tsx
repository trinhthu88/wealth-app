import { cn } from "@/lib/utils";
import type { ScenarioResult } from "@/lib/investmentCalculations";

function fmtUsd(v: number, compact = false) {
  if (compact && Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (compact && Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
}

function StatCard({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-3">
      <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wide mb-1">{label}</p>
      <p className={cn("text-lg font-semibold text-[#042C53]", valueColor)}>{value}</p>
      {sub && <p className="text-xs text-[#64748B] mt-0.5">{sub}</p>}
    </div>
  );
}

interface Props {
  result: ScenarioResult;
  horizonYears: number;
}

export default function ScenarioSummaryStats({ result, horizonYears }: Props) {
  const { params, baselineFinalValue, scenarioFinalValue, deltaValue, deltaPct } = result;
  const isDelta = deltaValue >= 0;
  const deltaColor = isDelta ? "text-emerald-600" : "text-red-500";

  function fourthCard() {
    switch (params.type) {
      case "increase_monthly": {
        const extraPerMonth = params.newMonthly - params.currentMonthly;
        const extraTotal = extraPerMonth * params.months;
        const returnOnExtra = deltaValue - extraTotal;
        return (
          <StatCard
            label="Extra contribution"
            value={`+${fmtUsd(extraTotal, true)} total`}
            sub={`${fmtUsd(returnOnExtra, true)} growth on extra`}
            valueColor={isDelta ? "text-emerald-600" : undefined}
          />
        );
      }
      case "add_lump_sum":
        return (
          <StatCard
            label="Lump sum invested"
            value={fmtUsd(params.lumpSumAmount, true)}
            sub={`Growth: +${fmtUsd(deltaValue, true)}`}
          />
        );
      case "reduce_monthly": {
        const savedPerMonth = params.currentMonthly - params.newMonthly;
        return (
          <StatCard
            label="Saved per month"
            value={fmtUsd(savedPerMonth, true)}
            sub={`Long-term cost: ${fmtUsd(Math.abs(deltaValue), true)} less`}
            valueColor="text-amber-600"
          />
        );
      }
      case "pause_contributions": {
        const missed = params.pauseMonths * params.currentMonthly;
        return (
          <StatCard
            label="Missed contributions"
            value={fmtUsd(missed, true)}
            sub={`Long-term cost: ${fmtUsd(Math.abs(deltaValue), true)} less`}
            valueColor="text-amber-600"
          />
        );
      }
      case "market_drop": {
        const droppedVal = Math.round(params.currentValue * (1 - params.dropPct / 100));
        return (
          <StatCard
            label="Value at bottom"
            value={fmtUsd(droppedVal, true)}
            sub={`Recovery: ${params.recoveryMonths} months`}
            valueColor="text-red-500"
          />
        );
      }
      case "retire_earlier":
        return (
          <div className="bg-[#1D9E75]/5 border border-[#1D9E75]/20 rounded-xl p-3 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-medium text-[#1D9E75] uppercase tracking-wide mb-1">Required monthly</p>
            <p className="text-lg font-semibold text-[#042C53]">{fmtUsd(result.requiredMonthly ?? 0)}/mo</p>
            <p className="text-xs text-[#64748B] mt-0.5">
              +{fmtUsd(result.extraMonthly ?? 0)}/mo more ·{" "}
              {result.yearsSavedOrLost != null
                ? `${result.yearsSavedOrLost > 0 ? result.yearsSavedOrLost.toFixed(1) + " yrs sooner" : "same timeframe"}`
                : "—"}
            </p>
          </div>
        );
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          label={`Baseline after ${horizonYears}yr`}
          value={fmtUsd(baselineFinalValue, true)}
        />
        <StatCard
          label={`Scenario after ${horizonYears}yr`}
          value={fmtUsd(scenarioFinalValue, true)}
          valueColor={deltaColor}
        />
        <StatCard
          label="Difference"
          value={`${isDelta ? "+" : "-"}${fmtUsd(Math.abs(deltaValue), true)}`}
          sub={`${isDelta ? "+" : ""}${deltaPct.toFixed(1)}%`}
          valueColor={deltaColor}
        />
        {fourthCard()}
      </div>

      <p className="text-[11px] italic text-[#64748B]">
        Projections are illustrative only. Actual returns will vary. Past performance does not guarantee future results.
      </p>
    </div>
  );
}

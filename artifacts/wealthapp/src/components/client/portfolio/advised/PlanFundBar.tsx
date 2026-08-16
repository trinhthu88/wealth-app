import type { AdvisedPlanHolding } from "@/hooks/useAdvisedPlans";

const FUND_COLORS: Record<string, string> = {
  ISSP: "#1D9E75",
  ISHT: "#0F6E56",
  IBIT: "#F59E0B",
  ISEM: "#3B82F6",
  ISAC: "#6366F1",
};
function colorFor(code: string): string {
  if (FUND_COLORS[code]) return FUND_COLORS[code];
  const h = code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = ["#1D9E75", "#0F6E56", "#3B82F6", "#6366F1", "#0EA5E9", "#8B5CF6"];
  return hues[h % hues.length];
}

interface Props {
  holdings: AdvisedPlanHolding[];
}

export default function PlanFundBar({ holdings }: Props) {
  const withAlloc = holdings.filter(h => parseFloat(h.futureAllocationPct) > 0);

  if (withAlloc.length === 0) {
    return (
      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-slate-200" />
        <p className="text-xs text-slate-400">No fund data — advisor will update this.</p>
      </div>
    );
  }

  const total = withAlloc.reduce((s, h) => s + parseFloat(h.futureAllocationPct), 0);

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full rounded-full overflow-hidden">
        {withAlloc.map((h, i) => (
          <div
            key={i}
            style={{ width: `${(parseFloat(h.futureAllocationPct) / total) * 100}%`, backgroundColor: colorFor(h.fundCode) }}
          />
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        {withAlloc.map(h => `${h.fundCode} ${parseFloat(h.futureAllocationPct).toFixed(0)}%`).join(" · ")}
      </p>
    </div>
  );
}

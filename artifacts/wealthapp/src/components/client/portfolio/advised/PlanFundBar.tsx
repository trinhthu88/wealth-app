import type { AdvisedPlanHolding } from "@/hooks/useAdvisedPlans";

const FUND_COLORS: Record<string, string> = {
  ISSP: "var(--forest)",
  ISHT: "var(--field)",
  IBIT: "var(--breeze)",
  ISEM: "var(--forest-700)",
  ISAC: "var(--mint-dim)",
};
function colorFor(code: string): string {
  if (FUND_COLORS[code]) return FUND_COLORS[code];
  const h = code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = ["var(--forest)", "var(--field)", "var(--breeze)", "var(--forest-700)", "var(--mint-dim)", "var(--green-tint)"];
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
        <div className="h-2 w-full rounded-full bg-forest/15" />
        <p className="text-[12px] text-ink-40">No fund data — advisor will update this.</p>
      </div>
    );
  }

  const total = withAlloc.reduce((s, h) => s + parseFloat(h.futureAllocationPct), 0);

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-forest/15">
        {withAlloc.map((h, i) => (
          <div
            key={i}
            style={{ width: `${(parseFloat(h.futureAllocationPct) / total) * 100}%`, backgroundColor: colorFor(h.fundCode) }}
          />
        ))}
      </div>
      <p className="text-[12px] text-ink-40 tabular-nums">
        {withAlloc.map(h => `${h.fundCode} ${parseFloat(h.futureAllocationPct).toFixed(0)}%`).join(" · ")}
      </p>
    </div>
  );
}

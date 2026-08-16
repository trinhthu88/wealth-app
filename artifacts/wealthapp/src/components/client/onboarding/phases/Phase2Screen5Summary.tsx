import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { NewHolding } from "../HoldingMiniForm";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";
import HoldingTypeBadge from "@/components/client/HoldingTypeBadge";
import { formatCurrency } from "@/lib/currencyUtils";
import { getHoldingTypeConfig } from "@/lib/holdingTypeConfig";

const TYPE_COLORS: Record<string, string> = {
  stock_etf: "#1D9E75",
  crypto:    "#F97316",
  property:  "#3B82F6",
  cash:      "#0EA5E9",
  pension:   "#8B5CF6",
  other:     "#94A3B8",
  advised:   "#042C53",
};

function getDisplayValue(h: NewHolding): number {
  if (h.holdingType === "property") return h.currentEstimatedValue ?? h.purchasePrice ?? 0;
  if (h.holdingType === "cash") return h.currentBalance ?? 0;
  if (h.holdingType === "pension") return h.currentBalancePension ?? 0;
  if (h.holdingType === "other") return h.currentValueOther ?? 0;
  return (h.unitsHeld ?? 0) * (h.averageCostPrice ?? 0);
}

interface Props {
  isTrackA: boolean;
  advisedPlans: AdvisedPlan[];
  addedHoldings: NewHolding[];
  preferredCurrency: string;
}

export default function Phase2Screen5Summary({ isTrackA, advisedPlans, addedHoldings, preferredCurrency }: Props) {
  const advisedValue = advisedPlans.reduce((s, p) => s + (parseFloat(p.latestAccountValue) || 0), 0);
  const selfValues = addedHoldings.reduce((acc, h) => {
    acc[h.holdingType] = (acc[h.holdingType] ?? 0) + getDisplayValue(h);
    return acc;
  }, {} as Record<string, number>);

  const selfTotal = Object.values(selfValues).reduce((s, v) => s + v, 0);
  const total = advisedValue + selfTotal;

  // Pie chart data
  const pieData: { name: string; value: number; color: string }[] = [];
  if (isTrackA && advisedValue > 0) {
    pieData.push({ name: "Advised plan", value: advisedValue, color: TYPE_COLORS.advised });
  }
  for (const [type, value] of Object.entries(selfValues)) {
    if (value > 0) {
      const cfg = getHoldingTypeConfig(type);
      pieData.push({ name: cfg.label, value, color: TYPE_COLORS[type] ?? "#94A3B8" });
    }
  }

  const hasData = total > 0;
  const pieLabel = `${formatCurrency(total, preferredCurrency, true)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#042C53] mb-1">Your portfolio at a glance</h1>
        <p className="text-sm text-slate-500">Here's what we've captured so far.</p>
      </div>

      {!hasData ? (
        <div className="py-8 text-center">
          <p className="text-slate-400 text-sm">No investments added yet — you can add them any time from your portfolio page.</p>
        </div>
      ) : (
        <>
          {/* Total card */}
          <div className="bg-[#042C53] text-white rounded-2xl p-5 text-center">
            <p className="text-xs text-white/60 mb-1 uppercase tracking-wide">Total portfolio value</p>
            <p className="text-3xl font-bold">{formatCurrency(total, preferredCurrency)}</p>
            {preferredCurrency !== "USD" && (
              <p className="text-xs text-white/50 mt-1">(USD equivalent)</p>
            )}
          </div>

          {/* Donut chart */}
          {pieData.length > 0 && (
            <div
              role="img"
              aria-label={`Portfolio breakdown: ${pieData.map(d => `${d.name} ${formatCurrency(d.value, preferredCurrency, true)}`).join(", ")}`}
              className="h-48 relative"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={80}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#fff"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-sm font-bold text-[#042C53]">{pieLabel}</span>
              </div>
            </div>
          )}

          {/* Breakdown list */}
          <div className="space-y-2">
            {isTrackA && advisedValue > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#042C53]" />
                  <span className="text-sm font-medium text-[#042C53]">
                    Advised plan — {advisedPlans[0]?.providerName ?? ""}
                  </span>
                </div>
                <span className="text-sm font-semibold text-[#042C53]">
                  {formatCurrency(advisedValue, preferredCurrency, true)}
                </span>
              </div>
            )}
            {Object.entries(selfValues).filter(([, v]) => v > 0).map(([type, value]) => (
              <div key={type} className="flex items-center justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <HoldingTypeBadge type={type} size="sm" />
                </div>
                <span className="text-sm font-semibold text-[#042C53]">
                  {formatCurrency(value, preferredCurrency, true)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

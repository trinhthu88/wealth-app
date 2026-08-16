import AdvisedPlanSection from "@/components/client/portfolio/advised/AdvisedPlanSection";
import SelfHoldingsSection from "@/components/client/portfolio/self/SelfHoldingsSection";
import AllocationDonut from "@/components/client/portfolio/shared/AllocationDonut";
import TrackBConversionCTA from "@/components/client/TrackBConversionCTA";
import { formatCurrency } from "@/lib/currencyUtils";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";
import type { ClientHolding } from "@/hooks/useClientHoldings";
import type { usePortfolioTotals } from "@/hooks/usePortfolioTotals";

const TYPE_COLORS: Record<string, string> = {
  advised_plan: "#042C53",
  stock_etf: "#1D9E75", etf: "#0D9488", mutual_fund: "#0891B2",
  crypto: "#F59E0B", commodity: "#D97706", bond: "#6366F1",
  property: "#3B82F6", cash: "#0EA5E9", pension: "#8B5CF6", other: "#94A3B8",
};
const TYPE_LABELS: Record<string, string> = {
  advised_plan: "Advised plans",
  stock_etf: "Stocks", etf: "ETFs", mutual_fund: "Mutual Funds",
  crypto: "Crypto", commodity: "Commodities", bond: "Bonds",
  property: "Property", cash: "Cash & Savings", pension: "Pension", other: "Other",
};

interface Props {
  isTrackA: boolean;
  plans: AdvisedPlan[];
  selfHoldings: ClientHolding[];
  totals: ReturnType<typeof usePortfolioTotals>;
  displayCurrency: string;
  advisorName?: string;
  onAddHolding: () => void;
  onEditHolding: (h: ClientHolding) => void;
}

export default function OverviewTab({ isTrackA, plans, selfHoldings, totals, displayCurrency, advisorName, onAddHolding, onEditHolding }: Props) {
  const selfValue = selfHoldings.reduce((s, h) => s + h.currentValue, 0);

  // Build donut segments
  const segmentMap: Record<string, number> = {};
  if (isTrackA) {
    const av = plans.reduce((s, p) => s + (parseFloat(p.latestAccountValue) || 0), 0);
    if (av > 0) segmentMap.advised_plan = av;
  }
  for (const h of selfHoldings) {
    segmentMap[h.holdingType] = (segmentMap[h.holdingType] ?? 0) + h.currentValue;
  }
  const segments = Object.entries(segmentMap)
    .filter(([, v]) => v > 0)
    .map(([type, value]) => ({
      label: TYPE_LABELS[type] ?? type,
      value,
      color: TYPE_COLORS[type] ?? "#94A3B8",
    }));

  return (
    <div className="space-y-6">
      {isTrackA && plans.length > 0 && (
        <AdvisedPlanSection plans={plans} advisorName={advisorName} />
      )}

      <SelfHoldingsSection
        holdings={selfHoldings}
        totalValue={selfValue}
        onAdd={onAddHolding}
        onEdit={onEditHolding}
      />

      <TrackBConversionCTA context="dashboard" />

      {segments.length > 0 && (
        <AllocationDonut
          segments={segments}
          totalLabel={formatCurrency(totals.totalPortfolioValue, displayCurrency, true)}
        />
      )}
    </div>
  );
}

import { useAdvisedPlans, type AdvisedPlan } from "./useAdvisedPlans";
import { useClientHoldings, type ClientHolding } from "./useClientHoldings";
import { calcCAGR } from "@/lib/investmentCalculations";

export interface AllHolding {
  id: string;
  type: string;
  label: string;
  currentValue: number;
  costBasis: number;
  gainLoss: number;
  gainLossPct: number;
  cagr: number | null;
  currency: string;
  isAdvisedPlan: boolean;
  raw: AdvisedPlan | ClientHolding;
}

function cagrOrNull(currentValue: number, costBasis: number, purchaseDate: string | null): number | null {
  if (!purchaseDate || costBasis <= 0 || currentValue <= 0) return null;
  const days = (Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 90) return null;
  return calcCAGR(currentValue, costBasis, purchaseDate);
}

export function usePortfolioTotals() {
  const { plans, totalAdvisedValue, totalNetContribution: advisedContrib, loading: plansLoading } = useAdvisedPlans();
  const { holdings, totalSelfManagedValue, loading: holdingsLoading } = useClientHoldings();

  const allHoldings: AllHolding[] = [
    ...plans.map(p => {
      const cv = parseFloat(p.latestAccountValue) || 0;
      const cb = parseFloat(p.latestNetContribution) || 0;
      const gl = cv - cb;
      const glPct = cb > 0 ? (gl / cb) * 100 : 0;
      return {
        id: p.id,
        type: "advised_plan",
        label: p.nickname ?? p.productName,
        currentValue: cv,
        costBasis: cb,
        gainLoss: gl,
        gainLossPct: glPct,
        cagr: cagrOrNull(cv, cb, p.effectiveDate),
        currency: p.currency,
        isAdvisedPlan: true,
        raw: p as AdvisedPlan,
      };
    }),
    ...holdings.map(h => ({
      id: h.id,
      type: h.holdingType,
      label: h.label,
      currentValue: h.currentValue,
      costBasis: h.costBasis,
      gainLoss: h.gainLoss,
      gainLossPct: h.gainLossPct,
      cagr: cagrOrNull(h.currentValue, h.costBasis, h.purchaseDate),
      currency: h.currency,
      isAdvisedPlan: false,
      raw: h as ClientHolding,
    })),
  ];

  const selfCostBasis = holdings.reduce((s, h) => s + h.costBasis, 0);
  const totalNetContribution = (parseFloat(String(advisedContrib)) || 0) + selfCostBasis;
  const totalPortfolioValue = totalAdvisedValue + totalSelfManagedValue;
  const totalGainLoss = totalPortfolioValue - totalNetContribution;
  const totalGainLossPct = totalNetContribution > 0 ? (totalGainLoss / totalNetContribution) * 100 : 0;

  // Weighted CAGR
  const cagrHoldings = allHoldings.filter(h => h.cagr !== null && h.costBasis > 0);
  let overallCagr: number | null = null;
  if (cagrHoldings.length >= 2) {
    const totalCb = cagrHoldings.reduce((s, h) => s + h.costBasis, 0);
    overallCagr = totalCb > 0
      ? cagrHoldings.reduce((s, h) => s + (h.cagr! * h.costBasis), 0) / totalCb
      : null;
  }

  return {
    totalPortfolioValue,
    totalNetContribution,
    totalGainLoss,
    totalGainLossPct,
    overallCagr,
    loading: plansLoading || holdingsLoading,
    allHoldings,
  };
}

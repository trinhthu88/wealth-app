import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { calcPlanGainLoss, calcCAGR } from "@/lib/investmentCalculations";

export interface AdvisedPlanStatement {
  id: string;
  advisedPlanId: string;
  periodStart: string;
  periodEnd: string;
  statementDate: string | null;
  openingValue: string;
  closingValue: string;
  contributions: string;
  extraAllocations: string;
  investmentReturns: string;
  policyFee: string;
  assetManagementFee: string;
  adminCharges: string;
  advisoryServicesFee: string;
  bidOfferSpread: string;
  surrenders: string;
  surrenderCharges: string;
  entryMode: string;
  createdAt: string;
}

export interface AdvisedPlanHolding {
  id: string;
  fundCode: string;
  fundName: string;
  unitValueDate: string | null;
  unitValue: string | null;
  unitsHeld: string | null;
  holdingValue: string | null;
  pendingTransactions: string;
  finalValue: string | null;
  futureAllocationPct: string;
}

export interface AdvisedPlan {
  id: string;
  userId: string;
  advisorId: string | null;
  providerName: string;
  productCode: string | null;
  productName: string;
  policyNumber: string | null;
  introducerCode: string | null;
  planType: string;
  currency: string;
  termYears: number | null;
  annualPremium: string;
  initialPremium: string;
  effectiveDate: string | null;
  maturityDate: string | null;
  status: string;
  latestAccountValue: string;
  latestNetContribution: string;
  latestStatementDate: string | null;
  nickname: string | null;
  isVisibleToClient: boolean;
  createdAt: string;
  updatedAt: string;
  // Enriched fields
  latestStatement: AdvisedPlanStatement | null;
  latestHoldings: AdvisedPlanHolding[];
  gainLoss: number;
  gainLossPct: number;
  cagr: number;
}

function enrichPlan(raw: Omit<AdvisedPlan, "gainLoss" | "gainLossPct" | "cagr">): AdvisedPlan {
  const currentValue = parseFloat(raw.latestAccountValue) || 0;
  const netContribution = parseFloat(raw.latestNetContribution) || 0;
  const { gainLoss, gainLossPct } = calcPlanGainLoss(currentValue, netContribution);
  const cagr = raw.effectiveDate
    ? calcCAGR(currentValue, netContribution, raw.effectiveDate)
    : 0;
  return { ...raw, gainLoss, gainLossPct, cagr };
}

export function useAdvisedPlans() {
  const { user, isLoaded } = useUser();

  const query = useQuery<AdvisedPlan[]>({
    queryKey: ["advised-plans"],
    queryFn: async () => {
      const raw = await apiFetch<Omit<AdvisedPlan, "gainLoss" | "gainLossPct" | "cagr">[]>(
        "/client/advised-plans"
      );
      return raw.map(enrichPlan);
    },
    enabled: isLoaded && !!user,
  });

  const plans = query.data ?? [];
  const activePlans = plans.filter((p) => p.status === "inforce" && p.isVisibleToClient);

  const totalAdvisedValue = activePlans.reduce(
    (sum, p) => sum + (parseFloat(p.latestAccountValue) || 0),
    0
  );
  const totalNetContribution = activePlans.reduce(
    (sum, p) => sum + (parseFloat(p.latestNetContribution) || 0),
    0
  );

  const qc = useQueryClient();

  return {
    plans,
    totalAdvisedValue,
    totalNetContribution,
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
    refetch: () => qc.invalidateQueries({ queryKey: ["advised-plans"] }),
  };
}

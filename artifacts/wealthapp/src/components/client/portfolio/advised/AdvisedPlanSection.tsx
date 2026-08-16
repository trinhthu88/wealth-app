import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
import AdvisedPlanCardFull from "./AdvisedPlanCard";
import StatementHistoryDrawer from "./StatementHistoryDrawer";
import type { AdvisedPlan, AdvisedPlanStatement, AdvisedPlanHolding } from "@/hooks/useAdvisedPlans";

interface Props {
  plans: AdvisedPlan[];
  advisorName?: string;
}

function PlanWithDrawer({ plan }: { plan: AdvisedPlan }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: statements = [] } = useQuery<AdvisedPlanStatement[]>({
    queryKey: ["plan-statements", plan.id],
    queryFn: () => apiFetch(`/client/advised-plans/${plan.id}/statements`),
    enabled: drawerOpen,
  });

  const { data: holdingsMap = {} } = useQuery<Record<string, AdvisedPlanHolding[]>>({
    queryKey: ["plan-statement-holdings", plan.id],
    queryFn: async () => {
      const map: Record<string, AdvisedPlanHolding[]> = {};
      for (const stmt of statements) {
        const h = await apiFetch<AdvisedPlanHolding[]>(`/client/advised-plans/${plan.id}/statements/${stmt.id}/holdings`);
        map[stmt.id] = h;
      }
      return map;
    },
    enabled: drawerOpen && statements.length > 0,
  });

  return (
    <>
      <AdvisedPlanCardFull plan={plan} onViewStatements={() => setDrawerOpen(true)} />
      <StatementHistoryDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        plan={plan}
        statements={statements}
        holdingsByStatement={holdingsMap}
      />
    </>
  );
}

export default function AdvisedPlanSection({ plans, advisorName }: Props) {
  const totalValue = plans.reduce((s, p) => s + (parseFloat(p.latestAccountValue) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-[#042C53]">Advised investment plans</p>
          {advisorName && <p className="text-xs text-slate-500">Managed by {advisorName}</p>}
        </div>
        <p className="text-sm font-semibold text-[#042C53]">
          <CurrencyDisplay amountUsd={totalValue} compact />
        </p>
      </div>
      {plans.map(plan => <PlanWithDrawer key={plan.id} plan={plan} />)}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import AdvisedPlanCardFull from "./AdvisedPlanCard";
import AdvisedPlanDetailSheet from "./AdvisedPlanDetailSheet";
import StatementHistoryDrawer from "./StatementHistoryDrawer";
import type { AdvisedPlan, AdvisedPlanStatement, AdvisedPlanHolding } from "@/hooks/useAdvisedPlans";

interface Props {
  plans: AdvisedPlan[];
}

function PlanWithSheets({ plan }: { plan: AdvisedPlan }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: statements = [] } = useQuery<AdvisedPlanStatement[]>({
    queryKey: ["plan-statements", plan.id],
    queryFn: () => apiFetch(`/client/advised-plans/${plan.id}/statements`),
    enabled: historyOpen,
  });

  const { data: holdingsMap = {} } = useQuery<Record<string, AdvisedPlanHolding[]>>({
    queryKey: ["plan-statement-holdings", plan.id],
    queryFn: async () => {
      const map: Record<string, AdvisedPlanHolding[]> = {};
      for (const statement of statements) {
        map[statement.id] = await apiFetch<AdvisedPlanHolding[]>(
          `/client/advised-plans/${plan.id}/statements/${statement.id}/holdings`,
        );
      }
      return map;
    },
    enabled: historyOpen && statements.length > 0,
  });

  return (
    <>
      <AdvisedPlanCardFull plan={plan} onOpen={() => setDetailOpen(true)} />
      <AdvisedPlanDetailSheet
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        plan={plan}
        onViewAllStatements={() => {
          setDetailOpen(false);
          setHistoryOpen(true);
        }}
      />
      <StatementHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        plan={plan}
        statements={statements}
        holdingsByStatement={holdingsMap}
      />
    </>
  );
}

export default function AdvisedPlanSection({ plans }: Props) {
  return (
    <div className="space-y-3">
      {plans.map((plan) => <PlanWithSheets key={plan.id} plan={plan} />)}
    </div>
  );
}

import { useLocation } from "wouter";
import AdvisedPlanCardFull from "./AdvisedPlanCard";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";

interface Props {
  plans: AdvisedPlan[];
}

export default function AdvisedPlanSection({ plans }: Props) {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <AdvisedPlanCardFull
          key={plan.id}
          plan={plan}
          onOpen={() => navigate(`/client/portfolio/${plan.id}`)}
        />
      ))}
    </div>
  );
}

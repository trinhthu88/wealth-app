import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ScenarioAlert } from "@/hooks/useDashboardData";

function describeScenario(alert: ScenarioAlert): string {
  const p = alert.parameters as Record<string, unknown>;
  const fmt = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

  switch (alert.scenarioType) {
    case "increase_monthly": return `Increase your monthly contribution to ${fmt(p.new_monthly as number)}`;
    case "add_lump_sum": return `Add a ${fmt(p.lump_sum_amount as number)} lump sum investment`;
    case "reduce_monthly": return `Reduce monthly contribution to ${fmt(p.new_monthly as number)}`;
    case "pause_contributions": return `Pause contributions for ${p.pause_months} months`;
    case "market_drop": return `Stress test: what if markets drop ${p.drop_pct}%?`;
    case "retire_earlier": return `Reach your goal sooner by adjusting your plan`;
    default: return alert.scenarioName ?? "Custom scenario";
  }
}

interface Props {
  alert: ScenarioAlert;
}

export default function ScenarioAlertSection({ alert }: Props) {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiFetch(`/client/scenarios/${alert.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard-scenario-alert"] }),
  });

  if (dismissed) return null;

  function handleView() {
    if (alert.alertStatus === "new") {
      statusMutation.mutate("viewed");
    }
  }

  return (
    <div className="bg-forest rounded-[28px] p-5 text-paper mb-3.5">
      <div className="tala-eyebrow text-mint mb-2.5">
        One thing to do
      </div>
      <div className="text-[16px] font-semibold leading-[1.35] mb-1.5">
        {alert.scenarioName ?? "Investment scenario"}
      </div>
      <div className="text-xs text-mint leading-[1.5] mb-4">
        {describeScenario(alert)}
      </div>
      <Link href={`/client/goals/what-if?highlight=${alert.id}`} onClick={handleView}>
        <button className="w-full min-h-[44px] border-none rounded-full bg-field text-forest font-sans text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity">
          View scenario
        </button>
      </Link>
    </div>
  );
}

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
    <div className="bg-[#042C53] rounded-[24px] p-5 text-white mb-3.5">
      <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#7FCBAE] mb-2.5">
        One thing to do
      </div>
      <div className="font-display text-base font-semibold leading-[1.35] mb-1.5">
        {alert.scenarioName ?? "Investment scenario"}
      </div>
      <div className="text-xs text-[#A9C0D6] leading-[1.5] mb-4">
        {describeScenario(alert)}
      </div>
      <Link href={`/client/scenarios?highlight=${alert.id}`} onClick={handleView}>
        <button className="w-full min-h-[44px] border-none rounded-[14px] bg-[#1D9E75] text-white font-sans text-sm font-semibold cursor-pointer hover:bg-[#17805F] transition-colors">
          View scenario
        </button>
      </Link>
    </div>
  );
}

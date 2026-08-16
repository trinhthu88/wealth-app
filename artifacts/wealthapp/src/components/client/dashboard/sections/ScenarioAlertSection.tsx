import { useState } from "react";
import { Link } from "wouter";
import { Sparkles, X } from "lucide-react";
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

  function handleDismiss() {
    setDismissed(true);
    statusMutation.mutate("dismissed");
  }

  function handleView() {
    if (alert.alertStatus === "new") {
      statusMutation.mutate("viewed");
    }
  }

  return (
    <div className="bg-[#F0FDF8] border border-[#1D9E75]/20 border-l-[3px] border-l-[#1D9E75] rounded-xl p-4 relative">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-[#1D9E75]" />
          <span className="text-[11px] font-bold text-[#1D9E75] uppercase tracking-wide">New from your advisor</span>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss scenario alert"
          className="text-[#64748B] hover:text-[#042C53] shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-sm font-semibold text-[#042C53] mb-1">
        {alert.scenarioName ?? "Investment scenario"}
      </p>
      <p className="text-xs text-[#64748B] mb-3">{describeScenario(alert)}</p>

      <div className="flex items-center gap-3">
        <Link href={`/client/scenarios?highlight=${alert.id}`} onClick={handleView}>
          <span className="text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">View scenario →</span>
        </Link>
        <button onClick={handleDismiss} className="text-xs text-[#64748B] hover:text-[#042C53]">
          Dismiss
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import type { ScenarioRun } from "@/hooks/useScenarios";

function describeScenario(run: ScenarioRun): string {
  const p = run.parameters as Record<string, unknown>;
  const fmt = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
  switch (run.scenarioType) {
    case "increase_monthly": return `Increase monthly to ${fmt(p.newMonthly as number)}`;
    case "add_lump_sum": return `Add ${fmt(p.lumpSumAmount as number)} lump sum`;
    case "reduce_monthly": return `Reduce monthly to ${fmt(p.newMonthly as number)}`;
    case "pause_contributions": return `Pause for ${p.pauseMonths} months`;
    case "market_drop": return `Markets drop ${p.dropPct}%`;
    case "retire_earlier": return `Reach goal ${((p.currentTargetMonths as number) - (p.newTargetMonths as number)) / 12}yr sooner`;
    default: return run.scenarioName ?? "Custom scenario";
  }
}

const TYPE_LABELS: Record<string, string> = {
  increase_monthly: "Increase monthly",
  add_lump_sum: "Add lump sum",
  reduce_monthly: "Reduce monthly",
  pause_contributions: "Pause contributions",
  market_drop: "Market drop",
  retire_earlier: "Reach goal sooner",
};

interface Props {
  run: ScenarioRun;
  onLoad: (run: ScenarioRun) => void;
  onViewed: (id: string) => void;
}

export default function AdvisorScenarioCard({ run, onLoad, onViewed }: Props) {
  const [expanded, setExpanded] = useState(false);

  function handleExpand() {
    if (!expanded) onViewed(run.id);
    setExpanded(v => !v);
  }

  return (
    <div className="bg-[#F0FDF8] border border-[#1D9E75]/20 border-l-[3px] border-l-[#1D9E75] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-3 text-left"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-[#1D9E75] shrink-0" />
          <span className="text-xs font-semibold text-[#1D9E75] truncate">
            {TYPE_LABELS[run.scenarioType] ?? run.scenarioType}
          </span>
          {run.alertStatus === "new" && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75] shrink-0" />
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-[#1D9E75] shrink-0" /> : <ChevronDown className="h-4 w-4 text-[#1D9E75] shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {run.scenarioName && (
            <p className="text-sm font-semibold text-[#042C53]">{run.scenarioName}</p>
          )}
          <p className="text-xs text-[#64748B]">{describeScenario(run)}</p>
          <button
            onClick={() => onLoad(run)}
            className="text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]"
          >
            Load this →
          </button>
        </div>
      )}
    </div>
  );
}

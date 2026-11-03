import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2, Sparkles, TrendingUp, PiggyBank, TrendingDown, Pause, Zap, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import AdvisorScenarioCard from "./AdvisorScenarioCard";
import type { ScenarioRun } from "@/hooks/useScenarios";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";
import type { DashboardGoal } from "@/hooks/useDashboardData";

export type ScenarioSource = {
  id: string;
  label: string;
  currentValue: number;
  currentMonthly: number;
  kind: "plan" | "total" | "goal";
  linkedGoal?: DashboardGoal;
};

const SCENARIO_TYPES = [
  { type: "increase_monthly",    tile: "bg-field",  icon: <TrendingUp className="w-[18px] h-[18px] text-forest" />, label: "Increase monthly contribution",  sub: "What if I contribute more?" },
  { type: "add_lump_sum",        tile: "bg-field",  icon: <PiggyBank className="w-[18px] h-[18px] text-forest" />, label: "Add a lump sum",                 sub: "What if I invest extra now?" },
  { type: "reduce_monthly",      tile: "bg-breeze", icon: <TrendingDown className="w-[18px] h-[18px] text-forest" />, label: "Reduce monthly contribution",    sub: "What if I contribute less?" },
  { type: "pause_contributions", tile: "bg-breeze", icon: <Pause className="w-[18px] h-[18px] text-forest" />,  label: "Pause contributions",            sub: "What if I stop for a while?" },
  { type: "market_drop",         tile: "bg-sun",    icon: <Zap className="w-[18px] h-[18px] text-forest" />, label: "Market drop stress test",        sub: "What if markets fall?" },
  { type: "retire_earlier",      tile: "bg-forest", icon: <Target className="w-[18px] h-[18px] text-paper" />, label: "Reach goal sooner",              sub: "What monthly do I need?" },
];

interface Props {
  plans: AdvisedPlan[];
  goals: DashboardGoal[];
  totalAdvisedValue: number;
  totalMonthly: number;
  selectedSource: ScenarioSource | null;
  onSelectSource: (s: ScenarioSource) => void;
  selectedType: string | null;
  onSelectType: (t: string) => void;
  savedScenarios: ScenarioRun[];
  advisorScenarios: ScenarioRun[];
  onLoadSaved: (run: ScenarioRun) => void;
  onDeleteSaved: (id: string) => void;
  onLoadAdvisor: (run: ScenarioRun) => void;
  onAdvisorViewed: (id: string) => void;
}

export default function ScenarioSidebar({
  plans, goals, totalAdvisedValue, totalMonthly,
  selectedSource, onSelectSource, selectedType, onSelectType,
  savedScenarios, advisorScenarios, onLoadSaved, onDeleteSaved, onLoadAdvisor, onAdvisorViewed,
}: Props) {
  const [savedOpen, setSavedOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Actionable scenarios apply only to advised holdings — these are the levers an
  // advisor can actually pull. Self-tracked holdings get the separate "bring under
  // management" comparison instead (see BringUnderManagementCompare).
  const sources: ScenarioSource[] = [
    // All advised investments combined
    { id: "total", label: "All advised investments combined", currentValue: totalAdvisedValue, currentMonthly: totalMonthly, kind: "total" },
    // Advised plans
    ...plans.map(p => ({
      id: p.id,
      label: p.nickname ?? p.productName,
      currentValue: parseFloat(p.latestAccountValue) || 0,
      currentMonthly: parseFloat(p.annualPremium) / 12 || 0,
      kind: "plan" as const,
    })),
  ];

  return (
    <div className="space-y-5 w-full">
      {/* Source picker */}
      <div className="space-y-2">
        <p className="text-[16px] font-semibold text-forest">What to model</p>
        <div className="bg-surface rounded-[24px] p-1 space-y-0.5">
          {sources.map(s => (
            <button
              key={s.id}
              onClick={() => onSelectSource(s)}
              className={cn(
                "w-full min-h-[44px] text-left p-3 rounded-[20px] transition-colors text-[14px] text-forest",
                selectedSource?.id === s.id
                  ? "bg-breeze"
                  : "hover:bg-paper/70"
              )}
            >
              <p className="font-semibold truncate">{s.label}</p>
              <p className="text-[12px] text-ink-40 tabular-nums">
                ${Math.round(s.currentValue).toLocaleString()}
                {s.currentMonthly > 0 && ` · $${Math.round(s.currentMonthly).toLocaleString()}/mo`}
              </p>
            </button>
          ))}

          {goals.length > 0 && (
            <>
              <p className="tala-eyebrow text-ink-40 pt-3 pb-1 px-3">Or model a goal:</p>
              {goals.map(g => (
                <button
                  key={g.id}
                  onClick={() => onSelectSource({
                    id: `goal-${g.id}`,
                    label: g.title,
                    currentValue: totalAdvisedValue,
                    currentMonthly: totalMonthly,
                    kind: "goal",
                    linkedGoal: g,
                  })}
                  className={cn(
                    "w-full min-h-[44px] text-left p-3 rounded-[20px] transition-colors text-[14px] text-forest",
                    selectedSource?.id === `goal-${g.id}`
                      ? "bg-field"
                      : "hover:bg-paper/70"
                  )}
                >
                  <p className="font-semibold truncate">{g.title}</p>
                  {g.targetAmount && (
                    <p className="text-[12px] text-ink-40 tabular-nums">Target: ${parseFloat(g.targetAmount).toLocaleString()}</p>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Type picker */}
      {selectedSource && (
        <div className="space-y-2">
          <p className="text-[16px] font-semibold text-forest">Scenario type</p>
          <div className="bg-surface rounded-[24px] p-1 space-y-0.5">
            {SCENARIO_TYPES.filter(t => {
              if (t.type === "retire_earlier") return goals.length > 0 || selectedSource.kind === "goal";
              return true;
            }).map(st => (
              <button
                key={st.type}
                onClick={() => onSelectType(st.type)}
                className={cn(
                  "w-full min-h-[44px] text-left p-3 rounded-[20px] transition-colors flex items-center gap-3 text-forest",
                  selectedType === st.type ? "bg-breeze" : "hover:bg-paper/70"
                )}
              >
                <span className={cn("w-10 h-10 shrink-0 rounded-[14px] flex items-center justify-center", st.tile)}>
                  {st.icon}
                </span>
                <span className="min-w-0">
                  <p className="text-[14px] font-semibold text-forest">{st.label}</p>
                  <p className="text-[13px] text-ink-40">{st.sub}</p>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved scenarios */}
      <div>
        <button
          onClick={() => setSavedOpen(v => !v)}
          className="flex items-center gap-2 min-h-[44px] text-[16px] font-semibold text-forest w-full"
        >
          {savedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Saved scenarios ({savedScenarios.length})
        </button>
        {savedOpen && (
          <div className="mt-1 bg-surface rounded-[24px] p-1">
            {savedScenarios.length === 0 ? (
              <p className="text-[13px] text-ink-40 p-3">No saved scenarios yet.</p>
            ) : (
              savedScenarios.map(run => (
                <div key={run.id} className="flex items-center justify-between p-3 border-b border-hairline last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-forest truncate">{run.scenarioName ?? "Scenario"}</p>
                    <p className="text-[12px] text-ink-40">{run.scenarioType.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={() => onLoadSaved(run)} className="min-h-[44px] px-2 text-[13px] text-forest font-semibold hover:underline">Load</button>
                    {deleteConfirm === run.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => { onDeleteSaved(run.id); setDeleteConfirm(null); }} className="min-h-[44px] px-2 text-[13px] text-red-600 font-semibold">Yes</button>
                        <button onClick={() => setDeleteConfirm(null)} className="min-h-[44px] px-2 text-[13px] text-ink-40 font-medium">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(run.id)} aria-label="Delete scenario" className="w-11 h-11 flex items-center justify-center rounded-full">
                        <Trash2 className="h-4 w-4 text-ink-40 hover:text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Advisor scenarios */}
      {advisorScenarios.length > 0 && (
        <div className="space-y-2">
          <p className="text-[16px] font-semibold text-forest flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-forest" />
            From your advisor
          </p>
          {advisorScenarios.map(run => (
            <AdvisorScenarioCard
              key={run.id}
              run={run}
              onLoad={onLoadAdvisor}
              onViewed={onAdvisorViewed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

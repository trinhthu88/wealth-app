import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import AdvisorScenarioCard from "./AdvisorScenarioCard";
import type { ScenarioRun } from "@/hooks/useScenarios";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";
import type { ClientHolding } from "@/hooks/useClientHoldings";
import type { DashboardGoal } from "@/hooks/useDashboardData";

export type ScenarioSource = {
  id: string;
  label: string;
  currentValue: number;
  currentMonthly: number;
  kind: "plan" | "holding" | "total" | "goal";
  linkedGoal?: DashboardGoal;
};

const SCENARIO_TYPES = [
  { type: "increase_monthly",    emoji: "📈", label: "Increase monthly contribution",  sub: "What if I contribute more?" },
  { type: "add_lump_sum",        emoji: "💰", label: "Add a lump sum",                 sub: "What if I invest extra now?" },
  { type: "reduce_monthly",      emoji: "📉", label: "Reduce monthly contribution",    sub: "What if I contribute less?" },
  { type: "pause_contributions", emoji: "⏸",  label: "Pause contributions",            sub: "What if I stop for a while?" },
  { type: "market_drop",         emoji: "⚡", label: "Market drop stress test",        sub: "What if markets fall?" },
  { type: "retire_earlier",      emoji: "🎯", label: "Reach goal sooner",              sub: "What monthly do I need?" },
];

interface Props {
  plans: AdvisedPlan[];
  selfHoldings: ClientHolding[];
  goals: DashboardGoal[];
  totalPortfolioValue: number;
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
  plans, selfHoldings, goals, totalPortfolioValue, totalMonthly,
  selectedSource, onSelectSource, selectedType, onSelectType,
  savedScenarios, advisorScenarios, onLoadSaved, onDeleteSaved, onLoadAdvisor, onAdvisorViewed,
}: Props) {
  const [savedOpen, setSavedOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const sources: ScenarioSource[] = [
    // All investments combined
    { id: "total", label: "All investments combined", currentValue: totalPortfolioValue, currentMonthly: totalMonthly, kind: "total" },
    // Advised plans
    ...plans.map(p => ({
      id: p.id,
      label: p.nickname ?? p.productName,
      currentValue: parseFloat(p.latestAccountValue) || 0,
      currentMonthly: parseFloat(p.annualPremium) / 12 || 0,
      kind: "plan" as const,
    })),
    // Market-priced holdings (stocks, ETFs, crypto, commodities, bonds, mutual funds)
    ...selfHoldings
      .filter(h => ["stock_etf", "etf", "mutual_fund", "commodity", "bond", "crypto"].includes(h.holdingType))
      .map(h => ({
        id: h.id,
        label: `${h.label}${h.ticker ? ` · ${h.ticker}` : h.coinSymbol ? ` · ${h.coinSymbol}` : ""}`,
        currentValue: h.currentValue,
        currentMonthly: 0,
        kind: "holding" as const,
      })),
  ];

  return (
    <div className="space-y-5 w-full">
      {/* Source picker */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">What to model</p>
        <div className="space-y-1.5">
          {sources.map(s => (
            <button
              key={s.id}
              onClick={() => onSelectSource(s)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-xl border transition-all text-sm",
                selectedSource?.id === s.id
                  ? "border-[#1D9E75] bg-[#1D9E75]/5 text-[#042C53]"
                  : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/30"
              )}
            >
              <p className="font-medium truncate">{s.label}</p>
              <p className="text-xs text-slate-400">
                ${Math.round(s.currentValue).toLocaleString()}
                {s.currentMonthly > 0 && ` · $${Math.round(s.currentMonthly).toLocaleString()}/mo`}
              </p>
            </button>
          ))}

          {goals.length > 0 && (
            <>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide pt-1 px-1">Or model a goal:</p>
              {goals.map(g => (
                <button
                  key={g.id}
                  onClick={() => onSelectSource({
                    id: `goal-${g.id}`,
                    label: g.title,
                    currentValue: totalPortfolioValue,
                    currentMonthly: totalMonthly,
                    kind: "goal",
                    linkedGoal: g,
                  })}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl border transition-all text-sm",
                    selectedSource?.id === `goal-${g.id}`
                      ? "border-[#1D9E75] bg-[#1D9E75]/5"
                      : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/30"
                  )}
                >
                  <p className="font-medium truncate">{g.title}</p>
                  {g.targetAmount && (
                    <p className="text-xs text-slate-400">Target: ${parseFloat(g.targetAmount).toLocaleString()}</p>
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
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Scenario type</p>
          <div className="space-y-1.5">
            {SCENARIO_TYPES.filter(t => {
              if (t.type === "retire_earlier") return goals.length > 0 || selectedSource.kind === "goal";
              return true;
            }).map(st => (
              <button
                key={st.type}
                onClick={() => onSelectType(st.type)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all",
                  selectedType === st.type ? "border-[#1D9E75] bg-[#1D9E75]/5" : "border-slate-200 hover:border-[#1D9E75]/30"
                )}
              >
                <p className="text-sm font-medium text-[#042C53]">{st.emoji} {st.label}</p>
                <p className="text-xs text-slate-400">{st.sub}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved scenarios */}
      <div>
        <button
          onClick={() => setSavedOpen(v => !v)}
          className="flex items-center gap-2 text-xs font-semibold text-[#64748B] uppercase tracking-wide w-full"
        >
          {savedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Saved scenarios ({savedScenarios.length})
        </button>
        {savedOpen && (
          <div className="mt-2 space-y-1.5">
            {savedScenarios.length === 0 ? (
              <p className="text-xs text-slate-400 px-1">No saved scenarios yet.</p>
            ) : (
              savedScenarios.map(run => (
                <div key={run.id} className="flex items-center justify-between px-2 py-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#042C53] truncate">{run.scenarioName ?? "Scenario"}</p>
                    <p className="text-[11px] text-slate-400">{run.scenarioType.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={() => onLoadSaved(run)} className="text-[11px] text-[#1D9E75] font-medium hover:text-[#0F6E56]">Load</button>
                    {deleteConfirm === run.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => { onDeleteSaved(run.id); setDeleteConfirm(null); }} className="text-[11px] text-red-500 font-medium">Yes</button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-[11px] text-slate-400">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(run.id)} aria-label="Delete scenario">
                        <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-400" />
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
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#1D9E75]" />
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

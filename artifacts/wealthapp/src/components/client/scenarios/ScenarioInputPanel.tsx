import IncreaseMonthlyForm from "./inputs/IncreaseMonthlyForm";
import AddLumpSumForm from "./inputs/AddLumpSumForm";
import ReduceMonthlyForm from "./inputs/ReduceMonthlyForm";
import PauseContributionsForm from "./inputs/PauseContributionsForm";
import MarketDropForm from "./inputs/MarketDropForm";
import RetireEarlierForm from "./inputs/RetireEarlierForm";
import type { ScenarioSource } from "./ScenarioSidebar";
import type { ScenarioParams, ScenarioResult } from "@/lib/investmentCalculations";
import type { DashboardGoal } from "@/hooks/useDashboardData";

interface Props {
  source: ScenarioSource;
  scenarioType: string;
  goals: DashboardGoal[];
  onRun: (result: ScenarioResult) => void;
  runScenario: (p: ScenarioParams) => ScenarioResult;
}

const TYPE_LABELS: Record<string, string> = {
  increase_monthly: "Increase monthly contribution",
  add_lump_sum: "Add a lump sum",
  reduce_monthly: "Reduce monthly contribution",
  pause_contributions: "Pause contributions",
  market_drop: "Market drop stress test",
  retire_earlier: "Reach goal sooner",
};

export default function ScenarioInputPanel({ source, scenarioType, goals, onRun, runScenario }: Props) {
  const common = {
    currentValue: source.currentValue,
    currentMonthly: source.currentMonthly,
    sourceLabel: source.label,
    onRun,
    runScenario,
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="tala-eyebrow text-mint mb-1">Source: {source.label}</p>
        <p className="text-[16px] font-semibold text-paper">{TYPE_LABELS[scenarioType] ?? scenarioType}</p>
      </div>

      {scenarioType === "increase_monthly" && <IncreaseMonthlyForm {...common} />}
      {scenarioType === "add_lump_sum" && <AddLumpSumForm {...common} />}
      {scenarioType === "reduce_monthly" && <ReduceMonthlyForm {...common} />}
      {scenarioType === "pause_contributions" && <PauseContributionsForm {...common} />}
      {scenarioType === "market_drop" && <MarketDropForm {...common} />}
      {scenarioType === "retire_earlier" && (
        <RetireEarlierForm
          {...common}
          goals={goals}
          preselectedGoal={source.linkedGoal ?? null}
        />
      )}
    </div>
  );
}

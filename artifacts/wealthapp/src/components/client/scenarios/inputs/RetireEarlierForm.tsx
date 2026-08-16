import { useState, useEffect } from "react";
import { Link } from "wouter";
import { SourceDisplay, ReturnSlider, RunButton, NumberInput, RETURN_DEFAULT } from "./_shared";
import type { ScenarioParams, ScenarioResult } from "@/lib/investmentCalculations";
import type { DashboardGoal } from "@/hooks/useDashboardData";

interface Props {
  currentValue: number;
  currentMonthly: number;
  sourceLabel: string;
  goals: DashboardGoal[];
  preselectedGoal?: DashboardGoal | null;
  onRun: (result: ScenarioResult) => void;
  runScenario: (p: ScenarioParams) => ScenarioResult;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
}

function toMonthStr(date: string | null | undefined): string {
  if (!date) return "";
  return date.slice(0, 7); // "YYYY-MM-DD" → "YYYY-MM"
}

export default function RetireEarlierForm({ currentValue, currentMonthly, sourceLabel, goals, preselectedGoal, onRun, runScenario }: Props) {
  const [selectedGoalId, setSelectedGoalId] = useState<string>(preselectedGoal?.id ?? "");
  const [targetAmount, setTargetAmount] = useState(preselectedGoal?.targetAmount ?? "");
  const [currentTargetDate, setCurrentTargetDate] = useState(toMonthStr(preselectedGoal?.targetDate));
  const [earlierTargetDate, setEarlierTargetDate] = useState("");
  const [annualReturn, setAnnualReturn] = useState(RETURN_DEFAULT);

  useEffect(() => {
    if (preselectedGoal) {
      setSelectedGoalId(preselectedGoal.id);
      setTargetAmount(preselectedGoal.targetAmount ?? "");
      setCurrentTargetDate(toMonthStr(preselectedGoal.targetDate));
    }
  }, [preselectedGoal?.id]);

  function selectGoal(goalId: string) {
    setSelectedGoalId(goalId);
    const g = goals.find(g => g.id === goalId);
    if (g) {
      setTargetAmount(g.targetAmount ?? "");
      setCurrentTargetDate(toMonthStr(g.targetDate));
    }
  }

  const now = new Date();
  const currentTargetMonths = currentTargetDate
    ? monthsBetween(now, new Date(currentTargetDate + "-01"))
    : 0;
  const newTargetMonths = earlierTargetDate
    ? monthsBetween(now, new Date(earlierTargetDate + "-01"))
    : 0;
  const yearsSooner = currentTargetMonths > 0 && newTargetMonths > 0
    ? ((currentTargetMonths - newTargetMonths) / 12).toFixed(1)
    : null;

  const ta = parseFloat(targetAmount) || 0;
  const canRun = ta > 0 && currentTargetMonths > 0 && newTargetMonths > 0 && newTargetMonths < currentTargetMonths;

  function handleRun() {
    const result = runScenario({
      type: "retire_earlier",
      currentValue, currentMonthly,
      targetAmount: ta,
      currentTargetMonths,
      newTargetMonths,
      annualReturnPct: annualReturn,
    });
    onRun(result);
  }

  return (
    <div className="space-y-5">
      <SourceDisplay label={sourceLabel} currentValue={currentValue} currentMonthly={currentMonthly} />

      {goals.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
          No goals set yet.{" "}
          <Link href="/client/goals">
            <span className="font-semibold underline">Set a goal first →</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#042C53]">Which goal?</label>
          <select
            value={selectedGoalId}
            onChange={e => selectGoal(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] bg-white focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
          >
            <option value="">Select a goal…</option>
            {goals.map(g => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </div>
      )}

      <NumberInput
        label="Target amount"
        value={targetAmount}
        onChange={setTargetAmount}
        placeholder="500000"
        min={1}
        helper={!ta && selectedGoalId ? "Enter a target amount to continue." : undefined}
      />

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#042C53]">Your current target date</label>
        <input
          type="month"
          value={currentTargetDate}
          onChange={e => setCurrentTargetDate(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#042C53]">I want to reach this by</label>
        <input
          type="month"
          value={earlierTargetDate}
          onChange={e => setEarlierTargetDate(e.target.value)}
          max={currentTargetDate}
          className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
        />
        {yearsSooner && Number(yearsSooner) > 0 && (
          <p className="text-xs text-[#1D9E75] font-medium">That's {yearsSooner} years sooner</p>
        )}
        {newTargetMonths >= currentTargetMonths && currentTargetDate && earlierTargetDate && (
          <p className="text-xs text-red-500">Must be before your current target date.</p>
        )}
      </div>

      <ReturnSlider value={annualReturn} onChange={setAnnualReturn} />
      <RunButton
        disabled={!canRun}
        onClick={handleRun}
      />
      {!canRun && ta === 0 && (
        <p className="text-xs text-slate-400 text-center">Enter a target amount to calculate the required monthly contribution.</p>
      )}
    </div>
  );
}

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
        <div className="bg-sun rounded-[14px] p-3 text-[14px] text-forest">
          No goals set yet.{" "}
          <Link href="/client/goals/goals">
            <span className="font-semibold underline">Set a goal first →</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label className="text-[14px] font-medium text-paper">Which goal?</label>
          <select
            value={selectedGoalId}
            onChange={e => selectGoal(e.target.value)}
            className="w-full h-12 px-4 rounded-[14px] bg-white/10 text-[15px] font-semibold text-field [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-field"
          >
            <option value="" className="bg-paper text-forest">Select a goal…</option>
            {goals.map(g => (
              <option key={g.id} value={g.id} className="bg-paper text-forest">{g.title}</option>
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
        <label className="text-[14px] font-medium text-paper">Your current target date</label>
        <input
          type="month"
          value={currentTargetDate}
          onChange={e => setCurrentTargetDate(e.target.value)}
          className="w-full h-12 px-4 rounded-[14px] bg-white/10 text-[15px] font-semibold text-field [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-field"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[14px] font-medium text-paper">I want to reach this by</label>
        <input
          type="month"
          value={earlierTargetDate}
          onChange={e => setEarlierTargetDate(e.target.value)}
          max={currentTargetDate}
          className="w-full h-12 px-4 rounded-[14px] bg-white/10 text-[15px] font-semibold text-field [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-field"
        />
        {yearsSooner && Number(yearsSooner) > 0 && (
          <p className="text-[12px] text-field font-semibold">That's {yearsSooner} years sooner</p>
        )}
        {newTargetMonths >= currentTargetMonths && currentTargetDate && earlierTargetDate && (
          <p className="text-[12px] font-semibold text-sun">Must be before your current target date.</p>
        )}
      </div>

      <ReturnSlider value={annualReturn} onChange={setAnnualReturn} />
      <RunButton
        disabled={!canRun}
        onClick={handleRun}
      />
      {!canRun && ta === 0 && (
        <p className="text-[12px] text-mint text-center">Enter a target amount to calculate the required monthly contribution.</p>
      )}
    </div>
  );
}

import { useState } from "react";
import { SourceDisplay, HorizonSelector, ReturnSlider, RunButton, NumberInput, RETURN_DEFAULT } from "./_shared";
import type { ScenarioParams, ScenarioResult } from "@/lib/investmentCalculations";

interface Props {
  currentValue: number;
  currentMonthly: number;
  sourceLabel: string;
  onRun: (result: ScenarioResult) => void;
  runScenario: (p: ScenarioParams) => ScenarioResult;
}

export default function ReduceMonthlyForm({ currentValue, currentMonthly, sourceLabel, onRun, runScenario }: Props) {
  const [newMonthly, setNewMonthly] = useState("");
  const [horizonYears, setHorizonYears] = useState(10);
  const [annualReturn, setAnnualReturn] = useState(RETURN_DEFAULT);

  const nm = parseFloat(newMonthly) || 0;
  const savedPerMonth = currentMonthly - nm;

  function handleRun() {
    const result = runScenario({
      type: "reduce_monthly",
      currentValue, currentMonthly,
      newMonthly: nm,
      annualReturnPct: annualReturn,
      months: horizonYears * 12,
    });
    onRun(result);
  }

  return (
    <div className="space-y-5">
      <SourceDisplay label={sourceLabel} currentValue={currentValue} currentMonthly={currentMonthly} />
      <NumberInput
        label="Reduce my monthly to"
        value={newMonthly}
        onChange={setNewMonthly}
        placeholder="0"
        min={0}
        max={currentMonthly - 1}
        suffix="/ month"
        helper={savedPerMonth > 0 ? `Savings per month: $${Math.round(savedPerMonth).toLocaleString()}` : "Must be less than current monthly"}
      />
      <HorizonSelector value={horizonYears} onChange={setHorizonYears} />
      <ReturnSlider value={annualReturn} onChange={setAnnualReturn} />
      <RunButton disabled={nm >= currentMonthly || nm < 0} onClick={handleRun} />
    </div>
  );
}

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

export default function IncreaseMonthlyForm({ currentValue, currentMonthly, sourceLabel, onRun, runScenario }: Props) {
  const [newMonthly, setNewMonthly] = useState("");
  const [horizonYears, setHorizonYears] = useState(10);
  const [annualReturn, setAnnualReturn] = useState(RETURN_DEFAULT);

  const nm = parseFloat(newMonthly) || 0;
  const delta = nm - currentMonthly;
  const extraTotal = delta > 0 ? delta * horizonYears * 12 : 0;

  function handleRun() {
    const result = runScenario({
      type: "increase_monthly",
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
        label="Increase my monthly contribution to"
        value={newMonthly}
        onChange={setNewMonthly}
        placeholder={String(Math.round(currentMonthly * 1.25))}
        min={currentMonthly + 1}
        suffix="/ month"
        helper={delta > 0 ? `Extra per month: +$${Math.round(delta).toLocaleString()} · Extra over ${horizonYears}yr: $${Math.round(extraTotal).toLocaleString()}` : "Must be higher than current monthly"}
      />
      <HorizonSelector value={horizonYears} onChange={setHorizonYears} />
      <ReturnSlider value={annualReturn} onChange={setAnnualReturn} />
      <RunButton disabled={nm <= currentMonthly} onClick={handleRun} />
    </div>
  );
}

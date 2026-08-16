import { useState } from "react";
import { SourceDisplay, HorizonSelector, ReturnSlider, RunButton, SegmentedPicker, RETURN_DEFAULT } from "./_shared";
import type { ScenarioParams, ScenarioResult } from "@/lib/investmentCalculations";

const DROP_OPTIONS = [
  { label: "10%", value: 10 },
  { label: "20%", value: 20 },
  { label: "30%", value: 30 },
  { label: "40%", value: 40 },
];

const RECOVERY_OPTIONS = [
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
  { label: "18 months", value: 18 },
  { label: "24 months", value: 24 },
];

interface Props {
  currentValue: number;
  currentMonthly: number;
  sourceLabel: string;
  onRun: (result: ScenarioResult) => void;
  runScenario: (p: ScenarioParams) => ScenarioResult;
}

export default function MarketDropForm({ currentValue, currentMonthly, sourceLabel, onRun, runScenario }: Props) {
  const [dropPct, setDropPct] = useState(30);
  const [recoveryMonths, setRecoveryMonths] = useState(18);
  const [horizonYears, setHorizonYears] = useState(10);
  const [annualReturn, setAnnualReturn] = useState(RETURN_DEFAULT);

  const bottomValue = Math.round(currentValue * (1 - dropPct / 100));

  function handleRun() {
    const result = runScenario({
      type: "market_drop",
      currentValue, currentMonthly,
      dropPct,
      recoveryMonths,
      annualReturnPct: annualReturn,
      months: Math.max(horizonYears * 12, recoveryMonths + 12),
    });
    onRun(result);
  }

  return (
    <div className="space-y-5">
      <SourceDisplay label={sourceLabel} currentValue={currentValue} currentMonthly={currentMonthly} />
      <div className="space-y-1.5">
        <SegmentedPicker
          label="Markets fall by"
          options={DROP_OPTIONS}
          value={dropPct}
          onChange={(v) => setDropPct(v as number)}
        />
        <p className="text-xs text-slate-400">Portfolio would drop to ${bottomValue.toLocaleString("en-US")}</p>
      </div>
      <SegmentedPicker
        label="Recovery takes"
        options={RECOVERY_OPTIONS}
        value={recoveryMonths}
        onChange={(v) => setRecoveryMonths(v as number)}
      />
      <HorizonSelector value={horizonYears} onChange={setHorizonYears} />
      <ReturnSlider value={annualReturn} onChange={setAnnualReturn} />
      <RunButton onClick={handleRun} />
    </div>
  );
}

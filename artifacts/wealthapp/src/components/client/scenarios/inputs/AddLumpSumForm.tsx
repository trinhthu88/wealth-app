import { useState } from "react";
import { SourceDisplay, HorizonSelector, ReturnSlider, RunButton, NumberInput, SegmentedPicker, RETURN_DEFAULT } from "./_shared";
import type { ScenarioParams, ScenarioResult } from "@/lib/investmentCalculations";

const DELAY_OPTIONS = [
  { label: "Now", value: 0 },
  { label: "3 months", value: 3 },
  { label: "6 months", value: 6 },
  { label: "1 year", value: 12 },
];

interface Props {
  currentValue: number;
  currentMonthly: number;
  sourceLabel: string;
  onRun: (result: ScenarioResult) => void;
  runScenario: (p: ScenarioParams) => ScenarioResult;
}

export default function AddLumpSumForm({ currentValue, currentMonthly, sourceLabel, onRun, runScenario }: Props) {
  const [lumpSum, setLumpSum] = useState("");
  const [delay, setDelay] = useState(0);
  const [horizonYears, setHorizonYears] = useState(10);
  const [annualReturn, setAnnualReturn] = useState(RETURN_DEFAULT);

  const ls = parseFloat(lumpSum) || 0;

  function handleRun() {
    const result = runScenario({
      type: "add_lump_sum",
      currentValue, currentMonthly,
      lumpSumAmount: ls,
      lumpSumDelayMonths: delay,
      annualReturnPct: annualReturn,
      months: horizonYears * 12,
    });
    onRun(result);
  }

  return (
    <div className="space-y-5">
      <SourceDisplay label={sourceLabel} currentValue={currentValue} currentMonthly={currentMonthly} />
      <NumberInput
        label="Add a one-time investment of"
        value={lumpSum}
        onChange={setLumpSum}
        placeholder="10000"
        min={1}
        suffix="USD"
        helper="This will be added to your current value."
      />
      <SegmentedPicker
        label="When to invest"
        options={DELAY_OPTIONS}
        value={delay}
        onChange={(v) => setDelay(v as number)}
      />
      <HorizonSelector value={horizonYears} onChange={setHorizonYears} />
      <ReturnSlider value={annualReturn} onChange={setAnnualReturn} />
      <RunButton disabled={ls <= 0} onClick={handleRun} />
    </div>
  );
}

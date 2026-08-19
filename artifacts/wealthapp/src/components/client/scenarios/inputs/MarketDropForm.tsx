import { useState } from "react";
import { SourceDisplay, HorizonSelector, ReturnSlider, RunButton, SegmentedPicker, RETURN_DEFAULT } from "./_shared";
import { calcMarketDropRecoveryMonths, type ScenarioParams, type ScenarioResult } from "@/lib/investmentCalculations";

const DROP_OPTIONS = [
  { label: "10%", value: 10 },
  { label: "20%", value: 20 },
  { label: "30%", value: 30 },
  { label: "40%", value: 40 },
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
  const [horizonYears, setHorizonYears] = useState(10);
  const [annualReturn, setAnnualReturn] = useState(RETURN_DEFAULT);

  const bottomValue = Math.round(currentValue * (1 - dropPct / 100));
  const recoveryMonths = calcMarketDropRecoveryMonths(dropPct, annualReturn);

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
      <ReturnSlider value={annualReturn} onChange={setAnnualReturn} />
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
        <p className="text-xs text-slate-500">Estimated recovery</p>
        <p className="text-sm font-semibold text-[#042C53]">
          ~{recoveryMonths} month{recoveryMonths === 1 ? "" : "s"}, based on your {annualReturn}% expected return
        </p>
      </div>
      <HorizonSelector value={horizonYears} onChange={setHorizonYears} />
      <RunButton onClick={handleRun} />
    </div>
  );
}

import { useState } from "react";
import { SourceDisplay, HorizonSelector, ReturnSlider, RunButton, SegmentedPicker, RETURN_DEFAULT } from "./_shared";
import { cn } from "@/lib/utils";
import type { ScenarioParams, ScenarioResult } from "@/lib/investmentCalculations";

const PAUSE_OPTIONS = [
  { label: "3 months", value: 3 },
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
];

interface Props {
  currentValue: number;
  currentMonthly: number;
  sourceLabel: string;
  onRun: (result: ScenarioResult) => void;
  runScenario: (p: ScenarioParams) => ScenarioResult;
}

export default function PauseContributionsForm({ currentValue, currentMonthly, sourceLabel, onRun, runScenario }: Props) {
  const [pauseMonths, setPauseMonths] = useState(6);
  const [customPause, setCustomPause] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [horizonYears, setHorizonYears] = useState(10);
  const [annualReturn, setAnnualReturn] = useState(RETURN_DEFAULT);

  const effectivePause = isCustom ? (parseInt(customPause) || 6) : pauseMonths;
  const missedTotal = effectivePause * currentMonthly;
  const effectiveHorizon = Math.max(horizonYears, Math.ceil(effectivePause / 12) + 1);

  function handleRun() {
    const result = runScenario({
      type: "pause_contributions",
      currentValue, currentMonthly,
      pauseMonths: effectivePause,
      annualReturnPct: annualReturn,
      months: effectiveHorizon * 12,
    });
    onRun(result);
  }

  return (
    <div className="space-y-5">
      <SourceDisplay label={sourceLabel} currentValue={currentValue} currentMonthly={currentMonthly} />
      <div className="space-y-1.5">
        <label className="text-[14px] font-medium text-paper">Pause contributions for</label>
        <div className="flex flex-wrap gap-1.5">
          {PAUSE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setPauseMonths(opt.value); setIsCustom(false); }}
              className={cn("min-h-[44px] px-4 rounded-full text-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-field", !isCustom && pauseMonths === opt.value ? "bg-field text-forest" : "bg-white/10 text-paper hover:bg-white/20")}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setIsCustom(v => !v)}
            className={cn("min-h-[44px] px-4 rounded-full text-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-field", isCustom ? "bg-field text-forest" : "bg-white/10 text-paper hover:bg-white/20")}
          >
            Custom
          </button>
          {isCustom && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={customPause}
                min={1}
                max={36}
                onChange={e => setCustomPause(e.target.value)}
                placeholder="6"
                className="w-16 h-11 px-2 rounded-[14px] bg-white/10 text-[15px] font-semibold tabular-nums text-center text-field placeholder:text-mint/60 focus:outline-none focus:ring-2 focus:ring-field"
              />
              <span className="text-[14px] text-mint">months</span>
            </div>
          )}
        </div>
        <p className="text-[12px] text-mint">Missed contributions: ${Math.round(missedTotal).toLocaleString()}</p>
      </div>
      <HorizonSelector value={horizonYears} onChange={setHorizonYears} />
      <ReturnSlider value={annualReturn} onChange={setAnnualReturn} />
      <RunButton disabled={effectivePause <= 0} onClick={handleRun} />
    </div>
  );
}

import { useState } from "react";
import { Loader2 } from "lucide-react";
import ProjectionChart from "./chart/ProjectionChart";
import ScenarioSummaryStats from "./chart/ScenarioSummaryStats";
import type { ScenarioResult } from "@/lib/investmentCalculations";

interface Props {
  result: ScenarioResult;
  onSave: (name: string) => Promise<void>;
  onCompare: () => void;
  onReset: () => void;
  showCompare: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  increase_monthly: "Increase monthly contribution",
  add_lump_sum: "Add a lump sum",
  reduce_monthly: "Reduce monthly contribution",
  pause_contributions: "Pause contributions",
  market_drop: "Market drop stress test",
  retire_earlier: "Reach goal sooner",
};

export default function ScenarioResultPanel({ result, onSave, onCompare, onReset, showCompare }: Props) {
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saving, setSaving] = useState(false);

  const horizonYears = Math.round(result.dataPoints.length / 12);
  const typeLabel = TYPE_LABELS[result.params.type] ?? result.params.type;
  
  const isPositiveDelta = result.deltaValue >= 0;

  async function handleSave() {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await onSave(saveName.trim());
      setShowSaveInput(false);
      setSaveName("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-[14px] transition-opacity duration-150">
      <div className="bg-forest rounded-[30px] p-[22px]">
        <div className="flex justify-between items-baseline mb-[8px]">
          <span className="text-[14px] font-semibold text-mint">{typeLabel} (Year {horizonYears})</span>
          <span className="text-[13px] font-semibold text-forest bg-sun py-1 px-2.5 rounded-full">
            {isPositiveDelta ? 'Improved' : 'Below baseline'}
          </span>
        </div>
        <div className="font-display text-[40px] font-semibold text-paper tracking-[-0.03em] font-variant-numeric:tabular-nums">
          {result.scenarioFinalValue >= 1000000 
            ? `$${(result.scenarioFinalValue / 1000000).toFixed(2)}M` 
            : `$${(result.scenarioFinalValue / 1000).toFixed(0)}k`}
        </div>
        <div className="text-[13.5px] text-mint mb-[10px]">
          {isPositiveDelta ? '+' : '-'}${Math.abs(result.deltaValue / 1000).toFixed(0)}k vs baseline
        </div>
        
        <div className="mt-4">
          <ProjectionChart result={result} />
        </div>
      </div>

      <ScenarioSummaryStats result={result} horizonYears={horizonYears} />

      <div className="flex flex-col gap-[10px]">
        {!showSaveInput ? (
          <button
            onClick={() => setShowSaveInput(true)}
            className="w-full py-[14px] rounded-[20px] bg-green-tint text-forest font-semibold text-[14.5px] hover:bg-green-300 transition-colors"
          >
            Save this scenario
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Name this scenario…"
              autoFocus
              className="flex-1 px-4 py-3 rounded-[20px] border border-hairline bg-surface text-forest focus:outline-none focus:border-green"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim() || saving}
              className="px-5 py-3 rounded-[20px] bg-green text-white font-semibold disabled:opacity-50 flex items-center gap-1"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
            <button onClick={() => setShowSaveInput(false)} className="px-4 py-3 rounded-[20px] border border-hairline bg-surface text-ink-40 font-semibold">
              Cancel
            </button>
          </div>
        )}

        <div className="flex gap-[10px]">
          <button
            onClick={onCompare}
            className="flex-1 py-[14px] rounded-[20px] bg-sun-tint text-amber-ink font-semibold text-[14.5px] hover:bg-sun transition-colors"
          >
            {showCompare ? "Close compare" : "Compare with saved"}
          </button>
          <button
            onClick={onReset}
            className="flex-1 py-[14px] rounded-[20px] bg-clay-tint text-clay-ink font-semibold text-[14.5px] hover:bg-clay hover:text-white transition-colors"
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}

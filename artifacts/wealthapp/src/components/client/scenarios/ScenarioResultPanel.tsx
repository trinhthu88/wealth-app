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
      <div className="bg-surface rounded-[28px] p-5">
        <div className="flex justify-between items-center gap-3 mb-3">
          <span className="tala-eyebrow text-ink-40">{typeLabel} (Year {horizonYears})</span>
          <span
            className={
              isPositiveDelta
                ? "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold bg-forest text-paper"
                : "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold bg-sun text-forest"
            }
          >
            {isPositiveDelta ? 'Improved' : 'Below baseline'}
          </span>
        </div>
        <div className="font-display tabular-nums text-[56px] leading-none tracking-[-0.04em] text-forest">
          {result.scenarioFinalValue >= 1000000
            ? `$${(result.scenarioFinalValue / 1000000).toFixed(2)}M`
            : `$${(result.scenarioFinalValue / 1000).toFixed(0)}k`}
        </div>
        <div className="mt-3">
          <span
            className={
              isPositiveDelta
                ? "inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums bg-field text-forest"
                : "inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums bg-sun-tint text-clay-ink"
            }
          >
            {isPositiveDelta ? '+' : '-'}${Math.abs(result.deltaValue / 1000).toFixed(0)}k vs baseline
          </span>
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
            className="w-full h-12 px-5 rounded-full bg-forest text-paper font-semibold text-[15px] hover:bg-forest-700 transition-colors"
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
              className="flex-1 min-w-0 h-12 px-4 rounded-full bg-surface text-[14px] text-forest placeholder:text-ink-30 focus:outline-none focus:ring-2 focus:ring-forest"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim() || saving}
              className="h-12 px-5 rounded-full bg-forest text-paper font-semibold disabled:opacity-50 flex items-center gap-1"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
            <button onClick={() => setShowSaveInput(false)} className="h-12 px-4 rounded-full border-[1.5px] border-forest bg-transparent text-forest font-semibold">
              Cancel
            </button>
          </div>
        )}

        <div className="flex gap-[10px]">
          <button
            onClick={onCompare}
            className="flex-1 h-12 px-4 rounded-full border-[1.5px] border-forest bg-transparent text-forest font-semibold text-[15px] hover:bg-surface transition-colors"
          >
            {showCompare ? "Close compare" : "Compare with saved"}
          </button>
          <button
            onClick={onReset}
            className="flex-1 h-12 px-4 rounded-full border-[1.5px] border-forest bg-transparent text-forest font-semibold text-[15px] hover:bg-surface transition-colors"
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}

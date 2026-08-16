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
    <div className="space-y-4 transition-opacity duration-150">
      <div>
        <p className="text-sm font-semibold text-[#042C53]">{typeLabel}</p>
        <p className="text-xs text-slate-400">Baseline vs scenario over {horizonYears} years</p>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
        <ProjectionChart result={result} />
      </div>

      <ScenarioSummaryStats result={result} horizonYears={horizonYears} />

      <div className="flex flex-col gap-2">
        {!showSaveInput ? (
          <button
            onClick={() => setShowSaveInput(true)}
            className="w-full py-2.5 rounded-xl border border-[#1D9E75] text-[#1D9E75] font-medium text-sm hover:bg-[#1D9E75]/5 transition-colors"
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
              className="flex-1 px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim() || saving}
              className="px-4 py-2 rounded-xl bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </button>
            <button onClick={() => setShowSaveInput(false)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500">
              Cancel
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCompare}
            className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            {showCompare ? "Close compare" : "Compare with saved"}
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm hover:bg-slate-50"
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import type { ScenarioResult } from "@/lib/investmentCalculations";
import type { ScenarioRun } from "@/hooks/useScenarios";
import { runScenario as runFromParams } from "@/lib/investmentCalculations";

const COLORS = ["#1D9E75", "#3B82F6", "#F59E0B", "#8B5CF6"];

function fmtY(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

interface Props {
  current: ScenarioResult;
  saved: ScenarioRun[];
  onSaveCurrent: () => void;
  onClose: () => void;
}

export default function ScenarioCompareView({ current, saved, onSaveCurrent, onClose }: Props) {
  const savedResults = saved.slice(0, 3).map(run => {
    try {
      return runScenario(run.parameters as any);
    } catch { return null; }
  }).filter(Boolean) as ScenarioResult[];

  function runScenario(params: any): ScenarioResult {
    return runFromParams(params);
  }

  // Build unified data (align to current's dataPoints length)
  const len = current.dataPoints.length;
  const step = Math.max(1, Math.floor(len / 24));
  const chartData = current.dataPoints
    .filter((_, i) => i % step === 0 || i === len - 1)
    .map((pt, i) => {
      const out: Record<string, number | string> = { month: pt.month, label: pt.label, baseline: pt.baseline, current: pt.scenario };
      savedResults.forEach((sr, j) => {
        const sampled = sr.dataPoints.filter((_, k) => k % step === 0 || k === sr.dataPoints.length - 1);
        out[`saved_${j}`] = sampled[i]?.scenario ?? sampled[sampled.length - 1]?.scenario ?? 0;
      });
      return out;
    });

  const xTicks = chartData.filter((d: any) => d.month % 12 === 0).map((d: any) => d.month);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#042C53]">Compare scenarios</p>
        <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">Close ×</button>
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis
              dataKey="month"
              ticks={xTicks}
              tickFormatter={(m) => {
                const d = new Date();
                d.setMonth(d.getMonth() + m);
                return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
              }}
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tickFormatter={fmtY} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              formatter={(v: number) => [fmtY(v), ""]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line type="monotone" dataKey="baseline" stroke="#94A3B8" strokeDasharray="4 2" strokeWidth={1.5} dot={false} name="Baseline" />
            <Line type="monotone" dataKey="current" stroke={COLORS[0]} strokeWidth={2} dot={false} name="Current" />
            {savedResults.map((_, j) => (
              <Line key={j} type="monotone" dataKey={`saved_${j}`} stroke={COLORS[j + 1]} strokeWidth={2} dot={false} name={saved[j]?.scenarioName ?? `Saved ${j + 1}`} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-1.5 text-slate-400 font-medium">Scenario</th>
              <th className="text-right py-1.5 text-slate-400 font-medium">Final value</th>
              <th className="text-right py-1.5 text-slate-400 font-medium">vs baseline</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-50">
              <td className="py-1.5 flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[0] }} />
                <span className="font-medium text-[#042C53]">Current (unsaved)</span>
              </td>
              <td className="py-1.5 text-right font-medium">{fmtY(current.scenarioFinalValue)}</td>
              <td className={`py-1.5 text-right font-medium ${current.deltaValue >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {current.deltaValue >= 0 ? "+" : ""}{fmtY(current.deltaValue)}
              </td>
            </tr>
            {savedResults.map((sr, j) => (
              <tr key={j} className="border-b border-slate-50">
                <td className="py-1.5 flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[j + 1] }} />
                  <span>{saved[j]?.scenarioName ?? `Saved ${j + 1}`}</span>
                </td>
                <td className="py-1.5 text-right font-medium">{fmtY(sr.scenarioFinalValue)}</td>
                <td className={`py-1.5 text-right font-medium ${sr.deltaValue >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {sr.deltaValue >= 0 ? "+" : ""}{fmtY(sr.deltaValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
    <div className="bg-surface border border-hairline rounded-[26px] p-5 space-y-4 shadow-[0_2px_14px_rgba(20,52,42,.06)]">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold text-forest">Compare scenarios</p>
        <button onClick={onClose} className="text-[13px] text-ink-40 hover:text-forest">Close ×</button>
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
            <XAxis
              dataKey="month"
              ticks={xTicks}
              tickFormatter={(m) => {
                const d = new Date();
                d.setMonth(d.getMonth() + m);
                return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
              }}
              tick={{ fontSize: 10, fill: "var(--ink-40)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tickFormatter={fmtY} tick={{ fontSize: 10, fill: "var(--ink-40)" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              formatter={(v: number) => [fmtY(v), ""]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--hairline)" }}
            />
            <Line type="monotone" dataKey="baseline" stroke="var(--ink-30)" strokeDasharray="4 2" strokeWidth={1.5} dot={false} name="Baseline" />
            <Line type="monotone" dataKey="current" stroke={COLORS[0]} strokeWidth={2} dot={false} name="Current" />
            {savedResults.map((_, j) => (
              <Line key={j} type="monotone" dataKey={`saved_${j}`} stroke={COLORS[j + 1]} strokeWidth={2} dot={false} name={saved[j]?.scenarioName ?? `Saved ${j + 1}`} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-hairline">
              <th className="text-left py-2 text-ink-40 font-semibold">Scenario</th>
              <th className="text-right py-2 text-ink-40 font-semibold">Final value</th>
              <th className="text-right py-2 text-ink-40 font-semibold">vs baseline</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-hairline">
              <td className="py-2 flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[0] }} />
                <span className="font-semibold text-forest">Current (unsaved)</span>
              </td>
              <td className="py-2 text-right font-semibold text-forest">{fmtY(current.scenarioFinalValue)}</td>
              <td className={`py-2 text-right font-semibold ${current.deltaValue >= 0 ? "text-green" : "text-clay"}`}>
                {current.deltaValue >= 0 ? "+" : ""}{fmtY(current.deltaValue)}
              </td>
            </tr>
            {savedResults.map((sr, j) => (
              <tr key={j} className="border-b border-hairline">
                <td className="py-2 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[j + 1] }} />
                  <span className="text-forest">{saved[j]?.scenarioName ?? `Saved ${j + 1}`}</span>
                </td>
                <td className="py-2 text-right font-semibold text-forest">{fmtY(sr.scenarioFinalValue)}</td>
                <td className={`py-2 text-right font-semibold ${sr.deltaValue >= 0 ? "text-green" : "text-clay"}`}>
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

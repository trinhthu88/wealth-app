import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from "recharts";
import type { ScenarioResult } from "@/lib/investmentCalculations";

function fmtY(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

interface Props {
  result: ScenarioResult;
}

export default function ProjectionChart({ result }: Props) {
  const { dataPoints, params } = result;

  // Sample ~24 points for performance
  const step = Math.max(1, Math.floor(dataPoints.length / 24));
  const sampled = dataPoints.filter((_, i) => i % step === 0 || i === dataPoints.length - 1);

  // X-axis: tick every 12 months
  const xTicks = sampled.filter(p => p.month % 12 === 0).map(p => p.month);

  const ariaLabel = `Projection chart: baseline reaches $${Math.round(result.baselineFinalValue).toLocaleString()}, scenario reaches $${Math.round(result.scenarioFinalValue).toLocaleString()} — difference ${result.deltaValue >= 0 ? "+" : ""}$${Math.round(Math.abs(result.deltaValue)).toLocaleString()}`;

  return (
    <div role="img" aria-label={ariaLabel} className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sampled} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis
            dataKey="month"
            ticks={xTicks}
            tickFormatter={(m) => {
              const d = new Date();
              d.setMonth(d.getMonth() + m);
              return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
            }}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtY}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              const diff = d.scenario - d.baseline;
              return (
                <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
                  <p className="font-semibold text-[#042C53]">{d.label}</p>
                  <p className="text-slate-400">Baseline: <span className="font-medium text-slate-600">{fmtY(d.baseline)}</span></p>
                  <p className="text-[#1D9E75]">Scenario: <span className="font-medium">{fmtY(d.scenario)}</span></p>
                  <p className={diff >= 0 ? "text-emerald-600" : "text-red-500"}>
                    Difference: <span className="font-medium">{diff >= 0 ? "+" : ""}{fmtY(diff)}</span>
                  </p>
                </div>
              );
            }}
          />

          <Area type="monotone" dataKey="baseline" stroke="#94A3B8" strokeWidth={2} fill="#94A3B8" fillOpacity={0.15} name="Baseline" />
          <Area type="monotone" dataKey="scenario" stroke="#1D9E75" strokeWidth={2} fill="#1D9E75" fillOpacity={0.2} name="Scenario" />

          {/* Market drop reference lines */}
          {params.type === "market_drop" && (
            <>
              <ReferenceLine x={1} stroke="#EF4444" strokeDasharray="4 2" label={{ value: "Drop", position: "insideTopLeft", fontSize: 10, fill: "#EF4444" }} />
              <ReferenceLine x={params.recoveryMonths} stroke="#F59E0B" strokeDasharray="4 2" label={{ value: "Recovery", position: "insideTopLeft", fontSize: 10, fill: "#F59E0B" }} />
            </>
          )}

          {/* Retire earlier: goal reference line */}
          {params.type === "retire_earlier" && (
            <ReferenceLine
              y={params.targetAmount}
              stroke="#1D9E75"
              strokeDasharray="4 2"
              label={{ value: `Goal: ${fmtY(params.targetAmount)}`, position: "insideTopRight", fontSize: 10, fill: "#1D9E75" }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

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
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis
            dataKey="month"
            ticks={xTicks}
            tickFormatter={(m) => {
              const d = new Date();
              d.setMonth(d.getMonth() + m);
              return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
            }}
            tick={{ fontSize: 11, fill: "var(--ink-40)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtY}
            tick={{ fontSize: 11, fill: "var(--ink-40)" }}
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
                <div className="bg-paper border border-hairline rounded-[14px] px-3 py-2 text-[12px] tabular-nums space-y-1">
                  <p className="font-semibold text-forest">{d.label}</p>
                  <p className="text-ink-40">Baseline: <span className="font-medium text-forest">{fmtY(d.baseline)}</span></p>
                  <p className="text-forest">Scenario: <span className="font-semibold">{fmtY(d.scenario)}</span></p>
                  <p className={diff >= 0 ? "text-forest" : "text-clay-ink"}>
                    Difference: <span className="font-medium">{diff >= 0 ? "+" : ""}{fmtY(diff)}</span>
                  </p>
                </div>
              );
            }}
          />

          <Area type="monotone" dataKey="baseline" stroke="var(--breeze)" strokeWidth={2} fill="var(--breeze)" fillOpacity={0.35} name="Baseline" />
          <Area type="monotone" dataKey="scenario" stroke="var(--forest)" strokeWidth={2.8} strokeLinecap="round" fill="var(--forest)" fillOpacity={0.12} name="Scenario" />

          {/* Market drop reference lines */}
          {params.type === "market_drop" && (
            <>
              <ReferenceLine x={1} stroke="var(--sun)" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Drop", position: "insideTopLeft", fontSize: 11, fontWeight: 600, fill: "var(--clay-ink)" }} />
              <ReferenceLine x={params.recoveryMonths} stroke="var(--ink-30)" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Recovery", position: "insideTopLeft", fontSize: 11, fontWeight: 600, fill: "var(--ink-40)" }} />
            </>
          )}

          {/* Retire earlier: goal reference line */}
          {params.type === "retire_earlier" && (
            <ReferenceLine
              y={params.targetAmount}
              stroke="var(--forest)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `Goal: ${fmtY(params.targetAmount)}`, position: "insideTopRight", fontSize: 11, fontWeight: 600, fill: "var(--forest)" }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

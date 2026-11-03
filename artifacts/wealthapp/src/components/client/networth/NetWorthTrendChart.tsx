import { TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import type { TrendPoint } from "@/hooks/useNetWorthTrend";

function fmtY(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

interface Props {
  trendData: TrendPoint[];
  hasHistory: boolean;
}

export default function NetWorthTrendChart({ trendData, hasHistory }: Props) {
  const ariaLabel = hasHistory && trendData.length > 0
    ? `Net worth trend chart: current net worth ${fmtY(trendData[trendData.length - 1].netWorth)}`
    : "Net worth trend chart — no history yet";

  if (!hasHistory) {
    return (
      <div className="bg-surface rounded-[24px] p-6 flex flex-col items-center justify-center gap-3 min-h-[180px]">
        <div className="h-11 w-11 rounded-[14px] bg-field text-forest flex items-center justify-center">
          <TrendingUp className="h-5 w-5" />
        </div>
        <p className="text-[14px] text-ink-40 text-center max-w-xs">
          Your net worth trend will appear here as you update your values over time.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-surface rounded-[24px] p-5"
      role="img"
      aria-label={ariaLabel}
    >
      <h2 className="text-[16px] font-semibold text-forest mb-3">Trend</h2>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline-2)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--ink-40)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={fmtY}
              tick={{ fontSize: 11, fill: "var(--ink-40)" }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as TrendPoint;
                return (
                  <div className="bg-paper rounded-[14px] px-3 py-2 shadow-[0_8px_24px_rgba(12,33,164,0.12)] text-[12px] space-y-1">
                    <p className="font-semibold text-forest">{d.label}</p>
                    <p className="text-forest">Net worth: <span className="font-semibold tabular-nums">{fmtY(d.netWorth)}</span></p>
                    <p className="text-ink-40">Assets: <span className="font-medium tabular-nums text-forest">{fmtY(d.assets)}</span></p>
                    <p className="text-ink-40">Liabilities: <span className="font-medium tabular-nums text-forest">{fmtY(d.liabilities)}</span></p>
                  </div>
                );
              }}
            />
            <Legend
              iconType="line"
              formatter={(value) => <span className="text-[12px] text-ink-40">{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="netWorth"
              name="Net worth"
              stroke="var(--forest)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "var(--forest)" }}
            />
            <Line
              type="monotone"
              dataKey="assets"
              name="Assets"
              stroke="var(--mint-dim)"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="liabilities"
              name="Liabilities"
              stroke="var(--violet)"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

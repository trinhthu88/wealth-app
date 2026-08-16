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
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 flex flex-col items-center justify-center gap-3 min-h-[180px]">
        <TrendingUp className="h-8 w-8 text-[#1D9E75]" />
        <p className="text-sm text-slate-500 text-center max-w-xs">
          Your net worth trend will appear here as you update your values over time.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-xl p-4"
      role="img"
      aria-label={ariaLabel}
    >
      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">Trend</p>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={fmtY}
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as TrendPoint;
                return (
                  <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
                    <p className="font-semibold text-[#042C53]">{d.label}</p>
                    <p className="text-[#1D9E75]">Net worth: <span className="font-medium">{fmtY(d.netWorth)}</span></p>
                    <p className="text-slate-400">Assets: <span className="font-medium text-slate-600">{fmtY(d.assets)}</span></p>
                    <p className="text-red-400">Liabilities: <span className="font-medium">{fmtY(d.liabilities)}</span></p>
                  </div>
                );
              }}
            />
            <Legend
              iconType="line"
              formatter={(value) => <span className="text-xs text-slate-500">{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="netWorth"
              name="Net worth"
              stroke="#1D9E75"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#1D9E75" }}
            />
            <Line
              type="monotone"
              dataKey="assets"
              name="Assets"
              stroke="#94A3B8"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="liabilities"
              name="Liabilities"
              stroke="#EF4444"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

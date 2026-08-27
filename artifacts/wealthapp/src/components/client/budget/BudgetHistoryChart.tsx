import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import type { ClientBudgetMonth } from "@/hooks/useClientBudget";

function fmtY(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtMonth(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function n(s: string | null | undefined) { return parseFloat(s ?? "0") || 0; }

interface Props {
  months: ClientBudgetMonth[];
}

export default function BudgetHistoryChart({ months }: Props) {
  const ariaLabel = months.length > 0
    ? `12-month budget history. Latest month: income ${fmtY(n(months[months.length - 1]?.totalIncome))}, expenses ${fmtY(n(months[months.length - 1]?.totalExpenses))}, investments ${fmtY(n(months[months.length - 1]?.totalInvestments))}, surplus ${fmtY(n(months[months.length - 1]?.netSurplus))}.`
    : "No budget history yet.";

  if (months.length < 2) {
    // Single-bar preview
    const preview = months[0];
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-forest">12-month history</p>
        <p className="text-sm text-ink-40">
          Budget history will appear here once you've tracked for at least 2 months.
        </p>
        {preview && (
          <div className="h-[80px]" role="img" aria-label="Current month budget preview">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={[{
                label: fmtMonth(preview.month),
                expenses: n(preview.totalExpenses),
                investments: n(preview.totalInvestments),
                income: n(preview.totalIncome),
              }]} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <Bar dataKey="expenses" stackId="a" fill="var(--clay)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="investments" stackId="a" fill="var(--green)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="income" stroke="var(--forest)" strokeWidth={2} dot={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-20)" }} axisLine={false} tickLine={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  const chartData = months.map(m => ({
    label: fmtMonth(m.month),
    expenses: n(m.totalExpenses),
    investments: n(m.totalInvestments),
    income: n(m.totalIncome),
    surplus: n(m.netSurplus),
  }));

  const rateData = months.map(m => ({
    label: fmtMonth(m.month),
    rate: Math.max(0, n(m.savingsRatePct)),
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-forest">12-month history</p>

      {/* Main chart */}
      <div className="h-[220px]" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-20)" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtY} tick={{ fontSize: 10, fill: "var(--ink-20)" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload ?? {};
                return (
                  <div className="bg-surface border border-hairline rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
                    <p className="font-semibold text-forest">{label}</p>
                    <p className="text-forest">Income: <span className="font-medium">{fmtY(d.income)}</span></p>
                    <p className="text-clay">Expenses: <span className="font-medium">{fmtY(d.expenses)}</span></p>
                    <p className="text-green">Investments: <span className="font-medium">{fmtY(d.investments)}</span></p>
                    <p className="text-ink-60">Surplus: <span className="font-medium">{fmtY(d.surplus)}</span></p>
                  </div>
                );
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-xs text-ink-40">{value}</span>}
            />
            <Bar dataKey="expenses" name="Expenses" stackId="a" fill="var(--clay)" fillOpacity={0.85} />
            <Bar dataKey="investments" name="Investments" stackId="a" fill="var(--green)" fillOpacity={0.85} />
            <Line type="monotone" dataKey="income" name="Income" stroke="var(--forest)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="surplus" name="Surplus" stroke="var(--ink-20)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Savings rate sparkline */}
      <div className="h-[60px]">
        <p className="text-[10px] text-ink-30 mb-1">Savings rate</p>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rateData} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--ink-20)" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 50]} tick={{ fontSize: 9, fill: "var(--ink-20)" }} axisLine={false} tickLine={false} width={24} />
            <ReferenceLine y={20} stroke="var(--ink-20)" strokeDasharray="3 2" label={{ value: "20%", position: "right", fontSize: 9, fill: "var(--ink-20)" }} />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="var(--green)"
              strokeWidth={1.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

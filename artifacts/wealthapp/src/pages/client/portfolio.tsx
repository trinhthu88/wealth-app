import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface Holding { id: string; assetName: string; assetClass: string; currentValueUsd: string; weightPercent: string | null; tickerSymbol: string | null; isAdvisorManaged: boolean; }

const COLORS = ["#1D9E75", "#042C53", "#f59e0b", "#6366f1", "#ef4444", "#64748b", "#14b8a6", "#f97316"];

export default function ClientPortfolio() {
  const { data: holdings = [], isLoading } = useQuery<Holding[]>({ queryKey: ["portfolio"], queryFn: () => apiFetch<Holding[]>("/portfolio") });

  const total = holdings.reduce((s, h) => s + parseFloat(h.currentValueUsd), 0);
  const byClass = holdings.reduce<Record<string, number>>((acc, h) => {
    acc[h.assetClass] = (acc[h.assetClass] ?? 0) + parseFloat(h.currentValueUsd);
    return acc;
  }, {});
  const pieData = Object.entries(byClass).map(([name, value]) => ({ name, value }));

  if (isLoading) return <AppShell><div className="animate-pulse space-y-4"><div className="h-64 bg-muted rounded-xl" /></div></AppShell>;

  return (
    <AppShell>
      <PageHeader title="My Portfolio" subtitle={`Total value: $${total.toLocaleString()} USD`} />

      {holdings.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-16 text-center">
          <BarChart3 className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Holdings Yet</h3>
          <p className="text-muted-foreground text-sm">Your advisor will populate your portfolio holdings.</p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Allocation by Asset Class</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Asset Class Summary</h3>
              <div className="space-y-3">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-sm flex-1 capitalize">{d.name}</span>
                    <span className="text-sm font-semibold">${d.value.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">{((d.value / total) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">All Holdings</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Asset</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Class</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Value (USD)</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Weight</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Managed</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => (
                    <tr key={h.id} className="border-b border-border last:border-0">
                      <td className="py-2.5">
                        <div className="font-medium">{h.assetName}</div>
                        {h.tickerSymbol && <div className="text-xs text-muted-foreground">{h.tickerSymbol}</div>}
                      </td>
                      <td className="py-2.5 text-muted-foreground capitalize">{h.assetClass}</td>
                      <td className="py-2.5 text-right font-semibold">${parseFloat(h.currentValueUsd).toLocaleString()}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{h.weightPercent ? `${h.weightPercent}%` : "—"}</td>
                      <td className="py-2.5 text-right">{h.isAdvisorManaged ? <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Advisor</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

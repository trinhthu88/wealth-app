import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, ASSET_CLASS_COLORS } from "@/lib/portfolioCalculations";
import { ArrowRight } from "lucide-react";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface PackageSummary {
  id: string;
  nickname: string;
  type: string;
  status: string;
  monthlyAmount: string | null;
  latestSnapshot: { totalValueUsd: string; totalInvestedUsd: string; totalReturnPercent: string | null } | null;
  allocations: Array<{ fundId: string; weightPercent: string; fund: { name: string; assetClass: string } | null }>;
}

const TIME_FILTERS = ["3M", "6M", "1Y", "All"] as const;

export default function PortfolioOverview() {
  const [timeFilter, setTimeFilter] = useState<typeof TIME_FILTERS[number]>("All");

  const { data: packages = [], isLoading } = useQuery<PackageSummary[]>({
    queryKey: ["my-packages"],
    queryFn: () => apiFetch("/packages"),
  });

  const totalValue = packages.reduce((s, p) => s + parseFloat(p.latestSnapshot?.totalValueUsd ?? "0"), 0);
  const totalInvested = packages.reduce((s, p) => s + parseFloat(p.latestSnapshot?.totalInvestedUsd ?? "0"), 0);
  const totalReturn = totalValue - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  const assetClassAgg: Record<string, number> = {};
  for (const pkg of packages) {
    for (const alloc of pkg.allocations) {
      const cls = alloc.fund?.assetClass ?? "equity";
      const wt = parseFloat(alloc.weightPercent) / 100;
      const pkgValue = parseFloat(pkg.latestSnapshot?.totalValueUsd ?? "0");
      assetClassAgg[cls] = (assetClassAgg[cls] ?? 0) + wt * pkgValue;
    }
  }
  const pieData = Object.entries(assetClassAgg).map(([cls, val]) => ({
    name: cls.replace(/_/g, " "),
    value: Math.round(val),
    pct: totalValue > 0 ? (val / totalValue) * 100 : 0,
    color: ASSET_CLASS_COLORS[cls] ?? "#94A3B8",
  }));

  const chartData = [
    { date: "Start", value: totalInvested, invested: totalInvested },
    { date: "Now", value: totalValue, invested: totalInvested },
  ];

  return (
    <AppShell>
      <PageHeader title="Portfolio Overview" subtitle="Your complete investment picture." />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 mb-5 text-white" style={{ background: "linear-gradient(135deg,#042C53 0%,#0a4a8a 100%)" }}>
        <div className="text-slate-300 text-xs mb-1">Total Portfolio Value</div>
        <div className="text-3xl font-bold mb-1">{fmtCurrency(totalValue)}</div>
        <div className={`text-sm mb-4 ${totalReturn >= 0 ? "text-emerald-300" : "text-red-300"}`}>
          {totalReturn >= 0 ? "▲" : "▼"} {fmtCurrency(Math.abs(totalReturn))} ({totalReturn >= 0 ? "+" : ""}{totalReturnPct.toFixed(2)}%) total return
        </div>
        <div className="flex gap-4 text-xs text-slate-400">
          <span>Total invested: {fmtCurrency(totalInvested)}</span>
          <span>{packages.filter(p => p.status === "active").length} active package(s)</span>
        </div>
      </motion.div>

      {totalValue > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card border border-card-border rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Performance</h3>
            <div className="flex gap-1">
              {TIME_FILTERS.map((f) => (
                <button key={f} onClick={() => setTimeFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${timeFilter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={55} />
              <Tooltip formatter={(v: any) => fmtCurrency(v)} />
              <Area type="monotone" dataKey="value" fill="#1D9E7520" stroke="#1D9E75" strokeWidth={2} name="Portfolio value" />
              <Line type="monotone" dataKey="invested" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Total invested" />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground text-center mt-1">Full history chart grows as your portfolio ages.</p>
        </motion.div>
      )}

      {pieData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card border border-card-border rounded-2xl p-4 mb-5">
          <h3 className="font-semibold text-sm mb-3">Allocation by Asset Class</h3>
          <div className="flex flex-col items-center">
            <PieChart width={220} height={160}>
              <Pie data={pieData} cx={110} cy={80} innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmtCurrency(v)} />
            </PieChart>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
              {pieData.map((d) => (
                <span key={d.name} className="text-xs flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: d.color }} />
                  <span className="capitalize">{d.name}</span>
                  <span className="font-medium">{d.pct.toFixed(1)}%</span>
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 className="font-semibold mb-3">Packages Summary</h3>
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
          ) : packages.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No packages yet. Your advisor will set these up.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Package</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Value</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Return</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => {
                  const val = parseFloat(pkg.latestSnapshot?.totalValueUsd ?? "0");
                  const inv = parseFloat(pkg.latestSnapshot?.totalInvestedUsd ?? "0");
                  const ret = val - inv;
                  const retPct = inv > 0 ? (ret / inv) * 100 : 0;
                  return (
                    <tr key={pkg.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{pkg.nickname}</div>
                        <div className="text-xs text-muted-foreground capitalize">{pkg.type.replace(/_/g, " ")}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(val)}</td>
                      <td className={`px-4 py-3 text-right text-xs font-medium ${ret >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {ret >= 0 ? "+" : ""}{retPct.toFixed(1)}%
                      </td>
                      <td className="px-2 py-3">
                        <Link href={`/client/packages/${pkg.id}`}>
                          <a><ArrowRight className="h-4 w-4 text-muted-foreground" /></a>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </AppShell>
  );
}

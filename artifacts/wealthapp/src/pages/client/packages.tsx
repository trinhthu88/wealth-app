import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { fmtCurrency } from "@/lib/portfolioCalculations";
import { ArrowRight, Plus, TrendingUp, TrendingDown } from "lucide-react";

interface PackageSummary {
  id: string;
  nickname: string;
  type: string;
  status: string;
  monthlyAmount: string | null;
  lumpSumAmount: string | null;
  startDate: string | null;
  goalId: string | null;
  latestSnapshot: { totalValueUsd: string; totalInvestedUsd: string; totalReturnPercent: string } | null;
  allocations: Array<{ fundId: string; weightPercent: string; fund: { name: string; assetClass: string } | null }>;
}

const TYPE_LABELS: Record<string, string> = {
  rsp: "RSP",
  lump_sum: "Lump Sum",
  combination: "Both",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending_setup: "bg-amber-100 text-amber-700",
  paused: "bg-slate-100 text-slate-600",
  closed: "bg-red-100 text-red-600",
};

export default function PackagesPage() {
  const { data: packages = [], isLoading } = useQuery<PackageSummary[]>({
    queryKey: ["my-packages"],
    queryFn: () => apiFetch("/packages"),
  });

  const totalValue = packages.reduce((s, p) => s + parseFloat(p.latestSnapshot?.totalValueUsd ?? "0"), 0);
  const activeCount = packages.filter((p) => p.status === "active").length;

  return (
    <AppShell>
      <PageHeader title="My Investment Packages" subtitle={`${activeCount} active package${activeCount !== 1 ? "s" : ""} · Total ${fmtCurrency(totalValue)}`} />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {packages.map((pkg, i) => {
            const value = parseFloat(pkg.latestSnapshot?.totalValueUsd ?? "0");
            const invested = parseFloat(pkg.latestSnapshot?.totalInvestedUsd ?? "0");
            const ret = value - invested;
            const retPct = invested > 0 ? (ret / invested) * 100 : 0;
            const isActive = pkg.status === "active";

            return (
              <motion.div key={pkg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/client/packages/${pkg.id}`}>
                  <a className="block bg-card border border-card-border rounded-2xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base">{pkg.nickname}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[pkg.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {pkg.status === "pending_setup" ? "Being set up" : pkg.status}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                          {TYPE_LABELS[pkg.type] ?? pkg.type}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
                    </div>

                    {isActive ? (
                      <div>
                        <div className="text-2xl font-bold text-navy mb-1">{fmtCurrency(value)}</div>
                        <div className={`flex items-center gap-1 text-sm mb-3 ${ret >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {ret >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {ret >= 0 ? "+" : ""}{fmtCurrency(Math.abs(ret))} ({ret >= 0 ? "+" : ""}{retPct.toFixed(1)}%) since inception
                        </div>
                        {pkg.monthlyAmount && (
                          <div className="text-xs text-muted-foreground mb-3">
                            {fmtCurrency(parseFloat(pkg.monthlyAmount))}/month
                          </div>
                        )}
                        {pkg.allocations.length > 0 && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-1.5">Fund allocation</div>
                            <div className="h-2.5 rounded-full overflow-hidden flex">
                              {pkg.allocations.map((a, idx) => {
                                const colors = ["#1D9E75", "#042C53", "#94A3B8", "#F59E0B", "#8B5CF6", "#EC4899"];
                                return (
                                  <div key={a.fundId} style={{ width: `${a.weightPercent}%`, backgroundColor: colors[idx % colors.length] }} className="h-full" />
                                );
                              })}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                              {pkg.allocations.slice(0, 4).map((a, idx) => {
                                const colors = ["#1D9E75", "#042C53", "#94A3B8", "#F59E0B", "#8B5CF6", "#EC4899"];
                                return (
                                  <span key={a.fundId} className="text-xs text-muted-foreground flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: colors[idx % colors.length] }} />
                                    {a.fund?.name ?? "Fund"} {parseFloat(a.weightPercent).toFixed(0)}%
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Being set up by your advisor
                        {pkg.startDate && <span> · Expected start: {pkg.startDate}</span>}
                      </div>
                    )}
                  </a>
                </Link>
              </motion.div>
            );
          })}

          <a className="block bg-card border-2 border-dashed border-border rounded-2xl p-6 text-center hover:border-primary/40 transition-colors cursor-pointer">
            <Plus className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <div className="font-medium text-sm">Request a new package</div>
            <div className="text-xs text-muted-foreground mt-1">Your advisor will set it up for you</div>
          </a>
        </div>
      )}
    </AppShell>
  );
}

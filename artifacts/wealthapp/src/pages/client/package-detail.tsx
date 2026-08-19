import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import ClientAppShell from "@/components/client/AppShell";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, ASSET_CLASS_COLORS } from "@/lib/portfolioCalculations";
import { ArrowLeft, TrendingUp, TrendingDown, FileText, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

interface PackageDetail {
  id: string;
  nickname: string;
  type: string;
  status: string;
  monthlyAmount: string | null;
  lumpSumAmount: string | null;
  startDate: string | null;
  expectedAnnualReturn: string;
  advisorNotes: string | null;
  allocations: Array<{
    id: string;
    fundId: string;
    weightPercent: string;
    unitsHeld: string;
    isActive: boolean;
    fund: { id: string; name: string; ticker: string; assetClass: string; fundManager: string | null; factsheetUrl: string | null } | null;
  }>;
  transactions: Array<{
    id: string;
    transactionDate: string;
    transactionType: string;
    amountUsd: string;
    units: string | null;
    pricePerUnitUsd: string | null;
    notes: string | null;
    fund: { name: string; ticker: string } | null;
  }>;
  snapshots: Array<{
    id: string;
    snapshotDate: string;
    totalInvestedUsd: string;
    totalValueUsd: string;
    totalReturnPercent: string | null;
  }>;
}

const TX_TYPE_LABELS: Record<string, string> = {
  initial_investment: "Initial investment",
  monthly_contribution: "Monthly contribution",
  top_up: "Top up",
  withdrawal: "Withdrawal",
  dividend_reinvested: "Dividend reinvested",
  fee_charged: "Fee charged",
  rebalance: "Rebalance",
};

const TYPE_LABELS: Record<string, string> = { rsp: "RSP", lump_sum: "Lump Sum", combination: "Both" };

export default function PackageDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: pkg, isLoading } = useQuery<PackageDetail>({
    queryKey: ["package", id],
    queryFn: () => apiFetch(`/packages/${id}`),
    enabled: !!id,
  });

  if (isLoading || !pkg) {
    return (
      <ClientAppShell>
        <div className="max-w-[860px] mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/3" />
          <div className="h-32 bg-slate-100 rounded-xl" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </ClientAppShell>
    );
  }

  const latestSnap = pkg.snapshots[pkg.snapshots.length - 1];
  const firstSnap = pkg.snapshots[0];
  const value = parseFloat(latestSnap?.totalValueUsd ?? "0");
  const invested = parseFloat(latestSnap?.totalInvestedUsd ?? "0");
  const ret = value - invested;
  const retPct = invested > 0 ? (ret / invested) * 100 : 0;

  const chartData = pkg.snapshots.map((s) => ({
    date: s.snapshotDate,
    value: parseFloat(s.totalValueUsd),
    invested: parseFloat(s.totalInvestedUsd),
  }));

  const activeAllocs = pkg.allocations.filter((a) => a.isActive);
  const pieData = activeAllocs.map((a) => ({
    name: a.fund?.name ?? "Unknown",
    value: parseFloat(a.weightPercent),
    assetClass: a.fund?.assetClass ?? "equity",
  }));

  const assetClassAgg: Record<string, number> = {};
  activeAllocs.forEach((a) => {
    const cls = a.fund?.assetClass ?? "equity";
    assetClassAgg[cls] = (assetClassAgg[cls] ?? 0) + parseFloat(a.weightPercent);
  });

  return (
    <ClientAppShell>
      <div className="max-w-[860px] mx-auto">
      <div className="mb-4">
        <Link href="/client/portfolio" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#042C53] transition-colors">
          <ArrowLeft className="h-4 w-4" /> Investment accounts
        </Link>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-slate-400 mb-1">{TYPE_LABELS[pkg.type] ?? pkg.type}</div>
            <h1 className="text-2xl font-bold text-[#042C53]">{pkg.nickname}</h1>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${pkg.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {pkg.status === "pending_setup" ? "Setting up" : pkg.status}
          </span>
        </div>
        <div className="text-3xl font-bold text-[#042C53] mb-1">{fmtCurrency(value)}</div>
        <div className={`flex items-center gap-1 text-sm ${ret >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {ret >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {ret >= 0 ? "+" : ""}{fmtCurrency(Math.abs(ret))} ({ret >= 0 ? "+" : ""}{retPct.toFixed(2)}%) since inception
        </div>
        <div className="flex gap-4 mt-3 text-xs text-slate-400">
          <span>Invested: {fmtCurrency(invested)}</span>
          {pkg.monthlyAmount && <span>{fmtCurrency(parseFloat(pkg.monthlyAmount))}/month</span>}
          {pkg.startDate && <span>Since {pkg.startDate}</span>}
        </div>
      </div>

      <Tabs defaultValue="performance">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="performance" className="flex-1">Performance</TabsTrigger>
          <TabsTrigger value="holdings" className="flex-1">Holdings</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <div className="bg-card border border-card-border rounded-2xl p-4">
            <h3 className="font-semibold mb-4 text-sm">Value vs. Invested Over Time</h3>
            {chartData.length > 1 ? (
              <div role="img" aria-label={`Package performance chart: current value ${fmtCurrency(value)}, return ${retPct.toFixed(2)}% since inception`}>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={55} />
                    <Tooltip formatter={(v: any) => fmtCurrency(v)} />
                    <Area type="monotone" dataKey="value" fill="#1D9E7520" stroke="#1D9E75" strokeWidth={2} name="Portfolio value" />
                    <Line type="monotone" dataKey="invested" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Total invested" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                Performance chart will appear once your package has history.
              </div>
            )}
          </div>

          {pkg.advisorNotes && (
            <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="text-xs font-medium text-primary mb-1">Advisor note</div>
              <p className="text-sm">{pkg.advisorNotes}</p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">Expected annual return</div>
              <div className="text-xl font-bold text-primary">{parseFloat(pkg.expectedAnnualReturn).toFixed(1)}%</div>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">Package type</div>
              <div className="text-xl font-bold">{TYPE_LABELS[pkg.type] ?? pkg.type}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="holdings">
          {activeAllocs.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Fund allocation will appear once your advisor sets it up.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-card border border-card-border rounded-2xl p-4">
                <h3 className="font-semibold mb-3 text-sm">Asset Class Breakdown</h3>
                <div className="h-2.5 rounded-full overflow-hidden flex mb-3">
                  {Object.entries(assetClassAgg).map(([cls, pct]) => (
                    <div key={cls} style={{ width: `${pct}%`, backgroundColor: ASSET_CLASS_COLORS[cls] ?? "#94A3B8" }} className="h-full" />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {Object.entries(assetClassAgg).map(([cls, pct]) => (
                    <span key={cls} className="text-xs flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: ASSET_CLASS_COLORS[cls] ?? "#94A3B8" }} />
                      <span className="capitalize">{cls.replace("_", " ")}</span>
                      <span className="font-medium">{pct.toFixed(1)}%</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {activeAllocs.map((a, i) => (
                  <div key={a.id} className="bg-card border border-card-border rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-sm">{a.fund?.name ?? "Unknown fund"}</div>
                        <div className="text-xs text-muted-foreground">{a.fund?.ticker ?? ""} · {a.fund?.assetClass ?? ""} · {a.fund?.fundManager ?? ""}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-base">{parseFloat(a.weightPercent).toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">{parseFloat(a.unitsHeld).toFixed(4)} units</div>
                      </div>
                    </div>
                    {a.fund?.factsheetUrl && (
                      <a href={a.fund.factsheetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                        <FileText className="h-3 w-3" /> Fund factsheet <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          {pkg.transactions.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No transactions yet.</div>
          ) : (
            <div className="space-y-2">
              {pkg.transactions.map((tx) => {
                const isOutflow = ["withdrawal", "fee_charged"].includes(tx.transactionType);
                return (
                  <div key={tx.id} className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isOutflow ? "bg-red-50" : "bg-emerald-50"}`}>
                      {isOutflow ? <TrendingDown className="h-4 w-4 text-red-500" /> : <TrendingUp className="h-4 w-4 text-emerald-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{TX_TYPE_LABELS[tx.transactionType] ?? tx.transactionType}</div>
                      <div className="text-xs text-muted-foreground">
                        {tx.fund?.name && <span>{tx.fund.name} · </span>}
                        {tx.transactionDate}
                        {tx.notes && <span> · {tx.notes}</span>}
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${isOutflow ? "text-red-500" : "text-emerald-600"}`}>
                      {isOutflow ? "-" : "+"}{fmtCurrency(parseFloat(tx.amountUsd))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </ClientAppShell>
  );
}

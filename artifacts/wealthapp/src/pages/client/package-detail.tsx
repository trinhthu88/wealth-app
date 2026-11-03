import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import ClientAppShell from "@/components/client/AppShell";
import { apiFetch } from "@/lib/api";
import { fmtCurrency } from "@/lib/portfolioCalculations";
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

// Palette colours per asset class (Cobalt / Spring Field / Blue Breeze family).
const ASSET_CLASS_PALETTE: Record<string, string> = {
  equity: "var(--forest)",
  bond: "var(--field)",
  cash: "var(--breeze)",
  real_estate: "var(--forest-700)",
  commodity: "var(--mint-dim)",
  alternative: "var(--ink-30)",
};
const ASSET_CLASS_FALLBACK = "var(--ink-20)";
const DARK_ASSET_CLASSES = new Set(["equity", "real_estate"]);

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
          <div className="h-8 bg-surface rounded-full w-1/3" />
          <div className="h-32 bg-surface rounded-[28px]" />
          <div className="h-64 bg-surface rounded-[24px]" />
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
      <div className="max-w-[860px] mx-auto space-y-4 pb-8">
      <div>
        <Link href="/client/wealth/investments" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-ink-40 hover:text-forest transition-colors">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Investment accounts
        </Link>
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <div className="tala-eyebrow text-ink-40 mb-1">{TYPE_LABELS[pkg.type] ?? pkg.type}</div>
            <h1 className="font-display text-[34px] leading-[1.05] text-forest">{pkg.nickname}</h1>
          </div>
          <span className={`mt-1 shrink-0 text-[12px] px-2.5 py-1 rounded-full font-semibold capitalize ${pkg.status === "active" ? "bg-forest text-paper" : "bg-sun text-forest"}`}>
            {pkg.status === "pending_setup" ? "Setting up" : pkg.status}
          </span>
        </div>
      </div>

      <section aria-label="Package value" className="bg-forest text-paper rounded-[28px] p-5 flex flex-col gap-3">
        <span className="tala-eyebrow text-mint">Current value</span>
        <div className="font-display tabular-nums text-[52px] leading-none tracking-[-0.04em] text-paper">{fmtCurrency(value)}</div>
        <div className={`self-start inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold tabular-nums text-forest ${ret >= 0 ? "bg-field" : "bg-sun"}`}>
          {ret >= 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
          {ret >= 0 ? "+" : ""}{fmtCurrency(Math.abs(ret))} ({ret >= 0 ? "+" : ""}{retPct.toFixed(2)}%) since inception
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 border-t border-white/20 text-[13px] text-mint tabular-nums">
          <span>Invested: {fmtCurrency(invested)}</span>
          {pkg.monthlyAmount && <span>{fmtCurrency(parseFloat(pkg.monthlyAmount))}/month</span>}
          {pkg.startDate && <span>Since {pkg.startDate}</span>}
        </div>
      </section>

      <Tabs defaultValue="performance">
        <TabsList className="mb-4 w-full h-auto rounded-full bg-surface p-1">
          <TabsTrigger value="performance" className="flex-1 min-h-10 rounded-full text-[13px] font-semibold text-ink-40 data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none">Performance</TabsTrigger>
          <TabsTrigger value="holdings" className="flex-1 min-h-10 rounded-full text-[13px] font-semibold text-ink-40 data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none">Holdings</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 min-h-10 rounded-full text-[13px] font-semibold text-ink-40 data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <div className="bg-surface rounded-[24px] p-5">
            <h3 className="font-semibold mb-4 text-[16px] text-forest">Value vs. Invested Over Time</h3>
            {chartData.length > 1 ? (
              <div role="img" aria-label={`Package performance chart: current value ${fmtCurrency(value)}, return ${retPct.toFixed(2)}% since inception`}>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--ink-40)" }} tickFormatter={(v) => v.slice(5)} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--ink-40)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={55} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => fmtCurrency(v)} />
                    <Area type="monotone" dataKey="value" fill="var(--forest)" fillOpacity={0.12} stroke="var(--forest)" strokeWidth={2.5} name="Portfolio value" />
                    <Line type="monotone" dataKey="invested" stroke="var(--breeze)" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Total invested" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-[14px] text-ink-40 text-center">
                Performance chart will appear once your package has history.
              </div>
            )}
          </div>

          {pkg.advisorNotes && (
            <div className="mt-4 bg-breeze rounded-[24px] p-4">
              <div className="tala-eyebrow text-forest mb-1">Advisor note</div>
              <p className="text-[14px] text-forest">{pkg.advisorNotes}</p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-[24px] p-4">
              <div className="tala-eyebrow text-ink-40 mb-1.5">Expected annual return</div>
              <div className="text-[18px] font-semibold text-forest tabular-nums">{parseFloat(pkg.expectedAnnualReturn).toFixed(1)}%</div>
            </div>
            <div className="bg-surface rounded-[24px] p-4">
              <div className="tala-eyebrow text-ink-40 mb-1.5">Package type</div>
              <div className="text-[18px] font-semibold text-forest">{TYPE_LABELS[pkg.type] ?? pkg.type}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="holdings">
          {activeAllocs.length === 0 ? (
            <div className="bg-surface rounded-[24px] text-center p-8 text-[14px] text-ink-40">
              Fund allocation will appear once your advisor sets it up.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-surface rounded-[24px] p-5">
                <h3 className="font-semibold mb-3 text-[16px] text-forest">Asset Class Breakdown</h3>
                <div className="h-2 rounded-full overflow-hidden flex gap-px mb-3 bg-forest/15">
                  {Object.entries(assetClassAgg).map(([cls, pct]) => (
                    <div key={cls} style={{ width: `${pct}%`, backgroundColor: ASSET_CLASS_PALETTE[cls] ?? ASSET_CLASS_FALLBACK }} className="h-full" />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {Object.entries(assetClassAgg).map(([cls, pct]) => (
                    <span key={cls} className="text-[13px] text-forest flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: ASSET_CLASS_PALETTE[cls] ?? ASSET_CLASS_FALLBACK }} />
                      <span className="capitalize">{cls.replace("_", " ")}</span>
                      <span className="font-semibold tabular-nums">{pct.toFixed(1)}%</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-surface rounded-[24px] p-1">
                {activeAllocs.map((a, i) => (
                  <div key={a.id} className="p-3 border-b border-hairline last:border-0">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[11px] font-semibold"
                        style={{ background: ASSET_CLASS_PALETTE[a.fund?.assetClass ?? "equity"] ?? ASSET_CLASS_FALLBACK, color: DARK_ASSET_CLASSES.has(a.fund?.assetClass ?? "equity") ? "var(--paper)" : "var(--forest)" }}
                      >
                        {(a.fund?.ticker || a.fund?.name || "?").slice(0, 4).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[15px] text-forest truncate">{a.fund?.name ?? "Unknown fund"}</div>
                        <div className="text-[13px] text-ink-40 truncate">{a.fund?.ticker ?? ""} · {a.fund?.assetClass ?? ""} · {a.fund?.fundManager ?? ""}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-[15px] text-forest tabular-nums">{parseFloat(a.weightPercent).toFixed(1)}%</div>
                        <div className="text-[12px] text-ink-40 tabular-nums">{parseFloat(a.unitsHeld).toFixed(4)} units</div>
                      </div>
                    </div>
                    {a.fund?.factsheetUrl && (
                      <a href={a.fund.factsheetUrl} target="_blank" rel="noopener noreferrer" className="ml-14 mt-1 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-green underline-offset-2 hover:underline">
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
            <div className="bg-surface rounded-[24px] text-center p-8 text-[14px] text-ink-40">No transactions yet.</div>
          ) : (
            <div className="bg-surface rounded-[24px] p-1">
              {pkg.transactions.map((tx) => {
                const isOutflow = ["withdrawal", "fee_charged"].includes(tx.transactionType);
                return (
                  <div key={tx.id} className="p-3 border-b border-hairline last:border-0 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 text-forest ${isOutflow ? "bg-breeze" : "bg-field"}`}>
                      {isOutflow ? <TrendingDown className="h-4 w-4" aria-hidden="true" /> : <TrendingUp className="h-4 w-4" aria-hidden="true" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-forest">{TX_TYPE_LABELS[tx.transactionType] ?? tx.transactionType}</div>
                      <div className="text-[13px] text-ink-40 truncate">
                        {tx.fund?.name && <span>{tx.fund.name} · </span>}
                        {tx.transactionDate}
                        {tx.notes && <span> · {tx.notes}</span>}
                      </div>
                    </div>
                    <div className={`text-[14px] font-semibold tabular-nums shrink-0 ${isOutflow ? "text-clay-ink" : "text-forest"}`}>
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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import CurrencyInput from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, ASSET_CLASS_COLORS } from "@/lib/portfolioCalculations";
import { ArrowRight, Plus, TrendingUp, TrendingDown, X, Check } from "lucide-react";
import { toast } from "sonner";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface PackageSummary {
  id: string;
  nickname: string;
  type: string;
  status: string;
  monthlyAmount: string | null;
  lumpSumAmount: string | null;
  startDate: string | null;
  goalId: string | null;
  latestSnapshot: { totalValueUsd: string; totalInvestedUsd: string; totalReturnPercent: string | null } | null;
  allocations: Array<{ fundId: string; weightPercent: string; fund: { name: string; assetClass: string } | null }>;
}

interface Goal {
  id: string;
  title: string;
}

const PACKAGE_TYPES = [
  { id: "rsp", label: "Regular savings (RSP)", sub: "Monthly fixed amount invested automatically", emoji: "💸" },
  { id: "lump_sum", label: "Lump sum", sub: "One-time investment to start immediately", emoji: "💼" },
  { id: "combination", label: "Both (RSP + Lump sum)", sub: "Initial deposit plus ongoing monthly", emoji: "🔄" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending_setup: "bg-amber-100 text-amber-700",
  paused: "bg-slate-100 text-slate-600",
  closed: "bg-red-100 text-red-600",
};

const TIME_FILTERS = ["3M", "6M", "1Y", "All"] as const;

interface AddPackageForm {
  nickname: string;
  type: string;
  monthlyAmount: number;
  lumpSumAmount: number;
  goalId: string;
}

export default function InvestmentsPage() {
  const qc = useQueryClient();
  const [timeFilter, setTimeFilter] = useState<typeof TIME_FILTERS[number]>("All");
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [addForm, setAddForm] = useState<AddPackageForm>({ nickname: "", type: "", monthlyAmount: 0, lumpSumAmount: 0, goalId: "" });

  const { data: packages = [], isLoading } = useQuery<PackageSummary[]>({
    queryKey: ["my-packages"],
    queryFn: () => apiFetch("/packages"),
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => apiFetch("/goals"),
  });

  const createPackageMut = useMutation({
    mutationFn: (data: any) => apiFetch("/packages", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-packages"] });
      toast.success("Package created! Your advisor will follow up with fund selection.");
      setShowAddPackage(false);
      setAddForm({ nickname: "", type: "", monthlyAmount: 0, lumpSumAmount: 0, goalId: "" });
    },
    onError: () => toast.error("Failed to create package"),
  });

  const totalValue = packages.reduce((s, p) => s + parseFloat(p.latestSnapshot?.totalValueUsd ?? "0"), 0);
  const totalInvested = packages.reduce((s, p) => s + parseFloat(p.latestSnapshot?.totalInvestedUsd ?? "0"), 0);
  const totalReturn = totalValue - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  const activeCount = packages.filter((p) => p.status === "active").length;

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

  function submitAddPackage() {
    if (!addForm.nickname || !addForm.type) { toast.error("Name and type are required"); return; }
    createPackageMut.mutate({
      nickname: addForm.nickname,
      type: addForm.type,
      monthlyAmount: addForm.monthlyAmount > 0 ? String(addForm.monthlyAmount) : undefined,
      lumpSumAmount: addForm.lumpSumAmount > 0 ? String(addForm.lumpSumAmount) : undefined,
      goalId: addForm.goalId || undefined,
    });
  }

  return (
    <AppShell>
      <PageHeader
        title="Investments"
        subtitle={`${activeCount} active package${activeCount !== 1 ? "s" : ""} · Total ${fmtCurrency(totalValue)}`}
      />

      {/* Portfolio hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 mb-5 text-white" style={{ background: "linear-gradient(135deg,#042C53 0%,#0a4a8a 100%)" }}>
        <div className="text-slate-300 text-xs mb-1 font-mono uppercase tracking-wider">Total Portfolio Value</div>
        <div className="text-3xl font-bold mb-1">{fmtCurrency(totalValue)}</div>
        <div className={`text-sm mb-4 ${totalReturn >= 0 ? "text-emerald-300" : "text-red-300"}`}>
          {totalReturn >= 0 ? "▲" : "▼"} {fmtCurrency(Math.abs(totalReturn))} ({totalReturn >= 0 ? "+" : ""}{totalReturnPct.toFixed(2)}%) total return
        </div>
        <div className="flex gap-4 text-xs text-slate-400">
          <span>Total invested: {fmtCurrency(totalInvested)}</span>
          <span>{activeCount} active package{activeCount !== 1 ? "s" : ""}</span>
        </div>
      </motion.div>

      {/* Performance chart */}
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
          <p className="text-xs text-muted-foreground text-center mt-1">Full history grows as your portfolio ages.</p>
        </motion.div>
      )}

      {/* Asset allocation */}
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

      {/* Packages list */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">My Packages</h3>
          <Button size="sm" onClick={() => setShowAddPackage(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add package
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />)}
          </div>
        ) : packages.length === 0 ? (
          <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
            <div className="text-3xl mb-3">📦</div>
            <p className="font-medium mb-1">No packages yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create a package yourself or ask your advisor to set one up for you.</p>
            <Button onClick={() => setShowAddPackage(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Create first package
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg, i) => {
              const value = parseFloat(pkg.latestSnapshot?.totalValueUsd ?? "0");
              const invested = parseFloat(pkg.latestSnapshot?.totalInvestedUsd ?? "0");
              const ret = value - invested;
              const retPct = invested > 0 ? (ret / invested) * 100 : 0;
              const isActive = pkg.status === "active";
              const colors = ["#1D9E75", "#042C53", "#94A3B8", "#F59E0B", "#8B5CF6", "#EC4899"];

              return (
                <motion.div key={pkg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link href={`/client/packages/${pkg.id}`}>
                    <a className="block bg-card border border-card-border rounded-2xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-semibold text-sm">{pkg.nickname}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[pkg.status] ?? "bg-slate-100 text-slate-600"}`}>
                              {pkg.status === "pending_setup" ? "Being set up" : pkg.status}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">{pkg.type === "rsp" ? "RSP" : pkg.type === "lump_sum" ? "Lump Sum" : pkg.type === "combination" ? "RSP + Lump Sum" : pkg.type}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      </div>

                      {isActive ? (
                        <div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <div className="text-xl font-bold text-navy">{fmtCurrency(value)}</div>
                            <div className={`flex items-center gap-1 text-xs ${ret >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {ret >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                              {ret >= 0 ? "+" : ""}{retPct.toFixed(1)}%
                            </div>
                          </div>
                          {pkg.allocations.length > 0 && (
                            <div className="mt-2">
                              <div className="h-2 rounded-full overflow-hidden flex gap-0.5">
                                {pkg.allocations.map((a, idx) => (
                                  <div key={a.fundId} style={{ width: `${a.weightPercent}%`, backgroundColor: colors[idx % colors.length] }} className="h-full rounded-sm" />
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                                {pkg.allocations.slice(0, 3).map((a, idx) => (
                                  <span key={a.fundId} className="text-xs text-muted-foreground flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: colors[idx % colors.length] }} />
                                    {a.fund?.name ?? "Fund"} {parseFloat(a.weightPercent).toFixed(0)}%
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground mt-1">
                          Waiting for fund selection
                          {pkg.monthlyAmount && <span> · {fmtCurrency(parseFloat(pkg.monthlyAmount))}/month planned</span>}
                        </div>
                      )}
                    </a>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Add Package Sheet */}
      <AnimatePresence>
        {showAddPackage && (
          <>
            <motion.div className="fixed inset-0 bg-black/30 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddPackage(false)} />
            <motion.div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 p-6 pb-10 shadow-2xl max-h-[92vh] overflow-y-auto"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold">New Investment Package</h3>
                <button onClick={() => setShowAddPackage(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Package name</label>
                  <Input value={addForm.nickname} onChange={e => setAddForm(f => ({ ...f, nickname: e.target.value }))} placeholder="e.g. Growth Portfolio, Retirement Fund" />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Investment type</label>
                  <div className="space-y-2">
                    {PACKAGE_TYPES.map((t) => (
                      <button key={t.id} onClick={() => setAddForm(f => ({ ...f, type: t.id }))}
                        className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${addForm.type === t.id ? "border-primary bg-primary/5" : "border-border"}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{t.emoji}</span>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{t.label}</div>
                            <div className="text-xs text-muted-foreground">{t.sub}</div>
                          </div>
                          {addForm.type === t.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {(addForm.type === "rsp" || addForm.type === "combination") && (
                  <CurrencyInput value={addForm.monthlyAmount} onChange={v => setAddForm(f => ({ ...f, monthlyAmount: v }))} currency="USD" label="Monthly amount" />
                )}
                {(addForm.type === "lump_sum" || addForm.type === "combination") && (
                  <CurrencyInput value={addForm.lumpSumAmount} onChange={v => setAddForm(f => ({ ...f, lumpSumAmount: v }))} currency="USD" label="Lump sum amount" />
                )}

                {goals.length > 0 && (
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Link to a goal (optional)</label>
                    <div className="space-y-1.5">
                      {goals.map((g) => (
                        <button key={g.id} onClick={() => setAddForm(f => ({ ...f, goalId: f.goalId === g.id ? "" : g.id }))}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${addForm.goalId === g.id ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground"}`}>
                          {addForm.goalId === g.id ? <Check className="h-3.5 w-3.5 inline mr-2 text-primary" /> : null}
                          {g.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-muted/50 rounded-xl p-3.5 border border-border">
                  <p className="text-xs text-muted-foreground">Your package will be created immediately. Your advisor will follow up to select the specific funds and complete the setup.</p>
                </div>

                <Button className="w-full" onClick={submitAddPackage} disabled={createPackageMut.isPending || !addForm.nickname || !addForm.type}>
                  {createPackageMut.isPending ? "Creating…" : "Create package"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

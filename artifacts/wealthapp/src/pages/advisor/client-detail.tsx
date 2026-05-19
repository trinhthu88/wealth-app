import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CurrencyInput from "@/components/CurrencyInput";
import { ArrowLeft, Plus, Check, X, TrendingUp, TrendingDown, Edit2, Save } from "lucide-react";
import { fmtCurrency } from "@/lib/portfolioCalculations";
import { toast } from "sonner";

interface ClientProfile {
  id: string;
  userId: string;
  status: string;
  kycStatus: string;
  riskProfile: string | null;
  riskScore: number | null;
  investmentStyle: string | null;
  indicativeAmount: string | null;
  preCallNotes: string | null;
  advisorInternalNotes: string | null;
  prospectOnboardingComplete: boolean;
  fullOnboardingComplete: boolean;
  onboardingStep: number;
}

interface ClientUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

interface Goal {
  id: string;
  title: string;
  goalType: string;
  status: string;
  targetAmount: string | null;
  currentAmount: string | null;
  targetDate: string | null;
}

interface Task { id: string; title: string; priority: string; status: string; dueDate: string | null; }
interface KycDoc { id: string; documentType: string; status: string; fileName: string | null; createdAt: string; }

interface PackageSummary {
  id: string;
  nickname: string;
  type: string;
  status: string;
  monthlyAmount: string | null;
  lumpSumAmount: string | null;
  startDate: string | null;
  expectedAnnualReturn: string;
  advisorNotes: string | null;
  latestSnapshot: { totalValueUsd: string; totalInvestedUsd: string } | null;
  allocations: Array<{
    id: string;
    fundId: string;
    weightPercent: string;
    unitsHeld: string;
    isActive: boolean;
    fund: { id: string; name: string; ticker: string; assetClass: string } | null;
  }>;
}

interface Fund { id: string; name: string; ticker: string; assetClass: string; }
interface Transaction {
  id: string;
  transactionDate: string;
  transactionType: string;
  amountUsd: string;
  notes: string | null;
  fund: { name: string; ticker: string } | null;
  package: { nickname: string } | null;
}

const STATUS_OPTIONS = ["prospect", "pending", "active", "active_prospect", "paused", "churned"];
const KYC_OPTIONS = ["not_started", "submitted", "approved", "rejected"];
const TX_TYPES = ["initial_investment", "monthly_contribution", "top_up", "withdrawal", "dividend_reinvested", "fee_charged", "rebalance"];

export default function AdvisorClientDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: profile } = useQuery<ClientUser>({
    queryKey: ["advisor-client-profile", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/profile`),
    enabled: !!id,
  });

  const { data: clientProfile, refetch: refetchCP } = useQuery<ClientProfile>({
    queryKey: ["advisor-client-cp", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/client-profile`),
    enabled: !!id,
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["advisor-client-goals", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/goals`),
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["advisor-client-tasks", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/tasks`),
    enabled: !!id,
  });

  const { data: kycdocs = [] } = useQuery<KycDoc[]>({
    queryKey: ["advisor-client-kyc", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/kyc`),
    enabled: !!id,
  });

  const { data: packages = [], refetch: refetchPkgs } = useQuery<PackageSummary[]>({
    queryKey: ["advisor-client-packages", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/packages`),
    enabled: !!id,
  });

  const { data: allFunds = [] } = useQuery<Fund[]>({
    queryKey: ["funds-all"],
    queryFn: () => apiFetch("/funds/all"),
  });

  const { data: allTxs = [] } = useQuery<Transaction[]>({
    queryKey: ["advisor-client-txs", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/transactions`),
    enabled: !!id,
  });

  const totalValue = packages.reduce((s, p) => s + parseFloat(p.latestSnapshot?.totalValueUsd ?? "0"), 0);

  // Status update
  const updateCPMut = useMutation({
    mutationFn: (data: any) => apiFetch(`/advisor/clients/${id}/client-profile`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { refetchCP(); toast.success("Updated"); },
  });

  // Package creation
  const [showNewPkg, setShowNewPkg] = useState(false);
  const [newPkg, setNewPkg] = useState({ nickname: "", type: "rsp", monthlyAmount: 0, lumpSumAmount: 0, startDate: "", expectedAnnualReturn: 7.0, advisorNotes: "" });
  const createPkgMut = useMutation({
    mutationFn: (data: any) => apiFetch("/packages", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refetchPkgs(); setShowNewPkg(false); toast.success("Package created"); },
  });

  // Allocation update
  const [editAllocPkg, setEditAllocPkg] = useState<string | null>(null);
  const [allocDrafts, setAllocDrafts] = useState<Array<{ fundId: string; weightPercent: number; unitsHeld: number }>>([]);
  const updateAllocMut = useMutation({
    mutationFn: ({ pkgId, allocations }: any) => apiFetch(`/packages/${pkgId}/allocations`, { method: "PUT", body: JSON.stringify({ allocations }) }),
    onSuccess: () => { refetchPkgs(); setEditAllocPkg(null); toast.success("Allocations updated"); },
  });

  // Transaction creation
  const [showTxForm, setShowTxForm] = useState<string | null>(null);
  const [txDraft, setTxDraft] = useState({ fundId: "", transactionDate: new Date().toISOString().split("T")[0], transactionType: "monthly_contribution", amountUsd: 0, units: "", pricePerUnitUsd: "", notes: "" });
  const createTxMut = useMutation({
    mutationFn: ({ pkgId, data }: any) => apiFetch(`/packages/${pkgId}/transactions`, { method: "POST", body: JSON.stringify({ ...data, userId: id }) }),
    onSuccess: () => { refetchPkgs(); setShowTxForm(null); qc.invalidateQueries({ queryKey: ["advisor-client-txs", id] }); toast.success("Transaction recorded"); },
  });

  // Snapshot update
  const updateSnapMut = useMutation({
    mutationFn: ({ pkgId, data }: any) => apiFetch(`/packages/${pkgId}/snapshots`, { method: "POST", body: JSON.stringify({ ...data, userId: id }) }),
    onSuccess: () => { refetchPkgs(); toast.success("Snapshot updated"); },
  });

  const [pkgNotes, setPkgNotes] = useState<Record<string, string>>({});
  const updatePkgMut = useMutation({
    mutationFn: ({ pkgId, data }: any) => apiFetch(`/packages/${pkgId}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { refetchPkgs(); toast.success("Package updated"); },
  });

  const [internalNotes, setInternalNotes] = useState(clientProfile?.advisorInternalNotes ?? "");

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/advisor/clients">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to clients
          </a>
        </Link>
      </div>

      <div className="mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{profile?.fullName ?? "Client"}</h1>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${clientProfile?.status === "active" ? "bg-emerald-100 text-emerald-700" : clientProfile?.status === "prospect" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
            {clientProfile?.status ?? "—"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-card border border-card-border rounded-xl p-3 text-center">
          <div className="font-bold text-lg">{fmtCurrency(totalValue)}</div>
          <div className="text-xs text-muted-foreground">Portfolio</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3 text-center">
          <div className="font-bold text-lg">{packages.length}</div>
          <div className="text-xs text-muted-foreground">Packages</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3 text-center">
          <div className="font-bold text-lg">{goals.length}</div>
          <div className="text-xs text-muted-foreground">Goals</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-3 text-center">
          <div className="font-bold text-lg">{clientProfile?.kycStatus ?? "—"}</div>
          <div className="text-xs text-muted-foreground">KYC</div>
        </div>
      </div>

      <Tabs defaultValue="packages">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
        </TabsList>

        <TabsContent value="packages">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowNewPkg(true)}>
                <Plus className="h-4 w-4 mr-1" /> Create package
              </Button>
            </div>

            {showNewPkg && (
              <div className="bg-card border-2 border-primary/20 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold">New Investment Package</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-medium">Package nickname</label>
                    <Input value={newPkg.nickname} onChange={(e) => setNewPkg((p) => ({ ...p, nickname: e.target.value }))} placeholder="e.g. Retirement Fund" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Type</label>
                    <select className="w-full border border-border rounded-lg px-3 py-2 text-sm" value={newPkg.type} onChange={(e) => setNewPkg((p) => ({ ...p, type: e.target.value }))}>
                      <option value="rsp">RSP (Monthly)</option>
                      <option value="lump_sum">Lump Sum</option>
                      <option value="combination">Both</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Expected annual return %</label>
                    <Input type="number" step="0.1" value={newPkg.expectedAnnualReturn} onChange={(e) => setNewPkg((p) => ({ ...p, expectedAnnualReturn: parseFloat(e.target.value) }))} />
                  </div>
                  {(newPkg.type === "rsp" || newPkg.type === "combination") && (
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs font-medium">Monthly amount (USD)</label>
                      <CurrencyInput value={newPkg.monthlyAmount} onChange={(v) => setNewPkg((p) => ({ ...p, monthlyAmount: v }))} currency="USD" />
                    </div>
                  )}
                  {(newPkg.type === "lump_sum" || newPkg.type === "combination") && (
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs font-medium">Lump sum amount (USD)</label>
                      <CurrencyInput value={newPkg.lumpSumAmount} onChange={(v) => setNewPkg((p) => ({ ...p, lumpSumAmount: v }))} currency="USD" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Start date</label>
                    <Input type="date" value={newPkg.startDate} onChange={(e) => setNewPkg((p) => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-medium">Advisor notes</label>
                    <Textarea value={newPkg.advisorNotes} onChange={(e) => setNewPkg((p) => ({ ...p, advisorNotes: e.target.value }))} rows={2} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowNewPkg(false)}>Cancel</Button>
                  <Button size="sm" disabled={createPkgMut.isPending} onClick={() =>
                    createPkgMut.mutate({
                      userId: id,
                      nickname: newPkg.nickname,
                      type: newPkg.type,
                      monthlyAmount: newPkg.monthlyAmount > 0 ? newPkg.monthlyAmount : undefined,
                      lumpSumAmount: newPkg.lumpSumAmount > 0 ? newPkg.lumpSumAmount : undefined,
                      startDate: newPkg.startDate || undefined,
                      expectedAnnualReturn: newPkg.expectedAnnualReturn,
                      advisorNotes: newPkg.advisorNotes || undefined,
                      status: "active",
                    })
                  }>
                    {createPkgMut.isPending ? "Creating…" : "Create package"}
                  </Button>
                </div>
              </div>
            )}

            {packages.map((pkg) => {
              const val = parseFloat(pkg.latestSnapshot?.totalValueUsd ?? "0");
              const inv = parseFloat(pkg.latestSnapshot?.totalInvestedUsd ?? "0");
              const ret = val - inv;
              const retPct = inv > 0 ? (ret / inv) * 100 : 0;
              const isEditingAlloc = editAllocPkg === pkg.id;

              return (
                <div key={pkg.id} className="bg-card border border-card-border rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold">{pkg.nickname}</div>
                        <div className="text-xs text-muted-foreground capitalize">{pkg.type.replace(/_/g, " ")} · {pkg.status}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{fmtCurrency(val)}</div>
                        <div className={`text-xs ${ret >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {ret >= 0 ? "+" : ""}{fmtCurrency(ret)} ({ret >= 0 ? "+" : ""}{retPct.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditAllocPkg(isEditingAlloc ? null : pkg.id);
                        setAllocDrafts(pkg.allocations.filter(a => a.isActive).map(a => ({ fundId: a.fundId, weightPercent: parseFloat(a.weightPercent), unitsHeld: parseFloat(a.unitsHeld) })));
                      }}>
                        {isEditingAlloc ? "Cancel edit" : "Edit allocation"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowTxForm(showTxForm === pkg.id ? null : pkg.id)}>
                        {showTxForm === pkg.id ? "Cancel" : "Add transaction"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const snapDate = new Date().toISOString().split("T")[0];
                        const totalV = prompt("Enter current total value (USD):");
                        const totalI = prompt("Enter total invested to date (USD):");
                        if (totalV && totalI) {
                          const retPct = parseFloat(totalI) > 0 ? ((parseFloat(totalV) - parseFloat(totalI)) / parseFloat(totalI) * 100).toFixed(2) : "0";
                          updateSnapMut.mutate({ pkgId: pkg.id, data: { snapshotDate: snapDate, totalInvestedUsd: totalI, totalValueUsd: totalV, totalReturnPercent: retPct } });
                        }
                      }}>
                        Update value
                      </Button>
                    </div>
                  </div>

                  {isEditingAlloc && (
                    <div className="p-4 bg-primary/5 border-b border-border">
                      <div className="text-sm font-medium mb-3">Edit Fund Allocations</div>
                      <div className="space-y-2 mb-3">
                        {allocDrafts.map((a, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <select className="flex-1 border border-border rounded-lg px-2 py-1.5 text-sm" value={a.fundId}
                              onChange={(e) => setAllocDrafts(d => d.map((x, j) => j === i ? { ...x, fundId: e.target.value } : x))}>
                              <option value="">Select fund</option>
                              {allFunds.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.ticker})</option>)}
                            </select>
                            <Input type="number" className="w-20" placeholder="Wt%" value={a.weightPercent} onChange={(e) => setAllocDrafts(d => d.map((x, j) => j === i ? { ...x, weightPercent: parseFloat(e.target.value) || 0 } : x))} />
                            <Input type="number" className="w-24" placeholder="Units" value={a.unitsHeld} onChange={(e) => setAllocDrafts(d => d.map((x, j) => j === i ? { ...x, unitsHeld: parseFloat(e.target.value) || 0 } : x))} />
                            <button onClick={() => setAllocDrafts(d => d.filter((_, j) => j !== i))}><X className="h-4 w-4 text-muted-foreground" /></button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setAllocDrafts(d => [...d, { fundId: "", weightPercent: 0, unitsHeld: 0 }])}>
                          <Plus className="h-4 w-4 mr-1" /> Add fund
                        </Button>
                        <Button size="sm" disabled={updateAllocMut.isPending} onClick={() =>
                          updateAllocMut.mutate({ pkgId: pkg.id, allocations: allocDrafts.filter(a => a.fundId) })
                        }>
                          {updateAllocMut.isPending ? "Saving…" : <><Check className="h-4 w-4 mr-1" /> Save allocation</>}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Total weight: {allocDrafts.reduce((s, a) => s + (a.weightPercent || 0), 0).toFixed(1)}% (should sum to 100%)
                      </div>
                    </div>
                  )}

                  {showTxForm === pkg.id && (
                    <div className="p-4 bg-amber-50 border-b border-border space-y-3">
                      <div className="text-sm font-medium">Record Transaction</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Type</label>
                          <select className="w-full border border-border rounded-lg px-2 py-1.5 text-sm" value={txDraft.transactionType}
                            onChange={(e) => setTxDraft(d => ({ ...d, transactionType: e.target.value }))}>
                            {TX_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Date</label>
                          <Input type="date" value={txDraft.transactionDate} onChange={(e) => setTxDraft(d => ({ ...d, transactionDate: e.target.value }))} />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <label className="text-xs font-medium">Amount (USD)</label>
                          <CurrencyInput value={txDraft.amountUsd} onChange={(v) => setTxDraft(d => ({ ...d, amountUsd: v }))} currency="USD" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Fund (optional)</label>
                          <select className="w-full border border-border rounded-lg px-2 py-1.5 text-sm" value={txDraft.fundId}
                            onChange={(e) => setTxDraft(d => ({ ...d, fundId: e.target.value }))}>
                            <option value="">— No specific fund —</option>
                            {allFunds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Units (optional)</label>
                          <Input placeholder="e.g. 12.5" value={txDraft.units} onChange={(e) => setTxDraft(d => ({ ...d, units: e.target.value }))} />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <label className="text-xs font-medium">Notes</label>
                          <Input placeholder="Optional note" value={txDraft.notes} onChange={(e) => setTxDraft(d => ({ ...d, notes: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowTxForm(null)}>Cancel</Button>
                        <Button size="sm" disabled={createTxMut.isPending} onClick={() =>
                          createTxMut.mutate({
                            pkgId: pkg.id,
                            data: { ...txDraft, fundId: txDraft.fundId || undefined, units: txDraft.units || undefined, pricePerUnitUsd: txDraft.pricePerUnitUsd || undefined }
                          })
                        }>
                          {createTxMut.isPending ? "Saving…" : "Record"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {pkg.allocations.filter(a => a.isActive).length > 0 && (
                    <div className="p-4">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Current allocation</div>
                      <div className="space-y-1.5">
                        {pkg.allocations.filter(a => a.isActive).map((a) => (
                          <div key={a.id} className="flex items-center gap-2 text-sm">
                            <span className="flex-1 text-xs">{a.fund?.name ?? a.fundId}</span>
                            <span className="font-medium text-xs">{parseFloat(a.weightPercent).toFixed(1)}%</span>
                            <span className="text-muted-foreground text-xs">{parseFloat(a.unitsHeld).toFixed(4)} units</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {packages.length === 0 && !showNewPkg && (
              <div className="text-center py-10 text-sm text-muted-foreground">No packages yet. Create one for this client.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          {allTxs.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No transactions yet.</div>
          ) : (
            <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Package</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {allTxs.map((tx) => {
                    const isOut = ["withdrawal", "fee_charged"].includes(tx.transactionType);
                    return (
                      <tr key={tx.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{tx.transactionDate}</td>
                        <td className="px-4 py-2.5 capitalize text-xs">{tx.transactionType.replace(/_/g, " ")}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{tx.package?.nickname ?? "—"}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${isOut ? "text-red-500" : "text-emerald-600"}`}>
                          {isOut ? "-" : "+"}{fmtCurrency(parseFloat(tx.amountUsd))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="profile">
          {clientProfile && (
            <div className="space-y-4">
              <div className="bg-card border border-card-border rounded-xl p-4 space-y-4">
                <h3 className="font-semibold text-sm">Client Status</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <select className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm"
                      value={clientProfile.status}
                      onChange={(e) => updateCPMut.mutate({ status: e.target.value })}>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">KYC Status</label>
                    <select className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm"
                      value={clientProfile.kycStatus}
                      onChange={(e) => updateCPMut.mutate({ kycStatus: e.target.value })}>
                      {KYC_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-xs text-muted-foreground block">Risk profile</span>{clientProfile.riskProfile ?? "—"}</div>
                  <div><span className="text-xs text-muted-foreground block">Risk score</span>{clientProfile.riskScore ?? "—"}</div>
                  <div><span className="text-xs text-muted-foreground block">Style</span>{clientProfile.investmentStyle ?? "—"}</div>
                </div>
                {clientProfile.indicativeAmount && (
                  <div className="text-sm"><span className="text-xs text-muted-foreground block">Indicative amount</span>{fmtCurrency(parseFloat(clientProfile.indicativeAmount))}</div>
                )}
                {clientProfile.preCallNotes && (
                  <div><span className="text-xs text-muted-foreground block">Pre-call notes</span><p className="text-sm mt-1 bg-muted/50 rounded-lg p-3">{clientProfile.preCallNotes}</p></div>
                )}
              </div>
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="font-semibold text-sm mb-3">Internal Notes (advisor only)</h3>
                <Textarea
                  value={internalNotes || clientProfile.advisorInternalNotes || ""}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                  placeholder="Private notes visible only to you…"
                />
                <Button size="sm" className="mt-2" onClick={() => updateCPMut.mutate({ advisorInternalNotes: internalNotes })}>
                  <Save className="h-4 w-4 mr-1" /> Save notes
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="goals">
          {goals.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No goals yet.</p> : (
            <div className="space-y-3">
              {goals.map((g) => {
                const prog = g.targetAmount && g.currentAmount ? (parseFloat(g.currentAmount) / parseFloat(g.targetAmount)) * 100 : 0;
                return (
                  <div key={g.id} className="bg-card border border-card-border rounded-xl p-4">
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{g.title}</span>
                      <span className="text-xs text-muted-foreground">{g.targetDate ?? "—"}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full">
                      <div className="h-1.5 bg-primary rounded-full" style={{ width: `${Math.min(100, prog)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{Math.round(prog)}% funded</span>
                      {g.targetAmount && <span>Target: {fmtCurrency(parseFloat(g.targetAmount))}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          {tasks.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No tasks.</p> : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="bg-card border border-card-border rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{t.title}</div>
                    {t.dueDate && <div className="text-xs text-muted-foreground">Due: {new Date(t.dueDate).toLocaleDateString()}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.priority === "high" ? "bg-red-100 text-red-700" : t.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>{t.priority}</span>
                    <span className="text-xs text-muted-foreground">{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kyc">
          {kycdocs.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No KYC documents submitted.</p> : (
            <div className="space-y-2">
              {kycdocs.map((d) => (
                <div key={d.id} className="bg-card border border-card-border rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm capitalize">{d.documentType.replace(/_/g, " ")}</div>
                    <div className="text-xs text-muted-foreground">{d.fileName ?? ""} · {new Date(d.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${d.status === "approved" ? "bg-green-100 text-green-700" : d.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CurrencyInput from "@/components/CurrencyInput";
import { useProfile } from "@/hooks/useProfile";
import { ArrowLeft, Plus, Check, X, Save, MessageCircle, TrendingUp } from "lucide-react";
import { fmtCurrency } from "@/lib/portfolioCalculations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AdvisedPlanManager from "@/components/advisor/AdvisedPlanManager";

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

interface Conversation { id: string; clientId: string; advisorId: string; }
interface Message { id: string; senderId: string; senderRole: string | null; content: string; createdAt: string; }

const STATUS_OPTIONS = ["prospect", "pending", "active", "active_prospect", "paused", "churned"];
const KYC_OPTIONS = ["not_started", "submitted", "approved", "rejected"];
const TX_TYPES = ["initial_investment", "monthly_contribution", "top_up", "withdrawal", "dividend_reinvested", "fee_charged", "rebalance"];

export default function AdvisorClientDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { profile: advisorProfile } = useProfile();
  const advisorId = advisorProfile?.id;

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

  // ── Messaging ─────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState("packages");
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversation", id, advisorId],
    queryFn: () => apiFetch<Conversation[]>(`/conversations?clientId=${id}&advisorId=${advisorId}`),
    enabled: !!id && !!advisorId && activeTab === "messages",
  });

  const conversation = conversations[0] ?? null;

  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["messages", conversation?.id],
    queryFn: () => apiFetch<Message[]>(`/conversations/${conversation!.id}/messages`),
    enabled: !!conversation,
    refetchInterval: activeTab === "messages" ? 3000 : false,
  });

  useEffect(() => {
    if (activeTab === "messages") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const sendMsgMut = useMutation({
    mutationFn: (content: string) => apiFetch(`/conversations/${conversation!.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, senderRole: "advisor" }),
    }),
    onSuccess: () => { setMessageInput(""); refetchMessages(); },
    onError: () => toast.error("Failed to send message"),
  });

  const handleSend = () => {
    const trimmed = messageInput.trim();
    if (!trimmed || !conversation) return;
    sendMsgMut.mutate(trimmed);
  };

  // ── Other mutations ───────────────────────────────────────────────────────

  const totalValue = packages.reduce((s, p) => s + parseFloat(p.latestSnapshot?.totalValueUsd ?? "0"), 0);

  const updateCPMut = useMutation({
    mutationFn: (data: any) => apiFetch(`/advisor/clients/${id}/client-profile`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { refetchCP(); toast.success("Updated"); },
  });

  const [showNewPkg, setShowNewPkg] = useState(false);
  const [newPkg, setNewPkg] = useState({ nickname: "", type: "rsp", monthlyAmount: 0, lumpSumAmount: 0, startDate: "", expectedAnnualReturn: 7.0, advisorNotes: "" });
  const createPkgMut = useMutation({
    mutationFn: (data: any) => apiFetch("/packages", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { refetchPkgs(); setShowNewPkg(false); toast.success("Package created"); },
  });

  const [editAllocPkg, setEditAllocPkg] = useState<string | null>(null);
  const [allocDrafts, setAllocDrafts] = useState<Array<{ fundId: string; weightPercent: number; unitsHeld: number }>>([]);
  const updateAllocMut = useMutation({
    mutationFn: ({ pkgId, allocations }: any) => apiFetch(`/packages/${pkgId}/allocations`, { method: "PUT", body: JSON.stringify({ allocations }) }),
    onSuccess: () => { refetchPkgs(); setEditAllocPkg(null); toast.success("Allocations updated"); },
  });

  const [showTxForm, setShowTxForm] = useState<string | null>(null);
  const [txDraft, setTxDraft] = useState({ fundId: "", transactionDate: new Date().toISOString().split("T")[0], transactionType: "monthly_contribution", amountUsd: 0, units: "", pricePerUnitUsd: "", notes: "" });
  const createTxMut = useMutation({
    mutationFn: ({ pkgId, data }: any) => apiFetch(`/packages/${pkgId}/transactions`, { method: "POST", body: JSON.stringify({ ...data, userId: id }) }),
    onSuccess: () => { refetchPkgs(); setShowTxForm(null); qc.invalidateQueries({ queryKey: ["advisor-client-txs", id] }); toast.success("Transaction recorded"); },
  });

  const updateSnapMut = useMutation({
    mutationFn: ({ pkgId, data }: any) => apiFetch(`/packages/${pkgId}/snapshots`, { method: "POST", body: JSON.stringify({ ...data, userId: id }) }),
    onSuccess: () => { refetchPkgs(); toast.success("Snapshot updated"); },
  });

  const [internalNotes, setInternalNotes] = useState(clientProfile?.advisorInternalNotes ?? "");

  const allocTotal = allocDrafts.reduce((s, a) => s + (a.weightPercent || 0), 0);
  const allocValid = Math.abs(allocTotal - 100) < 0.01;

  return (
    <AppShell>
      <div className="mb-6">
        <Link href="/advisor/clients" className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-40 hover:text-forest transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to clients
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-[32px] font-semibold text-forest leading-none mb-2">{profile?.fullName ?? "Client"}</h1>
          <p className="text-[14px] text-ink-60">{profile?.email}</p>
        </div>
        <span className={cn("text-[12px] px-3 py-1 rounded-[8px] font-medium tracking-wide uppercase",
          clientProfile?.status === "active" ? "bg-green-tint text-green" :
          clientProfile?.status === "prospect" ? "bg-sun-tint text-amber-ink" : "bg-surface border border-hairline text-ink-60")}>
          {clientProfile?.status?.replace(/_/g, " ") ?? "—"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-hairline rounded-[26px] p-5 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[24px] font-semibold text-forest tabular-nums leading-none mb-1">{fmtCurrency(totalValue)}</div>
          <div className="text-[12px] text-ink-40 tracking-wide uppercase">Portfolio</div>
        </div>
        <div className="bg-surface border border-hairline rounded-[26px] p-5 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[24px] font-semibold text-forest tabular-nums leading-none mb-1">{packages.length}</div>
          <div className="text-[12px] text-ink-40 tracking-wide uppercase">Packages</div>
        </div>
        <div className="bg-surface border border-hairline rounded-[26px] p-5 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[24px] font-semibold text-forest tabular-nums leading-none mb-1">{goals.length}</div>
          <div className="text-[12px] text-ink-40 tracking-wide uppercase">Goals</div>
        </div>
        <div className="bg-surface border border-hairline rounded-[26px] p-5 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[20px] font-semibold text-forest leading-none mb-1">{clientProfile?.kycStatus?.replace(/_/g, " ") ?? "—"}</div>
          <div className="text-[12px] text-ink-40 tracking-wide uppercase">KYC</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-surface border border-hairline rounded-full p-1 w-full justify-start h-auto flex-wrap overflow-x-auto gap-1">
          <TabsTrigger value="packages" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">Packages</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">Transactions</TabsTrigger>
          <TabsTrigger value="profile" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">Profile</TabsTrigger>
          <TabsTrigger value="goals" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">Goals</TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">Tasks</TabsTrigger>
          <TabsTrigger value="messages" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">
            <MessageCircle className="h-4 w-4 mr-1.5 inline-block" />Messages
          </TabsTrigger>
          <TabsTrigger value="investment-plans" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">
            <TrendingUp className="h-4 w-4 mr-1.5 inline-block" />Plans
          </TabsTrigger>
          <TabsTrigger value="kyc" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">KYC</TabsTrigger>
        </TabsList>

        {/* ── Packages ── */}
        <TabsContent value="packages">
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowNewPkg(true)} className="rounded-full px-5 bg-forest text-paper hover:bg-forest-700 h-10">
                <Plus className="h-4 w-4 mr-2" /> Create package
              </Button>
            </div>

            {showNewPkg && (
              <div className="bg-surface border border-green rounded-[26px] p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[20px] font-semibold text-forest">New Investment Package</h3>
                  <button onClick={() => setShowNewPkg(false)} className="h-8 w-8 rounded-full hover:bg-paper flex items-center justify-center transition-colors">
                    <X className="h-5 w-5 text-ink-40" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[13px] font-medium text-ink-60 block">Package nickname</label>
                    <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={newPkg.nickname} onChange={(e) => setNewPkg((p) => ({ ...p, nickname: e.target.value }))} placeholder="e.g. Retirement Fund" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-ink-60 block">Type</label>
                    <select className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green" value={newPkg.type} onChange={(e) => setNewPkg((p) => ({ ...p, type: e.target.value }))}>
                      <option value="rsp">RSP (Monthly)</option>
                      <option value="lump_sum">Lump Sum</option>
                      <option value="combination">Both</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-ink-60 block">Expected annual return %</label>
                    <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" type="number" step="0.1" value={newPkg.expectedAnnualReturn} onChange={(e) => setNewPkg((p) => ({ ...p, expectedAnnualReturn: parseFloat(e.target.value) }))} />
                  </div>
                  {(newPkg.type === "rsp" || newPkg.type === "combination") && (
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[13px] font-medium text-ink-60 block">Monthly amount (USD)</label>
                      <div className="h-11">
                         <CurrencyInput value={newPkg.monthlyAmount} onChange={(v) => setNewPkg((p) => ({ ...p, monthlyAmount: v }))} currency="USD" />
                      </div>
                    </div>
                  )}
                  {(newPkg.type === "lump_sum" || newPkg.type === "combination") && (
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[13px] font-medium text-ink-60 block">Lump sum amount (USD)</label>
                      <div className="h-11">
                        <CurrencyInput value={newPkg.lumpSumAmount} onChange={(v) => setNewPkg((p) => ({ ...p, lumpSumAmount: v }))} currency="USD" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-ink-60 block">Start date</label>
                    <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" type="date" value={newPkg.startDate} onChange={(e) => setNewPkg((p) => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[13px] font-medium text-ink-60 block">Advisor notes</label>
                    <Textarea className="rounded-[12px] border-hairline bg-paper px-4 py-3 focus-visible:ring-green" value={newPkg.advisorNotes} onChange={(e) => setNewPkg((p) => ({ ...p, advisorNotes: e.target.value }))} rows={2} />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" className="flex-1 rounded-full h-11 border-hairline text-forest hover:bg-paper" onClick={() => setShowNewPkg(false)}>Cancel</Button>
                  <Button className="flex-1 rounded-full h-11 bg-green text-surface hover:bg-green-300" disabled={createPkgMut.isPending} onClick={() =>
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
              const activeAllocs = pkg.allocations.filter(a => a.isActive);

              return (
                <div key={pkg.id} className="bg-surface border border-hairline rounded-[26px] overflow-hidden shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
                  <div className="p-6 border-b border-hairline">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="font-display text-[20px] font-semibold text-forest mb-1">{pkg.nickname}</div>
                        <div className="text-[13px] text-ink-60 capitalize tracking-wide uppercase">{pkg.type.replace(/_/g, " ")} · {pkg.status}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-[24px] font-semibold text-forest tabular-nums">{fmtCurrency(val)}</div>
                        <div className={cn("text-[14px] font-semibold tabular-nums mt-1", ret >= 0 ? "text-green" : "text-clay")}>
                          {ret >= 0 ? "+" : ""}{fmtCurrency(ret)} ({ret >= 0 ? "+" : ""}{retPct.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" className="rounded-full h-9 px-4 text-[13px] border-hairline text-forest hover:bg-paper" onClick={() => {
                        setEditAllocPkg(isEditingAlloc ? null : pkg.id);
                        setAllocDrafts(activeAllocs.map(a => ({ fundId: a.fundId, weightPercent: parseFloat(a.weightPercent), unitsHeld: parseFloat(a.unitsHeld) })));
                      }}>
                        {isEditingAlloc ? "Cancel edit" : "Edit allocation"}
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full h-9 px-4 text-[13px] border-hairline text-forest hover:bg-paper" onClick={() => setShowTxForm(showTxForm === pkg.id ? null : pkg.id)}>
                        {showTxForm === pkg.id ? "Cancel" : "Add transaction"}
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full h-9 px-4 text-[13px] border-hairline text-forest hover:bg-paper" onClick={() => {
                        const snapDate = new Date().toISOString().split("T")[0];
                        const totalV = prompt("Enter current total value (USD):");
                        const totalI = prompt("Enter total invested to date (USD):");
                        if (totalV && totalI) {
                          const retPct2 = parseFloat(totalI) > 0 ? ((parseFloat(totalV) - parseFloat(totalI)) / parseFloat(totalI) * 100).toFixed(2) : "0";
                          updateSnapMut.mutate({ pkgId: pkg.id, data: { snapshotDate: snapDate, totalInvestedUsd: totalI, totalValueUsd: totalV, totalReturnPercent: retPct2 } });
                        }
                      }}>
                        Update value
                      </Button>
                    </div>
                  </div>

                  {isEditingAlloc && (
                    <div className="p-6 bg-paper border-b border-hairline">
                      <div className="text-[15px] font-semibold text-forest mb-4">Edit Fund Allocations</div>
                      <div className="space-y-3 mb-5">
                        {allocDrafts.map((a, i) => (
                          <div key={i} className="flex gap-3 items-center">
                            <select className="flex-1 h-10 border border-hairline rounded-[10px] px-3 text-[14px] bg-surface focus:outline-none focus:ring-2 focus:ring-green text-forest" value={a.fundId}
                              onChange={(e) => setAllocDrafts(d => d.map((x, j) => j === i ? { ...x, fundId: e.target.value } : x))}>
                              <option value="">Select fund</option>
                              {allFunds.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.ticker})</option>)}
                            </select>
                            <Input type="number" className="w-24 h-10 rounded-[10px] border-hairline bg-surface px-3" placeholder="Wt%" value={a.weightPercent}
                              onChange={(e) => setAllocDrafts(d => d.map((x, j) => j === i ? { ...x, weightPercent: parseFloat(e.target.value) || 0 } : x))} />
                            <Input type="number" className="w-28 h-10 rounded-[10px] border-hairline bg-surface px-3" placeholder="Units" value={a.unitsHeld}
                              onChange={(e) => setAllocDrafts(d => d.map((x, j) => j === i ? { ...x, unitsHeld: parseFloat(e.target.value) || 0 } : x))} />
                            <button className="h-10 w-10 flex items-center justify-center rounded-[10px] bg-surface border border-hairline hover:bg-clay-tint hover:text-clay hover:border-clay-tint transition-colors" onClick={() => setAllocDrafts(d => d.filter((_, j) => j !== i))}><X className="h-4 w-4 text-ink-40" /></button>
                          </div>
                        ))}
                      </div>
                      <div className={cn("text-[13px] font-semibold tracking-wide uppercase mb-4", allocValid ? "text-green" : "text-amber-ink")}>
                        Total weight: {allocTotal.toFixed(1)}%
                        {!allocValid && allocDrafts.length > 0 && " — must equal 100%"}
                        {allocValid && " — Valid"}
                      </div>
                      <div className="flex gap-3">
                        <Button size="sm" variant="outline" className="rounded-full h-10 px-5 border-hairline text-forest hover:bg-surface" onClick={() => setAllocDrafts(d => [...d, { fundId: "", weightPercent: 0, unitsHeld: 0 }])}>
                          <Plus className="h-4 w-4 mr-2" /> Add fund
                        </Button>
                        <Button size="sm" className="rounded-full h-10 px-6 bg-green text-surface hover:bg-green-300" disabled={updateAllocMut.isPending || (!allocValid && allocDrafts.length > 0)}
                          onClick={() => updateAllocMut.mutate({ pkgId: pkg.id, allocations: allocDrafts.filter(a => a.fundId) })}>
                          {updateAllocMut.isPending ? "Saving…" : <><Check className="h-4 w-4 mr-2" /> Save allocation</>}
                        </Button>
                      </div>
                    </div>
                  )}

                  {showTxForm === pkg.id && (
                    <div className="p-6 bg-sun-tint border-b border-[#FBE5C5] space-y-4">
                      <div className="text-[16px] font-semibold text-amber-ink mb-2">Record Transaction</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-medium text-amber-ink/80 block">Type</label>
                          <select className="w-full h-11 border border-[#FBE5C5] rounded-[12px] px-4 text-[14px] bg-surface text-forest focus:outline-none capitalize" value={txDraft.transactionType}
                            onChange={(e) => setTxDraft(d => ({ ...d, transactionType: e.target.value }))}>
                            {TX_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-medium text-amber-ink/80 block">Date</label>
                          <Input className="h-11 rounded-[12px] border-[#FBE5C5] bg-surface px-4 text-forest" type="date" value={txDraft.transactionDate} onChange={(e) => setTxDraft(d => ({ ...d, transactionDate: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                          <label className="text-[13px] font-medium text-amber-ink/80 block">Amount (USD)</label>
                          <div className="h-11">
                            <CurrencyInput value={txDraft.amountUsd} onChange={(v) => setTxDraft(d => ({ ...d, amountUsd: v }))} currency="USD" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-medium text-amber-ink/80 block">Fund (optional)</label>
                          <select className="w-full h-11 border border-[#FBE5C5] rounded-[12px] px-4 text-[14px] bg-surface text-forest focus:outline-none" value={txDraft.fundId}
                            onChange={(e) => setTxDraft(d => ({ ...d, fundId: e.target.value }))}>
                            <option value="">— No specific fund —</option>
                            {allFunds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-medium text-amber-ink/80 block">Units (optional)</label>
                          <Input className="h-11 rounded-[12px] border-[#FBE5C5] bg-surface px-4 text-forest" placeholder="e.g. 12.5" value={txDraft.units} onChange={(e) => setTxDraft(d => ({ ...d, units: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                          <label className="text-[13px] font-medium text-amber-ink/80 block">Notes</label>
                          <Input className="h-11 rounded-[12px] border-[#FBE5C5] bg-surface px-4 text-forest" placeholder="Optional note" value={txDraft.notes} onChange={(e) => setTxDraft(d => ({ ...d, notes: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <Button variant="outline" className="flex-1 rounded-full h-11 border-[#FBE5C5] text-amber-ink hover:bg-surface/50" onClick={() => setShowTxForm(null)}>Cancel</Button>
                        <Button className="flex-1 rounded-full h-11 bg-amber-ink text-surface hover:bg-sun-deep" disabled={createTxMut.isPending} onClick={() =>
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

                  {activeAllocs.length > 0 && (
                    <div className="p-6">
                      <div className="tala-eyebrow text-ink-40 mb-4">Current allocation</div>
                      <div className="space-y-2">
                        {activeAllocs.map((a) => (
                          <div key={a.id} className="flex items-center gap-3 text-[14px]">
                            <span className="flex-1 text-forest font-medium">{a.fund?.name ?? a.fundId}</span>
                            <span className="font-semibold text-forest tabular-nums">{parseFloat(a.weightPercent).toFixed(1)}%</span>
                            <span className="text-ink-40 tabular-nums w-24 text-right">{parseFloat(a.unitsHeld).toFixed(4)} units</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {packages.length === 0 && !showNewPkg && (
              <div className="text-center py-16 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
                <p className="text-[14px] text-ink-40 mb-2">No packages yet.</p>
                <p className="text-[14px] text-ink-60">Create one for this client to start managing their investments.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Transactions ── */}
        <TabsContent value="transactions">
          {allTxs.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">No transactions yet.</div>
          ) : (
            <div className="bg-surface rounded-[26px] overflow-hidden shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
              <table className="w-full text-left">
                <thead className="border-b border-hairline">
                  <tr>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Date</th>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Type</th>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Package</th>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {allTxs.map((tx) => {
                    const isOut = ["withdrawal", "fee_charged"].includes(tx.transactionType);
                    return (
                      <tr key={tx.id} className="border-b border-hairline last:border-0 hover:bg-paper transition-colors">
                        <td className="px-5 py-4 text-ink-60 text-[14px] tabular-nums">{tx.transactionDate}</td>
                        <td className="px-5 py-4 capitalize text-[14px] text-forest font-medium">{tx.transactionType.replace(/_/g, " ")}</td>
                        <td className="px-5 py-4 text-[14px] text-ink-60">{tx.package?.nickname ?? "—"}</td>
                        <td className={cn("px-5 py-4 text-right font-semibold text-[15px] tabular-nums", isOut ? "text-clay" : "text-green")}>
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

        {/* ── Profile ── */}
        <TabsContent value="profile">
          {clientProfile && (
            <div className="space-y-6">
              <div className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.04)] space-y-5">
                <h3 className="font-display text-[20px] font-semibold text-forest">Client Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Status</label>
                    <select className="w-full h-11 border border-hairline rounded-[12px] bg-paper px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize"
                      value={clientProfile.status}
                      onChange={(e) => updateCPMut.mutate({ status: e.target.value })}>
                      {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Risk Profile</label>
                    <select className="w-full h-11 border border-hairline rounded-[12px] bg-paper px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize"
                      value={clientProfile.riskProfile ?? ""}
                      onChange={(e) => updateCPMut.mutate({ riskProfile: e.target.value || null })}>
                      <option value="">Unknown</option>
                      <option value="conservative">Conservative</option>
                      <option value="moderate">Moderate</option>
                      <option value="balanced">Balanced</option>
                      <option value="growth">Growth</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.04)] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[20px] font-semibold text-forest">Advisor Internal Notes</h3>
                  <Button size="sm" className="rounded-full h-9 px-4 bg-green text-surface hover:bg-green-300"
                    onClick={() => updateCPMut.mutate({ advisorInternalNotes: internalNotes })}
                    disabled={updateCPMut.isPending || internalNotes === clientProfile.advisorInternalNotes}>
                    <Save className="h-4 w-4 mr-2" /> Save Notes
                  </Button>
                </div>
                <Textarea
                  className="w-full rounded-[16px] border-hairline bg-paper px-5 py-4 text-[14px] text-forest focus-visible:ring-green min-h-[150px] resize-y"
                  placeholder="Private notes (not visible to client)…"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                />
              </div>

              {clientProfile.preCallNotes && (
                <div className="bg-paper border border-hairline rounded-[26px] p-6 space-y-3">
                  <h3 className="font-semibold text-forest text-[15px]">Pre-call Notes (from prospect form)</h3>
                  <div className="text-[14px] text-ink-60 whitespace-pre-wrap">{clientProfile.preCallNotes}</div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Goals ── */}
        <TabsContent value="goals">
          {goals.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">No goals found.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {goals.map((g) => (
                <div key={g.id} className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-display text-[20px] font-semibold text-forest mb-1">{g.title}</h4>
                      <p className="text-[13px] text-ink-40 tracking-wide uppercase capitalize">{g.goalType.replace(/_/g, " ")}</p>
                    </div>
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-[4px] font-medium tracking-wide uppercase", g.status === "completed" ? "bg-green-tint text-green" : g.status === "in_progress" ? "bg-sun-tint text-amber-ink" : "bg-surface border border-hairline text-ink-60")}>
                      {g.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {g.targetAmount && (
                    <div className="mt-4 pt-4 border-t border-hairline">
                      <div className="flex justify-between text-[13px] mb-2">
                        <span className="text-ink-60">Progress</span>
                        <span className="font-medium text-forest tabular-nums">{fmtCurrency(parseFloat(g.currentAmount || "0"))} / {fmtCurrency(parseFloat(g.targetAmount))}</span>
                      </div>
                      <div className="h-2 w-full bg-paper rounded-full overflow-hidden">
                        <div className="h-full bg-green rounded-full"
                          style={{ width: `${Math.min(100, (parseFloat(g.currentAmount || "0") / parseFloat(g.targetAmount)) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  {g.targetDate && (
                    <p className="text-[13px] text-ink-40 mt-4 tabular-nums">Target: {new Date(g.targetDate).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tasks ── */}
        <TabsContent value="tasks">
          {tasks.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">No tasks for this client.</div>
          ) : (
            <div className="space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="bg-surface border border-hairline rounded-[20px] p-5 flex items-center justify-between shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
                  <div>
                    <h4 className={cn("font-medium text-[16px]", t.status === "completed" ? "text-ink-40 line-through" : "text-forest")}>{t.title}</h4>
                    {t.dueDate && <p className="text-[13px] text-ink-40 mt-1 tabular-nums">Due: {new Date(t.dueDate).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-[4px] font-medium tracking-wide uppercase", t.priority === "high" ? "bg-clay-tint text-clay" : t.priority === "medium" ? "bg-sun-tint text-amber-ink" : "bg-surface border border-hairline text-ink-60")}>
                      {t.priority}
                    </span>
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-[4px] font-medium tracking-wide uppercase", t.status === "completed" ? "bg-green-tint text-green" : "bg-surface border border-hairline text-ink-60")}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Messages ── */}
        <TabsContent value="messages">
          <div className="flex flex-col h-[600px] border border-hairline rounded-[26px] bg-surface overflow-hidden shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
            <div className="p-4 border-b border-hairline bg-paper flex items-center gap-3 shrink-0">
              <div className="h-10 w-10 rounded-full bg-sun-tint flex items-center justify-center text-amber-ink font-bold text-[15px]">
                {profile?.fullName?.[0]?.toUpperCase() ?? "C"}
              </div>
              <div>
                <h3 className="font-semibold text-[15px] text-forest">{profile?.fullName ?? "Client"}</h3>
                <p className="text-[12px] text-ink-40">Direct chat</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[14px] text-ink-40">No messages yet. Start the conversation.</div>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderRole === "advisor";
                  return (
                    <div key={m.id} className={cn("flex flex-col max-w-[75%]", isMe ? "ml-auto items-end" : "items-start")}>
                      <div className={cn("px-5 py-3 rounded-[20px] text-[15px] leading-relaxed shadow-sm",
                        isMe ? "bg-forest text-paper rounded-br-[4px]" : "bg-paper border border-hairline text-forest rounded-bl-[4px]")}>
                        {m.content}
                      </div>
                      <span className="text-[11px] text-ink-40 mt-1.5 tabular-nums px-1">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-hairline bg-paper shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-3">
                <Input
                  className="flex-1 h-12 rounded-full border-hairline bg-surface px-5 focus-visible:ring-green text-[15px]"
                  placeholder="Type a message…"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                />
                <Button type="submit" disabled={!messageInput.trim() || sendMsgMut.isPending} className="h-12 w-12 rounded-full p-0 bg-green text-surface hover:bg-green-300 shrink-0 shadow-md">
                  <MessageCircle className="h-5 w-5" />
                </Button>
              </form>
            </div>
          </div>
        </TabsContent>

        {/* ── Investment Plans ── */}
        <TabsContent value="investment-plans">
          <AdvisedPlanManager clientId={id} />
        </TabsContent>

        {/* ── KYC ── */}
        <TabsContent value="kyc">
          <div className="space-y-6">
            <div className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
              <h3 className="font-display text-[20px] font-semibold text-forest mb-4">KYC Status</h3>
              <select className="w-64 h-11 border border-hairline rounded-[12px] bg-paper px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize"
                value={clientProfile?.kycStatus ?? "not_started"}
                onChange={(e) => updateCPMut.mutate({ kycStatus: e.target.value })}>
                {KYC_OPTIONS.map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
              </select>
            </div>

            <h3 className="font-display text-[20px] font-semibold text-forest">Uploaded Documents</h3>
            {kycdocs.length === 0 ? (
              <div className="text-center py-12 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">No documents uploaded.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {kycdocs.map(d => (
                  <div key={d.id} className="bg-surface border border-hairline rounded-[20px] p-5 shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-[15px] text-forest capitalize">{d.documentType.replace(/_/g, " ")}</div>
                        <div className="text-[13px] text-ink-40 mt-0.5">{d.fileName ?? "Unnamed document"}</div>
                      </div>
                      <span className={cn("text-[11px] px-2 py-0.5 rounded-[4px] font-medium tracking-wide uppercase", d.status === "approved" ? "bg-green-tint text-green" : d.status === "rejected" ? "bg-clay-tint text-clay" : "bg-sun-tint text-amber-ink")}>
                        {d.status}
                      </span>
                    </div>
                    <div className="text-[12px] text-ink-40 tabular-nums">Uploaded: {new Date(d.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

      </Tabs>
    </AppShell>
  );
}

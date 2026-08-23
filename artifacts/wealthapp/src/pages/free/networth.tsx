import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import FreeTierBanner from "@/components/FreeTierBanner";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import CurrencyField from "@/components/shared/CurrencyField";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Plus, Trash2, X, ChevronDown, Landmark, PiggyBank, TrendingUp, Briefcase, Home, FileText, CreditCard, Wallet, AlertCircle, Car, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useProfile } from "@/hooks/useProfile";

interface Asset { id: string; name: string; category: string; valueUsd: string; currencyOriginal: string; }
interface Liability { id: string; name: string; category: string; balanceUsd: string; interestRatePercent: string | null; }

// Free-tier: exactly 5 asset categories
const ASSET_CAT_INFO: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  cash:        { label: "Cash",        icon: Landmark, color: "#4ADE80", bg: "rgba(74,222,128,0.15)" },
  savings:     { label: "Savings",     icon: PiggyBank, color: "#60A5FA", bg: "rgba(96,165,250,0.15)" },
  investment:  { label: "Investment",  icon: TrendingUp, color: "#A78BFA", bg: "rgba(167,139,250,0.15)" },
  business:    { label: "Business",    icon: Briefcase, color: "#FB923C", bg: "rgba(251,146,60,0.15)" },
  real_estate: { label: "Real Estate", icon: Home, color: "#F472B6", bg: "rgba(244,114,182,0.15)" },
};
// Fallback for any legacy categories still in DB
const ASSET_CAT_FALLBACK = { label: "Other", icon: FileText, color: "#A8A095", bg: "rgba(168,160,149,0.12)" };

const LIABILITY_CAT_INFO: Record<string, { label: string; icon: React.ElementType }> = {
  mortgage:     { label: "Mortgage",        icon: Home },
  car_loan:     { label: "Car Loan",        icon: Car },
  student_loan: { label: "Student Loan",    icon: GraduationCap },
  credit_card:  { label: "Credit Card",     icon: CreditCard },
  personal_loan:{ label: "Personal Loan",   icon: Wallet },
  other:        { label: "Other Debt",      icon: AlertCircle },
};

const ASSET_CATS = Object.keys(ASSET_CAT_INFO); // exactly the 5 free-tier categories
const LIABILITY_CATS = Object.keys(LIABILITY_CAT_INFO);

type AssetForm = { name: string; category: string; valueUsd: string; currencyOriginal: string };
type LiabForm  = { name: string; category: string; balanceUsd: string; interestRatePercent: string };

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n < 0 ? "-$" : "$") + (Math.abs(n) / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return (n < 0 ? "-$" : "$") + Math.round(Math.abs(n) / 1000) + "k";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function NetWorthPage() {
  const { profile } = useProfile();
  const currency = profile?.preferredCurrency ?? "USD";

  const [tab, setTab]             = useState<"assets" | "liabilities">("assets");
  const [showAssetForm, setShowAssetForm]   = useState(false);
  const [showLiabForm, setShowLiabForm]     = useState(false);
  const [confirmDeleteAsset, setConfirmDeleteAsset]   = useState<string | null>(null);
  const [confirmDeleteLiab, setConfirmDeleteLiab]     = useState<string | null>(null);

  const [aForm, setAForm] = useState<AssetForm>({ name: "", category: "cash", valueUsd: "", currencyOriginal: currency });
  const [lForm, setLForm] = useState<LiabForm>({ name: "", category: "mortgage", balanceUsd: "", interestRatePercent: "" });
  const [aValue, setAValue] = useState(0);
  const [lValue, setLValue] = useState(0);

  const { data: assets = [] }      = useQuery<Asset[]>({ queryKey: ["assets"],      queryFn: () => apiFetch<Asset[]>("/assets") });
  const { data: liabilities = [] } = useQuery<Liability[]>({ queryKey: ["liabilities"], queryFn: () => apiFetch<Liability[]>("/liabilities") });

  const totalAssets      = assets.reduce((s, a) => s + parseFloat(a.valueUsd), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + parseFloat(l.balanceUsd), 0);
  const netWorth         = totalAssets - totalLiabilities;

  const addAsset = useMutation({
    mutationFn: () => apiFetch("/assets", {
      method: "POST",
      body: JSON.stringify({ ...aForm, valueUsd: String(aValue) }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setShowAssetForm(false);
      setAForm({ name: "", category: "cash", valueUsd: "", currencyOriginal: currency });
      setAValue(0);
      toast.success("Asset added");
    },
    onError: () => toast.error("Failed to add asset"),
  });

  const delAsset = useMutation({
    mutationFn: (id: string) => apiFetch(`/assets/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["assets"] }); setConfirmDeleteAsset(null); },
  });

  const addLiab = useMutation({
    mutationFn: () => apiFetch("/liabilities", {
      method: "POST",
      body: JSON.stringify({ ...lForm, balanceUsd: String(lValue) }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
      setShowLiabForm(false);
      setLForm({ name: "", category: "mortgage", balanceUsd: "", interestRatePercent: "" });
      setLValue(0);
      toast.success("Liability added");
    },
    onError: () => toast.error("Failed to add liability"),
  });

  const delLiab = useMutation({
    mutationFn: (id: string) => apiFetch(`/liabilities/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["liabilities"] }); setConfirmDeleteLiab(null); },
  });

  const chartData = [
    { name: "Assets",       value: totalAssets,      fill: "#1D9E75" },
    { name: "Liabilities",  value: totalLiabilities, fill: "#D86B5A" },
    { name: "Net Worth",    value: Math.abs(netWorth), fill: netWorth >= 0 ? "#042C53" : "#F5B947" },
  ];

  const netWorthColor = netWorth > 0 ? "#1D9E75" : netWorth < 0 ? "#D86B5A" : "#A8A095";

  return (
    <AppShell>
      <div className="pb-24 md:pb-0">

        <FreeTierBanner
          feature="Manual assets and liabilities only"
          benefit="Investment clients get their full advised portfolio auto-synced into net worth."
          storageKey="networth"
        />

        {/* Dark navy header */}
        <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6" style={{ background: "#042C53", padding: "20px 22px 48px" }}>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.02em", marginBottom: 20 }}>
            Net Worth
          </h1>
          <div className="grid grid-cols-2 gap-5 mb-3">
            <div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Total assets</p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: "white", marginTop: 2 }}>
                {totalAssets > 0 ? fmt(totalAssets) : "—"}
              </p>
            </div>
            <div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Total liabilities</p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: "white", marginTop: 2 }}>
                {totalLiabilities > 0 ? fmt(totalLiabilities) : "—"}
              </p>
            </div>
          </div>
          {(totalAssets > 0 || totalLiabilities > 0) && (
            <p style={{ color: netWorth >= 0 ? "#F5B947" : "#D86B5A", fontSize: 13, fontWeight: 500 }}>
              Net worth {fmt(netWorth)}{netWorth < 0 ? " — liabilities exceed assets" : ""}
            </p>
          )}
        </div>

        {/* Cream content area */}
        <div className="-mx-4 md:-mx-6" style={{ background: "#FAF8F5", borderRadius: "24px 24px 0 0", marginTop: -24, padding: "22px 16px 0", minHeight: "100%" }}>
          <div className="space-y-4">

            {/* Chart */}
            {(assets.length > 0 || liabilities.length > 0) && (
              <div className="bg-white rounded-[20px]" style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.06)", padding: 18 }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: "#A8A095", marginBottom: 12 }}>
                  Overview
                </p>
                {netWorth < 0 && (
                  <div className="rounded-[12px] px-3 py-2 mb-3 flex items-center gap-2" style={{ background: "#FEEAE8", border: "1px solid rgba(216,107,90,0.2)" }}>
                    <AlertCircle className="h-4 w-4 shrink-0 text-[#B85544]" aria-hidden="true" />
                    <p style={{ fontSize: 12, color: "#B85544" }}>Your liabilities currently exceed your assets.</p>
                  </div>
                )}
                <div role="img" aria-label={`Net worth breakdown: assets ${fmt(totalAssets)}, liabilities ${fmt(totalLiabilities)}, net worth ${fmt(netWorth)}`}>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData} barSize={40}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#A8A095" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#A8A095" }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => [fmt(v), ""]} cursor={{ fill: "rgba(4,44,83,0.04)" }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tab toggle */}
            <div className="flex gap-1 rounded-xl p-1" style={{ background: "#F2EFE9" }}>
              {(["assets", "liabilities"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg transition-all capitalize"
                  style={{
                    background: tab === t ? "white" : "transparent",
                    color: tab === t ? "#042C53" : "#A8A095",
                    boxShadow: tab === t ? "0 1px 4px rgba(15,23,42,0.08)" : "none",
                  }}>
                  {t === "assets" ? `Assets (${assets.length})` : `Liabilities (${liabilities.length})`}
                </button>
              ))}
            </div>

            {/* Assets tab */}
            {tab === "assets" && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowAssetForm(true)}
                  className="w-full rounded-[20px] p-4 text-left active:scale-95 transition-transform"
                  style={{ background: "#E6F5EE", border: "1px solid rgba(29,158,117,0.25)" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg"></span>
                    <Plus className="h-3.5 w-3.5" style={{ color: "#1D9E75" }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0F6E56" }}>Add an asset</p>
                  </div>
                  <p style={{ fontSize: 11, color: "#1D9E75", marginTop: 4 }}>Cash, savings, investments, business, property</p>
                </button>

                {assets.length === 0 ? (
                  <div className="rounded-[20px] text-center py-8" style={{ border: "1.5px dashed #E6E1D8" }}>
                    <p style={{ fontSize: 13, color: "#A8A095" }}>No assets added yet.</p>
                    <p style={{ fontSize: 12, color: "#A8A095", marginTop: 4 }}>Track what you own to see your net worth.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-[20px] overflow-hidden" style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.06)" }}>
                    {assets.map((a, idx) => {
                      const info = ASSET_CAT_INFO[a.category] ?? ASSET_CAT_FALLBACK;
                      return (
                        <div key={a.id} style={{ padding: "14px 18px", borderBottom: idx < assets.length - 1 ? "1px solid #F2EFE9" : "none" }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 flex items-center justify-center rounded-xl" style={{ width: 38, height: 38, background: info.bg }}>
                                <info.icon className="w-5 h-5" style={{ color: info.color }} />
                              </div>
                              <div className="min-w-0">
                                <p style={{ fontSize: 13, fontWeight: 600, color: "#042C53" }} className="truncate">{a.name}</p>
                                <p style={{ fontSize: 11, color: "#A8A095", marginTop: 1 }}>{info.label}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: info.color }}>
                                {fmt(parseFloat(a.valueUsd))}
                              </p>
                              {confirmDeleteAsset === a.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => delAsset.mutate(a.id)} disabled={delAsset.isPending}
                                    className="text-xs text-white font-medium px-2 py-1 rounded-lg" style={{ background: "#D86B5A", minHeight: 32 }}>
                                    {delAsset.isPending ? "…" : "Delete"}
                                  </button>
                                  <button onClick={() => setConfirmDeleteAsset(null)}
                                    className="text-xs text-muted-foreground px-2 py-1 rounded-lg hover:bg-muted" style={{ minHeight: 32 }}>
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteAsset(a.id)}
                                  className="flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
                                  aria-label={`Delete ${a.name}`} style={{ minWidth: 36, minHeight: 36 }}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Category totals breakdown */}
            {tab === "assets" && assets.length > 0 && (() => {
              const totals = ASSET_CATS
                .map(key => ({ key, ...ASSET_CAT_INFO[key], total: assets.filter(a => a.category === key).reduce((s, a) => s + parseFloat(a.valueUsd), 0) }))
                .filter(c => c.total > 0);
              if (totals.length === 0) return null;
              return (
                <div className="bg-white rounded-[20px] overflow-hidden" style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.06)" }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: "#A8A095", padding: "14px 18px 8px" }}>
                    By category
                  </p>
                  {totals.map((c, idx) => (
                    <div key={c.key} style={{ padding: "10px 18px", borderTop: "1px solid #F2EFE9" }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                          <c.icon className="w-4 h-4 text-muted-foreground" />
                          <span style={{ fontSize: 13, color: "#2D2A24" }}>{c.label}</span>
                        </div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: c.color }}>
                          {fmt(c.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Liabilities tab */}
            {tab === "liabilities" && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowLiabForm(true)}
                  className="w-full rounded-[20px] p-4 text-left active:scale-95 transition-transform"
                  style={{ background: "#FEEAE8", border: "1px solid rgba(216,107,90,0.25)" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg"></span>
                    <Plus className="h-3.5 w-3.5" style={{ color: "#D86B5A" }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#B85544" }}>Add a liability</p>
                  </div>
                  <p style={{ fontSize: 11, color: "#D86B5A", marginTop: 4 }}>Mortgage, loans, credit card debt…</p>
                </button>

                {liabilities.length === 0 ? (
                  <div className="rounded-[20px] text-center py-8" style={{ border: "1.5px dashed #E6E1D8" }}>
                    <p style={{ fontSize: 13, color: "#A8A095" }}>No liabilities added yet.</p>
                    <p style={{ fontSize: 12, color: "#A8A095", marginTop: 4 }}>Track what you owe for a complete picture.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-[20px] overflow-hidden" style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.06)" }}>
                    {liabilities.map((l, idx) => {
                      const info = LIABILITY_CAT_INFO[l.category] ?? { label: l.category, icon: AlertCircle };
                      return (
                        <div key={l.id} style={{ padding: "14px 18px", borderBottom: idx < liabilities.length - 1 ? "1px solid #F2EFE9" : "none" }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 flex items-center justify-center rounded-xl" style={{ width: 38, height: 38, background: "#FEEAE8" }}>
                                <info.icon className="w-5 h-5 text-[#D86B5A]" />
                              </div>
                              <div className="min-w-0">
                                <p style={{ fontSize: 13, fontWeight: 600, color: "#042C53" }} className="truncate">{l.name}</p>
                                <p style={{ fontSize: 11, color: "#A8A095", marginTop: 1 }}>
                                  {info.label}{l.interestRatePercent ? ` · ${l.interestRatePercent}% interest` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: "#D86B5A" }}>
                                {fmt(parseFloat(l.balanceUsd))}
                              </p>
                              {confirmDeleteLiab === l.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => delLiab.mutate(l.id)} disabled={delLiab.isPending}
                                    className="text-xs text-white font-medium px-2 py-1 rounded-lg" style={{ background: "#D86B5A", minHeight: 32 }}>
                                    {delLiab.isPending ? "…" : "Delete"}
                                  </button>
                                  <button onClick={() => setConfirmDeleteLiab(null)}
                                    className="text-xs text-muted-foreground px-2 py-1 rounded-lg hover:bg-muted" style={{ minHeight: 32 }}>
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteLiab(l.id)}
                                  className="flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
                                  aria-label={`Delete ${l.name}`} style={{ minWidth: 36, minHeight: 36 }}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Add Asset bottom sheet */}
      <AnimatePresence>
        {showAssetForm && (
          <>
            <motion.div className="fixed inset-0 bg-black/30 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAssetForm(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl"
              style={{ background: "white", padding: "24px 24px 40px" }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "#042C53" }}>Add an asset</h3>
                <button onClick={() => setShowAssetForm(false)} className="flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Close" style={{ minWidth: 36, minHeight: 36 }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Asset name</label>
                  <input
                    value={aForm.name} onChange={e => setAForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. DBS Savings Account"
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Category</label>
                  <div className="relative">
                    <select
                      value={aForm.category} onChange={e => setAForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary appearance-none pr-10"
                    >
                      {ASSET_CATS.map(c => <option key={c} value={c}>{ASSET_CAT_INFO[c].label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <CurrencyField editable value={aValue} onChange={setAValue} currency={currency} label="Value (USD)" />
              </div>
              <Button
                className="w-full mt-6" onClick={() => addAsset.mutate()}
                disabled={!aForm.name || aValue <= 0 || addAsset.isPending}
              >
                {addAsset.isPending ? "Saving…" : "Add asset"}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Liability bottom sheet */}
      <AnimatePresence>
        {showLiabForm && (
          <>
            <motion.div className="fixed inset-0 bg-black/30 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLiabForm(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl"
              style={{ background: "white", padding: "24px 24px 40px" }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "#042C53" }}>Add a liability</h3>
                <button onClick={() => setShowLiabForm(false)} className="flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Close" style={{ minWidth: 36, minHeight: 36 }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Liability name</label>
                  <input
                    value={lForm.name} onChange={e => setLForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Home Mortgage"
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Category</label>
                  <div className="relative">
                    <select
                      value={lForm.category} onChange={e => setLForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary appearance-none pr-10"
                    >
                      {LIABILITY_CATS.map(c => <option key={c} value={c}>{LIABILITY_CAT_INFO[c]?.label ?? c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <CurrencyField editable value={lValue} onChange={setLValue} currency={currency} label="Balance (USD)" />
                <div>
                  <label className="text-sm font-medium block mb-1.5">Interest rate % <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <input
                    type="number" step="0.1" placeholder="e.g. 3.5"
                    value={lForm.interestRatePercent} onChange={e => setLForm(f => ({ ...f, interestRatePercent: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <Button
                className="w-full mt-6" onClick={() => addLiab.mutate()}
                disabled={!lForm.name || lValue <= 0 || addLiab.isPending}
              >
                {addLiab.isPending ? "Saving…" : "Add liability"}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </AppShell>
  );
}

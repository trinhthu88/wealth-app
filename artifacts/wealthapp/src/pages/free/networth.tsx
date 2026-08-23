// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Chart draw animation (Recharts default)
// ✓ ALLOWED: BottomSheet spring animation
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#FAF8F5, #F2EFE9, #A8A095)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Double bottom nav — AppShell is the ONLY nav

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

// Free-tier: exactly 5 asset categories.
// The design system's palette is brand-semantic (green/sun/clay + neutrals), not a
// general-purpose categorical palette, so these 5 distinct hues are the closest
// available tokens rather than a precise one-to-one mapping — flagged for review.
const ASSET_CAT_INFO: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  cash:        { label: "Cash",        icon: Landmark, color: "var(--green)", bg: "rgba(29,158,117,0.15)" },
  savings:     { label: "Savings",     icon: PiggyBank, color: "var(--sun)", bg: "rgba(255,182,39,0.15)" },
  investment:  { label: "Investment",  icon: TrendingUp, color: "var(--forest-700)", bg: "rgba(29,74,58,0.15)" },
  business:    { label: "Business",    icon: Briefcase, color: "var(--clay-ink)", bg: "rgba(163,69,42,0.15)" },
  real_estate: { label: "Real Estate", icon: Home, color: "var(--ink-60)", bg: "rgba(74,92,84,0.15)" },
};
// Fallback for any legacy categories still in DB
const ASSET_CAT_FALLBACK = { label: "Other", icon: FileText, color: "var(--ink-40)", bg: "rgba(122,139,130,0.12)" };

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
    { name: "Assets",       value: totalAssets,      fill: "var(--green)" },
    { name: "Liabilities",  value: totalLiabilities, fill: "var(--clay)" },
    { name: "Net Worth",    value: Math.abs(netWorth), fill: netWorth >= 0 ? "var(--forest)" : "var(--sun)" },
  ];

  const netWorthColor = netWorth > 0 ? "var(--green)" : netWorth < 0 ? "var(--clay)" : "var(--ink-40)";

  return (
    <AppShell>
      <div className="pb-24 md:pb-0">

        <FreeTierBanner
          feature="Manual assets and liabilities only"
          benefit="Investment clients get their full advised portfolio auto-synced into net worth."
          storageKey="networth"
        />

        {/* Dark navy header */}
        <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 bg-forest p-[20px_22px_48px]">
          <h1 className="text-[22px] font-bold text-white tracking-[-0.02em] mb-5">
            Net Worth
          </h1>
          <div className="grid grid-cols-2 gap-5 mb-3">
            <div>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Total assets</p>
              <p className="text-[22px] font-bold text-white mt-0.5">
                {totalAssets > 0 ? fmt(totalAssets) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Total liabilities</p>
              <p className="text-[22px] font-bold text-white mt-0.5">
                {totalLiabilities > 0 ? fmt(totalLiabilities) : "—"}
              </p>
            </div>
          </div>
          {(totalAssets > 0 || totalLiabilities > 0) && (
            <p className={`text-[13px] font-medium ${netWorth >= 0 ? "text-sun" : "text-clay"}`}>
              Net worth {fmt(netWorth)}{netWorth < 0 ? " — liabilities exceed assets" : ""}
            </p>
          )}
        </div>

        {/* Cream content area */}
        <div className="-mx-4 md:-mx-6 bg-paper rounded-t-[24px] -mt-6 p-[22px_16px_0] min-h-full">
          <div className="space-y-4">

            {/* Chart */}
            {(assets.length > 0 || liabilities.length > 0) && (
              <div className="bg-surface rounded-[20px] p-[18px] shadow-[0_4px_14px_rgba(20,52,42,.06)]">
                <p className="text-[11px] tracking-[0.11em] uppercase text-ink-40 mb-3">
                  Overview
                </p>
                {netWorth < 0 && (
                  <div className="rounded-[12px] px-3 py-2 mb-3 flex items-center gap-2 bg-clay-tint border border-clay/20">
                    <AlertCircle className="h-4 w-4 shrink-0 text-clay-ink" aria-hidden="true" />
                    <p className="text-xs text-clay-ink">Your liabilities currently exceed your assets.</p>
                  </div>
                )}
                <div role="img" aria-label={`Net worth breakdown: assets ${fmt(totalAssets)}, liabilities ${fmt(totalLiabilities)}, net worth ${fmt(netWorth)}`}>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData} barSize={40}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--ink-40)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--ink-40)" }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => [fmt(v), ""]} cursor={{ fill: "rgba(20,52,42,0.04)" }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tab toggle */}
            <div className="flex gap-1 rounded-xl p-1 bg-hairline">
              {(["assets", "liabilities"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${
                    tab === t ? "bg-surface text-forest shadow-[0_1px_4px_rgba(20,52,42,.08)]" : "bg-transparent text-ink-40"
                  }`}>
                  {t === "assets" ? `Assets (${assets.length})` : `Liabilities (${liabilities.length})`}
                </button>
              ))}
            </div>

            {/* Assets tab */}
            {tab === "assets" && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowAssetForm(true)}
                  className="w-full rounded-[20px] p-4 text-left active:scale-95 transition-transform bg-green-tint border border-green/25"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg"></span>
                    <Plus className="h-3.5 w-3.5 text-green" />
                    <p className="text-[13px] font-semibold text-green">Add an asset</p>
                  </div>
                  <p className="text-[11px] text-green mt-1">Cash, savings, investments, business, property</p>
                </button>

                {assets.length === 0 ? (
                  <div className="rounded-[20px] text-center py-8 border-[1.5px] border-dashed border-hairline">
                    <p className="text-[13px] text-ink-40">No assets added yet.</p>
                    <p className="text-xs text-ink-40 mt-1">Track what you own to see your net worth.</p>
                  </div>
                ) : (
                  <div className="bg-surface rounded-[20px] overflow-hidden shadow-[0_4px_14px_rgba(20,52,42,.06)]">
                    {assets.map((a, idx) => {
                      const info = ASSET_CAT_INFO[a.category] ?? ASSET_CAT_FALLBACK;
                      return (
                        <div key={a.id} className={`p-[14px_18px] ${idx < assets.length - 1 ? "border-b border-hairline" : ""}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 flex items-center justify-center rounded-xl w-[38px] h-[38px]" style={{ background: info.bg }}>
                                <info.icon className="w-5 h-5" style={{ color: info.color }} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-forest truncate">{a.name}</p>
                                <p className="text-[11px] text-ink-40 mt-px">{info.label}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p className="text-sm font-bold" style={{ color: info.color }}>
                                {fmt(parseFloat(a.valueUsd))}
                              </p>
                              {confirmDeleteAsset === a.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => delAsset.mutate(a.id)} disabled={delAsset.isPending}
                                    className="text-xs text-white font-medium px-2 py-1 rounded-lg bg-clay min-h-8">
                                    {delAsset.isPending ? "…" : "Delete"}
                                  </button>
                                  <button onClick={() => setConfirmDeleteAsset(null)}
                                    className="text-xs text-muted-foreground px-2 py-1 rounded-lg hover:bg-muted min-h-8">
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteAsset(a.id)}
                                  className="flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors min-w-9 min-h-9"
                                  aria-label={`Delete ${a.name}`}>
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
                <div className="bg-surface rounded-[20px] overflow-hidden shadow-[0_4px_14px_rgba(20,52,42,.06)]">
                  <p className="text-[11px] tracking-[0.11em] uppercase text-ink-40 p-[14px_18px_8px]">
                    By category
                  </p>
                  {totals.map((c, idx) => (
                    <div key={c.key} className="p-[10px_18px] border-t border-hairline">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                          <c.icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-[13px] text-forest">{c.label}</span>
                        </div>
                        <span className="text-[13px] font-semibold" style={{ color: c.color }}>
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
                  className="w-full rounded-[20px] p-4 text-left active:scale-95 transition-transform bg-clay-tint border border-clay/25"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg"></span>
                    <Plus className="h-3.5 w-3.5 text-clay" />
                    <p className="text-[13px] font-semibold text-clay-ink">Add a liability</p>
                  </div>
                  <p className="text-[11px] text-clay mt-1">Mortgage, loans, credit card debt…</p>
                </button>

                {liabilities.length === 0 ? (
                  <div className="rounded-[20px] text-center py-8 border-[1.5px] border-dashed border-hairline">
                    <p className="text-[13px] text-ink-40">No liabilities added yet.</p>
                    <p className="text-xs text-ink-40 mt-1">Track what you owe for a complete picture.</p>
                  </div>
                ) : (
                  <div className="bg-surface rounded-[20px] overflow-hidden shadow-[0_4px_14px_rgba(20,52,42,.06)]">
                    {liabilities.map((l, idx) => {
                      const info = LIABILITY_CAT_INFO[l.category] ?? { label: l.category, icon: AlertCircle };
                      return (
                        <div key={l.id} className={`p-[14px_18px] ${idx < liabilities.length - 1 ? "border-b border-hairline" : ""}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 flex items-center justify-center rounded-xl w-[38px] h-[38px] bg-clay-tint">
                                <info.icon className="w-5 h-5 text-clay" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-forest truncate">{l.name}</p>
                                <p className="text-[11px] text-ink-40 mt-px">
                                  {info.label}{l.interestRatePercent ? ` · ${l.interestRatePercent}% interest` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p className="text-sm font-bold text-clay">
                                {fmt(parseFloat(l.balanceUsd))}
                              </p>
                              {confirmDeleteLiab === l.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => delLiab.mutate(l.id)} disabled={delLiab.isPending}
                                    className="text-xs text-white font-medium px-2 py-1 rounded-lg bg-clay min-h-8">
                                    {delLiab.isPending ? "…" : "Delete"}
                                  </button>
                                  <button onClick={() => setConfirmDeleteLiab(null)}
                                    className="text-xs text-muted-foreground px-2 py-1 rounded-lg hover:bg-muted min-h-8">
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteLiab(l.id)}
                                  className="flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors min-w-9 min-h-9"
                                  aria-label={`Delete ${l.name}`}>
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
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl bg-surface p-[24px_24px_40px]"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-forest">Add an asset</h3>
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
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl bg-surface p-[24px_24px_40px]"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-forest">Add a liability</h3>
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

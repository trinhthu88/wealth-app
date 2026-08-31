// ANIMATION RULES FOR THIS PAGE:
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
import { Plus, Trash2, X, ChevronDown, Lock, LineChart as LineChartIcon, Bitcoin, Landmark, Home, PiggyBank, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";

interface Holding {
  id: string;
  assetName: string;
  assetClass: string;
  currentValueUsd: string;
  currencyOriginal: string;
  tickerSymbol: string | null;
}

const FREE_HOLDING_CAP = 2;

const ASSET_CLASS_INFO: Record<string, { label: string; icon: React.ElementType }> = {
  stock_etf: { label: "Stock / ETF", icon: LineChartIcon },
  crypto:    { label: "Crypto",      icon: Bitcoin },
  cash:      { label: "Cash / Savings", icon: PiggyBank },
  property:  { label: "Property",    icon: Home },
  pension:   { label: "Pension / Retirement", icon: Landmark },
  other:     { label: "Other",       icon: HelpCircle },
};
const ASSET_CLASSES = Object.keys(ASSET_CLASS_INFO);
const TICKER_CLASSES = new Set(["stock_etf", "crypto"]);

type HoldingForm = { assetName: string; assetClass: string; tickerSymbol: string; currencyOriginal: string };

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n < 0 ? "-$" : "$") + (Math.abs(n) / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return (n < 0 ? "-$" : "$") + Math.round(Math.abs(n) / 1000) + "k";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function FreePortfolioPage() {
  const { profile } = useProfile();
  const currency = profile?.preferredCurrency ?? "USD";

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<HoldingForm>({ assetName: "", assetClass: "stock_etf", tickerSymbol: "", currencyOriginal: currency });
  const [value, setValue] = useState(0);

  const { data: holdings = [], isLoading } = useQuery<Holding[]>({ queryKey: ["portfolio"], queryFn: () => apiFetch<Holding[]>("/portfolio") });

  const totalValue = holdings.reduce((s, h) => s + parseFloat(h.currentValueUsd), 0);
  const atCap = holdings.length >= FREE_HOLDING_CAP;

  function resetForm() {
    setForm({ assetName: "", assetClass: "stock_etf", tickerSymbol: "", currencyOriginal: currency });
    setValue(0);
    setEditingId(null);
    setShowForm(false);
  }

  function openEdit(h: Holding) {
    setForm({ assetName: h.assetName, assetClass: h.assetClass, tickerSymbol: h.tickerSymbol ?? "", currencyOriginal: h.currencyOriginal });
    setValue(parseFloat(h.currentValueUsd));
    setEditingId(h.id);
    setShowForm(true);
  }

  const saveHolding = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({
        assetName: form.assetName,
        assetClass: form.assetClass,
        currentValueUsd: value,
        currencyOriginal: form.currencyOriginal,
        tickerSymbol: TICKER_CLASSES.has(form.assetClass) && form.tickerSymbol ? form.tickerSymbol : null,
      });
      return editingId ? apiFetch(`/portfolio/${editingId}`, { method: "PUT", body }) : apiFetch("/portfolio", { method: "POST", body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success(editingId ? "Holding updated" : "Holding added");
      resetForm();
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to save holding"),
  });

  const deleteHolding = useMutation({
    mutationFn: (id: string) => apiFetch(`/portfolio/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["portfolio"] }); setConfirmDeleteId(null); },
  });

  return (
    <AppShell>
      <div className="pb-24 md:pb-0">

        <FreeTierBanner
          feature={`Track up to ${FREE_HOLDING_CAP} holdings manually`}
          benefit="Investment clients get live prices, performance tracking, and unlimited asset types across property, pensions, and multi-currency accounts."
          storageKey="portfolio"
        />

        {/* Dark navy header */}
        <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 bg-forest p-[20px_22px_48px]">
          <h1 className="text-[22px] font-bold text-white tracking-[-0.02em] mb-5">Portfolio</h1>
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Total tracked value</p>
          <p className="text-[24px] font-bold text-white mt-0.5">{totalValue > 0 ? fmt(totalValue) : "—"}</p>
        </div>

        {/* Cream content area */}
        <div className="-mx-4 md:-mx-6 bg-paper rounded-t-[24px] -mt-6 p-[22px_16px_0] min-h-full">
          <div className="space-y-3">

            <div className="flex items-center justify-between">
              <p className="text-[11px] tracking-[0.11em] uppercase text-ink-40">
                {holdings.length}/{FREE_HOLDING_CAP} holdings
              </p>
              {!atCap && (
                <button
                  onClick={() => { resetForm(); setShowForm(true); }}
                  className="flex items-center gap-1 text-[13px] font-semibold text-green"
                >
                  <Plus className="h-3.5 w-3.5" />Add holding
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 bg-hairline animate-pulse rounded-2xl" />)}</div>
            ) : holdings.length === 0 ? (
              <div className="rounded-[20px] text-center py-8 border-[1.5px] border-dashed border-hairline">
                <p className="text-[13px] text-ink-40">No holdings tracked yet.</p>
                <p className="text-xs text-ink-40 mt-1">Add a stock, crypto, or cash position to get started.</p>
              </div>
            ) : (
              <div className="bg-surface rounded-[20px] overflow-hidden shadow-[0_4px_14px_rgba(20,52,42,.06)]">
                {holdings.map((h, idx) => {
                  const info = ASSET_CLASS_INFO[h.assetClass] ?? ASSET_CLASS_INFO.other;
                  return (
                    <div key={h.id} className={`p-[14px_18px] ${idx < holdings.length - 1 ? "border-b border-hairline" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 flex items-center justify-center rounded-xl w-[38px] h-[38px] bg-green-tint">
                            <info.icon className="w-5 h-5 text-green" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-forest truncate">{h.assetName}</p>
                            <p className="text-[11px] text-ink-40 mt-px">{info.label}{h.tickerSymbol ? ` · ${h.tickerSymbol}` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="text-sm font-bold text-forest">{fmt(parseFloat(h.currentValueUsd))}</p>
                          {confirmDeleteId === h.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => deleteHolding.mutate(h.id)} disabled={deleteHolding.isPending}
                                className="text-xs text-white font-medium px-2 py-1 rounded-lg bg-clay min-h-8">
                                {deleteHolding.isPending ? "…" : "Delete"}
                              </button>
                              <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-muted-foreground px-2 py-1 rounded-lg hover:bg-muted min-h-8">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEdit(h)} className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors min-w-8 min-h-8" aria-label={`Edit ${h.assetName}`}>
                                <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                              </button>
                              <button onClick={() => setConfirmDeleteId(h.id)} className="flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors min-w-9 min-h-9" aria-label={`Delete ${h.assetName}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Locked upgrade card — always shown */}
            <div className="rounded-2xl p-5 bg-green-tint border border-green/20">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 flex items-center justify-center rounded-xl w-10 h-10 bg-surface">
                  <Lock className="h-4 w-4 text-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-forest leading-[1.4]">
                    Live prices, performance tracking, and more asset types unlock when you become a client.
                  </p>
                  <p className="text-[11px] text-ink-40 mt-1">Property, pensions, and multi-currency accounts included.</p>
                  <Button variant="outline" size="sm" className="mt-3 text-xs border-primary text-primary hover:bg-primary/5" asChild>
                    <a href="/book">See what's included →</a>
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Add/Edit holding sheet */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div className="fixed inset-0 bg-black/30 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={resetForm} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl bg-surface p-[24px_24px_40px]"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-forest">{editingId ? "Edit holding" : "Add a holding"}</h3>
                <button onClick={resetForm} className="flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Close" style={{ minWidth: 36, minHeight: 36 }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Name</label>
                  <input
                    value={form.assetName} onChange={e => setForm(f => ({ ...f, assetName: e.target.value }))}
                    placeholder="e.g. Vanguard S&P 500 ETF"
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Asset type</label>
                  <div className="relative">
                    <select
                      value={form.assetClass} onChange={e => setForm(f => ({ ...f, assetClass: e.target.value }))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary appearance-none pr-10"
                    >
                      {ASSET_CLASSES.map(c => <option key={c} value={c}>{ASSET_CLASS_INFO[c].label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                {TICKER_CLASSES.has(form.assetClass) && (
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Ticker <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <input
                      value={form.tickerSymbol} onChange={e => setForm(f => ({ ...f, tickerSymbol: e.target.value.toUpperCase() }))}
                      placeholder="e.g. VOO, BTC"
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
                <CurrencyField editable value={value} onChange={setValue} currency={currency} label="Current value" />
              </div>
              <Button
                className="w-full mt-6" onClick={() => saveHolding.mutate()}
                disabled={!form.assetName || value <= 0 || saveHolding.isPending}
              >
                {saveHolding.isPending ? "Saving…" : editingId ? "Save changes" : "Add holding"}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </AppShell>
  );
}

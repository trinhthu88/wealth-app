// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: BottomSheet spring animation
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Off-palette colours — use the theme tokens (see index.css)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Own nav / bottom padding hacks — FreeAppShell owns the menu bar and section tabs

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import Sol from "@/components/Sol";
import SolNarration from "@/components/client/SolNarration";
import BottomSheet from "@/components/client/BottomSheet";
import CurrencyField from "@/components/shared/CurrencyField";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Pencil, LineChart as LineChartIcon, Bitcoin, Landmark, Home, PiggyBank, HelpCircle } from "lucide-react";
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

// Palette only. `tile` is the row's icon tile; `card`/`sub` style the
// full-colour allocation tile (Investments Cobalt, Cash Sunset Pop, rest Breeze/Field).
const ASSET_CLASS_INFO: Record<string, { label: string; icon: React.ElementType; tile: string; card: string; sub: string }> = {
  stock_etf: { label: "Stock / ETF",          icon: LineChartIcon, tile: "bg-forest text-paper",  card: "bg-forest text-paper",  sub: "text-mint" },
  crypto:    { label: "Crypto",               icon: Bitcoin,       tile: "bg-breeze text-forest", card: "bg-breeze text-forest", sub: "text-forest" },
  cash:      { label: "Cash / Savings",       icon: PiggyBank,     tile: "bg-sun text-forest",    card: "bg-sun text-forest",    sub: "text-forest" },
  property:  { label: "Property",             icon: Home,          tile: "bg-field text-forest",  card: "bg-field text-forest",  sub: "text-forest" },
  pension:   { label: "Pension / Retirement", icon: Landmark,      tile: "bg-field text-forest",  card: "bg-field text-forest",  sub: "text-forest" },
  other:     { label: "Other",                icon: HelpCircle,    tile: "bg-paper text-forest",  card: "bg-surface text-forest", sub: "text-ink-40" },
};
const ASSET_CLASSES = Object.keys(ASSET_CLASS_INFO);
const TICKER_CLASSES = new Set(["stock_etf", "crypto"]);

type HoldingForm = { assetName: string; assetClass: string; tickerSymbol: string; currencyOriginal: string };

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n < 0 ? "-$" : "$") + (Math.abs(n) / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return (n < 0 ? "-$" : "$") + Math.round(Math.abs(n) / 1000) + "k";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const inputClass =
  "w-full h-11 rounded-2xl bg-surface px-4 text-[14px] text-forest placeholder:text-ink-30 border border-hairline-2 outline-none focus:border-green transition-colors";
const labelClass = "block text-[13px] font-medium text-forest mb-1.5";

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

  // Allocation by asset class, largest first
  const allocation = ASSET_CLASSES
    .map(key => {
      const v = holdings.filter(h => (ASSET_CLASS_INFO[h.assetClass] ? h.assetClass : "other") === key)
        .reduce((s, h) => s + parseFloat(h.currentValueUsd), 0);
      return { key, ...ASSET_CLASS_INFO[key], value: v, pct: totalValue > 0 ? (v / totalValue) * 100 : 0 };
    })
    .filter(a => a.value > 0)
    .sort((a, b) => b.value - a.value);
  const topClass = allocation[0];

  function openAdd() { resetForm(); setShowForm(true); }

  return (
    <AppShell>
      <div className="space-y-4 pb-8">

        <header className="px-1 pt-1">
          <h1 className="font-display text-[36px] leading-[1.05] text-forest">Portfolio</h1>
          <p className="mt-1 text-[14px] text-ink-40 leading-[1.5]">Holdings you track yourself</p>
        </header>

        {/* Cobalt hero */}
        <section aria-label="Self-tracked value" className="bg-forest text-paper rounded-[28px] p-5 flex flex-col gap-3">
          <span className="tala-eyebrow text-mint">Self-tracked value</span>
          <span className="font-display tabular-nums text-[56px] leading-[0.9] tracking-[-0.045em] text-paper">
            {isLoading ? "…" : totalValue > 0 ? fmt(totalValue) : "—"}
          </span>
          <span className="self-start inline-flex items-center rounded-full bg-field px-3 py-1.5 text-[12px] font-semibold tabular-nums text-forest">
            {holdings.length} of {FREE_HOLDING_CAP} holdings used
          </span>
          <span className="text-[12px] text-mint">Values you enter yourself — they move when you update them</span>
        </section>

        {/* Allocation tiles */}
        {allocation.length > 0 && (
          <section
            aria-label={`Allocation: ${allocation.map(a => `${a.label} ${Math.round(a.pct)}%`).join(", ")}`}
            className="space-y-3"
          >
            <h2 className="font-sans text-[16px] font-semibold text-forest px-1">Allocation</h2>
            <div className="grid grid-cols-2 gap-3">
              {allocation.map(a => (
                <div key={a.key} className={cn("rounded-[24px] p-4 flex flex-col gap-1.5 min-w-0", a.card)}>
                  <span className="font-display tabular-nums text-[30px] leading-none tracking-[-0.03em]">{Math.round(a.pct)}%</span>
                  <span className="text-[14px] font-semibold truncate">{a.label}</span>
                  <span className={cn("text-[13px] tabular-nums", a.sub)}>{fmt(a.value)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {!isLoading && topClass && totalValue > 0 && (
          <SolNarration
            line={allocation.length > 1
              ? `${fmt(totalValue)} tracked here. ${topClass.label} is ${Math.round(topClass.pct)}% of it.`
              : `${fmt(totalValue)} tracked here, all of it in ${topClass.label.toLowerCase()}.`}
            detail="These are values you enter yourself, so they move only when you update them. Keeping them current is what makes the split above meaningful."
            className="px-1 mb-0"
          />
        )}

        {/* Holdings */}
        <section aria-label="Holdings" className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="font-sans text-[16px] font-semibold text-forest">
              Holdings <span className="text-ink-40 font-medium tabular-nums">· {holdings.length} of {FREE_HOLDING_CAP}</span>
            </h2>
            {!atCap && holdings.length > 0 && (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add a holding
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="h-32 bg-surface animate-pulse rounded-[24px]" />
          ) : holdings.length === 0 ? (
            <div className="bg-surface rounded-[24px] py-8 px-5 flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-[14px] bg-field text-forest flex items-center justify-center" aria-hidden="true">
                <LineChartIcon className="h-[18px] w-[18px]" />
              </div>
              <p className="text-[14px] font-semibold text-forest mt-3">No holdings tracked yet</p>
              <p className="text-[13px] text-ink-40 mt-1 max-w-xs text-pretty">Add a stock, crypto, or cash position to get started.</p>
              <button
                type="button"
                onClick={openAdd}
                className="mt-4 inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-forest text-paper text-[14px] font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add holding
              </button>
            </div>
          ) : (
            <div className="bg-surface rounded-[24px] p-1">
              {holdings.map(h => {
                const info = ASSET_CLASS_INFO[h.assetClass] ?? ASSET_CLASS_INFO.other;
                return (
                  <div key={h.id} className="flex items-center gap-3 p-3 border-b border-hairline last:border-0">
                    <div className={cn("w-11 h-11 rounded-[14px] shrink-0 flex items-center justify-center", info.tile)} aria-hidden="true">
                      <info.icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-forest truncate">{h.assetName}</p>
                      <p className="text-[13px] text-ink-40 mt-0.5 truncate">{h.tickerSymbol ? `${h.tickerSymbol} · ` : ""}{info.label}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[15px] font-semibold tabular-nums text-forest">{fmt(parseFloat(h.currentValueUsd))}</span>
                      {confirmDeleteId === h.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => deleteHolding.mutate(h.id)} disabled={deleteHolding.isPending}
                            className="h-11 px-4 rounded-full bg-sun text-forest text-[13px] font-semibold disabled:opacity-60">
                            {deleteHolding.isPending ? "…" : "Remove"}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="h-11 px-3 rounded-full text-[13px] font-medium text-ink-40 hover:text-forest">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => openEdit(h)}
                            className="h-11 w-11 flex items-center justify-center rounded-full text-ink-40 hover:text-forest hover:bg-paper transition-colors"
                            aria-label={`Edit ${h.assetName}`}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setConfirmDeleteId(h.id)}
                            className="h-11 w-11 flex items-center justify-center rounded-full text-ink-40 hover:text-forest hover:bg-paper transition-colors"
                            aria-label={`Delete ${h.assetName}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {atCap && (
            <p className="px-1 text-[13px] text-ink-40 leading-[1.5]">
              You're using both free holdings. Edit one to track something else.
            </p>
          )}
        </section>

        {/* Sol tip → Advisor tab */}
        <section aria-label="Sol tip" className="bg-breeze rounded-[24px] p-4 flex items-center gap-3 text-forest">
          <div className="shrink-0">
            <Sol size="sm" animate="breathe" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold leading-[1.4]">Live prices and performance</p>
            <p className="text-[13px] leading-[1.45] text-forest/80 text-pretty mt-0.5">
              Advised clients see live prices and every account in one place.
            </p>
          </div>
          <Link
            href="/free/advisor"
            onClick={() => track("upgrade_cta_clicked", { location: "portfolio_locked_card" })}
            className="shrink-0 inline-flex h-11 items-center rounded-full bg-forest px-4 text-[13px] font-semibold text-paper whitespace-nowrap hover:opacity-90 transition-opacity"
          >
            See how
          </Link>
        </section>
      </div>

      {/* Add/Edit holding sheet */}
      <BottomSheet isOpen={showForm} onClose={resetForm} title={editingId ? "Edit holding" : "Add a holding"}>
        <div className="space-y-5 pb-4">
          <div>
            <label className={labelClass} htmlFor="free-holding-name">Name</label>
            <input
              id="free-holding-name"
              value={form.assetName} onChange={e => setForm(f => ({ ...f, assetName: e.target.value }))}
              placeholder="e.g. Vanguard S&P 500 ETF"
              className={inputClass}
            />
          </div>
          <div>
            <span className={labelClass}>Asset type</span>
            <div className="flex flex-wrap gap-2">
              {ASSET_CLASSES.map(c => {
                const info = ASSET_CLASS_INFO[c];
                const active = form.assetClass === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setForm(f => ({ ...f, assetClass: c }))}
                    className={cn(
                      "h-10 px-3.5 rounded-full text-[13px] font-medium transition-colors flex items-center gap-1.5",
                      active ? "bg-forest text-paper" : "bg-surface text-forest hover:bg-breeze",
                    )}
                  >
                    <info.icon className="w-4 h-4" />
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>
          {TICKER_CLASSES.has(form.assetClass) && (
            <div>
              <label className={labelClass} htmlFor="free-holding-ticker">
                Ticker <span className="text-ink-40 font-normal">(optional)</span>
              </label>
              <input
                id="free-holding-ticker"
                value={form.tickerSymbol} onChange={e => setForm(f => ({ ...f, tickerSymbol: e.target.value.toUpperCase() }))}
                placeholder="e.g. VOO, BTC"
                className={inputClass}
              />
            </div>
          )}
          <CurrencyField editable value={value} onChange={setValue} currency={currency} label="Current value" />
          <button
            className="w-full h-11 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            onClick={() => saveHolding.mutate()}
            disabled={!form.assetName || value <= 0 || saveHolding.isPending}
          >
            {saveHolding.isPending ? "Saving…" : editingId ? "Save changes" : "Add holding"}
          </button>
        </div>
      </BottomSheet>

    </AppShell>
  );
}

// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Chart draw animation (Recharts default)
// ✓ ALLOWED: BottomSheet spring animation
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Off-palette colours — use the theme tokens (see index.css)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Own nav / bottom padding hacks — FreeAppShell owns the menu bar and section tabs

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import FreeTierBanner from "@/components/FreeTierBanner";
import SolNarration from "@/components/client/SolNarration";
import BottomSheet from "@/components/client/BottomSheet";
import CurrencyField from "@/components/shared/CurrencyField";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Landmark, PiggyBank, TrendingUp, TrendingDown, Briefcase, Home, FileText,
  CreditCard, Wallet, AlertCircle, Car, GraduationCap, Minus,
} from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useProfile } from "@/hooks/useProfile";

interface Asset { id: string; name: string; category: string; valueUsd: string; currencyOriginal: string; }
interface Liability { id: string; name: string; category: string; balanceUsd: string; interestRatePercent: string | null; }
interface NetWorthSnapshot { id: string; snapshotDate: string; netWorthUsd: string; }

const FREE_HISTORY_MONTHS = 3;

// Free-tier: exactly 5 asset categories. Icon tiles cycle the calm palette
// (Spring Field / Blue Breeze / Soft Cloud) — Cobalt stays on text and actions.
const ASSET_CAT_INFO: Record<string, { label: string; icon: React.ElementType; tile: string }> = {
  cash:        { label: "Cash",        icon: Landmark,   tile: "bg-breeze text-forest" },
  savings:     { label: "Savings",     icon: PiggyBank,  tile: "bg-breeze text-forest" },
  investment:  { label: "Investment",  icon: TrendingUp, tile: "bg-field text-forest" },
  business:    { label: "Business",    icon: Briefcase,  tile: "bg-field text-forest" },
  real_estate: { label: "Real Estate", icon: Home,       tile: "bg-paper text-forest" },
};
// Fallback for any legacy categories still in DB
const ASSET_CAT_FALLBACK = { label: "Other", icon: FileText, tile: "bg-paper text-forest" };

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
const CASH_CATS = new Set(["cash", "savings"]);

type AssetForm = { name: string; category: string; valueUsd: string; currencyOriginal: string };
type LiabForm  = { name: string; category: string; balanceUsd: string; interestRatePercent: string };

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n < 0 ? "-$" : "$") + (Math.abs(n) / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return (n < 0 ? "-$" : "$") + Math.round(Math.abs(n) / 1000) + "k";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const inputClass =
  "w-full h-11 rounded-2xl bg-surface px-4 text-[14px] text-forest placeholder:text-ink-30 border border-hairline-2 outline-none focus:border-green transition-colors";
const labelClass = "block text-[13px] font-medium text-forest mb-1.5";
const primaryBtn =
  "w-full h-11 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity";

function IconTile({ icon: Icon, className }: { icon: React.ElementType; className: string }) {
  return (
    <div className={cn("w-10 h-10 rounded-[14px] shrink-0 flex items-center justify-center", className)} aria-hidden="true">
      <Icon className="h-[18px] w-[18px]" />
    </div>
  );
}

function ConfirmRemove({ pending, onConfirm, onCancel }: { pending: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onConfirm} disabled={pending}
        className="h-11 px-4 rounded-full bg-sun text-forest text-[13px] font-semibold disabled:opacity-60">
        {pending ? "…" : "Remove"}
      </button>
      <button onClick={onCancel}
        className="h-11 px-3 rounded-full text-[13px] font-medium text-ink-40 hover:text-forest">
        Cancel
      </button>
    </div>
  );
}

function CategoryChips<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; icon: React.ElementType }[];
  value: string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "h-10 px-3.5 rounded-full text-[13px] font-medium transition-colors flex items-center gap-1.5",
            value === o.value ? "bg-forest text-paper" : "bg-surface text-forest hover:bg-breeze",
          )}
        >
          <o.icon className="w-4 h-4" />
          {o.label}
        </button>
      ))}
    </div>
  );
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
  const { data: snapshots = [] }   = useQuery<NetWorthSnapshot[]>({ queryKey: ["nw-snapshots"], queryFn: () => apiFetch<NetWorthSnapshot[]>("/client/networth/snapshots") });

  const totalAssets      = assets.reduce((s, a) => s + parseFloat(a.valueUsd), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + parseFloat(l.balanceUsd), 0);
  const netWorth         = totalAssets - totalLiabilities;

  const isFreeUser = profile?.role === "free_user";
  const visibleSnapshots = isFreeUser ? snapshots.slice(-FREE_HISTORY_MONTHS) : snapshots;
  const netWorthDelta = visibleSnapshots.length >= 2
    ? parseFloat(visibleSnapshots[visibleSnapshots.length - 1].netWorthUsd) - parseFloat(visibleSnapshots[visibleSnapshots.length - 2].netWorthUsd)
    : null;
  const trendData = visibleSnapshots.map(s => ({
    date: s.snapshotDate,
    value: parseFloat(s.netWorthUsd),
    label: new Date(s.snapshotDate).toLocaleDateString("en-US", { month: "short" }),
  }));

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

  const hasItems = assets.length > 0 || liabilities.length > 0;
  const cashTotal = assets.filter(a => CASH_CATS.has(a.category)).reduce((s, a) => s + parseFloat(a.valueUsd), 0);
  const cashPct = totalAssets > 0 ? Math.round((cashTotal / totalAssets) * 100) : 0;

  const categoryTotals = ASSET_CATS
    .map(key => ({ key, ...ASSET_CAT_INFO[key], total: assets.filter(a => a.category === key).reduce((s, a) => s + parseFloat(a.valueUsd), 0) }))
    .filter(c => c.total > 0);

  let deltaNode: React.ReactNode = null;
  if (netWorthDelta !== null) {
    const DeltaIcon = netWorthDelta === 0 ? Minus : netWorthDelta > 0 ? TrendingUp : TrendingDown;
    deltaNode = (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold tabular-nums",
        netWorthDelta >= 0 ? "bg-field text-forest" : "bg-sun-tint text-amber-ink",
      )}>
        <DeltaIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {netWorthDelta === 0 ? "No change" : `${netWorthDelta > 0 ? "+" : "-"}${fmt(Math.abs(netWorthDelta))}`} this month
      </span>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4 pb-8">


        {totalAssets > 0 && (
          <SolNarration
            line={`${fmt(totalAssets)} across ${assets.length} asset${assets.length !== 1 ? "s" : ""}. Cash and savings are ${cashPct}% of it.`}
            detail="A cash buffer is usually sized in months of expenses — three to six is typical. Money beyond that has an opportunity cost, which is worth understanding as your net worth grows."
          />
        )}

        <div className="px-1">
          <h1 className="font-display text-[30px] leading-[1.1] text-forest">Net worth</h1>
          <p className="mt-1 text-[14px] text-ink-40 leading-[1.5]">What you own, minus what you owe.</p>
        </div>

        {/* Focal number */}
        <section aria-label="Net worth" className="px-1 pt-2 space-y-3">
          <p className="tala-eyebrow text-ink-40">Net worth</p>
          <p className={cn(
            "font-display tabular-nums text-[56px] leading-none tracking-[-0.04em]",
            netWorth < 0 ? "text-clay-ink" : "text-forest",
          )}>
            {hasItems ? fmt(netWorth) : "—"}
          </p>
          {deltaNode && <div>{deltaNode}</div>}
          <div className="flex gap-6 pt-1">
            <div>
              <p className="tala-eyebrow text-ink-30">Assets</p>
              <p className="text-[16px] font-semibold tabular-nums text-forest mt-1">{totalAssets > 0 ? fmt(totalAssets) : "—"}</p>
            </div>
            <div>
              <p className="tala-eyebrow text-ink-30">Liabilities</p>
              <p className="text-[16px] font-semibold tabular-nums text-forest mt-1">{totalLiabilities > 0 ? fmt(totalLiabilities) : "—"}</p>
            </div>
          </div>
        </section>

        {netWorth < 0 && (
          <div className="rounded-[24px] p-4 flex items-start gap-3 bg-sun-tint">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-ink mt-px" aria-hidden="true" />
            <p className="text-[14px] text-amber-ink leading-[1.5]">Your liabilities currently exceed your assets.</p>
          </div>
        )}

        {/* Trend */}
        {trendData.length >= 2 ? (
          <div
            className="bg-surface rounded-[24px] p-5"
            role="img"
            aria-label={`Net worth trend: latest ${fmt(trendData[trendData.length - 1].value)}`}
          >
            <h2 className="font-sans text-[16px] font-semibold text-forest mb-3">Trend</h2>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="free-nw-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--forest)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--forest)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-30)" }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Tooltip
                    cursor={{ stroke: "var(--hairline-2)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as { label: string; value: number };
                      return (
                        <div className="bg-paper rounded-[14px] px-3 py-2 shadow-[0_8px_24px_rgba(12,33,164,0.12)] text-[12px]">
                          <p className="font-semibold text-forest">{d.label}</p>
                          <p className="text-ink-40">Net worth <span className="font-semibold tabular-nums text-forest">{fmt(d.value)}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--forest)"
                    strokeWidth={2.5}
                    fill="url(#free-nw-fill)"
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--forest)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {isFreeUser && snapshots.length > FREE_HISTORY_MONTHS && (
              <p className="text-[12px] text-ink-30 mt-3">History beyond {FREE_HISTORY_MONTHS} months is available to clients.</p>
            )}
          </div>
        ) : hasItems ? (
          <div className="bg-surface rounded-[24px] p-5 flex items-center gap-3">
            <IconTile icon={TrendingUp} className="bg-field text-forest" />
            <p className="text-[14px] text-ink-40 leading-[1.5] text-pretty">
              Your trend appears here once there are two monthly snapshots to compare.
            </p>
          </div>
        ) : null}

        {/* Assets / liabilities switch */}
        <div className="flex gap-1 rounded-full bg-surface p-1" role="tablist" aria-label="Net worth items">
          {(["assets", "liabilities"] as const).map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "min-h-11 flex-1 rounded-full px-4 text-[13px] font-semibold transition-colors",
                tab === t ? "bg-forest text-paper" : "text-ink-40 hover:text-forest",
              )}
            >
              {t === "assets" ? `Assets (${assets.length})` : `Liabilities (${liabilities.length})`}
            </button>
          ))}
        </div>

        {/* Assets tab */}
        {tab === "assets" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <h2 className="font-sans text-[16px] font-semibold text-forest">Assets</h2>
                {assets.length > 0 && (
                  <span className="text-[15px] font-semibold tabular-nums text-ink-40">{fmt(totalAssets)}</span>
                )}
              </div>
              <button
                onClick={() => setShowAssetForm(true)}
                className="shrink-0 flex items-center gap-1.5 h-11 px-4 rounded-full bg-forest text-paper text-[14px] font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add asset
              </button>
            </div>

            {assets.length === 0 ? (
              <div className="bg-surface rounded-[24px] py-10 px-5 text-center">
                <p className="text-[14px] font-medium text-forest">No assets added yet</p>
                <p className="text-[13px] text-ink-40 mt-1">Cash, savings, investments, business or property — track what you own to see your net worth.</p>
              </div>
            ) : (
              <div className="bg-surface rounded-[24px] p-1">
                {assets.map(a => {
                  const info = ASSET_CAT_INFO[a.category] ?? ASSET_CAT_FALLBACK;
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-2 p-3 border-b border-hairline last:border-0">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <IconTile icon={info.icon} className={info.tile} />
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-forest truncate">{a.name}</p>
                          <p className="text-[13px] text-ink-40 mt-0.5 truncate">{info.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[15px] font-semibold tabular-nums text-forest">{fmt(parseFloat(a.valueUsd))}</span>
                        {confirmDeleteAsset === a.id ? (
                          <ConfirmRemove
                            pending={delAsset.isPending}
                            onConfirm={() => delAsset.mutate(a.id)}
                            onCancel={() => setConfirmDeleteAsset(null)}
                          />
                        ) : (
                          <button onClick={() => setConfirmDeleteAsset(a.id)}
                            className="h-11 w-11 flex items-center justify-center rounded-full text-ink-40 hover:text-clay-ink hover:bg-paper transition-colors"
                            aria-label={`Delete ${a.name}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Category totals breakdown */}
            {categoryTotals.length > 0 && (
              <div className="bg-surface rounded-[24px] p-5">
                <h3 className="text-[15px] font-semibold text-forest mb-3">By category</h3>
                <div className="space-y-3">
                  {categoryTotals.map(c => {
                    const pct = totalAssets > 0 ? (c.total / totalAssets) * 100 : 0;
                    return (
                      <div key={c.key}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <c.icon className="w-4 h-4 text-ink-40 shrink-0" aria-hidden="true" />
                            <span className="text-[14px] text-forest truncate">{c.label}</span>
                          </div>
                          <span className="text-[14px] font-semibold tabular-nums text-forest">{fmt(c.total)}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-track overflow-hidden">
                          <div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Liabilities tab */}
        {tab === "liabilities" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <h2 className="font-sans text-[16px] font-semibold text-forest">Liabilities</h2>
                {liabilities.length > 0 && (
                  <span className="text-[15px] font-semibold tabular-nums text-ink-40">{fmt(totalLiabilities)}</span>
                )}
              </div>
              <button
                onClick={() => setShowLiabForm(true)}
                className="shrink-0 flex items-center gap-1.5 h-11 px-4 rounded-full bg-forest text-paper text-[14px] font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add liability
              </button>
            </div>

            {liabilities.length === 0 ? (
              <div className="bg-surface rounded-[24px] py-10 px-5 text-center">
                <p className="text-[14px] font-medium text-forest">No liabilities added yet</p>
                <p className="text-[13px] text-ink-40 mt-1">Mortgage, loans or card balances — track what you owe for a complete picture.</p>
              </div>
            ) : (
              <div className="bg-surface rounded-[24px] p-1">
                {liabilities.map(l => {
                  const info = LIABILITY_CAT_INFO[l.category] ?? { label: l.category, icon: AlertCircle };
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-2 p-3 border-b border-hairline last:border-0">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <IconTile icon={info.icon} className="bg-breeze text-forest" />
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-forest truncate">{l.name}</p>
                          <p className="text-[13px] text-ink-40 mt-0.5 truncate">
                            {info.label}{l.interestRatePercent ? ` · ${l.interestRatePercent}% interest` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[15px] font-semibold tabular-nums text-forest">{fmt(parseFloat(l.balanceUsd))}</span>
                        {confirmDeleteLiab === l.id ? (
                          <ConfirmRemove
                            pending={delLiab.isPending}
                            onConfirm={() => delLiab.mutate(l.id)}
                            onCancel={() => setConfirmDeleteLiab(null)}
                          />
                        ) : (
                          <button onClick={() => setConfirmDeleteLiab(l.id)}
                            className="h-11 w-11 flex items-center justify-center rounded-full text-ink-40 hover:text-clay-ink hover:bg-paper transition-colors"
                            aria-label={`Delete ${l.name}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <FreeTierBanner
          feature="Manual assets and liabilities only"
          benefit="Investment clients get their full advised portfolio auto-synced into net worth."
          storageKey="networth"
        />
      </div>

      {/* Add Asset bottom sheet */}
      <BottomSheet isOpen={showAssetForm} onClose={() => setShowAssetForm(false)} title="Add an asset">
        <div className="space-y-5 pb-4">
          <div>
            <label className={labelClass} htmlFor="free-asset-name">Asset name</label>
            <input
              id="free-asset-name"
              value={aForm.name} onChange={e => setAForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. DBS Savings Account"
              className={inputClass}
            />
          </div>
          <div>
            <span className={labelClass}>Category</span>
            <CategoryChips
              options={ASSET_CATS.map(c => ({ value: c, label: ASSET_CAT_INFO[c].label, icon: ASSET_CAT_INFO[c].icon }))}
              value={aForm.category}
              onChange={v => setAForm(f => ({ ...f, category: v }))}
            />
          </div>
          <CurrencyField editable value={aValue} onChange={setAValue} currency={currency} label="Value (USD)" />
          <button
            className={primaryBtn} onClick={() => addAsset.mutate()}
            disabled={!aForm.name || aValue <= 0 || addAsset.isPending}
          >
            {addAsset.isPending ? "Saving…" : "Add asset"}
          </button>
        </div>
      </BottomSheet>

      {/* Add Liability bottom sheet */}
      <BottomSheet isOpen={showLiabForm} onClose={() => setShowLiabForm(false)} title="Add a liability">
        <div className="space-y-5 pb-4">
          <div>
            <label className={labelClass} htmlFor="free-liab-name">Liability name</label>
            <input
              id="free-liab-name"
              value={lForm.name} onChange={e => setLForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Home Mortgage"
              className={inputClass}
            />
          </div>
          <div>
            <span className={labelClass}>Category</span>
            <CategoryChips
              options={LIABILITY_CATS.map(c => ({ value: c, label: LIABILITY_CAT_INFO[c]?.label ?? c, icon: LIABILITY_CAT_INFO[c]?.icon ?? AlertCircle }))}
              value={lForm.category}
              onChange={v => setLForm(f => ({ ...f, category: v }))}
            />
          </div>
          <CurrencyField editable value={lValue} onChange={setLValue} currency={currency} label="Balance (USD)" />
          <div>
            <label className={labelClass} htmlFor="free-liab-rate">
              Interest rate % <span className="text-ink-40 font-normal">(optional)</span>
            </label>
            <input
              id="free-liab-rate"
              type="number" step="0.1" placeholder="e.g. 3.5"
              value={lForm.interestRatePercent} onChange={e => setLForm(f => ({ ...f, interestRatePercent: e.target.value }))}
              className={inputClass}
            />
          </div>
          <button
            className={primaryBtn} onClick={() => addLiab.mutate()}
            disabled={!lForm.name || lValue <= 0 || addLiab.isPending}
          >
            {addLiab.isPending ? "Saving…" : "Add liability"}
          </button>
        </div>
      </BottomSheet>

    </AppShell>
  );
}

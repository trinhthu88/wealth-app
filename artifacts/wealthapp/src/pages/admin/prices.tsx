import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw, TrendingUp, TrendingDown, Minus, DollarSign, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FundPrice {
  id: string;
  fundId: string;
  priceDate: string;
  priceNative: string;
  priceUsd: string;
  change1d: string | null;
  change1dPercent: string | null;
  source: string;
}

interface FundWithPrice {
  id: string;
  name: string;
  ticker: string | null;
  assetClass: string;
  currency: string;
  fundManager: string | null;
  priceApiSymbol: string | null;
  isActive: boolean;
  latestPrice: FundPrice | null;
}

interface OverrideForm { priceNative: string; priceDate: string; change1d: string; change1dPercent: string; }
const defaultOverride: OverrideForm = { priceNative: "", priceDate: new Date().toISOString().split("T")[0], change1d: "", change1dPercent: "" };

const ASSET_CLASS_COLORS: Record<string, string> = {
  equity: "bg-surface border border-hairline text-forest",
  bond: "bg-surface border border-hairline text-forest",
  cash: "bg-surface border border-hairline text-ink-60",
  real_estate: "bg-sun-tint text-amber-ink",
  commodity: "bg-sun-tint text-amber-ink",
  alternative: "bg-green-tint text-green",
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function AdminPrices() {
  const [search, setSearch] = useState("");
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideForm>(defaultOverride);

  const { data: funds = [], isLoading } = useQuery<FundWithPrice[]>({
    queryKey: ["fund-prices-latest"],
    queryFn: () => apiFetch<FundWithPrice[]>("/fund-prices/latest"),
    refetchInterval: 60_000,
  });

  const refreshMut = useMutation({
    mutationFn: () => apiFetch("/prices/refresh", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["fund-prices-latest"] });
      toast.success(`Refreshed ${data.refreshed} fund price${data.refreshed !== 1 ? "s" : ""} from Twelve Data`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Price refresh failed"),
  });

  const overrideMut = useMutation({
    mutationFn: ({ fundId, form }: { fundId: string; form: OverrideForm }) =>
      apiFetch("/fund-prices", {
        method: "POST",
        body: JSON.stringify({
          fundId,
          priceDate: form.priceDate,
          priceNative: form.priceNative,
          priceUsd: form.priceNative,
          change1d: form.change1d || null,
          change1dPercent: form.change1dPercent || null,
          source: "manual",
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fund-prices-latest"] });
      setOverrideId(null);
      setOverrideForm(defaultOverride);
      toast.success("Price updated");
    },
    onError: () => toast.error("Failed to update price"),
  });

  const filtered = funds.filter(f =>
    (f.name.toLowerCase().includes(search.toLowerCase())) ||
    (f.ticker ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (f.fundManager ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const stale = funds.filter(f => !f.latestPrice || daysSince(f.latestPrice.priceDate) > 1);
  const withSymbol = funds.filter(f => f.priceApiSymbol);

  return (
    <AppShell>
      <PageHeader title="Fund Price Manager" subtitle={`${funds.length} funds · ${stale.length} need price updates`} />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-surface border border-hairline rounded-[26px] p-6 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[32px] font-semibold text-forest leading-none">{funds.filter(f => f.latestPrice).length}</div>
          <div className="text-[13px] text-ink-40 mt-1.5">With prices</div>
        </div>
        <div className="bg-surface border border-hairline rounded-[26px] p-6 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className={cn("font-display text-[32px] font-semibold leading-none", stale.length > 0 ? "text-amber-ink" : "text-green")}>{stale.length}</div>
          <div className="text-[13px] text-ink-40 mt-1.5">Stale / missing</div>
        </div>
        <div className="bg-surface border border-hairline rounded-[26px] p-6 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[32px] font-semibold text-forest leading-none">{withSymbol.length}</div>
          <div className="text-[13px] text-ink-40 mt-1.5">API-enabled</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <Input placeholder="Search funds…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs h-11 rounded-full border-hairline bg-surface px-5 focus-visible:ring-green" />
        <Button onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending || withSymbol.length === 0}
          className="rounded-full h-11 px-5 bg-forest text-paper hover:bg-forest-700 gap-2">
          <RefreshCw className={cn("h-4 w-4", refreshMut.isPending && "animate-spin")} />
          {refreshMut.isPending ? "Refreshing…" : `Refresh ${withSymbol.length} via API`}
        </Button>
      </div>

      {withSymbol.length === 0 && (
        <div className="flex items-start gap-3 text-[14px] text-amber-ink bg-sun-tint border border-[#FBE5C5] rounded-[16px] p-4 mb-6">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 opacity-80" />
          <span className="leading-relaxed">No funds have a <strong>priceApiSymbol</strong> set. Add it in Fund Management to enable automatic price refresh from Twelve Data.</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-surface rounded-[26px] animate-pulse" />)}</div>
      ) : (
        <div className="bg-surface rounded-[26px] overflow-hidden shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Fund</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Asset class</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline text-right">Latest price</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline text-right hidden md:table-cell">Change</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden md:table-cell">As of</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden lg:table-cell">Source</th>
                <th className="px-5 py-4 border-b border-hairline" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const p = f.latestPrice;
                const age = p ? daysSince(p.priceDate) : null;
                const isStale = age === null || age > 1;
                const chg = p ? parseFloat(p.change1dPercent ?? "0") : 0;
                const isEditing = overrideId === f.id;
                return (
                  <React.Fragment key={f.id}>
                    <tr className={cn("border-b border-hairline last:border-0 transition-colors group", isEditing ? "bg-paper" : "hover:bg-paper")}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-[15px] text-forest">{f.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {f.ticker && <span className="text-[12px] text-ink-40 font-mono tracking-wide">{f.ticker}</span>}
                          {f.priceApiSymbol && <span className="text-[11px] bg-green-tint text-green px-1.5 py-0.5 rounded-[4px] font-mono tracking-wide">{f.priceApiSymbol}</span>}
                          {!f.isActive && <span className="text-[11px] bg-surface border border-hairline text-ink-60 px-1.5 py-0.5 rounded-[4px] uppercase tracking-wide">inactive</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("text-[12px] px-2.5 py-1 rounded-full font-medium capitalize tracking-wide", ASSET_CLASS_COLORS[f.assetClass] ?? "bg-surface border border-hairline text-ink-60")}>
                          {f.assetClass.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {p ? (
                          <span className="font-semibold text-forest tabular-nums text-[15px]">{f.currency} {parseFloat(p.priceNative).toFixed(4)}</span>
                        ) : (
                          <span className="text-ink-40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right hidden md:table-cell">
                        {p && p.change1dPercent ? (
                          <span className={cn("flex items-center gap-1 justify-end text-[13px] font-semibold tabular-nums", chg > 0 ? "text-green" : chg < 0 ? "text-clay" : "text-ink-40")}>
                            {chg > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : chg < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                            {chg > 0 ? "+" : ""}{chg.toFixed(2)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        {p ? (
                          <div>
                            <div className="text-[14px] text-forest tabular-nums">{p.priceDate}</div>
                            {isStale && <div className="text-[12px] text-amber-ink mt-0.5">{age === null ? "never" : `${age}d ago`}</div>}
                          </div>
                        ) : (
                          <span className="text-amber-ink text-[13px] font-medium">No price</span>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <span className="text-[13px] text-ink-40 capitalize">{p?.source ?? "—"}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="ghost" className="h-8 text-[13px] text-green hover:text-forest opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            if (isEditing) { setOverrideId(null); return; }
                            setOverrideId(f.id);
                            setOverrideForm({ ...defaultOverride, priceNative: p ? parseFloat(p.priceNative).toFixed(4) : "" });
                          }}>
                          <DollarSign className="h-3.5 w-3.5 mr-1" />
                          {isEditing ? "Cancel" : "Override"}
                        </Button>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="border-b border-hairline bg-paper">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="flex items-end gap-4 flex-wrap">
                            <div>
                              <label className="text-[12px] font-medium text-ink-60 block mb-1.5">Price ({f.currency})</label>
                              <Input className="w-32 h-10 rounded-[10px] border-hairline bg-surface px-3 focus-visible:ring-green" type="number" step="0.0001" placeholder="0.0000"
                                value={overrideForm.priceNative} onChange={e => setOverrideForm(f => ({ ...f, priceNative: e.target.value }))} />
                            </div>
                            <div>
                              <label className="text-[12px] font-medium text-ink-60 block mb-1.5">Price date</label>
                              <Input className="w-40 h-10 rounded-[10px] border-hairline bg-surface px-3 focus-visible:ring-green" type="date"
                                value={overrideForm.priceDate} onChange={e => setOverrideForm(frm => ({ ...frm, priceDate: e.target.value }))} />
                            </div>
                            <div>
                              <label className="text-[12px] font-medium text-ink-60 block mb-1.5">1d change (%)</label>
                              <Input className="w-28 h-10 rounded-[10px] border-hairline bg-surface px-3 focus-visible:ring-green" type="number" step="0.01" placeholder="e.g. 0.34"
                                value={overrideForm.change1dPercent} onChange={e => setOverrideForm(frm => ({ ...frm, change1dPercent: e.target.value }))} />
                            </div>
                            <Button size="sm" className="h-10 px-5 rounded-[10px] bg-green text-surface hover:bg-green-300" disabled={overrideMut.isPending || !overrideForm.priceNative}
                              onClick={() => overrideMut.mutate({ fundId: f.id, form: overrideForm })}>
                              {overrideMut.isPending ? "Saving…" : "Save price"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

import { useState } from "react";
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
  equity: "bg-blue-100 text-blue-700",
  bond: "bg-green-100 text-green-700",
  cash: "bg-slate-100 text-slate-600",
  real_estate: "bg-orange-100 text-orange-700",
  commodity: "bg-amber-100 text-amber-700",
  alternative: "bg-purple-100 text-purple-700",
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
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{funds.filter(f => f.latestPrice).length}</div>
          <div className="text-xs text-muted-foreground mt-1">With prices</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <div className={cn("text-2xl font-bold", stale.length > 0 ? "text-amber-600" : "text-emerald-600")}>{stale.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Stale / missing</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{withSymbol.length}</div>
          <div className="text-xs text-muted-foreground mt-1">API-enabled</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-4">
        <Input placeholder="Search funds…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Button onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending || withSymbol.length === 0}
          className="gap-2">
          <RefreshCw className={cn("h-4 w-4", refreshMut.isPending && "animate-spin")} />
          {refreshMut.isPending ? "Refreshing…" : `Refresh ${withSymbol.length} via API`}
        </Button>
      </div>

      {withSymbol.length === 0 && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>No funds have a <strong>priceApiSymbol</strong> set. Add it in Fund Management to enable automatic price refresh from Twelve Data.</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fund</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Asset class</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Latest price</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Change</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">As of</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Source</th>
                <th className="px-4 py-3" />
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
                  <>
                    <tr key={f.id} className={cn("border-b border-border last:border-0 transition-colors", isEditing ? "bg-primary/5" : "hover:bg-muted/30")}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{f.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {f.ticker && <span className="text-xs text-muted-foreground font-mono">{f.ticker}</span>}
                          {f.priceApiSymbol && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">{f.priceApiSymbol}</span>}
                          {!f.isActive && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">inactive</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", ASSET_CLASS_COLORS[f.assetClass] ?? "bg-muted text-muted-foreground")}>
                          {f.assetClass}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p ? (
                          <span className="font-semibold">{f.currency} {parseFloat(p.priceNative).toFixed(4)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {p && p.change1dPercent ? (
                          <span className={cn("flex items-center gap-1 justify-end text-xs font-medium", chg > 0 ? "text-emerald-600" : chg < 0 ? "text-red-500" : "text-muted-foreground")}>
                            {chg > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : chg < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                            {chg > 0 ? "+" : ""}{chg.toFixed(2)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {p ? (
                          <div>
                            <div className="text-sm">{p.priceDate}</div>
                            {isStale && <div className="text-xs text-amber-600">{age === null ? "never" : `${age}d ago`}</div>}
                          </div>
                        ) : (
                          <span className="text-amber-600 text-xs">No price</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground capitalize">{p?.source ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" className="h-7 text-xs"
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
                      <tr key={`${f.id}-edit`} className="border-b border-border bg-primary/5">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex items-end gap-3 flex-wrap">
                            <div>
                              <label className="text-xs font-medium block mb-1">Price ({f.currency})</label>
                              <Input className="w-32 h-8 text-sm" type="number" step="0.0001" placeholder="0.0000"
                                value={overrideForm.priceNative} onChange={e => setOverrideForm(f => ({ ...f, priceNative: e.target.value }))} />
                            </div>
                            <div>
                              <label className="text-xs font-medium block mb-1">Price date</label>
                              <Input className="w-36 h-8 text-sm" type="date"
                                value={overrideForm.priceDate} onChange={e => setOverrideForm(frm => ({ ...frm, priceDate: e.target.value }))} />
                            </div>
                            <div>
                              <label className="text-xs font-medium block mb-1">1d change (%)</label>
                              <Input className="w-24 h-8 text-sm" type="number" step="0.01" placeholder="e.g. 0.34"
                                value={overrideForm.change1dPercent} onChange={e => setOverrideForm(frm => ({ ...frm, change1dPercent: e.target.value }))} />
                            </div>
                            <Button size="sm" className="h-8" disabled={overrideMut.isPending || !overrideForm.priceNative}
                              onClick={() => overrideMut.mutate({ fundId: f.id, form: overrideForm })}>
                              {overrideMut.isPending ? "Saving…" : "Save price"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

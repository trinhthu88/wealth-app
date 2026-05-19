import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { Plus, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Fund {
  id: string;
  name: string;
  ticker: string | null;
  isin: string | null;
  assetClass: string;
  geography: string | null;
  currency: string;
  fundManager: string | null;
  fundType: string | null;
  expenseRatio: string | null;
  priceApiSymbol: string | null;
  isActive: boolean;
  createdAt: string;
}

const ASSET_CLASSES = ["equity", "bond", "cash", "real_estate", "commodity", "alternative"];

const EMPTY_FUND = {
  name: "", ticker: "", isin: "", assetClass: "equity", geography: "", currency: "USD",
  fundManager: "", fundType: "", expenseRatio: "", priceApiSymbol: "", factsheetUrl: "",
};

export default function AdminFundsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<typeof EMPTY_FUND>({ ...EMPTY_FUND });
  const [editDraft, setEditDraft] = useState<Partial<Fund>>({});
  const [priceForm, setPriceForm] = useState<{ fundId: string; date: string; price: string } | null>(null);

  const { data: funds = [], isLoading } = useQuery<Fund[]>({
    queryKey: ["funds-all"],
    queryFn: () => apiFetch("/funds/all"),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/funds", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["funds-all"] }); setShowCreate(false); setDraft({ ...EMPTY_FUND }); toast.success("Fund created"); },
    onError: () => toast.error("Failed to create fund"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => apiFetch(`/funds/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["funds-all"] }); setEditId(null); toast.success("Fund updated"); },
  });

  const priceMut = useMutation({
    mutationFn: (data: any) => apiFetch("/fund-prices", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { setPriceForm(null); toast.success("Price updated"); },
    onError: () => toast.error("Failed to update price"),
  });

  const activeFunds = funds.filter((f) => f.isActive);
  const inactiveFunds = funds.filter((f) => !f.isActive);

  return (
    <AppShell>
      <PageHeader title="Fund Management" subtitle={`${activeFunds.length} active funds`} />

      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add fund
        </Button>
      </div>

      {showCreate && (
        <div className="bg-card border-2 border-primary/20 rounded-2xl p-5 mb-5 space-y-4">
          <h3 className="font-semibold">Add New Fund</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium">Fund name *</label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Vanguard S&P 500 ETF" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Ticker</label>
              <Input value={draft.ticker} onChange={(e) => setDraft((d) => ({ ...d, ticker: e.target.value }))} placeholder="VOO" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">ISIN</label>
              <Input value={draft.isin} onChange={(e) => setDraft((d) => ({ ...d, isin: e.target.value }))} placeholder="US9229083632" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Asset class *</label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm" value={draft.assetClass} onChange={(e) => setDraft((d) => ({ ...d, assetClass: e.target.value }))}>
                {ASSET_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Currency</label>
              <Input value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))} placeholder="USD" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Geography</label>
              <Input value={draft.geography} onChange={(e) => setDraft((d) => ({ ...d, geography: e.target.value }))} placeholder="US, Global, EM Asia…" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Fund manager</label>
              <Input value={draft.fundManager} onChange={(e) => setDraft((d) => ({ ...d, fundManager: e.target.value }))} placeholder="Vanguard, BlackRock…" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Fund type</label>
              <Input value={draft.fundType} onChange={(e) => setDraft((d) => ({ ...d, fundType: e.target.value }))} placeholder="ETF, Unit Trust, OEIC…" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Expense ratio %</label>
              <Input type="number" step="0.01" value={draft.expenseRatio} onChange={(e) => setDraft((d) => ({ ...d, expenseRatio: e.target.value }))} placeholder="0.03" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Price API symbol</label>
              <Input value={draft.priceApiSymbol} onChange={(e) => setDraft((d) => ({ ...d, priceApiSymbol: e.target.value }))} placeholder="VOO" />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium">Factsheet URL</label>
              <Input value={draft.factsheetUrl} onChange={(e) => setDraft((d) => ({ ...d, factsheetUrl: e.target.value }))} placeholder="https://…" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" disabled={createMut.isPending || !draft.name}
              onClick={() => createMut.mutate({ ...draft, expenseRatio: draft.expenseRatio || undefined, ticker: draft.ticker || undefined })}>
              {createMut.isPending ? "Creating…" : "Create fund"}
            </Button>
          </div>
        </div>
      )}

      {priceForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 space-y-3">
          <h3 className="font-semibold text-sm">Update Price for {funds.find(f => f.id === priceForm.fundId)?.name}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Price date</label>
              <Input type="date" value={priceForm.date} onChange={(e) => setPriceForm(p => p ? { ...p, date: e.target.value } : null)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Price (USD)</label>
              <Input type="number" step="0.01" value={priceForm.price} onChange={(e) => setPriceForm(p => p ? { ...p, price: e.target.value } : null)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPriceForm(null)}>Cancel</Button>
            <Button size="sm" disabled={priceMut.isPending} onClick={() =>
              priceMut.mutate({ fundId: priceForm.fundId, priceDate: priceForm.date, priceNative: priceForm.price, priceUsd: priceForm.price, source: "manual" })
            }>
              {priceMut.isPending ? "Saving…" : "Save price"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Fund</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Class</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Manager</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {funds.map((fund) => (
                <tr key={fund.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{fund.name}</div>
                    <div className="text-xs text-muted-foreground">{[fund.ticker, fund.isin].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                      {fund.assetClass.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fund.fundManager ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${fund.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {fund.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() =>
                        setPriceForm({ fundId: fund.id, date: new Date().toISOString().split("T")[0], price: "" })
                      }>
                        Price
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditId(fund.id);
                        setEditDraft({ isActive: fund.isActive });
                      }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      {editId === fund.id && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => updateMut.mutate({ id: fund.id, data: { isActive: !fund.isActive } })}>
                            {fund.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {funds.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">No funds yet. Add your first fund above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

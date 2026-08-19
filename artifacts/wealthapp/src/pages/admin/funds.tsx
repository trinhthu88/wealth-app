import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { Plus, Edit2, Check, X, Building } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
const ASSET_CLASS_COLORS: Record<string, string> = {
  equity: "bg-surface border border-hairline text-forest",
  bond: "bg-surface border border-hairline text-forest",
  cash: "bg-surface border border-hairline text-ink-60",
  real_estate: "bg-sun-tint text-amber-ink",
  commodity: "bg-sun-tint text-amber-ink",
  alternative: "bg-green-tint text-green",
};

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

  return (
    <AppShell>
      <PageHeader 
        title="Fund Library" 
        subtitle={`${activeFunds.length} active funds available for portfolios.`} 
        action={
          <Button onClick={() => setShowCreate(true)} className="rounded-full px-5 bg-forest text-paper hover:bg-forest-700">
            <Plus className="h-4 w-4 mr-2" /> Add fund
          </Button>
        }
      />

      {showCreate && (
        <div className="bg-surface border border-green rounded-[28px] p-6 mb-8 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-[20px] font-semibold text-forest">Add New Fund</h3>
            <button onClick={() => setShowCreate(false)} className="h-8 w-8 rounded-full hover:bg-paper flex items-center justify-center transition-colors">
              <X className="h-5 w-5 text-ink-40" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[13px] font-medium text-ink-60 block">Fund name *</label>
              <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Vanguard S&P 500 ETF" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-60 block">Ticker</label>
              <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={draft.ticker} onChange={(e) => setDraft((d) => ({ ...d, ticker: e.target.value }))} placeholder="VOO" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-60 block">ISIN</label>
              <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={draft.isin} onChange={(e) => setDraft((d) => ({ ...d, isin: e.target.value }))} placeholder="US9229083632" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-60 block">Asset class *</label>
              <select className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize" value={draft.assetClass} onChange={(e) => setDraft((d) => ({ ...d, assetClass: e.target.value }))}>
                {ASSET_CLASSES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-60 block">Currency</label>
              <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))} placeholder="USD" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-60 block">Geography</label>
              <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={draft.geography} onChange={(e) => setDraft((d) => ({ ...d, geography: e.target.value }))} placeholder="US, Global, EM Asia…" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-60 block">Fund manager</label>
              <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={draft.fundManager} onChange={(e) => setDraft((d) => ({ ...d, fundManager: e.target.value }))} placeholder="Vanguard, BlackRock…" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-60 block">Fund type</label>
              <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={draft.fundType} onChange={(e) => setDraft((d) => ({ ...d, fundType: e.target.value }))} placeholder="ETF, Unit Trust, OEIC…" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-60 block">Expense ratio %</label>
              <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" type="number" step="0.01" value={draft.expenseRatio} onChange={(e) => setDraft((d) => ({ ...d, expenseRatio: e.target.value }))} placeholder="0.03" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-ink-60 block">Price API symbol</label>
              <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={draft.priceApiSymbol} onChange={(e) => setDraft((d) => ({ ...d, priceApiSymbol: e.target.value }))} placeholder="VOO" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-[13px] font-medium text-ink-60 block">Factsheet URL</label>
              <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={draft.factsheetUrl} onChange={(e) => setDraft((d) => ({ ...d, factsheetUrl: e.target.value }))} placeholder="https://…" />
            </div>
          </div>
          <div className="flex gap-3 mt-8">
            <Button variant="outline" className="flex-1 rounded-full h-11 border-hairline text-forest hover:bg-paper" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="flex-1 rounded-full h-11 bg-green text-surface hover:bg-green-300" disabled={createMut.isPending || !draft.name}
              onClick={() => createMut.mutate({ ...draft, expenseRatio: draft.expenseRatio || undefined, ticker: draft.ticker || undefined })}>
              {createMut.isPending ? "Creating…" : "Create fund"}
            </Button>
          </div>
        </div>
      )}

      {priceForm && (
        <div className="bg-sun-tint border border-[#FBE5C5] rounded-[26px] p-6 mb-8 shadow-2xl">
          <h3 className="font-display text-[20px] font-semibold text-amber-ink mb-5">Manual Price Entry</h3>
          <div className="text-[14px] text-amber-ink mb-4 font-medium">{funds.find(f => f.id === priceForm.fundId)?.name}</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-amber-ink/80 block">Price date</label>
              <Input className="h-11 rounded-[12px] border-[#FBE5C5] bg-surface px-4 text-forest" type="date" value={priceForm.date} onChange={(e) => setPriceForm(p => p ? { ...p, date: e.target.value } : null)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-amber-ink/80 block">Price (USD)</label>
              <Input className="h-11 rounded-[12px] border-[#FBE5C5] bg-surface px-4 text-forest" type="number" step="0.01" value={priceForm.price} onChange={(e) => setPriceForm(p => p ? { ...p, price: e.target.value } : null)} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" className="flex-1 rounded-full h-11 border-[#FBE5C5] text-amber-ink hover:bg-surface/50" onClick={() => setPriceForm(null)}>Cancel</Button>
            <Button className="flex-1 rounded-full h-11 bg-amber-ink text-surface hover:bg-sun-deep" disabled={priceMut.isPending} onClick={() =>
              priceMut.mutate({ fundId: priceForm.fundId, priceDate: priceForm.date, priceNative: priceForm.price, priceUsd: priceForm.price, source: "manual" })
            }>
              {priceMut.isPending ? "Saving…" : "Save price"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-surface rounded-[26px] animate-pulse shadow-[0_2px_14px_rgba(20,52,42,0.06)]" />)}</div>
      ) : funds.length === 0 ? (
        <div className="bg-surface rounded-[26px] p-16 text-center shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <Building className="h-14 w-14 text-ink-20 mx-auto mb-4" />
          <h3 className="font-display text-[20px] font-semibold text-forest mb-2">No funds in library</h3>
          <p className="text-[14px] text-ink-40">Add your first fund to start building portfolios.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-[26px] overflow-hidden shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Fund</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden md:table-cell">Class</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden md:table-cell">Manager</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Status</th>
                <th className="px-5 py-4 border-b border-hairline" />
              </tr>
            </thead>
            <tbody>
              {funds.map((fund) => (
                <tr key={fund.id} className="border-b border-hairline last:border-0 hover:bg-paper transition-colors group">
                  <td className="px-5 py-3">
                    <div className="font-medium text-[15px] text-forest">{fund.name}</div>
                    <div className="text-[12px] text-ink-40 mt-0.5 tracking-wide uppercase">{[fund.ticker, fund.isin].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <span className={cn("text-[12px] font-medium px-2.5 py-1 rounded-[8px] capitalize tracking-wide", ASSET_CLASS_COLORS[fund.assetClass] ?? "bg-surface border border-hairline text-ink-60")}>
                      {fund.assetClass.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-60 text-[14px] hidden md:table-cell">{fund.fundManager ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[12px] px-2.5 py-1 rounded-[8px] font-medium tracking-wide uppercase ${fund.isActive ? "bg-green-tint text-green" : "bg-surface border border-hairline text-ink-40"}`}>
                      {fund.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {editId !== fund.id && (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 text-[13px] rounded-[10px] text-green hover:text-forest" onClick={() =>
                            setPriceForm({ fundId: fund.id, date: new Date().toISOString().split("T")[0], price: "" })
                          }>
                            Price
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 rounded-full p-0 text-ink-40 hover:text-green hover:bg-green-tint" onClick={() => {
                            setEditId(fund.id);
                            setEditDraft({ isActive: fund.isActive });
                          }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {editId === fund.id && (
                        <div className="flex gap-2 items-center bg-paper p-1 rounded-full border border-hairline">
                          <Button size="sm" className={cn("h-7 text-[12px] px-3 rounded-full", fund.isActive ? "bg-clay text-surface hover:bg-clay-ink" : "bg-green text-surface hover:bg-green-300")} onClick={() => updateMut.mutate({ id: fund.id, data: { isActive: !fund.isActive } })}>
                            {fund.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 rounded-full p-0 text-ink-40 hover:text-forest" onClick={() => setEditId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

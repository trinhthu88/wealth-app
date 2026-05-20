import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Asset { id: string; name: string; category: string; valueUsd: string; currencyOriginal: string; }
interface Liability { id: string; name: string; category: string; balanceUsd: string; interestRatePercent: string | null; }

const ASSET_CATS = ["cash", "stocks", "bonds", "real_estate", "crypto", "business", "other"];
const LIABILITY_CATS = ["mortgage", "car_loan", "student_loan", "credit_card", "personal_loan", "other"];

export default function NetWorthPage() {
  const [assetOpen, setAssetOpen] = useState(false);
  const [liabOpen, setLiabOpen] = useState(false);
  const [aForm, setAForm] = useState({ name: "", category: "cash", valueUsd: "", currencyOriginal: "USD" });
  const [lForm, setLForm] = useState({ name: "", category: "mortgage", balanceUsd: "", interestRatePercent: "" });

  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ["assets"], queryFn: () => apiFetch<Asset[]>("/assets") });
  const { data: liabilities = [] } = useQuery<Liability[]>({ queryKey: ["liabilities"], queryFn: () => apiFetch<Liability[]>("/liabilities") });

  const addAsset = useMutation({
    mutationFn: (d: typeof aForm) => apiFetch("/assets", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["assets"] }); setAssetOpen(false); toast.success("Asset added"); },
  });
  const delAsset = useMutation({ mutationFn: (id: string) => apiFetch(`/assets/${id}`, { method: "DELETE" }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assets"] }) });
  const addLiab = useMutation({
    mutationFn: (d: typeof lForm) => apiFetch("/liabilities", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["liabilities"] }); setLiabOpen(false); toast.success("Liability added"); },
  });
  const delLiab = useMutation({ mutationFn: (id: string) => apiFetch(`/liabilities/${id}`, { method: "DELETE" }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["liabilities"] }) });

  const totalAssets = assets.reduce((s, a) => s + parseFloat(a.valueUsd), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + parseFloat(l.balanceUsd), 0);
  const netWorth = totalAssets - totalLiabilities;

  const chartData = [
    { name: "Assets", value: totalAssets, fill: "#1D9E75" },
    { name: "Liabilities", value: totalLiabilities, fill: "#ef4444" },
    { name: "Net Worth", value: netWorth, fill: netWorth >= 0 ? "#042C53" : "#f59e0b" },
  ];

  const af = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAForm(p => ({ ...p, [k]: e.target.value }));
  const lf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setLForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <AppShell>
      <PageHeader title="Net Worth Tracker" subtitle="Your complete financial picture — assets minus liabilities." />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-primary/30 rounded-xl p-4 text-center">
          <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="text-xl font-bold text-primary">${totalAssets.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Total Assets</div>
        </div>
        <div className="bg-card border border-red-200 rounded-xl p-4 text-center">
          <TrendingDown className="h-5 w-5 text-red-500 mx-auto mb-1" />
          <div className="text-xl font-bold text-red-500">${totalLiabilities.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Total Liabilities</div>
        </div>
        <div className={`bg-card border rounded-xl p-4 text-center ${netWorth >= 0 ? "border-primary/30" : "border-amber-300"}`}>
          <div className={`text-2xl font-extrabold ${netWorth >= 0 ? "text-primary" : "text-amber-600"}`}>${netWorth.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Net Worth</div>
        </div>
      </div>

      {(assets.length > 0 || liabilities.length > 0) && (
        <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
          <div role="img" aria-label={`Net worth breakdown: assets $${totalAssets.toLocaleString()}, liabilities $${totalLiabilities.toLocaleString()}, net worth $${netWorth.toLocaleString()}`}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <Tabs defaultValue="assets">
        <TabsList className="mb-4">
          <TabsTrigger value="assets">Assets ({assets.length})</TabsTrigger>
          <TabsTrigger value="liabilities">Liabilities ({liabilities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <div className="flex justify-end mb-3">
            <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Asset</Button></DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div><Label>Name</Label><Input placeholder="Savings Account" value={aForm.name} onChange={af("name")} /></div>
                  <div><Label>Category</Label>
                    <select value={aForm.category} onChange={af("category")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                      {ASSET_CATS.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Value (USD)</Label><Input type="number" placeholder="5000" value={aForm.valueUsd} onChange={af("valueUsd")} /></div>
                    <div><Label>Currency</Label>
                      <select value={aForm.currencyOriginal} onChange={af("currencyOriginal")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                        {["USD", "SGD", "MYR", "THB"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => addAsset.mutate(aForm)} disabled={!aForm.name || !aForm.valueUsd || addAsset.isPending}>Add Asset</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {assets.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No assets yet. Add your first asset.</p> : (
            <div className="space-y-2">
              {assets.map(a => (
                <div key={a.id} className="bg-card border border-card-border rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.category.replace(/_/g, " ")}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-primary">${parseFloat(a.valueUsd).toLocaleString()}</span>
                    <button onClick={() => delAsset.mutate(a.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="liabilities">
          <div className="flex justify-end mb-3">
            <Dialog open={liabOpen} onOpenChange={setLiabOpen}>
              <DialogTrigger asChild><Button size="sm" variant="destructive"><Plus className="h-4 w-4 mr-2" />Add Liability</Button></DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Add Liability</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div><Label>Name</Label><Input placeholder="Home Mortgage" value={lForm.name} onChange={lf("name")} /></div>
                  <div><Label>Category</Label>
                    <select value={lForm.category} onChange={lf("category")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                      {LIABILITY_CATS.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Balance (USD)</Label><Input type="number" placeholder="120000" value={lForm.balanceUsd} onChange={lf("balanceUsd")} /></div>
                    <div><Label>Interest Rate %</Label><Input type="number" placeholder="3.5" value={lForm.interestRatePercent} onChange={lf("interestRatePercent")} /></div>
                  </div>
                  <Button className="w-full" onClick={() => addLiab.mutate(lForm)} disabled={!lForm.name || !lForm.balanceUsd || addLiab.isPending}>Add Liability</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {liabilities.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No liabilities added yet.</p> : (
            <div className="space-y-2">
              {liabilities.map(l => (
                <div key={l.id} className="bg-card border border-card-border rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.category.replace(/_/g, " ")}{l.interestRatePercent ? ` · ${l.interestRatePercent}% interest` : ""}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-red-500">${parseFloat(l.balanceUsd).toLocaleString()}</span>
                    <button onClick={() => delLiab.mutate(l.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { DollarSign } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AssetClassBenchmark {
  id: string;
  assetClass: string;
  label: string;
  tenYearCagrPct: string;
  source: string | null;
  updatedAt: string;
}

interface AdvisedStrategyReturn {
  id: string;
  planType: string;
  label: string;
  targetAnnualReturnPct: string;
  updatedAt: string;
}

function EditableCagrRow<T extends { id: string; label: string; updatedAt: string }>({
  row, keyLabel, keyValue, valueField, valueLabel, onSave,
}: {
  row: T;
  keyLabel: string;
  keyValue: string;
  valueField: keyof T;
  valueLabel: string;
  onSave: (id: string, label: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(row.label);
  const [value, setValue] = useState(String(row[valueField]));

  return (
    <>
      <tr className={cn("border-b border-border last:border-0 transition-colors", editing ? "bg-primary/5" : "hover:bg-muted/30")}>
        <td className="px-4 py-3">
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">{keyValue}</span>
          <span className="ml-2 text-xs text-muted-foreground">{keyLabel}</span>
        </td>
        <td className="px-4 py-3">{row.label}</td>
        <td className="px-4 py-3 text-right font-semibold">{String(row[valueField])}%</td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(row.updatedAt).toLocaleDateString()}</td>
        <td className="px-4 py-3">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(v => !v)}>
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            {editing ? "Cancel" : "Edit"}
          </Button>
        </td>
      </tr>
      {editing && (
        <tr className="border-b border-border bg-primary/5">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs font-medium block mb-1">Label</label>
                <Input className="w-56 h-8 text-sm" value={label} onChange={e => setLabel(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">{valueLabel} (%)</label>
                <Input className="w-24 h-8 text-sm" type="number" step="0.1" value={value} onChange={e => setValue(e.target.value)} />
              </div>
              <Button size="sm" className="h-8" disabled={!label || !value} onClick={() => { onSave(row.id, label, value); setEditing(false); }}>
                Save
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminBenchmarks() {
  const { data: benchmarks = [], isLoading: benchmarksLoading } = useQuery<AssetClassBenchmark[]>({
    queryKey: ["admin-asset-class-benchmarks"],
    queryFn: () => apiFetch("/admin/asset-class-benchmarks"),
  });

  const { data: strategyReturns = [], isLoading: strategiesLoading } = useQuery<AdvisedStrategyReturn[]>({
    queryKey: ["admin-advised-strategy-returns"],
    queryFn: () => apiFetch("/admin/advised-strategy-returns"),
  });

  const updateBenchmark = useMutation({
    mutationFn: ({ id, label, tenYearCagrPct }: { id: string; label: string; tenYearCagrPct: string }) =>
      apiFetch(`/admin/asset-class-benchmarks/${id}`, { method: "PUT", body: JSON.stringify({ label, tenYearCagrPct }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-asset-class-benchmarks"] }); toast.success("Benchmark updated"); },
    onError: () => toast.error("Failed to update benchmark"),
  });

  const updateStrategy = useMutation({
    mutationFn: ({ id, label, targetAnnualReturnPct }: { id: string; label: string; targetAnnualReturnPct: string }) =>
      apiFetch(`/admin/advised-strategy-returns/${id}`, { method: "PUT", body: JSON.stringify({ label, targetAnnualReturnPct }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-advised-strategy-returns"] }); toast.success("Target return updated"); },
    onError: () => toast.error("Failed to update target return"),
  });

  return (
    <AppShell>
      <PageHeader
        title="Expected-Return Benchmarks"
        subtitle="Asset-class benchmarks for self-tracked holdings, and advised target strategy returns for the 'bring under management' comparison"
      />

      <div className="space-y-8 mt-2">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Asset class benchmarks (10yr CAGR)</h2>
          {benchmarksLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Asset class</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Label</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">10yr CAGR</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.map(row => (
                    <EditableCagrRow
                      key={row.id}
                      row={row}
                      keyLabel="asset class"
                      keyValue={row.assetClass}
                      valueField="tenYearCagrPct"
                      valueLabel="10yr CAGR"
                      onSave={(id, label, tenYearCagrPct) => updateBenchmark.mutate({ id, label, tenYearCagrPct })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Advised target strategy returns</h2>
          {strategiesLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Label</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Target return</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {strategyReturns.map(row => (
                    <EditableCagrRow
                      key={row.id}
                      row={row}
                      keyLabel="plan type"
                      keyValue={row.planType}
                      valueField="targetAnnualReturnPct"
                      valueLabel="Target return"
                      onSave={(id, label, targetAnnualReturnPct) => updateStrategy.mutate({ id, label, targetAnnualReturnPct })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

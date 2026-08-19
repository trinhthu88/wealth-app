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
      <tr className={cn("border-b border-hairline last:border-0 transition-colors", editing ? "bg-paper" : "hover:bg-paper")}>
        <td className="px-5 py-4">
          <span className="text-[12px] bg-sun-tint text-amber-ink px-2 py-1 rounded-[8px] font-medium tracking-wide uppercase">{keyValue.replace(/_/g, ' ')}</span>
          <span className="ml-3 text-[13px] text-ink-40">{keyLabel}</span>
        </td>
        <td className="px-5 py-4 text-[15px] font-medium text-forest">{row.label}</td>
        <td className="px-5 py-4 text-right font-semibold text-[16px] text-forest tabular-nums">{String(row[valueField])}%</td>
        <td className="px-5 py-4 text-[13px] text-ink-40 tabular-nums">{new Date(row.updatedAt).toLocaleDateString()}</td>
        <td className="px-5 py-4 text-right">
          <Button size="sm" variant="ghost" className="h-8 text-[13px] text-green hover:text-forest" onClick={() => setEditing(v => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        </td>
      </tr>
      {editing && (
        <tr className="border-b border-hairline bg-paper">
          <td colSpan={5} className="px-5 py-4">
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="text-[12px] font-medium text-ink-60 block mb-1.5">Label</label>
                <Input className="w-64 h-10 rounded-[10px] border-hairline bg-surface px-3 focus-visible:ring-green" value={label} onChange={e => setLabel(e.target.value)} />
              </div>
              <div>
                <label className="text-[12px] font-medium text-ink-60 block mb-1.5">{valueLabel} (%)</label>
                <Input className="w-28 h-10 rounded-[10px] border-hairline bg-surface px-3 focus-visible:ring-green" type="number" step="0.1" value={value} onChange={e => setValue(e.target.value)} />
              </div>
              <Button size="sm" className="h-10 px-5 rounded-[10px] bg-green text-surface hover:bg-green-300" disabled={!label || !value} onClick={() => { onSave(row.id, label, value); setEditing(false); }}>
                Save Changes
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
        title="Expected Returns"
        subtitle="Asset-class benchmarks for self-tracked holdings, and advised target strategy returns for the 'bring under management' comparison"
      />

      <div className="space-y-10 mt-2">
        <div>
          <h2 className="tala-eyebrow text-ink-40 mb-4">Asset class benchmarks (10yr CAGR)</h2>
          {benchmarksLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-surface rounded-[26px] animate-pulse" />)}</div>
          ) : (
            <div className="bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Asset class</th>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Label</th>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline text-right">10yr CAGR</th>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Updated</th>
                    <th className="px-5 py-4 border-b border-hairline" />
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
          <h2 className="tala-eyebrow text-ink-40 mb-4">Advised target strategy returns</h2>
          {strategiesLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-surface rounded-[26px] animate-pulse" />)}</div>
          ) : (
            <div className="bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Plan type</th>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Label</th>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline text-right">Target return</th>
                    <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Updated</th>
                    <th className="px-5 py-4 border-b border-hairline" />
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

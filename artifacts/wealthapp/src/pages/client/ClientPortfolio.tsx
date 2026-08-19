import { useState } from "react";
import ClientAppShell from "@/components/client/AppShell";
import AddHoldingSheet from "@/components/client/portfolio/self/AddHoldingSheet";
import EditHoldingSheet from "@/components/client/portfolio/self/EditHoldingSheet";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
import { usePortfolioTotals } from "@/hooks/usePortfolioTotals";
import { useClientHoldings } from "@/hooks/useClientHoldings";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import type { ClientHolding } from "@/hooks/useClientHoldings";
import { Pencil, Plus } from "lucide-react";

const ALLOCATION_COLORS = [
  "var(--green)",
  "var(--green-300)",
  "var(--forest)",
  "var(--sun)",
  "var(--sand)",
];

export default function ClientPortfolio() {
  const { holdings, addHolding, updateHolding, deleteHolding } = useClientHoldings();
  const { profile, update } = useProfile();
  const totals = usePortfolioTotals();

  const [activeTab, setActiveTab] = useState<"managed" | "other">("managed");
  const [addOpen, setAddOpen] = useState(false);
  const [editHolding, setEditHolding] = useState<ClientHolding | null>(null);

  async function handleAdd(data: Record<string, unknown>) {
    await addHolding(data as any);
    toast.success("Investment added");
  }
  async function handleUpdate(id: string, data: Record<string, unknown>) {
    await updateHolding(id, data as any);
    toast.success("Investment updated");
  }
  async function handleDelete(id: string) {
    await deleteHolding(id);
    toast.success("Holding removed.");
  }

  const totalValue = totals.totalPortfolioValue;
  const displayCurrency = profile?.preferredCurrency ?? "USD";
  const visibleHoldings = totals.allHoldings.filter((holding) =>
    activeTab === "managed" ? holding.isAdvisedPlan : !holding.isAdvisedPlan
  );
  const toggleCurrency = () => {
    update.mutate({ preferredCurrency: displayCurrency === "USD" ? "VND" : "USD" });
  };
  const circumference = 2 * Math.PI * 48;
  const allocation = totals.allHoldings
    .filter((holding) => holding.currentValue > 0)
    .sort((a, b) => b.currentValue - a.currentValue)
    .map((holding, index) => ({
      ...holding,
      color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
      percentage: totalValue > 0 ? (holding.currentValue / totalValue) * 100 : 0,
    }));
  let allocationOffset = 0;

  return (
    <ClientAppShell>
      <div className="space-y-[14px]">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em] mb-1">Portfolio</h1>
            <div className="text-[14px] text-ink-40">Advised and self-tracked investments</div>
          </div>
          <button
            type="button"
            onClick={toggleCurrency}
            className="min-h-11 rounded-full border border-hairline bg-surface px-4 font-mono text-[11px] font-semibold text-forest transition-colors hover:border-green hover:text-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            aria-label={`Display portfolio in ${displayCurrency === "USD" ? "VND" : "USD"}`}
          >
            {displayCurrency}
          </button>
        </div>

        {/* Allocation card */}
        <div className="bg-surface rounded-[28px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)] flex items-center gap-5">
          <svg viewBox="0 0 120 120" className="w-[132px] h-[132px] flex-none -rotate-90" aria-label="Portfolio allocation">
            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--track)" strokeWidth="18" />
            {allocation.map((holding) => {
              const offset = allocationOffset;
              allocationOffset += holding.percentage;
              return (
                <circle
                  key={holding.id}
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke={holding.color}
                  strokeWidth="18"
                  strokeDasharray={`${(holding.percentage / 100) * circumference} ${circumference}`}
                  strokeDashoffset={-((offset / 100) * circumference)}
                />
              );
            })}
          </svg>
          <div className="flex flex-col gap-[9px]">
            <div className="font-display text-[26px] font-semibold text-forest tracking-[-0.02em] tabular-nums">
              <CurrencyDisplay amountUsd={totalValue} />
            </div>
            {allocation.slice(0, 5).map((holding) => (
              <div key={holding.id} className="flex items-center gap-2 text-[13.5px] text-ink-60">
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: holding.color }} />
                <span className="min-w-0 truncate">{holding.label}</span>
                <span className="ml-auto tabular-nums">{Math.round(holding.percentage)}%</span>
              </div>
            ))}
            {allocation.length === 0 && (
              <div className="text-[13.5px] text-ink-40">Add an investment to see allocation.</div>
            )}
          </div>
        </div>

        <div className="my-[14px] flex gap-1 rounded-full border border-hairline bg-surface p-1" role="tablist" aria-label="Portfolio holdings">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "managed"}
            onClick={() => setActiveTab("managed")}
            className={`min-h-11 flex-1 rounded-full px-4 text-[13px] font-semibold transition-colors ${activeTab === "managed" ? "bg-forest text-paper" : "text-ink-40 hover:text-forest"}`}
          >
            Managed by your advisor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "other"}
            onClick={() => setActiveTab("other")}
            className={`min-h-11 flex-1 rounded-full px-4 text-[13px] font-semibold transition-colors ${activeTab === "other" ? "bg-forest text-paper" : "text-ink-40 hover:text-forest"}`}
          >
            Your other holdings
          </button>
        </div>

        {/* Holdings list */}
        <div className="bg-surface rounded-[26px] p-[6px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
            {visibleHoldings.length === 0 ? (
              <div className="p-8 text-center text-[15px] text-ink-40">
                {activeTab === "managed" ? "No advisor-managed investments yet." : "No self-tracked holdings yet."}
              </div>
            ) : (
              visibleHoldings.map((h, i) => {
                const rowContent = (
                  <>
                  <div>
                    <div className="text-[15px] font-semibold text-forest">{h.label}</div>
                    <div className="text-[13px] text-ink-30">{h.isAdvisedPlan ? "Advised Plan" : "Self-tracked"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-semibold text-forest tabular-nums">
                      <CurrencyDisplay amountUsd={h.currentValue} />
                    </div>
                    <div className={`text-[13px] font-semibold ${h.gainLossPct >= 0 ? "text-green" : "text-clay"}`}>
                      {h.gainLossPct >= 0 ? "+" : ""}{h.gainLossPct.toFixed(1)}%
                    </div>
                  </div>
                  </>
                );
                const rowClass = `w-full flex justify-between items-center gap-4 py-[15px] text-left ${
                  i < visibleHoldings.length - 1 ? "border-b border-hairline" : ""
                }`;

                return h.isAdvisedPlan ? (
                  <div key={h.id} className={rowClass}>{rowContent}</div>
                ) : (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setEditHolding(h.raw as ClientHolding)}
                    className={`${rowClass} rounded-xl transition-colors hover:bg-paper/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2`}
                    aria-label={`Edit ${h.label}`}
                  >
                    {rowContent}
                    <Pencil className="h-4 w-4 shrink-0 text-ink-30" aria-hidden="true" />
                  </button>
                );
              })
            )}
            {activeTab === "other" && (
              <div className="flex justify-center border-t border-hairline py-4">
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-4 text-[13px] font-semibold text-paper transition-colors hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add self-tracked holding
                </button>
              </div>
            )}
        </div>

      </div>

      <AddHoldingSheet isOpen={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <EditHoldingSheet
        isOpen={!!editHolding}
        onClose={() => setEditHolding(null)}
        holding={editHolding}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </ClientAppShell>
  );
}
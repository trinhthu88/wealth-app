import { useState } from "react";
import { Pencil, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import ClientAppShell from "@/components/client/AppShell";
import CurrencyToggle from "@/components/client/CurrencyToggle";
import CurrencyField from "@/components/shared/CurrencyField";
import AddHoldingSheet from "@/components/client/portfolio/self/AddHoldingSheet";
import EditHoldingSheet from "@/components/client/portfolio/self/EditHoldingSheet";
import HoldingTransactionsDrawer from "@/components/client/portfolio/self/HoldingTransactionsDrawer";
import AdvisedPlanSection from "@/components/client/portfolio/advised/AdvisedPlanSection";
import { useAdvisedPlans } from "@/hooks/useAdvisedPlans";
import { useClientHoldings, type ClientHolding } from "@/hooks/useClientHoldings";
import { cn } from "@/lib/utils";

type Tab = "advised" | "self";

const UNITS_BASED_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "bond", "commodity", "crypto"]);

const SELF_GROUPS: { key: string; label: string; types: string[] }[] = [
  { key: "stocks", label: "Stocks & ETFs", types: ["stock_etf", "etf", "mutual_fund", "bond", "commodity"] },
  { key: "crypto", label: "Crypto", types: ["crypto"] },
  { key: "property", label: "Property", types: ["property"] },
  { key: "cash", label: "Cash & Savings", types: ["cash"] },
  { key: "pension", label: "Pension", types: ["pension"] },
  { key: "other", label: "Other", types: ["other"] },
];

function n(v: string | null | undefined) { return parseFloat(v ?? "0") || 0; }

export default function ClientPortfolio() {
  const { plans, loading: plansLoading } = useAdvisedPlans();
  const { holdings, addHolding, updateHolding, deleteHolding, loading: holdingsLoading } = useClientHoldings();

  const [tab, setTab] = useState<Tab>("advised");
  const [addOpen, setAddOpen] = useState(false);
  const [editHolding, setEditHolding] = useState<ClientHolding | null>(null);
  const [txHolding, setTxHolding] = useState<ClientHolding | null>(null);

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
    toast.success("Holding removed");
  }

  const totalAdvisedValue = plans.reduce((s, p) => s + n(p.latestAccountValue), 0);
  const totalNetContribution = plans.reduce((s, p) => s + n(p.latestNetContribution), 0);
  const advisedGainLoss = totalAdvisedValue - totalNetContribution;
  const advisedGainLossPct = totalNetContribution > 0 ? (advisedGainLoss / totalNetContribution) * 100 : 0;
  const isAdvisedGain = advisedGainLoss >= 0;

  return (
    <ClientAppShell>
      <div className="space-y-[14px] pb-8">
        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em]">Portfolio</h1>
          <CurrencyToggle />
        </div>

        <div className="flex gap-1 rounded-full border border-hairline bg-surface p-1" role="tablist" aria-label="Portfolio holdings">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "advised"}
            onClick={() => setTab("advised")}
            className={cn(
              "min-h-11 flex-1 rounded-full px-4 text-[13px] font-semibold transition-colors",
              tab === "advised" ? "bg-forest text-paper" : "text-ink-40 hover:text-forest",
            )}
          >
            Advised Plans
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "self"}
            onClick={() => setTab("self")}
            className={cn(
              "min-h-11 flex-1 rounded-full px-4 text-[13px] font-semibold transition-colors",
              tab === "self" ? "bg-forest text-paper" : "text-ink-40 hover:text-forest",
            )}
          >
            Self-Managed
          </button>
        </div>

        {tab === "advised" ? (
          plansLoading ? (
            <div className="h-40 bg-surface animate-pulse rounded-[26px]" />
          ) : plans.length === 0 ? (
            <div className="bg-surface rounded-[26px] p-8 text-center text-[15px] text-ink-40 shadow-[0_2px_14px_rgba(20,52,42,.06)]">
              No advisor-managed investments yet.
            </div>
          ) : (
            <>
              <div className="bg-surface rounded-[26px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
                <p className="text-[13px] font-semibold text-ink-40 mb-1">Total portfolio value</p>
                <div className="font-display text-[32px] font-semibold text-forest tracking-[-0.02em] tabular-nums mb-1">
                  <CurrencyField amountUsd={totalAdvisedValue} />
                </div>
                <p className={cn("text-[13.5px] font-semibold", isAdvisedGain ? "text-green" : "text-clay")}>
                  {isAdvisedGain ? "+" : ""}<CurrencyField amountUsd={advisedGainLoss} showSign={false} compact /> ({isAdvisedGain ? "+" : ""}{advisedGainLossPct.toFixed(1)}%) vs. net contribution
                </p>
              </div>
              <AdvisedPlanSection plans={plans} />
            </>
          )
        ) : holdingsLoading ? (
          <div className="h-40 bg-surface animate-pulse rounded-[26px]" />
        ) : (
          <div className="space-y-4">
            {SELF_GROUPS.map(group => {
              const groupHoldings = holdings.filter(h => group.types.includes(h.holdingType));
              if (groupHoldings.length === 0) return null;
              return (
                <div key={group.key} className="bg-surface rounded-[26px] p-[6px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
                  <p className="text-[12px] font-semibold text-ink-40 uppercase tracking-wide pt-3 pb-1">{group.label}</p>
                  {groupHoldings.map((h, i) => (
                    <div
                      key={h.id}
                      className={cn(
                        "flex items-center justify-between gap-3 py-[14px]",
                        i < groupHoldings.length - 1 && "border-b border-hairline",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-forest truncate">{h.label}</p>
                        <p className="text-[13px] text-ink-40 tabular-nums">
                          Cost basis <CurrencyField amountUsd={h.costBasis} compact />
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[15px] font-semibold text-forest tabular-nums"><CurrencyField amountUsd={h.currentValue} compact /></p>
                        <p className={cn("text-[13px] font-semibold", h.gainLossPct >= 0 ? "text-green" : "text-clay")}>
                          {h.gainLossPct >= 0 ? "+" : ""}{h.gainLossPct.toFixed(1)}%
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditHolding(h)}
                          className="h-9 w-9 flex items-center justify-center rounded-full text-ink-30 hover:bg-hairline/50 hover:text-forest transition-colors"
                          aria-label={`Edit ${h.label}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTxHolding(h)}
                          className="h-9 w-9 flex items-center justify-center rounded-full text-ink-30 hover:bg-hairline/50 hover:text-forest transition-colors"
                          aria-label={`${h.label} transactions`}
                        >
                          <Clock className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {holdings.length === 0 && (
              <div className="bg-surface rounded-[26px] p-8 text-center text-[15px] text-ink-40 shadow-[0_2px_14px_rgba(20,52,42,.06)]">
                No self-tracked holdings yet.
              </div>
            )}

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-forest-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add holding
              </button>
            </div>
          </div>
        )}
      </div>

      <AddHoldingSheet isOpen={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <EditHoldingSheet
        isOpen={!!editHolding}
        onClose={() => setEditHolding(null)}
        holding={editHolding}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
      {txHolding && (
        <HoldingTransactionsDrawer
          isOpen={!!txHolding}
          onClose={() => setTxHolding(null)}
          holdingId={txHolding.id}
          holdingLabel={txHolding.label}
          isUnitsBased={UNITS_BASED_TYPES.has(txHolding.holdingType)}
        />
      )}
    </ClientAppShell>
  );
}

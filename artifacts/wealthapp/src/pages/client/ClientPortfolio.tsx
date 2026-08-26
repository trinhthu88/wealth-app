import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import ClientAppShell from "@/components/client/AppShell";
import CurrencyToggle from "@/components/client/CurrencyToggle";
import AddHoldingSheet from "@/components/client/portfolio/self/AddHoldingSheet";
import EditHoldingSheet from "@/components/client/portfolio/self/EditHoldingSheet";
import HoldingTransactionsDrawer from "@/components/client/portfolio/self/HoldingTransactionsDrawer";
import AdvisedPlanSection from "@/components/client/portfolio/advised/AdvisedPlanSection";
import PortfolioSummaryCard from "@/components/client/portfolio/PortfolioSummaryCard";
import HoldingRow from "@/components/client/portfolio/self/HoldingRow";
import { useAdvisedPlans } from "@/hooks/useAdvisedPlans";
import { useClientHoldings, type ClientHolding } from "@/hooks/useClientHoldings";
import { cn } from "@/lib/utils";

type Tab = "advised" | "self";
const UNITS_BASED_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "bond", "commodity", "crypto"]);

// Sunrise Colors for Donut Chart
const CHART_COLORS = [
  "var(--green)",
  "var(--green-300)",
  "var(--forest)",
  "var(--sun)",
  "var(--sand)",
  "var(--mint)",
];

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
  const totalSelfValue = holdings.reduce((s, h) => s + h.currentValue, 0);

  // Generate segments for Advised
  const advisedSegments = plans
    .filter(p => p.status === "inforce" && p.isVisibleToClient && n(p.latestAccountValue) > 0)
    .map((p, i) => ({
      label: p.nickname || p.productName,
      value: n(p.latestAccountValue),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  // Generate segments for Self-Managed
  const selfSegments = SELF_GROUPS
    .map((g, i) => {
      const groupHoldings = holdings.filter(h => g.types.includes(h.holdingType));
      const value = groupHoldings.reduce((s, h) => s + h.currentValue, 0);
      return { label: g.label, value, color: CHART_COLORS[i % CHART_COLORS.length], holdings: groupHoldings };
    })
    .filter(s => s.value > 0);

  return (
    <ClientAppShell>
      <div className="space-y-[14px] pb-8">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em] mb-[4px]">Portfolio</h1>
            <div className="text-[14px] text-ink-40">Balanced growth</div>
          </div>
          <CurrencyToggle />
        </div>

        <div className="flex gap-1 rounded-full border border-hairline bg-surface p-1 mb-2" role="tablist" aria-label="Portfolio mode">
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

        {tab === "advised" && !plansLoading && totalAdvisedValue > 0 && (
          <PortfolioSummaryCard totalValue={totalAdvisedValue} segments={advisedSegments} />
        )}

        {tab === "self" && !holdingsLoading && totalSelfValue > 0 && (
          <PortfolioSummaryCard totalValue={totalSelfValue} segments={selfSegments} />
        )}

        <div className="mb-[14px]">
          <span className="inline-flex rounded-full bg-forest px-[14px] py-[8px] text-[13px] font-semibold text-paper">
            Holdings
          </span>
        </div>

        {tab === "advised" ? (
          plansLoading ? (
            <div className="h-40 bg-surface animate-pulse rounded-[26px]" />
          ) : plans.length === 0 ? (
            <div className="bg-surface rounded-[26px] p-8 text-center text-[15px] text-ink-40 shadow-[0_2px_14px_rgba(20,52,42,.06)]">
              No advisor-managed investments yet.
            </div>
          ) : (
            <AdvisedPlanSection plans={plans} />
          )
        ) : holdingsLoading ? (
          <div className="h-40 bg-surface animate-pulse rounded-[26px]" />
        ) : (
          <div className="space-y-4">
            <div className="bg-surface rounded-[26px] p-[6px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
              {holdings.length === 0 ? (
                <div className="py-6 text-center text-[15px] text-ink-40">
                  No self-tracked holdings yet.
                </div>
              ) : (
                holdings.map((h, i) => (
                  <HoldingRow
                    key={h.id}
                    holding={h}
                    noBorder={i === holdings.length - 1}
                    onClick={() => setEditHolding(h)}
                    onViewTx={() => setTxHolding(h)}
                  />
                ))
              )}
            </div>

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

// Backing table (already applied to the DB via Drizzle — see
// lib/db/src/schema/clientHoldings.ts — with `type` in ('in','out','value_update','fee')
// and `source` in ('manual','budget_contribution','surplus_sweep') rather than the
// buy/sell/auto_contribution naming below, to match the rest of this app's ledger):
//
// CREATE TABLE IF NOT EXISTS client_holding_transactions (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   holding_id UUID REFERENCES client_holdings(id) ON DELETE CASCADE,
//   user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
//   transaction_date DATE NOT NULL,
//   type TEXT NOT NULL CHECK (type IN ('buy','sell','value_update','fee','auto_contribution')),
//   amount NUMERIC NOT NULL,
//   units NUMERIC,
//   balance_after NUMERIC,
//   note TEXT,
//   source TEXT DEFAULT 'manual' CHECK (source IN ('manual','auto')),
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
// ALTER TABLE client_holding_transactions ENABLE ROW LEVEL SECURITY;
// DROP POLICY IF EXISTS "holding_tx_owner" ON client_holding_transactions;
// CREATE POLICY "holding_tx_owner" ON client_holding_transactions FOR ALL TO authenticated USING (user_id = auth.uid());

import { useState } from "react";
import { useParams, Link } from "wouter";
import { ChevronLeft, Plus, Lock, Trash2 } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import CurrencyField from "@/components/shared/CurrencyField";
import HoldingTypeBadge from "@/components/client/HoldingTypeBadge";
import AddHoldingTransactionSheet from "@/components/client/portfolio/self/AddHoldingTransactionSheet";
import { getHoldingTypeConfig } from "@/lib/holdingTypeConfig";
import { useClientHoldings } from "@/hooks/useClientHoldings";
import { useHoldingTransactions, type HoldingTransactionType } from "@/hooks/useHoldingTransactions";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<HoldingTransactionType, string> = {
  in: "Buy",
  out: "Sell",
  value_update: "Value update",
  fee: "Fee",
};

function signFor(type: HoldingTransactionType) {
  if (type === "in") return 1;
  if (type === "out" || type === "fee") return -1;
  return 0;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

export default function HoldingDetail() {
  const { holdingId } = useParams<{ holdingId: string }>();
  const { holdings, loading: holdingsLoading } = useClientHoldings();
  const { transactions, loading: txLoading, deleteTransaction } = useHoldingTransactions(holdingId ?? null);
  const [addOpen, setAddOpen] = useState(false);

  const holding = holdings.find(h => h.id === holdingId);

  if (holdingsLoading) {
    return (
      <ClientAppShell>
        <div className="space-y-3">
          <div className="h-8 w-40 bg-surface animate-pulse rounded-lg" />
          <div className="h-32 bg-surface animate-pulse rounded-[26px]" />
        </div>
      </ClientAppShell>
    );
  }

  if (!holding) {
    return (
      <ClientAppShell>
        <div className="text-center py-16">
          <p className="text-[15px] text-ink-40 mb-4">This holding could not be found.</p>
          <Link href="/client/portfolio" className="text-[14px] font-semibold text-green">Back to Portfolio</Link>
        </div>
      </ClientAppShell>
    );
  }

  const isUnitsBased = getHoldingTypeConfig(holding.holdingType).priceSource === "api";
  const isGain = holding.gainLoss >= 0;

  async function handleDelete(txId: string) {
    if (!window.confirm("Delete this transaction? This cannot be undone.")) return;
    await deleteTransaction(txId);
  }

  return (
    <ClientAppShell>
      <div className="space-y-4 pb-8">
        <div>
          <Link
            href="/client/portfolio"
            className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-ink-40 hover:text-forest mb-3"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Portfolio
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-[26px] font-semibold text-forest tracking-[-0.02em]">
              {holding.label}
            </h1>
            <HoldingTypeBadge type={holding.holdingType} size="sm" />
          </div>
        </div>

        <div className="bg-surface rounded-[26px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)] space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] text-ink-40 mb-1">Current value</p>
              <p className="font-display text-[24px] font-semibold text-forest tabular-nums leading-none">
                <CurrencyField amountUsd={holding.currentValue} currency={holding.currency} compact />
              </p>
            </div>
            <div>
              <p className="text-[13px] text-ink-40 mb-1">Cost basis</p>
              <p className="font-display text-[24px] font-semibold text-forest tabular-nums leading-none">
                <CurrencyField amountUsd={holding.costBasis} currency={holding.currency} compact />
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-hairline">
            <p className="text-[13px] text-ink-40 mb-1">Gain / loss</p>
            <p className={cn("text-[16px] font-semibold tabular-nums", isGain ? "text-green" : "text-clay")}>
              {isGain ? "+" : ""}<CurrencyField amountUsd={holding.gainLoss} currency={holding.currency} compact /> ({isGain ? "+" : ""}{holding.gainLossPct.toFixed(1)}%)
            </p>
          </div>
        </div>

        <div className="bg-surface rounded-[26px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-semibold text-forest">Transaction history</p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-green hover:text-forest"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add transaction
            </button>
          </div>

          {txLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="h-12 bg-hairline/60 animate-pulse rounded-lg" />)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-[13.5px] text-ink-40 py-4 text-center">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => {
                const amt = parseFloat(tx.amount) || 0;
                const sign = signFor(tx.type);
                const isAuto = tx.source !== "manual";
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 px-3 border border-hairline rounded-[14px]">
                    <div className="min-w-0 flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13.5px] font-medium text-forest">{TYPE_LABEL[tx.type]}</p>
                          {isAuto && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-30 bg-hairline rounded-full px-1.5 py-0.5">
                              <Lock className="h-2.5 w-2.5" aria-hidden="true" /> Auto
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-ink-40 truncate">
                          {fmtDate(tx.transactionDate)}
                          {tx.description ? ` · ${tx.description}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={cn("text-[13.5px] font-semibold tabular-nums", sign > 0 ? "text-green" : sign < 0 ? "text-clay" : "text-forest")}>
                        {sign > 0 ? "+" : sign < 0 ? "-" : ""}
                        <CurrencyField amountUsd={amt} currency={holding.currency} compact />
                      </span>
                      {!isAuto && (
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-full text-ink-30 hover:bg-clay-tint hover:text-clay transition-colors"
                          aria-label="Delete transaction"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AddHoldingTransactionSheet
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        holdingId={holding.id}
        isUnitsBased={isUnitsBased}
      />
    </ClientAppShell>
  );
}

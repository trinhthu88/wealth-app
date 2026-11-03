import { Plus } from "lucide-react";
import { Link } from "wouter";
import { SyncedLiabilityRow, ManualLiabilityRow } from "./NetWorthItemRow";
import type { ManualLiability } from "@/hooks/useNetWorthItems";
import CurrencyField from "@/components/shared/CurrencyField";

interface Props {
  syncedLiabilities: ManualLiability[];
  manualLiabilities: ManualLiability[];
  totalLiabilities: number;
  onAddClick: () => void;
  onEditLiability: (item: ManualLiability) => void;
  onDeleteLiability: (id: string) => void;
}

export default function LiabilitySection({
  syncedLiabilities, manualLiabilities, totalLiabilities, onAddClick, onEditLiability, onDeleteLiability,
}: Props) {
  const isEmpty = syncedLiabilities.length === 0 && manualLiabilities.length === 0;
  const totalMonthlyPayment = [...syncedLiabilities, ...manualLiabilities].reduce(
    (s, l) => s + (l.monthlyPaymentUsd ?? 0), 0
  );

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-[16px] font-semibold text-forest">Liabilities</h2>
          {!isEmpty && (
            <span className="text-[15px] font-semibold tabular-nums text-ink-40">
              <CurrencyField amountUsd={totalLiabilities} compact />
            </span>
          )}
        </div>
        <button
          onClick={onAddClick}
          className="shrink-0 flex items-center gap-1.5 h-11 px-4 rounded-full border-[1.5px] border-forest bg-transparent text-forest text-[14px] font-semibold hover:bg-surface transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add liability
        </button>
      </div>

      {/* Synced (from a Property holding's outstanding mortgage) — read-only */}
      {syncedLiabilities.length > 0 && (
        <div className="bg-surface rounded-[24px] p-1">
          <p className="tala-eyebrow text-ink-40 px-3 pt-3 pb-1">
            Synced from a property holding — edit the balance there
          </p>
          <div>
            {syncedLiabilities.map(item => (
              <SyncedLiabilityRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Manual items */}
      {manualLiabilities.length > 0 && (
        <div className="bg-surface rounded-[24px] p-1">
          {manualLiabilities.map(item => (
            <ManualLiabilityRow
              key={item.id}
              item={item}
              onEdit={onEditLiability}
              onDelete={onDeleteLiability}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="bg-surface rounded-[24px] py-10 px-5 text-center">
          <p className="text-[14px] font-medium text-forest">No liabilities tracked</p>
          <p className="text-[13px] text-ink-40 mt-1">Add mortgages, loans, or credit card balances</p>
        </div>
      )}

      {/* Monthly payments footer */}
      {totalMonthlyPayment > 0 && (
        <div className="bg-surface rounded-[24px] p-5 flex items-center justify-between gap-3">
          <div>
            <p className="tala-eyebrow text-ink-40">Total monthly debt payments</p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums text-forest">
              <CurrencyField amountUsd={totalMonthlyPayment} compact />
              <span className="text-ink-40 font-normal text-[13px]">/mo</span>
            </p>
            <p className="text-[13px] text-ink-40 mt-1">Counted automatically as an expense in your budget.</p>
          </div>
          <Link
            href="/client/money"
            className="shrink-0 inline-flex items-center min-h-[44px] px-1 text-[14px] text-green font-semibold underline underline-offset-2 hover:text-forest-700"
          >
            See budget →
          </Link>
        </div>
      )}
    </div>
  );
}

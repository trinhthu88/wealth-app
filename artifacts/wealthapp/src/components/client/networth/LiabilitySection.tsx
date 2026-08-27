import { Plus } from "lucide-react";
import { Link } from "wouter";
import { ManualLiabilityRow } from "./NetWorthItemRow";
import type { ManualLiability } from "@/hooks/useNetWorthItems";
import CurrencyField from "@/components/shared/CurrencyField";

interface Props {
  manualLiabilities: ManualLiability[];
  totalLiabilities: number;
  onAddClick: () => void;
  onEditLiability: (item: ManualLiability) => void;
  onDeleteLiability: (id: string) => void;
}

export default function LiabilitySection({
  manualLiabilities, totalLiabilities, onAddClick, onEditLiability, onDeleteLiability,
}: Props) {
  const isEmpty = manualLiabilities.length === 0;
  const totalMonthlyPayment = manualLiabilities.reduce(
    (s, l) => s + (l.monthlyPaymentUsd ?? 0), 0
  );

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-semibold text-forest">Liabilities</h2>
          {!isEmpty && (
            <span className="text-sm font-semibold text-clay">
              <CurrencyField amountUsd={totalLiabilities} compact />
            </span>
          )}
        </div>
        <button
          onClick={onAddClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-clay/40 text-clay text-sm font-medium hover:bg-clay-tint transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add liability
        </button>
      </div>

      {/* Liability items */}
      {!isEmpty && (
        <div className="bg-surface border border-hairline rounded-[18px] overflow-hidden divide-y divide-hairline">
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
        <div className="border-2 border-dashed border-hairline rounded-[18px] py-10 text-center">
          <p className="text-sm font-medium text-ink-40">No liabilities tracked</p>
          <p className="text-xs text-ink-30 mt-1">Add mortgages, loans, or credit card balances</p>
        </div>
      )}

      {/* Monthly payments footer */}
      {totalMonthlyPayment > 0 && (
        <div className="bg-paper border border-hairline rounded-[18px] px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink-40">Total monthly debt payments</p>
            <p className="text-sm font-semibold text-forest">
              <CurrencyField amountUsd={totalMonthlyPayment} compact />
              <span className="text-ink-30 font-normal text-xs">/mo</span>
            </p>
          </div>
          <Link
            href="/client/budget"
            className="text-xs text-green font-medium hover:text-forest"
          >
            See budget →
          </Link>
        </div>
      )}
    </div>
  );
}

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
          <h2 className="text-base font-semibold text-[#042C53]">Liabilities</h2>
          {!isEmpty && (
            <span className="text-sm font-semibold text-red-500">
              <CurrencyField amountUsd={totalLiabilities} compact />
            </span>
          )}
        </div>
        <button
          onClick={onAddClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-300 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add liability
        </button>
      </div>

      {/* Liability items */}
      {!isEmpty && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden divide-y divide-slate-50">
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
        <div className="border-2 border-dashed border-slate-200 rounded-xl py-10 text-center">
          <p className="text-sm font-medium text-slate-400">No liabilities tracked</p>
          <p className="text-xs text-slate-300 mt-1">Add mortgages, loans, or credit card balances</p>
        </div>
      )}

      {/* Monthly payments footer */}
      {totalMonthlyPayment > 0 && (
        <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Total monthly debt payments</p>
            <p className="text-sm font-semibold text-[#042C53]">
              <CurrencyField amountUsd={totalMonthlyPayment} compact />
              <span className="text-slate-400 font-normal text-xs">/mo</span>
            </p>
          </div>
          <Link
            href="/client/budget"
            className="text-xs text-[#1D9E75] font-medium hover:text-[#0F6E56]"
          >
            See budget →
          </Link>
        </div>
      )}
    </div>
  );
}

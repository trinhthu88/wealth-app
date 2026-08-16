import { cn } from "@/lib/utils";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
import HoldingTypeBadge from "@/components/client/HoldingTypeBadge";
import type { AllHolding } from "@/hooks/usePortfolioTotals";

interface Props {
  holding: AllHolding;
  displayCurrency: string;
  onEdit?: () => void;
  onView?: () => void;
  compact?: boolean;
}

export default function HoldingRow({ holding, onEdit, onView, compact = false }: Props) {
  const isGain = holding.gainLoss >= 0;
  const gainColor = isGain ? "text-emerald-600" : "text-red-500";

  if (compact) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <HoldingTypeBadge type={holding.type} size="sm" />
            <span className="text-sm font-semibold text-[#042C53] truncate">{holding.label}</span>
          </div>
          <span className="text-sm font-bold text-[#042C53] shrink-0">
            <CurrencyDisplay amountUsd={holding.currentValue} compact />
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Cost: <CurrencyDisplay amountUsd={holding.costBasis} compact /></span>
          <span className={cn("font-medium", gainColor)}>
            {isGain ? "+" : ""}{holding.gainLossPct.toFixed(1)}%
          </span>
          {holding.cagr !== null && (
            <span className={cn("font-medium", holding.cagr >= 0 ? "text-emerald-600" : "text-red-500")}>
              {holding.cagr >= 0 ? "+" : ""}{holding.cagr.toFixed(1)}%/yr
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {onView && !holding.isAdvisedPlan && (
            <button onClick={onView} className="flex-1 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">View</button>
          )}
          {onEdit && holding.isAdvisedPlan && (
            <button onClick={onEdit} className="flex-1 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">Statements</button>
          )}
          {onEdit && !holding.isAdvisedPlan && (
            <button onClick={onEdit} className="flex-1 py-1 rounded-lg bg-[#1D9E75]/10 text-[#1D9E75] text-xs font-medium hover:bg-[#1D9E75]/20">Edit</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <HoldingTypeBadge type={holding.type} size="sm" />
          <span className="text-sm font-medium text-[#042C53]">{holding.label}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-slate-500">
        <CurrencyDisplay amountUsd={holding.costBasis} compact />
      </td>
      <td className="py-3 px-4 text-sm font-semibold text-[#042C53]">
        <CurrencyDisplay amountUsd={holding.currentValue} compact />
      </td>
      <td className={cn("py-3 px-4 text-sm font-medium", gainColor)}>
        <CurrencyDisplay amountUsd={holding.gainLoss} compact showSign />
      </td>
      <td className={cn("py-3 px-4 text-sm font-medium", gainColor)}>
        {isGain ? "+" : ""}{holding.gainLossPct.toFixed(1)}%
      </td>
      <td className="py-3 px-4 text-sm text-slate-500">
        {holding.cagr !== null ? (
          <span className={holding.cagr >= 0 ? "text-emerald-600" : "text-red-500"}>
            {holding.cagr >= 0 ? "+" : ""}{holding.cagr.toFixed(1)}%/yr
          </span>
        ) : (
          <div className="group relative inline-block">
            <span className="text-slate-300 cursor-help">--</span>
            <div className="absolute bottom-full left-0 mb-1 w-52 bg-[#042C53] text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-normal">
              Not enough history to calculate annualised return.
            </div>
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-1">
          {holding.isAdvisedPlan && onView && (
            <button onClick={onView} className="px-2 py-1 rounded text-xs font-medium text-[#1D9E75] border border-[#1D9E75]/30 hover:bg-[#1D9E75]/5">Statements</button>
          )}
          {!holding.isAdvisedPlan && onEdit && (
            <button onClick={onEdit} className="px-2 py-1 rounded text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50">Edit</button>
          )}
        </div>
      </td>
    </tr>
  );
}

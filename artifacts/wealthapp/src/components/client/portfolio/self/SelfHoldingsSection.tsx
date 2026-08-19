import { Plus } from "lucide-react";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
import HoldingTypeBadge from "@/components/client/HoldingTypeBadge";
import HoldingCard from "./HoldingCard";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  holdings: ClientHolding[];
  totalValue: number;
  advisorName?: string;
  onAdd: () => void;
  onEdit: (h: ClientHolding) => void;
}

export default function SelfHoldingsSection({ holdings, totalValue, advisorName, onAdd, onEdit }: Props) {
  const byType = holdings.reduce<Record<string, ClientHolding[]>>((acc, h) => {
    if (!acc[h.holdingType]) acc[h.holdingType] = [];
    acc[h.holdingType].push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-[#042C53]">Your other holdings</p>
          <p className="text-xs text-slate-400">Added by you · prices refresh automatically</p>
        </div>
        <div className="flex items-center gap-3">
          {totalValue > 0 && (
            <p className="text-sm font-semibold text-[#042C53]"><CurrencyDisplay amountUsd={totalValue} compact /></p>
          )}
          <button
            onClick={onAdd}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#1D9E75] text-[#1D9E75] text-xs font-semibold hover:bg-[#1D9E75]/5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add holding
          </button>
        </div>
      </div>

      {holdings.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm text-slate-400">No investments added yet.</p>
          <button onClick={onAdd} className="mt-2 text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">+ Add investment</button>
        </div>
      ) : (
        <>
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          These holdings are tracked for your reference and are not managed or reviewed by {advisorName ?? "your advisor"}.
        </p>
        {Object.entries(byType).map(([type, group]) => (
          <div key={type}>
            <div className="flex items-center justify-between mb-2">
              <HoldingTypeBadge type={type} size="sm" />
              <span className="text-xs text-slate-500">
                <CurrencyDisplay amountUsd={group.reduce((s, h) => s + h.currentValue, 0)} compact />
              </span>
            </div>
            <div className="space-y-2">
              {group.map(h => <HoldingCard key={h.id} holding={h} onEdit={() => onEdit(h)} />)}
            </div>
          </div>
        ))}
        </>
      )}
    </div>
  );
}

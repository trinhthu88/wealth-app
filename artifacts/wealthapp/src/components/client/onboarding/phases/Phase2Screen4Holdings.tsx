import { useState } from "react";
import { X, Plus, TrendingUp, Bitcoin, Home, Landmark, Shield, MoreHorizontal } from "lucide-react";
import HoldingMiniForm, { type NewHolding } from "../HoldingMiniForm";
import HoldingTypeBadge from "@/components/client/HoldingTypeBadge";
import { getHoldingTypeConfig } from "@/lib/holdingTypeConfig";
import { formatCurrency } from "@/lib/currencyUtils";

const HOLDING_TYPES = [
  { type: "stock_etf", icon: TrendingUp, label: "Stocks\n& ETFs" },
  { type: "crypto",   icon: Bitcoin,  label: "Crypto" },
  { type: "property", icon: Home, label: "Property" },
  { type: "cash",     icon: Landmark, label: "Cash &\nSavings" },
  { type: "pension",  icon: Shield,  label: "Pension" },
  { type: "other",    icon: MoreHorizontal, label: "Other" },
];

function getDisplayValue(h: NewHolding): number {
  if (h.holdingType === "property") return h.currentEstimatedValue ?? h.purchasePrice ?? 0;
  if (h.holdingType === "cash") return h.currentBalance ?? 0;
  if (h.holdingType === "pension") return h.currentBalancePension ?? 0;
  if (h.holdingType === "other") return h.currentValueOther ?? 0;
  // stock_etf / crypto: units × avg cost as estimate
  return (h.unitsHeld ?? 0) * (h.averageCostPrice ?? 0);
}

interface Props {
  isTrackA: boolean;
  addedHoldings: NewHolding[];
  preferredCurrency: string;
  onAdd: (holding: NewHolding) => Promise<void>;
  onRemove: (index: number) => void;
}

export default function Phase2Screen4Holdings({ isTrackA, addedHoldings, preferredCurrency, onAdd, onRemove }: Props) {
  const [openType, setOpenType] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#042C53] mb-1">Add your investments</h1>
        <p className="text-sm text-slate-500">
          {isTrackA
            ? "Add any investments outside your advised plan."
            : "Let's log what you have."}
        </p>
      </div>

      {/* Type picker */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Select type to add</p>
        <div className="grid grid-cols-3 gap-2.5">
          {HOLDING_TYPES.map(({ type, icon: Icon, label }) => {
            const cfg = getHoldingTypeConfig(type);
            const isOpen = openType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setOpenType(isOpen ? null : type)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                  isOpen
                    ? "border-[#1D9E75] bg-[#1D9E75]/5"
                    : "border-slate-200 hover:border-[#1D9E75]/30"
                }`}
              >
                <Icon className="w-6 h-6 text-slate-600 mb-1" />
                <span className="text-[11px] font-medium text-slate-600 leading-tight whitespace-pre-line">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Open form */}
      {openType && (
        <HoldingMiniForm
          holdingType={openType}
          defaultCurrency={preferredCurrency}
          onAdd={async (h) => { await onAdd(h); setOpenType(null); }}
          onCancel={() => setOpenType(null)}
        />
      )}

      {/* Added holdings list */}
      {addedHoldings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Added {addedHoldings.length} investment{addedHoldings.length > 1 ? "s" : ""}</p>
          {addedHoldings.map((h, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <HoldingTypeBadge type={h.holdingType} size="sm" />
              <span className="flex-1 text-sm font-medium text-[#042C53] truncate">{h.label}</span>
              <span className="text-sm font-semibold text-slate-600 shrink-0">
                {formatCurrency(getDisplayValue(h), h.currency, true)}
              </span>
              <button
                onClick={() => onRemove(i)}
                className="h-6 w-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-400 hover:bg-red-50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

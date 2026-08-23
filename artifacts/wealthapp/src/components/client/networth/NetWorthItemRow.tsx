import { useState } from "react";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import SyncedItemBadge from "./SyncedItemBadge";
import CurrencyField from "@/components/shared/CurrencyField";
import type { SyncedAsset, ManualAsset, ManualLiability } from "@/hooks/useNetWorthItems";

interface SyncedAssetRowProps {
  item: SyncedAsset;
}

interface ManualAssetRowProps {
  item: ManualAsset;
  onEdit: (item: ManualAsset) => void;
  onDelete: (id: string) => void;
}

interface ManualLiabilityRowProps {
  item: ManualLiability;
  onEdit: (item: ManualLiability) => void;
  onDelete: (id: string) => void;
}

function fmtDate(date: string | null) {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

const CATEGORY_DOTS: Record<string, string> = {
  investment:       "#042C53",
  property:         "#3B82F6",
  cash:             "#0EA5E9",
  savings:          "#0EA5E9",
  pension:          "#8B5CF6",
  business:         "#F59E0B",
  other_asset:      "#94A3B8",
  real_estate:      "#3B82F6",
  mortgage:         "#DC2626",
  personal_loan:    "#EF4444",
  credit_card:      "#F87171",
  business_debt:    "#B91C1C",
  other_liability:  "#FECACA",
  car_loan:         "#EF4444",
  student_loan:     "#F87171",
  other:            "#EF4444",
};

export function SyncedAssetRow({ item }: SyncedAssetRowProps) {
  const dot = CATEGORY_DOTS[item.category] ?? "#94A3B8";
  return (
    <div className="flex items-center justify-between py-3 px-3 sm:px-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: dot }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#042C53] truncate">{item.label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <SyncedItemBadge />
            {item.lastUpdated && (
              <span className="text-[11px] text-slate-400">Updated {fmtDate(item.lastUpdated)}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-sm font-semibold text-[#042C53]">
          <CurrencyField amountUsd={item.valueUsd} compact />
        </span>
        <Link
          href="/client/portfolio"
          className="text-[11px] text-[#1D9E75] font-medium flex items-center gap-0.5 hover:text-[#0F6E56]"
        >
          Portfolio <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export function ManualAssetRow({ item, onEdit, onDelete }: ManualAssetRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dot = CATEGORY_DOTS[item.category] ?? "#94A3B8";

  return (
    <div className="flex items-center justify-between py-3 px-3 sm:px-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: dot }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#042C53] truncate">{item.name}</p>
          <p className="text-[11px] text-slate-400 capitalize mt-0.5">
            {item.category.replace(/_/g, " ")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <span className="text-sm font-semibold text-[#042C53]">
          <CurrencyField amountUsd={item.valueUsd} compact />
        </span>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(item.id); setConfirmDelete(false); }}
              className="text-[11px] text-white bg-red-500 px-2 py-1 rounded-lg font-medium"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[11px] text-slate-400 px-2 py-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.name}`}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#1D9E75] hover:bg-slate-50 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete ${item.name}`}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function ManualLiabilityRow({ item, onEdit, onDelete }: ManualLiabilityRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dot = CATEGORY_DOTS[item.category] ?? "#EF4444";

  return (
    <div className="flex items-center justify-between py-3 px-3 sm:px-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: dot }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#042C53] truncate">{item.name}</p>
          <p className="text-[11px] text-slate-400 capitalize mt-0.5">
            {item.category.replace(/_/g, " ")}
            {item.interestRatePercent ? ` · ${item.interestRatePercent}% p.a.` : ""}
            {item.monthlyPaymentUsd ? ` · $${Math.round(item.monthlyPaymentUsd).toLocaleString()}/mo` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <span className="text-sm font-semibold text-red-500">
          <CurrencyField amountUsd={item.balanceUsd} compact />
        </span>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(item.id); setConfirmDelete(false); }}
              className="text-[11px] text-white bg-red-500 px-2 py-1 rounded-lg font-medium"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[11px] text-slate-400 px-2 py-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.name}`}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#1D9E75] hover:bg-slate-50 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete ${item.name}`}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

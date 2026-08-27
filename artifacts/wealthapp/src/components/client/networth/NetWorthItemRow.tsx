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
  investment:       "var(--green)",
  property:         "var(--forest)",
  cash:             "var(--mint)",
  savings:          "var(--mint)",
  pension:          "var(--violet)",
  business:         "var(--sun)",
  other_asset:      "var(--sand)",
  real_estate:      "var(--forest)",
  mortgage:         "var(--clay-ink)",
  personal_loan:    "var(--clay)",
  credit_card:      "#F2A98A",
  business_debt:    "var(--clay-ink)",
  other_liability:  "#F6C7B4",
  car_loan:         "var(--clay)",
  student_loan:     "#F2A98A",
  other:            "var(--clay)",
};

export function SyncedAssetRow({ item }: SyncedAssetRowProps) {
  const dot = CATEGORY_DOTS[item.category] ?? "var(--ink-20)";
  return (
    <div className="flex items-center justify-between py-3 px-3 sm:px-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: dot }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-forest truncate">{item.label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <SyncedItemBadge />
            {item.lastUpdated && (
              <span className="text-[11px] text-ink-30">Updated {fmtDate(item.lastUpdated)}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-sm font-semibold text-forest">
          <CurrencyField amountUsd={item.valueUsd} compact />
        </span>
        <Link
          href="/client/portfolio"
          className="text-[11px] text-green font-medium flex items-center gap-0.5 hover:text-forest"
        >
          Portfolio <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export function ManualAssetRow({ item, onEdit, onDelete }: ManualAssetRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dot = CATEGORY_DOTS[item.category] ?? "var(--ink-20)";

  return (
    <div className="flex items-center justify-between py-3 px-3 sm:px-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: dot }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-forest truncate">{item.name}</p>
          <p className="text-[11px] text-ink-30 capitalize mt-0.5">
            {item.category.replace(/_/g, " ")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <span className="text-sm font-semibold text-forest">
          <CurrencyField amountUsd={item.valueUsd} compact />
        </span>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(item.id); setConfirmDelete(false); }}
              className="text-[11px] text-white bg-clay px-2 py-1 rounded-lg font-medium"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[11px] text-ink-40 px-2 py-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.name}`}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-ink-30 hover:text-green hover:bg-hairline/50 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete ${item.name}`}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-ink-30 hover:text-clay hover:bg-hairline/50 transition-colors"
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
  const dot = CATEGORY_DOTS[item.category] ?? "var(--clay)";

  return (
    <div className="flex items-center justify-between py-3 px-3 sm:px-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: dot }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-forest truncate">{item.name}</p>
          <p className="text-[11px] text-ink-30 capitalize mt-0.5">
            {item.category.replace(/_/g, " ")}
            {item.interestRatePercent ? ` · ${item.interestRatePercent}% p.a.` : ""}
            {item.monthlyPaymentUsd ? ` · $${Math.round(item.monthlyPaymentUsd).toLocaleString()}/mo` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <span className="text-sm font-semibold text-clay">
          <CurrencyField amountUsd={item.balanceUsd} compact />
        </span>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(item.id); setConfirmDelete(false); }}
              className="text-[11px] text-white bg-clay px-2 py-1 rounded-lg font-medium"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[11px] text-ink-40 px-2 py-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.name}`}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-ink-30 hover:text-green hover:bg-hairline/50 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete ${item.name}`}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-ink-30 hover:text-clay hover:bg-hairline/50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

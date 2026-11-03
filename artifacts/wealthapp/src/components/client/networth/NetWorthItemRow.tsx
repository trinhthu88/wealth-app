import { useState } from "react";
import {
  Pencil, Trash2, ExternalLink, TrendingUp, Home, Landmark, Shield, Briefcase,
  MoreHorizontal, Wallet, CreditCard, Car, GraduationCap, type LucideIcon,
} from "lucide-react";
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

interface SyncedLiabilityRowProps {
  item: ManualLiability;
}

function fmtDate(date: string | null) {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

type TileStyle = { icon: LucideIcon; className: string };

const CATEGORY_TILES: Record<string, TileStyle> = {
  investment:       { icon: TrendingUp,     className: "bg-forest text-paper" },
  property:         { icon: Home,           className: "bg-field text-forest" },
  real_estate:      { icon: Home,           className: "bg-field text-forest" },
  cash:             { icon: Landmark,       className: "bg-breeze text-forest" },
  savings:          { icon: Landmark,       className: "bg-breeze text-forest" },
  pension:          { icon: Shield,         className: "bg-breeze text-forest" },
  business:         { icon: Briefcase,      className: "bg-field text-forest" },
  other_asset:      { icon: MoreHorizontal, className: "bg-paper text-forest" },
  mortgage:         { icon: Home,           className: "bg-breeze text-forest" },
  personal_loan:    { icon: Wallet,         className: "bg-breeze text-forest" },
  credit_card:      { icon: CreditCard,     className: "bg-breeze text-forest" },
  business_debt:    { icon: Briefcase,      className: "bg-breeze text-forest" },
  other_liability:  { icon: MoreHorizontal, className: "bg-breeze text-forest" },
  car_loan:         { icon: Car,            className: "bg-breeze text-forest" },
  student_loan:     { icon: GraduationCap,  className: "bg-breeze text-forest" },
  other:            { icon: MoreHorizontal, className: "bg-breeze text-forest" },
};

const FALLBACK_TILE: TileStyle = { icon: MoreHorizontal, className: "bg-paper text-forest" };

function CategoryTile({ category }: { category: string }) {
  const tile = CATEGORY_TILES[category] ?? FALLBACK_TILE;
  const Icon = tile.icon;
  return (
    <div
      className={cn("h-11 w-11 rounded-[14px] shrink-0 flex items-center justify-center", tile.className)}
      aria-hidden="true"
    >
      <Icon className="h-[18px] w-[18px]" />
    </div>
  );
}

export function SyncedAssetRow({ item }: SyncedAssetRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 p-3 border-b border-hairline last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <CategoryTile category={item.category} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-forest truncate">{item.label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <SyncedItemBadge />
            {item.lastUpdated && (
              <span className="text-[12px] text-ink-40">Updated {fmtDate(item.lastUpdated)}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[15px] font-semibold tabular-nums text-forest">
          <CurrencyField amountUsd={item.valueUsd} compact />
        </span>
        <Link
          href="/client/wealth/investments"
          className="min-h-[44px] px-1 text-[13px] text-green font-semibold underline underline-offset-2 flex items-center gap-1 hover:text-forest-700"
        >
          Portfolio <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export function ManualAssetRow({ item, onEdit, onDelete }: ManualAssetRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2 p-3 border-b border-hairline last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <CategoryTile category={item.category} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-forest truncate">{item.name}</p>
          <p className="text-[13px] text-ink-40 capitalize mt-0.5 truncate">
            {item.category.replace(/_/g, " ")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[15px] font-semibold tabular-nums text-forest">
          <CurrencyField amountUsd={item.valueUsd} compact />
        </span>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(item.id); setConfirmDelete(false); }}
              className="h-11 px-4 rounded-full bg-sun text-forest text-[13px] font-semibold"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="h-11 px-3 rounded-full text-[13px] font-medium text-ink-40 hover:text-forest"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.name}`}
              className="h-11 w-11 flex items-center justify-center rounded-full text-ink-40 hover:text-forest hover:bg-paper transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete ${item.name}`}
              className="h-11 w-11 flex items-center justify-center rounded-full text-ink-40 hover:text-clay-ink hover:bg-paper transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Liabilities derived from a Property holding's outstanding mortgage balance —
// there's no row in the `liabilities` table behind these (their `id` is a
// synthetic `mortgage-<holdingId>` string), so they must never be sent to the
// liabilities edit/delete API. Edit the balance from the holding itself.
export function SyncedLiabilityRow({ item }: SyncedLiabilityRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 p-3 border-b border-hairline last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <CategoryTile category={item.category} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-forest truncate">{item.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <SyncedItemBadge />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[15px] font-semibold tabular-nums text-forest">
          <CurrencyField amountUsd={item.balanceUsd} compact />
        </span>
        <Link
          href="/client/wealth/investments"
          className="min-h-[44px] px-1 text-[13px] text-green font-semibold underline underline-offset-2 flex items-center gap-1 hover:text-forest-700"
        >
          Portfolio <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export function ManualLiabilityRow({ item, onEdit, onDelete }: ManualLiabilityRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2 p-3 border-b border-hairline last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <CategoryTile category={item.category} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-forest truncate">{item.name}</p>
          <p className="text-[13px] text-ink-40 capitalize mt-0.5 truncate">
            {item.category.replace(/_/g, " ")}
            {item.interestRatePercent ? ` · ${item.interestRatePercent}% p.a.` : ""}
            {item.monthlyPaymentUsd ? ` · $${Math.round(item.monthlyPaymentUsd).toLocaleString()}/mo` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[15px] font-semibold tabular-nums text-forest">
          <CurrencyField amountUsd={item.balanceUsd} compact />
        </span>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(item.id); setConfirmDelete(false); }}
              className="h-11 px-4 rounded-full bg-sun text-forest text-[13px] font-semibold"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="h-11 px-3 rounded-full text-[13px] font-medium text-ink-40 hover:text-forest"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.name}`}
              className="h-11 w-11 flex items-center justify-center rounded-full text-ink-40 hover:text-forest hover:bg-paper transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete ${item.name}`}
              className="h-11 w-11 flex items-center justify-center rounded-full text-ink-40 hover:text-clay-ink hover:bg-paper transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

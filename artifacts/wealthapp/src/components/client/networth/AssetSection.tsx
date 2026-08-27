import { Plus } from "lucide-react";
import { SyncedAssetRow, ManualAssetRow } from "./NetWorthItemRow";
import type { SyncedAsset, ManualAsset } from "@/hooks/useNetWorthItems";
import CurrencyField from "@/components/shared/CurrencyField";

interface Props {
  syncedAssets: SyncedAsset[];
  manualAssets: ManualAsset[];
  totalAssets: number;
  onAddClick: () => void;
  onEditAsset: (item: ManualAsset) => void;
  onDeleteAsset: (id: string) => void;
}

export default function AssetSection({
  syncedAssets, manualAssets, totalAssets, onAddClick, onEditAsset, onDeleteAsset,
}: Props) {
  const allEmpty = syncedAssets.length === 0 && manualAssets.length === 0;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-semibold text-forest">Assets</h2>
          {!allEmpty && (
            <span className="text-sm font-semibold text-green">
              <CurrencyField amountUsd={totalAssets} compact />
            </span>
          )}
        </div>
        <button
          onClick={onAddClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-green text-green text-sm font-medium hover:bg-green-tint transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add asset
        </button>
      </div>

      {/* Synced section */}
      {syncedAssets.length > 0 && (
        <div className="bg-green-tint border border-green/20 rounded-[18px] overflow-hidden">
          <p className="text-[11px] font-semibold text-green uppercase tracking-wide px-3 sm:px-4 py-2 border-b border-green/10">
            Synced from portfolio — updates automatically
          </p>
          <div className="divide-y divide-hairline">
            {syncedAssets.map(item => (
              <SyncedAssetRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Manual items */}
      {manualAssets.length > 0 && (
        <div className="bg-surface border border-hairline rounded-[18px] overflow-hidden divide-y divide-hairline">
          {manualAssets.map(item => (
            <ManualAssetRow
              key={item.id}
              item={item}
              onEdit={onEditAsset}
              onDelete={onDeleteAsset}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {allEmpty && (
        <div className="border-2 border-dashed border-hairline rounded-[18px] py-10 text-center">
          <p className="text-sm font-medium text-ink-40">No assets tracked yet</p>
          <p className="text-xs text-ink-30 mt-1">Click "Add asset" to get started</p>
        </div>
      )}
    </div>
  );
}

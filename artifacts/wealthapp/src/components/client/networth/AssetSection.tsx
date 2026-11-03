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
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-[16px] font-semibold text-forest">Assets</h2>
          {!allEmpty && (
            <span className="text-[15px] font-semibold tabular-nums text-ink-40">
              <CurrencyField amountUsd={totalAssets} compact />
            </span>
          )}
        </div>
        <button
          onClick={onAddClick}
          className="shrink-0 flex items-center gap-1.5 h-11 px-4 rounded-full border-[1.5px] border-forest bg-transparent text-forest text-[14px] font-semibold hover:bg-surface transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add asset
        </button>
      </div>

      {/* Synced section */}
      {syncedAssets.length > 0 && (
        <div className="bg-surface rounded-[24px] p-1">
          <p className="tala-eyebrow text-ink-40 px-3 pt-3 pb-1">
            Synced from portfolio — updates automatically
          </p>
          <div>
            {syncedAssets.map(item => (
              <SyncedAssetRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Manual items */}
      {manualAssets.length > 0 && (
        <div className="bg-surface rounded-[24px] p-1">
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
        <div className="bg-surface rounded-[24px] py-10 px-5 text-center">
          <p className="text-[14px] font-medium text-forest">No assets tracked yet</p>
          <p className="text-[13px] text-ink-40 mt-1">Click "Add asset" to get started</p>
        </div>
      )}
    </div>
  );
}

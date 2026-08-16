import { Plus } from "lucide-react";
import { SyncedAssetRow, ManualAssetRow } from "./NetWorthItemRow";
import type { SyncedAsset, ManualAsset } from "@/hooks/useNetWorthItems";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";

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
          <h2 className="text-base font-semibold text-[#042C53]">Assets</h2>
          {!allEmpty && (
            <span className="text-sm font-semibold text-[#1D9E75]">
              <CurrencyDisplay amountUsd={totalAssets} compact />
            </span>
          )}
        </div>
        <button
          onClick={onAddClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#1D9E75] text-[#1D9E75] text-sm font-medium hover:bg-[#1D9E75]/5 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add asset
        </button>
      </div>

      {/* Synced section */}
      {syncedAssets.length > 0 && (
        <div className="bg-[#F0FDF8] border border-[#1D9E75]/20 rounded-xl overflow-hidden">
          <p className="text-[11px] font-semibold text-[#1D9E75] uppercase tracking-wide px-3 sm:px-4 py-2 border-b border-[#1D9E75]/10">
            Synced from portfolio — updates automatically
          </p>
          <div className="divide-y divide-slate-100">
            {syncedAssets.map(item => (
              <SyncedAssetRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Manual items */}
      {manualAssets.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden divide-y divide-slate-50">
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
        <div className="border-2 border-dashed border-slate-200 rounded-xl py-10 text-center">
          <p className="text-sm font-medium text-slate-400">No assets tracked yet</p>
          <p className="text-xs text-slate-300 mt-1">Click "Add asset" to get started</p>
        </div>
      )}
    </div>
  );
}

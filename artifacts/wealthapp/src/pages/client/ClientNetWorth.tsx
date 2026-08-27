// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Chart draw animation (Recharts default)
// ✓ ALLOWED: BottomSheet spring animation
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#FAF8F5, #F2EFE9, #A8A095)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Double bottom nav — AppShell is the ONLY nav

import { useState, useEffect, useRef } from "react";
import ClientAppShell from "@/components/client/AppShell";
import NetWorthHeader from "@/components/client/networth/NetWorthHeader";
import NetWorthTrendChart from "@/components/client/networth/NetWorthTrendChart";
import NetWorthSummaryBar from "@/components/client/networth/NetWorthSummaryBar";
import AssetSection from "@/components/client/networth/AssetSection";
import LiabilitySection from "@/components/client/networth/LiabilitySection";
import AddAssetSheet from "@/components/client/networth/AddAssetSheet";
import AddLiabilitySheet from "@/components/client/networth/AddLiabilitySheet";
import { EditAssetSheet, EditLiabilitySheet } from "@/components/client/networth/EditItemSheet";
import {
  useNetWorthItems,
  type ManualAsset,
  type ManualLiability,
} from "@/hooks/useNetWorthItems";
import { useNetWorthSummary } from "@/hooks/useNetWorthSummary";
import { useNetWorthTrend } from "@/hooks/useNetWorthTrend";

export default function ClientNetWorth() {
  const {
    syncedAssets, syncedLiabilities, manualAssets, manualLiabilities,
    totalAssets, totalLiabilities, netWorth, assetCount, liabilityCount, loading,
  } = useNetWorthSummary();
  const {
    addAsset, updateAsset, deleteAsset,
    addLiability, updateLiability, deleteLiability,
    saveSnapshot,
  } = useNetWorthItems();
  const { trendData, hasHistory, trendDelta, loading: trendLoading } = useNetWorthTrend();

  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddLiability, setShowAddLiability] = useState(false);
  const [editAsset, setEditAsset] = useState<ManualAsset | null>(null);
  const [editLiability, setEditLiability] = useState<ManualLiability | null>(null);

  // Build liability by category for summary bar
  const liabilityByCategory: Record<string, number> = {};
  for (const l of [...syncedLiabilities, ...manualLiabilities]) {
    liabilityByCategory[l.category] = (liabilityByCategory[l.category] ?? 0) + l.balanceUsd;
  }

  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading || (totalAssets === 0 && totalLiabilities === 0)) return;
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      saveSnapshot(totalAssets, totalLiabilities);
    }, 1000);
    return () => {
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    };
  }, [totalAssets, totalLiabilities, loading]);

  return (
    <ClientAppShell>
      <div className="max-w-[900px] mx-auto space-y-5">
        <NetWorthHeader
          totalAssets={totalAssets}
          totalLiabilities={totalLiabilities}
          netWorth={netWorth}
          assetCount={assetCount}
          liabilityCount={liabilityCount}
          trendDelta={trendLoading ? null : trendDelta}
          loading={loading}
        />

        <NetWorthTrendChart
          trendData={trendData}
          hasHistory={hasHistory}
        />

        <NetWorthSummaryBar
          syncedAssets={syncedAssets}
          manualAssets={manualAssets}
          totalAssets={totalAssets}
          totalLiabilities={totalLiabilities}
          liabilityByCategory={liabilityByCategory}
        />

        <AssetSection
          syncedAssets={syncedAssets}
          manualAssets={manualAssets}
          totalAssets={totalAssets}
          onAddClick={() => setShowAddAsset(true)}
          onEditAsset={setEditAsset}
          onDeleteAsset={deleteAsset}
        />

        <LiabilitySection
          manualLiabilities={[...syncedLiabilities, ...manualLiabilities]}
          totalLiabilities={totalLiabilities}
          onAddClick={() => setShowAddLiability(true)}
          onEditLiability={setEditLiability}
          onDeleteLiability={deleteLiability}
        />
      </div>

      <AddAssetSheet
        isOpen={showAddAsset}
        onClose={() => setShowAddAsset(false)}
        onSave={(data) => addAsset(data).then(() => {})}
      />

      <AddLiabilitySheet
        isOpen={showAddLiability}
        onClose={() => setShowAddLiability(false)}
        onSave={(data) => addLiability(data).then(() => {})}
      />

      <EditAssetSheet
        item={editAsset}
        isOpen={editAsset !== null}
        onClose={() => setEditAsset(null)}
        onSave={(id, data) => updateAsset(id, data).then(() => {})}
        onDelete={(id) => void deleteAsset(id)}
      />

      <EditLiabilitySheet
        item={editLiability}
        isOpen={editLiability !== null}
        onClose={() => setEditLiability(null)}
        onSave={(id, data) => updateLiability(id, data).then(() => {})}
        onDelete={(id) => void deleteLiability(id)}
      />
    </ClientAppShell>
  );
}

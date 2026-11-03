// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Chart draw animation (Recharts default)
// ✓ ALLOWED: BottomSheet spring animation
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#F1F4FE, #F1F4FE, #8F98C8)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Double bottom nav — AppShell is the ONLY nav

import { useState } from "react";
import { useLocation } from "wouter";
import ClientAppShell from "@/components/client/AppShell";
import SolNarration from "@/components/client/SolNarration";
import NetWorthHeader from "@/components/client/networth/NetWorthHeader";
import NetWorthTrendChart from "@/components/client/networth/NetWorthTrendChart";
import NetWorthSummaryBar from "@/components/client/networth/NetWorthSummaryBar";
import AssetSection from "@/components/client/networth/AssetSection";
import LiabilitySection from "@/components/client/networth/LiabilitySection";
import AddAssetSheet from "@/components/client/networth/AddAssetSheet";
import AddLiabilitySheet from "@/components/client/networth/AddLiabilitySheet";
import { EditAssetSheet, EditLiabilitySheet } from "@/components/client/networth/EditItemSheet";
import type { ManualAsset, ManualLiability } from "@/hooks/useNetWorthItems";
import { useNetWorthSummary } from "@/hooks/useNetWorthSummary";
import { useNetWorthTrend } from "@/hooks/useNetWorthTrend";
import { usePlan } from "@/hooks/usePlan";

const CASH_CATEGORIES = new Set(["cash", "savings"]);

export default function ClientNetWorth() {
  const [location] = useLocation();
  const isPropertyDebts = location.split(/[?#]/, 1)[0] === "/client/wealth/property-debts";
  const {
    syncedAssets, syncedLiabilities, manualAssets, manualLiabilities,
    totalAssets, totalLiabilities, netWorth, assetCount, liabilityCount, loading,
    addAsset, updateAsset, deleteAsset, addLiability, updateLiability, deleteLiability,
  } = useNetWorthSummary();
  const { advisorName } = usePlan();
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

  const cashValue = [...syncedAssets, ...manualAssets]
    .filter(a => CASH_CATEGORIES.has(a.category))
    .reduce((s, a) => s + a.valueUsd, 0);
  const cashPct = totalAssets > 0 ? Math.round((cashValue / totalAssets) * 100) : 0;
  const placeCount = assetCount + liabilityCount;
  const manualAssetTotal = manualAssets.reduce((sum, asset) => sum + asset.valueUsd, 0);
  const manualLiabilityTotal = manualLiabilities.reduce((sum, liability) => sum + liability.balanceUsd, 0);

  return (
    <ClientAppShell>
      <div className="max-w-[900px] mx-auto space-y-5">
        {isPropertyDebts ? (
          <>
            <div>
              <h1 className="font-display text-2xl font-semibold text-forest">Property &amp; debts</h1>
              <p className="mt-1 text-sm text-ink-40">Track assets and liabilities you have added manually.</p>
            </div>
            <AssetSection
              syncedAssets={[]}
              manualAssets={manualAssets}
              totalAssets={manualAssetTotal}
              onAddClick={() => setShowAddAsset(true)}
              onEditAsset={setEditAsset}
              onDeleteAsset={deleteAsset}
            />
            <LiabilitySection
              syncedLiabilities={[]}
              manualLiabilities={manualLiabilities}
              totalLiabilities={manualLiabilityTotal}
              onAddClick={() => setShowAddLiability(true)}
              onEditLiability={setEditLiability}
              onDeleteLiability={deleteLiability}
            />
          </>
        ) : (
          <>
            {!loading && totalAssets > 0 && (
              <SolNarration
                line={`$${Math.round(totalAssets).toLocaleString()} across ${placeCount} place${placeCount !== 1 ? "s" : ""}. Cash is ${cashPct}% of it.`}
                detail="A cash buffer is usually sized in months of expenses — three to six is typical. Money beyond that has an opportunity cost, and what to do with it is worth raising at your next review."
                advisorFirstName={advisorName?.split(" ")[0] ?? null}
              />
            )}

            <NetWorthHeader
              totalAssets={totalAssets}
              totalLiabilities={totalLiabilities}
              netWorth={netWorth}
              assetCount={assetCount}
              liabilityCount={liabilityCount}
              trendDelta={trendLoading ? null : trendDelta}
              loading={loading}
            />

            <NetWorthTrendChart trendData={trendData} hasHistory={hasHistory} />

            <NetWorthSummaryBar
              syncedAssets={syncedAssets}
              manualAssets={manualAssets}
              totalAssets={totalAssets}
              totalLiabilities={totalLiabilities}
              liabilityByCategory={liabilityByCategory}
            />
          </>
        )}
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

import { useAdvisedPlans } from "./useAdvisedPlans";
import { useClientHoldings } from "./useClientHoldings";
import { useNetWorthItems, buildSyncedAssets, buildSyncedLiabilities } from "./useNetWorthItems";

/**
 * Single source of truth for "net worth" so every screen (dashboard, Net
 * Worth page) shows the same number: synced portfolio/holding assets +
 * manual assets, minus synced (holding mortgages) + manual liabilities.
 */
export function useNetWorthSummary() {
  const { plans, loading: plansLoading } = useAdvisedPlans();
  const { holdings, loading: holdingsLoading } = useClientHoldings();
  const { manualAssets, manualLiabilities, loading: itemsLoading } = useNetWorthItems();

  const syncedAssets = buildSyncedAssets(plans, holdings);
  const syncedLiabilities = buildSyncedLiabilities(holdings);

  const totalAssets =
    syncedAssets.reduce((s, a) => s + a.valueUsd, 0) +
    manualAssets.reduce((s, a) => s + a.valueUsd, 0);

  const totalLiabilities =
    syncedLiabilities.reduce((s, l) => s + l.balanceUsd, 0) +
    manualLiabilities.reduce((s, l) => s + l.balanceUsd, 0);

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    assetCount: syncedAssets.length + manualAssets.length,
    liabilityCount: syncedLiabilities.length + manualLiabilities.length,
    syncedAssets,
    syncedLiabilities,
    manualAssets,
    manualLiabilities,
    loading: plansLoading || holdingsLoading || itemsLoading,
  };
}

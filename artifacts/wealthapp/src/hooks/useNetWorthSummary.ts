import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import {
  getClientGetNetWorthSummaryQueryKey,
  useClientGetNetWorthSummary,
  type NetWorthSummary,
} from "@workspace/api-client-react";
import { useNetWorthItems, type ManualAsset, type ManualLiability, type SyncedAsset } from "./useNetWorthItems";

function netWorthAssetCategory(source: "holding" | "advised_plan", category: string): string {
  if (source === "advised_plan") return "investment";
  if (["stock_etf", "etf", "mutual_fund", "commodity", "bond", "crypto"].includes(category)) return "investment";
  if (category === "other") return "other_asset";
  return category;
}

export function useNetWorthSummary() {
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const items = useNetWorthItems();
  const summaryQuery = useClientGetNetWorthSummary({
    query: {
      queryKey: getClientGetNetWorthSummaryQueryKey(),
      enabled: isLoaded && !!user,
    },
  });
  const summary: NetWorthSummary | undefined = summaryQuery.data;

  useEffect(() => {
    if (summary) queryClient.invalidateQueries({ queryKey: ["nw-snapshots"] });
  }, [queryClient, summary?.asOf, summary?.netWorth]);

  const syncedAssets: SyncedAsset[] = (summary?.items ?? [])
    .filter((item) => item.source === "holding" || item.source === "advised_plan")
    .map((item) => ({
      id: `${item.source === "advised_plan" ? "plan" : "holding"}-${item.id}`,
      label: item.label,
      category: netWorthAssetCategory(item.source as "holding" | "advised_plan", item.category),
      valueUsd: item.value,
      currency: item.currency,
      source: item.source === "advised_plan" ? "portfolio_sync" : "holding_sync",
      sourceId: item.id,
      lastUpdated: null,
    }));

  const syncedLiabilities: ManualLiability[] = (summary?.items ?? [])
    .filter((item) => item.source === "mortgage")
    .map((item) => ({
      id: `mortgage-${item.id}`,
      name: item.label,
      category: item.category,
      balanceUsd: item.value,
      interestRatePercent: null,
      monthlyPaymentUsd: null,
      currencyOriginal: item.currency,
      notes: `__synced:holding:${item.id}`,
      createdAt: summary?.asOf ?? "",
    }));

  const assetsInSummary = (summary?.items ?? []).filter((item) =>
    item.source === "holding" || item.source === "advised_plan" || item.source === "asset",
  );
  const liabilitiesInSummary = (summary?.items ?? []).filter((item) =>
    item.source === "liability" || item.source === "mortgage",
  );

  return {
    totalAssets: summary?.totalAssets ?? 0,
    totalLiabilities: summary?.totalLiabilities ?? 0,
    netWorth: summary?.netWorth ?? 0,
    assetCount: assetsInSummary.length,
    liabilityCount: liabilitiesInSummary.length,
    syncedAssets,
    syncedLiabilities,
    manualAssets: items.manualAssets as ManualAsset[],
    manualLiabilities: items.manualLiabilities,
    loading: summaryQuery.isLoading || items.loading,
    addAsset: items.addAsset,
    updateAsset: items.updateAsset,
    deleteAsset: items.deleteAsset,
    addLiability: items.addLiability,
    updateLiability: items.updateLiability,
    deleteLiability: items.deleteLiability,
  };
}

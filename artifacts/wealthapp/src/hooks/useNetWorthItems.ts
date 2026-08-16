import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useCallback, useRef } from "react";
import { useCurrencyRates } from "./useCurrencyRates";
import { convertCurrency } from "@/lib/currencyUtils";
import type { AdvisedPlan } from "./useAdvisedPlans";
import type { ClientHolding } from "./useClientHoldings";

// Synced read-only item derived from portfolio data
export interface SyncedAsset {
  id: string;
  label: string;
  category: "investment" | "property" | "cash" | "pension";
  valueUsd: number;
  currency: string;
  source: "portfolio_sync" | "holding_sync";
  sourceId: string;
  lastUpdated: string | null;
}

// Manually entered asset (existing assetsTable)
export interface ManualAsset {
  id: string;
  name: string;
  category: string;
  valueUsd: number;
  currencyOriginal: string;
  notes: string | null;
  createdAt: string;
}

// Manually entered liability (existing liabilitiesTable)
export interface ManualLiability {
  id: string;
  name: string;
  category: string;
  balanceUsd: number;
  interestRatePercent: number | null;
  monthlyPaymentUsd: number | null;
  currencyOriginal: string;
  notes: string | null;
  createdAt: string;
}

export function buildSyncedAssets(
  plans: AdvisedPlan[],
  holdings: ClientHolding[]
): SyncedAsset[] {
  const items: SyncedAsset[] = [];

  // All advised plans → investment category
  for (const plan of plans) {
    if (plan.status !== "inforce" || !plan.isVisibleToClient) continue;
    items.push({
      id: `plan-${plan.id}`,
      label: plan.nickname ?? plan.productName,
      category: "investment",
      valueUsd: parseFloat(plan.latestAccountValue) || 0,
      currency: plan.currency,
      source: "portfolio_sync",
      sourceId: plan.id,
      lastUpdated: plan.latestStatementDate,
    });
  }

  // Property / cash / pension holdings → their respective categories
  for (const h of holdings) {
    if (!h.isActive) continue;
    if (!["property", "cash", "pension"].includes(h.holdingType)) continue;
    items.push({
      id: `holding-${h.id}`,
      label: h.label,
      category: h.holdingType as "property" | "cash" | "pension",
      valueUsd: h.currentValue,
      currency: h.currency,
      source: "holding_sync",
      sourceId: h.id,
      lastUpdated: h.updatedAt?.slice(0, 10) ?? null,
    });
  }

  return items;
}

export function buildSyncedLiabilities(holdings: ClientHolding[]): ManualLiability[] {
  const items: ManualLiability[] = [];
  for (const h of holdings) {
    if (!h.isActive || h.holdingType !== "property") continue;
    const mortgage = parseFloat(h.outstandingMortgage ?? "0") || 0;
    if (mortgage <= 0) continue;
    items.push({
      id: `mortgage-${h.id}`,
      name: `${h.label} mortgage`,
      category: "mortgage",
      balanceUsd: mortgage,
      interestRatePercent: null,
      monthlyPaymentUsd: null,
      currencyOriginal: h.currency,
      notes: `__synced:holding:${h.id}`,
      createdAt: h.createdAt,
    });
  }
  return items;
}

export function useNetWorthItems() {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();
  const enabled = isLoaded && !!user;
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { rates } = useCurrencyRates();

  const assetsQuery = useQuery<Array<{
    id: string; name: string; category: string; valueUsd: string;
    currencyOriginal: string; notes: string | null; createdAt: string;
  }>>({
    queryKey: ["nw-assets"],
    queryFn: () => apiFetch("/assets"),
    enabled,
  });

  const liabsQuery = useQuery<Array<{
    id: string; name: string; category: string; balanceUsd: string;
    interestRatePercent: string | null; monthlyPaymentUsd: string | null;
    currencyOriginal: string; notes: string | null; createdAt: string;
  }>>({
    queryKey: ["nw-liabilities"],
    queryFn: () => apiFetch("/liabilities"),
    enabled,
  });

  const manualAssets: ManualAsset[] = (assetsQuery.data ?? []).map(a => ({
    id: a.id,
    name: a.name,
    category: a.category,
    valueUsd: parseFloat(a.valueUsd) || 0,
    currencyOriginal: a.currencyOriginal,
    notes: a.notes,
    createdAt: a.createdAt,
  }));

  const manualLiabilities: ManualLiability[] = (liabsQuery.data ?? []).map(l => ({
    id: l.id,
    name: l.name,
    category: l.category,
    balanceUsd: parseFloat(l.balanceUsd) || 0,
    interestRatePercent: l.interestRatePercent ? parseFloat(l.interestRatePercent) : null,
    monthlyPaymentUsd: l.monthlyPaymentUsd ? parseFloat(l.monthlyPaymentUsd) : null,
    currencyOriginal: l.currencyOriginal,
    notes: l.notes,
    createdAt: l.createdAt,
  }));

  const addAssetMutation = useMutation({
    mutationFn: (data: {
      name: string; category: string; valueUsd: number; currencyOriginal: string; notes?: string;
    }) => apiFetch("/assets", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        category: data.category,
        valueUsd: String(data.valueUsd),
        currencyOriginal: data.currencyOriginal,
        notes: data.notes ?? null,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nw-assets"] });
      toast.success("Asset added");
    },
    onError: () => toast.error("Failed to add asset"),
  });

  const updateAssetMutation = useMutation({
    mutationFn: ({ id, data }: {
      id: string; data: { name: string; category: string; valueUsd: number; currencyOriginal: string; notes?: string };
    }) => apiFetch(`/assets/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: data.name,
        category: data.category,
        valueUsd: String(data.valueUsd),
        currencyOriginal: data.currencyOriginal,
        notes: data.notes ?? null,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nw-assets"] });
      toast.success("Updated");
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/assets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nw-assets"] });
      toast.success("Asset removed");
    },
  });

  const addLiabMutation = useMutation({
    mutationFn: (data: {
      name: string; category: string; balanceUsd: number; currencyOriginal: string;
      interestRatePercent?: number | null; monthlyPaymentUsd?: number | null; notes?: string;
    }) => apiFetch("/liabilities", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        category: data.category,
        balanceUsd: String(data.balanceUsd),
        currencyOriginal: data.currencyOriginal,
        interestRatePercent: data.interestRatePercent != null ? String(data.interestRatePercent) : null,
        monthlyPaymentUsd: data.monthlyPaymentUsd != null ? String(data.monthlyPaymentUsd) : null,
        notes: data.notes ?? null,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nw-liabilities"] });
      toast.success("Liability added");
    },
    onError: () => toast.error("Failed to add liability"),
  });

  const updateLiabMutation = useMutation({
    mutationFn: ({ id, data }: {
      id: string; data: {
        name: string; category: string; balanceUsd: number; currencyOriginal: string;
        interestRatePercent?: number | null; monthlyPaymentUsd?: number | null;
      };
    }) => apiFetch(`/liabilities/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: data.name,
        category: data.category,
        balanceUsd: String(data.balanceUsd),
        currencyOriginal: data.currencyOriginal,
        interestRatePercent: data.interestRatePercent != null ? String(data.interestRatePercent) : null,
        monthlyPaymentUsd: data.monthlyPaymentUsd != null ? String(data.monthlyPaymentUsd) : null,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nw-liabilities"] });
      toast.success("Updated");
    },
  });

  const deleteLiabMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/liabilities/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nw-liabilities"] });
      toast.success("Liability removed");
    },
  });

  // Debounced snapshot save
  const saveSnapshot = useCallback((totalAssetsUsd: number, totalLiabilitiesUsd: number) => {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      apiFetch("/client/networth/snapshot", {
        method: "POST",
        body: JSON.stringify({
          totalAssetsUsd,
          totalLiabilitiesUsd,
          netWorthUsd: totalAssetsUsd - totalLiabilitiesUsd,
        }),
      }).then(() => {
        qc.invalidateQueries({ queryKey: ["nw-snapshots"] });
      }).catch(() => {});
    }, 5000);
  }, [qc]);

  return {
    manualAssets,
    manualLiabilities,
    loading: assetsQuery.isLoading || liabsQuery.isLoading,
    addAsset: addAssetMutation.mutateAsync,
    updateAsset: (id: string, data: Parameters<typeof updateAssetMutation.mutateAsync>[0]["data"]) =>
      updateAssetMutation.mutateAsync({ id, data }),
    deleteAsset: deleteAssetMutation.mutateAsync,
    addLiability: addLiabMutation.mutateAsync,
    updateLiability: (id: string, data: Parameters<typeof updateLiabMutation.mutateAsync>[0]["data"]) =>
      updateLiabMutation.mutateAsync({ id, data }),
    deleteLiability: deleteLiabMutation.mutateAsync,
    saveSnapshot,
    rates,
  };
}

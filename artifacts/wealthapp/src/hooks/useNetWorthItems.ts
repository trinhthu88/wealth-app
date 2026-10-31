import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { getClientGetNetWorthSummaryQueryKey } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

const netWorthSummaryQueryKey = getClientGetNetWorthSummaryQueryKey();

// Synced read-only item derived from portfolio data
export interface SyncedAsset {
  id: string;
  label: string;
  category: string;
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

export function useNetWorthItems() {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();
  const enabled = isLoaded && !!user;

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
      qc.invalidateQueries({ queryKey: netWorthSummaryQueryKey });
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
      qc.invalidateQueries({ queryKey: netWorthSummaryQueryKey });
      toast.success("Updated");
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/assets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nw-assets"] });
      qc.invalidateQueries({ queryKey: netWorthSummaryQueryKey });
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
      qc.invalidateQueries({ queryKey: netWorthSummaryQueryKey });
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
      qc.invalidateQueries({ queryKey: netWorthSummaryQueryKey });
      toast.success("Updated");
    },
  });

  const deleteLiabMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/liabilities/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nw-liabilities"] });
      qc.invalidateQueries({ queryKey: netWorthSummaryQueryKey });
      toast.success("Liability removed");
    },
  });

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
  };
}

import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";

export interface NetWorthSnapshot {
  id: string;
  userId: string;
  snapshotDate: string;
  totalAssetsUsd: string;
  totalLiabilitiesUsd: string;
  netWorthUsd: string;
  notes: string | null;
  createdAt: string;
}

export interface TrendPoint {
  date: string;
  label: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

export function useNetWorthTrend() {
  const { user, isLoaded } = useUser();

  const query = useQuery<NetWorthSnapshot[]>({
    queryKey: ["nw-snapshots"],
    queryFn: () => apiFetch("/client/networth/snapshots"),
    enabled: isLoaded && !!user,
  });

  const snapshots = query.data ?? [];

  const trendData: TrendPoint[] = snapshots.map(s => {
    const d = new Date(s.snapshotDate);
    return {
      date: s.snapshotDate,
      label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      netWorth: parseFloat(s.netWorthUsd) || 0,
      assets: parseFloat(s.totalAssetsUsd) || 0,
      liabilities: parseFloat(s.totalLiabilitiesUsd) || 0,
    };
  });

  const hasHistory = trendData.length >= 2;

  const latest = trendData[trendData.length - 1] ?? null;
  const previous = trendData[trendData.length - 2] ?? null;

  const trendDelta = latest && previous
    ? latest.netWorth - previous.netWorth
    : null;

  return {
    snapshots,
    trendData,
    hasHistory,
    trendDelta,
    loading: query.isLoading,
  };
}

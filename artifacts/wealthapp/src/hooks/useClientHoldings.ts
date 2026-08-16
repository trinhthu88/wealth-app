import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { calcHoldingGainLoss } from "@/lib/investmentCalculations";
import { usePriceCache } from "./usePriceCache";

export interface ClientHolding {
  id: string;
  userId: string;
  holdingType: string;
  label: string;
  currency: string;
  purchaseDate: string | null;
  notes: string | null;
  isActive: boolean;
  // stock_etf + crypto
  ticker: string | null;
  brokerPlatform: string | null;
  unitsHeld: string | null;
  averageCostPrice: string | null;
  // crypto
  coinSymbol: string | null;
  exchangeName: string | null;
  // property
  propertyAddress: string | null;
  purchasePrice: string | null;
  currentEstimatedValue: string | null;
  outstandingMortgage: string | null;
  monthlyRentalIncome: string | null;
  // cash
  bankName: string | null;
  accountType: string | null;
  currentBalance: string | null;
  interestRatePct: string | null;
  // pension
  schemeName: string | null;
  pensionCountry: string | null;
  currentBalancePension: string | null;
  monthlyContribution: string | null;
  employerContribution: string | null;
  // other
  currentValueOther: string | null;
  totalInvestedOther: string | null;
  createdAt: string;
  updatedAt: string;
  // Enriched
  currentValue: number;
  costBasis: number;
  gainLoss: number;
  gainLossPct: number;
  currentPriceUsd: number | null;
  isPriceStale: boolean;
}

const TICKER_BASED_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond"]);

function enrichHolding(
  raw: Omit<ClientHolding, "currentValue" | "costBasis" | "gainLoss" | "gainLossPct" | "currentPriceUsd" | "isPriceStale">,
  prices: Record<string, { price_usd: number; is_stale: boolean }>
): ClientHolding {
  const type = raw.holdingType;

  if (TICKER_BASED_TYPES.has(type)) {
    const priceKey = raw.ticker?.toUpperCase() ?? "";
    const priceEntry = prices[priceKey];
    const currentPriceUsd = priceEntry?.price_usd ?? null;
    const units = parseFloat(raw.unitsHeld ?? "0") || 0;
    const avgCost = parseFloat(raw.averageCostPrice ?? "0") || 0;
    if (currentPriceUsd != null) {
      const { costBasis, currentValue, gainLoss, gainLossPct } = calcHoldingGainLoss(units, avgCost, currentPriceUsd);
      return { ...raw, currentValue, costBasis, gainLoss, gainLossPct, currentPriceUsd, isPriceStale: priceEntry?.is_stale ?? false };
    }
    const costBasis = units * avgCost;
    return { ...raw, currentValue: costBasis, costBasis, gainLoss: 0, gainLossPct: 0, currentPriceUsd: null, isPriceStale: false };
  }

  if (type === "crypto") {
    const priceKey = raw.coinSymbol?.toUpperCase() ?? "";
    const priceEntry = prices[priceKey];
    const currentPriceUsd = priceEntry?.price_usd ?? null;
    const units = parseFloat(raw.unitsHeld ?? "0") || 0;
    const avgCost = parseFloat(raw.averageCostPrice ?? "0") || 0;
    if (currentPriceUsd != null) {
      const { costBasis, currentValue, gainLoss, gainLossPct } = calcHoldingGainLoss(units, avgCost, currentPriceUsd);
      return { ...raw, currentValue, costBasis, gainLoss, gainLossPct, currentPriceUsd, isPriceStale: priceEntry?.is_stale ?? false };
    }
    const costBasis = units * avgCost;
    return { ...raw, currentValue: costBasis, costBasis, gainLoss: 0, gainLossPct: 0, currentPriceUsd: null, isPriceStale: false };
  }

  if (type === "property") {
    const currentValue = parseFloat(raw.currentEstimatedValue ?? "0") || 0;
    const costBasis = parseFloat(raw.purchasePrice ?? "0") || 0;
    const gainLoss = currentValue - costBasis;
    const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
    return { ...raw, currentValue, costBasis, gainLoss, gainLossPct, currentPriceUsd: null, isPriceStale: false };
  }

  if (type === "cash") {
    const currentValue = parseFloat(raw.currentBalance ?? "0") || 0;
    return { ...raw, currentValue, costBasis: currentValue, gainLoss: 0, gainLossPct: 0, currentPriceUsd: null, isPriceStale: false };
  }

  if (type === "pension") {
    const currentValue = parseFloat(raw.currentBalancePension ?? "0") || 0;
    return { ...raw, currentValue, costBasis: currentValue, gainLoss: 0, gainLossPct: 0, currentPriceUsd: null, isPriceStale: false };
  }

  // other
  const currentValue = parseFloat(raw.currentValueOther ?? "0") || 0;
  const costBasis = parseFloat(raw.totalInvestedOther ?? "0") || currentValue;
  const gainLoss = currentValue - costBasis;
  const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
  return { ...raw, currentValue, costBasis, gainLoss, gainLossPct, currentPriceUsd: null, isPriceStale: false };
}

export function useClientHoldings() {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();

  const query = useQuery<Omit<ClientHolding, "currentValue" | "costBasis" | "gainLoss" | "gainLossPct" | "currentPriceUsd" | "isPriceStale">[]>({
    queryKey: ["client-holdings-raw"],
    queryFn: () => apiFetch("/client/holdings"),
    enabled: isLoaded && !!user,
  });

  const rawHoldings = query.data ?? [];

  const TICKER_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond"]);

  const priceSymbols = rawHoldings
    .filter((h) => TICKER_TYPES.has(h.holdingType) || h.holdingType === "crypto")
    .map((h) => ({
      symbol: h.holdingType === "crypto" ? (h.coinSymbol ?? "") : (h.ticker ?? ""),
      type: h.holdingType === "crypto" ? "crypto" as const : "stock_etf" as const,
    }))
    .filter((s) => s.symbol);

  const { prices } = usePriceCache(priceSymbols);

  const holdings: ClientHolding[] = rawHoldings
    .filter((h) => h.isActive)
    .map((h) => enrichHolding(h, prices));

  const holdingsByType = holdings.reduce<Record<string, ClientHolding[]>>((acc, h) => {
    if (!acc[h.holdingType]) acc[h.holdingType] = [];
    acc[h.holdingType].push(h);
    return acc;
  }, {});

  const totalSelfManagedValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  const addHolding = useMutation({
    mutationFn: (data: Partial<ClientHolding>) =>
      apiFetch("/client/holdings", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-holdings-raw"] }),
  });

  const updateHolding = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ClientHolding> }) =>
      apiFetch(`/client/holdings/${id}`, { method: "PUT", body: JSON.stringify(updates) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-holdings-raw"] }),
  });

  const deleteHolding = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/client/holdings/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-holdings-raw"] }),
  });

  return {
    holdings,
    holdingsByType,
    totalSelfManagedValue,
    loading: query.isLoading,
    addHolding: (data: Partial<ClientHolding>) => addHolding.mutateAsync(data),
    updateHolding: (id: string, updates: Partial<ClientHolding>) => updateHolding.mutateAsync({ id, updates }),
    deleteHolding: (id: string) => deleteHolding.mutateAsync(id),
  };
}

import { useQuery } from "@tanstack/react-query";
import { batchFetchPrices, type PriceResult } from "@/lib/priceService";

interface PriceSymbol {
  symbol: string;
  type: "stock_etf" | "crypto";
}

export function usePriceCache(symbols: PriceSymbol[]) {
  const key = symbols
    .map((s) => `${s.type}:${s.symbol}`)
    .sort()
    .join(",");

  const query = useQuery<Record<string, PriceResult>>({
    queryKey: ["price-cache", key],
    queryFn: () => batchFetchPrices(symbols),
    enabled: symbols.length > 0,
    staleTime: 4 * 60 * 60 * 1000, // 4 hours
    refetchOnWindowFocus: false,
  });

  return {
    prices: query.data ?? {},
    loading: query.isLoading,
  };
}

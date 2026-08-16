import { useQuery } from "@tanstack/react-query";
import { FALLBACK_RATES } from "@/lib/currencyUtils";

const CACHE_KEY = "currency_rates_cache";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCachedRates(): { rates: Record<string, number>; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchRates(): Promise<Record<string, number>> {
  const cached = getCachedRates();
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.rates;
  }

  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error("rate fetch failed");
  const data = await res.json();
  const rates: Record<string, number> = {
    USD: 1,
    VND: data.rates?.VND ?? FALLBACK_RATES.VND,
    EUR: data.rates?.EUR ?? FALLBACK_RATES.EUR,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }));
  return rates;
}

export function useCurrencyRates() {
  const query = useQuery<Record<string, number>>({
    queryKey: ["currency-rates"],
    queryFn: fetchRates,
    staleTime: CACHE_TTL,
    refetchOnWindowFocus: false,
    retry: 1,
    initialData: () => {
      const cached = getCachedRates();
      return cached?.rates ?? undefined;
    },
  });

  return {
    rates: query.data ?? FALLBACK_RATES,
    loading: query.isLoading,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
  };
}

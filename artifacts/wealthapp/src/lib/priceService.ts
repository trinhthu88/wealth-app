import { apiFetch } from "@/lib/api";

export interface PriceResult {
  symbol: string;
  price_usd: number;
  change_1d_pct: number;
  fetched_at: string;
  is_stale: boolean;
}

const COINGECKO_SYMBOL_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  MATIC: "matic-network",
  DOT: "polkadot",
  AVAX: "avalanche-2",
};

function toCoinGeckoId(symbol: string): string {
  return COINGECKO_SYMBOL_MAP[symbol.toUpperCase()] || symbol.toLowerCase();
}

export async function fetchStockPrice(ticker: string): Promise<PriceResult | null> {
  try {
    return await apiFetch<PriceResult>(`/prices/stock/${encodeURIComponent(ticker)}`);
  } catch {
    return null;
  }
}

export async function fetchCryptoPrice(coinSymbol: string): Promise<PriceResult | null> {
  try {
    const coinId = toCoinGeckoId(coinSymbol);
    return await apiFetch<PriceResult>(`/prices/crypto/${encodeURIComponent(coinId)}`);
  } catch {
    return null;
  }
}

// All types backed by Yahoo Finance
const YAHOO_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond"]);

export async function batchFetchPrices(
  holdings: Array<{ symbol: string; type: "stock_etf" | "crypto" }>
): Promise<Record<string, PriceResult>> {
  if (holdings.length === 0) return {};

  const stocks = holdings.filter((h) => YAHOO_TYPES.has(h.type)).map((h) => h.symbol);
  const cryptos = holdings.filter((h) => h.type === "crypto").map((h) => h.symbol);

  try {
    return await apiFetch<Record<string, PriceResult>>("/prices/batch", {
      method: "POST",
      body: JSON.stringify({ stocks, cryptos }),
    });
  } catch {
    return {};
  }
}

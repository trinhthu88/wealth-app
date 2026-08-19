import { db, assetClassBenchmarksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type AssetClass = "us_equity" | "global_equity" | "crypto" | "global_property" | "pension_balanced" | "other";

// Ticker-based holding types that don't have a dedicated benchmark row of their own —
// used only as a fallback when the live CAGR fetch for the holding's own ticker fails.
const TICKER_TYPE_FALLBACK_ASSET_CLASS: Record<string, AssetClass> = {
  stock_etf: "us_equity",
  etf: "us_equity",
  mutual_fund: "us_equity",
  bond: "us_equity",
  commodity: "other",
};

const TICKER_HOLDING_TYPES = new Set(Object.keys(TICKER_TYPE_FALLBACK_ASSET_CLASS));

const COINGECKO_MAP: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", SOL: "solana", XRP: "ripple",
  ADA: "cardano", DOGE: "dogecoin", MATIC: "matic-network", DOT: "polkadot", AVAX: "avalanche-2",
};

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

interface LiveCagr {
  cagrPct: number;
  years: number;
  sinceInception: boolean;
}

function cagrFromSeries(firstValue: number, firstAtMs: number, lastValue: number, lastAtMs: number): LiveCagr | null {
  if (firstValue <= 0 || lastValue <= 0) return null;
  const years = (lastAtMs - firstAtMs) / MS_PER_YEAR;
  if (years < 0.5) return null;
  const cappedYears = Math.min(years, 10);
  const cagrPct = (Math.pow(lastValue / firstValue, 1 / cappedYears) - 1) * 100;
  return { cagrPct, years: cappedYears, sinceInception: years < 9.5 };
}

async function fetchTickerCagr(ticker: string): Promise<LiveCagr | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=10y`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = (await r.json()) as any;
    const result = data?.chart?.result?.[0];
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
    const timestamps: number[] = result?.timestamp ?? [];
    const points = timestamps
      .map((t, i) => ({ atMs: t * 1000, close: closes[i] }))
      .filter((p): p is { atMs: number; close: number } => p.close != null);
    if (points.length < 2) return null;
    return cagrFromSeries(points[0].close, points[0].atMs, points[points.length - 1].close, points[points.length - 1].atMs);
  } catch {
    return null;
  }
}

async function fetchCryptoCagr(coinSymbol: string): Promise<LiveCagr | null> {
  const id = COINGECKO_MAP[coinSymbol.toUpperCase()] ?? coinSymbol.toLowerCase();
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=3650&interval=monthly`;
    const r = await fetch(url);
    const data = (await r.json()) as any;
    const prices: [number, number][] = data?.prices ?? [];
    if (prices.length < 2) return null;
    const [firstAtMs, firstPrice] = prices[0];
    const [lastAtMs, lastPrice] = prices[prices.length - 1];
    return cagrFromSeries(firstPrice, firstAtMs, lastPrice, lastAtMs);
  } catch {
    return null;
  }
}

async function getBenchmarkRow(assetClass: AssetClass) {
  const [row] = await db.select().from(assetClassBenchmarksTable).where(eq(assetClassBenchmarksTable.assetClass, assetClass));
  return row ?? null;
}

function liveLabel(symbol: string, live: LiveCagr): string {
  return live.sinceInception
    ? `${symbol} (since inception, ${live.years.toFixed(1)} years)`
    : `${symbol} (trailing 10yr CAGR)`;
}

export interface HoldingBenchmarkInput {
  holdingType: string;
  ticker?: string | null;
  coinSymbol?: string | null;
  interestRatePct?: string | number | null;
  expectedAnnualReturnPct?: string | number | null;
}

export interface BenchmarkResult {
  /** The value to use for projections: the client's override if set, else the benchmark. */
  value: number;
  source: string;
  isOverride: boolean;
  /** The benchmark itself — populated even when isOverride is true, for comparison. Null for cash. */
  benchmarkValue: number | null;
  benchmarkLabel: string | null;
}

function toNumberOrNull(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export async function resolveHoldingBenchmark(input: HoldingBenchmarkInput): Promise<BenchmarkResult> {
  const override = toNumberOrNull(input.expectedAnnualReturnPct);

  // cash uses the holding's own rate directly — no benchmark lookup, no override concept.
  if (input.holdingType === "cash") {
    return {
      value: toNumberOrNull(input.interestRatePct) ?? 0,
      source: "self_reported_interest_rate",
      isOverride: false,
      benchmarkValue: null,
      benchmarkLabel: null,
    };
  }

  let benchmarkValue: number | null = null;
  let benchmarkLabel: string | null = null;
  let source: string = "unavailable";

  if (TICKER_HOLDING_TYPES.has(input.holdingType) && input.ticker) {
    const live = await fetchTickerCagr(input.ticker);
    if (live) {
      benchmarkValue = live.cagrPct;
      benchmarkLabel = liveLabel(input.ticker, live);
      source = live.sinceInception ? "live_since_inception_cagr" : "live_10yr_cagr";
    } else {
      const row = await getBenchmarkRow(TICKER_TYPE_FALLBACK_ASSET_CLASS[input.holdingType] ?? "other");
      if (row) {
        benchmarkValue = parseFloat(row.tenYearCagrPct);
        benchmarkLabel = row.label;
        source = "asset_class_fallback";
      }
    }
  } else if (input.holdingType === "crypto" && input.coinSymbol) {
    const live = await fetchCryptoCagr(input.coinSymbol);
    if (live) {
      benchmarkValue = live.cagrPct;
      benchmarkLabel = liveLabel(input.coinSymbol, live);
      source = live.sinceInception ? "live_since_inception_cagr" : "live_10yr_cagr";
    } else {
      const row = await getBenchmarkRow("crypto");
      if (row) {
        benchmarkValue = parseFloat(row.tenYearCagrPct);
        benchmarkLabel = row.label;
        source = "asset_class_fallback";
      }
    }
  } else if (input.holdingType === "property") {
    const row = await getBenchmarkRow("global_property");
    if (row) { benchmarkValue = parseFloat(row.tenYearCagrPct); benchmarkLabel = row.label; source = "asset_class_benchmark"; }
  } else {
    // pension and other both use the blended pension_balanced default.
    const row = await getBenchmarkRow("pension_balanced");
    if (row) { benchmarkValue = parseFloat(row.tenYearCagrPct); benchmarkLabel = row.label; source = "asset_class_benchmark"; }
  }

  if (override != null) {
    return { value: override, source: "client_override", isOverride: true, benchmarkValue, benchmarkLabel };
  }

  return { value: benchmarkValue ?? 0, source, isOverride: false, benchmarkValue, benchmarkLabel };
}

/** Percentage-point deviation between an override and its benchmark. Null when within the 3pp threshold. */
export function getDeviationWarning(overridePct: number, benchmarkPct: number): { deltaPoints: number; isOptimistic: boolean } | null {
  const delta = overridePct - benchmarkPct;
  if (Math.abs(delta) <= 3) return null;
  return { deltaPoints: Math.round(Math.abs(delta) * 10) / 10, isOptimistic: delta > 0 };
}

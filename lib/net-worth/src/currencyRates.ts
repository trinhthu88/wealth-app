export type CurrencyRates = Record<string, number>;

export const FALLBACK_CURRENCY_RATES: CurrencyRates = {
  USD: 1,
  VND: 25_400,
  EUR: 0.92,
};

const RATE_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedRates: { rates: CurrencyRates; expiresAt: number } | null = null;
let pendingFetch: Promise<CurrencyRates> | null = null;

export async function getCurrencyRates(): Promise<CurrencyRates> {
  if (cachedRates && cachedRates.expiresAt > Date.now()) return cachedRates.rates;
  if (pendingFetch) return pendingFetch;

  pendingFetch = (async () => {
    try {
      const response = await fetch(RATE_URL);
      if (!response.ok) throw new Error(`Exchange-rate request failed with ${response.status}`);
      const data = await response.json() as { rates?: Record<string, number> };
      const rates = { ...FALLBACK_CURRENCY_RATES };

      for (const [code, value] of Object.entries(data.rates ?? {})) {
        if (Number.isFinite(value) && value > 0) rates[code.toUpperCase()] = value;
      }
      rates.USD = 1;
      cachedRates = { rates, expiresAt: Date.now() + CACHE_TTL_MS };
      return rates;
    } catch (error) {
      console.warn("[net-worth] Exchange rates unavailable; using the app fallback rates.", error);
      return cachedRates?.rates ?? FALLBACK_CURRENCY_RATES;
    } finally {
      pendingFetch = null;
    }
  })();

  return pendingFetch;
}

export async function getCurrencyRatesFor(
  currencies: Iterable<string | null | undefined>,
): Promise<CurrencyRates> {
  const needsLiveRates = Array.from(currencies).some(
    (currency) => (currency ?? "USD").trim().toUpperCase() !== "USD",
  );
  return needsLiveRates ? getCurrencyRates() : FALLBACK_CURRENCY_RATES;
}

/** Converts an amount quoted in a currency-per-USD rate table into USD. */
export function convertToUsd(
  amount: number,
  currency: string | null | undefined,
  rates: CurrencyRates,
): number {
  const code = (currency ?? "USD").trim().toUpperCase() || "USD";
  if (code === "USD") return amount;

  const rate = rates[code];
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No USD-base exchange rate is available for "${code}".`);
  }
  return amount / rate;
}

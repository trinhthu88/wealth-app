export const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  VND: 25400,
  EUR: 0.92,
};

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number> = FALLBACK_RATES
): number {
  if (fromCurrency === toCurrency) return amount;
  const inUsd = amount / (rates[fromCurrency] || 1);
  return inUsd * (rates[toCurrency] || 1);
}

export function formatCurrency(
  amount: number,
  currency: string,
  compact = false
): string {
  const symbols: Record<string, string> = { USD: "$", VND: "₫", EUR: "€" };
  const symbol = symbols[currency] || currency;
  const decimals = currency === "VND" ? 0 : 2;

  if (compact && Math.abs(amount) >= 1_000_000) {
    return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (compact && Math.abs(amount) >= 1_000) {
    return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  }
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatPct(value: number, decimals = 1): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

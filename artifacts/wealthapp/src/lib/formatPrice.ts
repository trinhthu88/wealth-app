/** The number of minor units in a currency: 2 for USD, 0 for VND, which Stripe sends whole. */
function fractionDigits(currency: string): number {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Formats an amount as Stripe sends it, in the currency's smallest unit. */
export function formatStripeAmount(amount: number, currency: string): string {
  const digits = fractionDigits(currency);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(amount / 10 ** digits);
}

/** The percentage saved by paying annually, or null if there is no saving to claim. */
export function annualSavingPct(monthly: number, annual: number): number | null {
  if (monthly <= 0) return null;
  const pct = Math.round((1 - annual / (monthly * 12)) * 100);
  return pct > 0 ? pct : null;
}

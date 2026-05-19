export function calculatePackageCurrentValue(
  allocations: Array<{ fund_id: string; units_held: number }>,
  latestPrices: Record<string, number>,
): number {
  return allocations.reduce((total, alloc) => {
    const price = latestPrices[alloc.fund_id] || 0;
    return total + alloc.units_held * price;
  }, 0);
}

export function calculateTotalInvested(
  transactions: Array<{ transaction_type: string; amount_usd: number }>,
): number {
  const inflows = [
    "initial_investment",
    "monthly_contribution",
    "top_up",
    "dividend_reinvested",
  ];
  const outflows = ["withdrawal", "fee_charged"];
  return transactions.reduce((total, tx) => {
    if (inflows.includes(tx.transaction_type)) return total + tx.amount_usd;
    if (outflows.includes(tx.transaction_type)) return total - tx.amount_usd;
    return total;
  }, 0);
}

export function buildFundBreakdown(
  allocations: Array<{ fund_id: string; units_held: number; weight_percent: number }>,
  funds: Array<{ id: string; name: string; ticker: string; asset_class: string }>,
  latestPrices: Record<string, number>,
  totalValue: number,
) {
  return allocations.map((alloc) => {
    const fund = funds.find((f) => f.id === alloc.fund_id);
    const priceUsd = latestPrices[alloc.fund_id] || 0;
    const valueUsd = alloc.units_held * priceUsd;
    return {
      fund_id: alloc.fund_id,
      fund_name: fund?.name || "Unknown",
      ticker: fund?.ticker || "",
      asset_class: fund?.asset_class || "",
      units: alloc.units_held,
      price_usd: priceUsd,
      value_usd: valueUsd,
      weight_pct: totalValue > 0 ? (valueUsd / totalValue) * 100 : 0,
    };
  });
}

export const ASSET_CLASS_COLORS: Record<string, string> = {
  equity: "#1D9E75",
  bond: "#042C53",
  cash: "#94A3B8",
  real_estate: "#F59E0B",
  commodity: "#8B5CF6",
  alternative: "#EC4899",
};

export function fmtCurrency(n: number, currency = "USD"): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtReturn(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

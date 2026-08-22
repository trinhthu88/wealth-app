import { eq, and, inArray } from "drizzle-orm";
import {
  db, clientHoldingsTable, advisedPlansTable, advisedStrategyReturnsTable, priceCacheTable,
} from "@workspace/db";
import { resolveHoldingBenchmark } from "./benchmarks";
import { resolveHoldingValueUsd } from "./goalProgressSnapshot";

const TICKER_BASED_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond"]);

export interface BlendedRateResult {
  ratePct: number;
  totalValue: number;
}

/**
 * Value-weighted blended annual return across the client's whole portfolio,
 * resolved from real per-holding/per-plan rate sources — never a guessed default:
 *   - self-tracked holdings: resolveHoldingBenchmark() (client override → live
 *     ticker/crypto CAGR → asset-class benchmark), same function the holdings
 *     benchmark-preview UI uses
 *   - advised plans: advised_strategy_returns.targetAnnualReturnPct by planType
 * Falls back to profiles.investmentRatePercent's default (7.0) only if the
 * portfolio is empty (nothing to weight).
 *
 * Shared between the coast-point route and the investment-client health-score
 * route — both need the same real blended rate, not two independent guesses.
 */
export async function resolveBlendedRate(userId: string): Promise<BlendedRateResult> {
  const [holdings, plans] = await Promise.all([
    db.select().from(clientHoldingsTable)
      .where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.isActive, true))),
    db.select().from(advisedPlansTable)
      .where(and(eq(advisedPlansTable.userId, userId), eq(advisedPlansTable.status, "inforce"))),
  ]);

  let weightedSum = 0;
  let totalValue = 0;

  const symbols = holdings
    .filter(h => TICKER_BASED_TYPES.has(h.holdingType) || h.holdingType === "crypto")
    .map(h => (h.holdingType === "crypto" ? h.coinSymbol : h.ticker)?.toUpperCase())
    .filter((s): s is string => !!s);
  const priceRows = symbols.length > 0
    ? await db.select({ symbol: priceCacheTable.symbol, priceUsd: priceCacheTable.priceUsd })
        .from(priceCacheTable).where(inArray(priceCacheTable.symbol, symbols))
    : [];
  const priceBySymbol = new Map(priceRows.map(p => [p.symbol.toUpperCase(), parseFloat(p.priceUsd) || 0]));

  for (const h of holdings) {
    // Same valuation goalProgressSnapshot.ts uses for goal funding — units × live
    // price with cost-basis fallback for ticker/crypto types, direct balance fields
    // for cash/property/pension/other. Reused, not re-derived, so this can't drift
    // from the number the client sees on their Goals page for the same holding.
    const value = resolveHoldingValueUsd(h, priceBySymbol);
    if (value <= 0) continue;

    const { value: ratePct } = await resolveHoldingBenchmark({
      holdingType: h.holdingType, ticker: h.ticker, coinSymbol: h.coinSymbol,
      interestRatePct: h.interestRatePct, expectedAnnualReturnPct: h.expectedAnnualReturnPct,
    });
    weightedSum += value * ratePct;
    totalValue += value;
  }

  for (const p of plans) {
    const value = parseFloat(p.latestAccountValue ?? "0") || 0;
    if (value <= 0) continue;
    const [row] = await db.select().from(advisedStrategyReturnsTable)
      .where(eq(advisedStrategyReturnsTable.planType, p.planType));
    const ratePct = row ? parseFloat(row.targetAnnualReturnPct) : null;
    if (ratePct != null) { weightedSum += value * ratePct; totalValue += value; }
  }

  if (totalValue <= 0) {
    return { ratePct: 7.0, totalValue: 0 }; // no priced holdings yet — matches profiles.investmentRatePercent default
  }
  return { ratePct: weightedSum / totalValue, totalValue };
}

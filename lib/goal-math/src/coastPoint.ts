// "Coast point" — the date at which a portfolio's current value, left to compound
// alone at its blended growth rate with zero further contributions, would still
// reach the target amount by the target date. Before that date, contributions are
// still doing real work; after it, further contributions only pull the target date
// earlier or pad the eventual amount.
//
// This module only solves the date given a rate — it does not choose the rate.
// The caller resolves the blended rate from real per-holding/per-plan data
// (resolveHoldingBenchmark() for self-tracked holdings, advised_strategy_returns
// for advised plans — see api-server/src/lib/benchmarks.ts and the
// advised_strategy_returns table), value-weighted across the portfolio. Passing a
// guessed or default rate here defeats the purpose — the whole point is that this
// number is real.

export interface CoastPointInput {
  currentValue: number;
  targetAmount: number;
  targetDate: string;
  monthlyContribution: number;
  blendedAnnualReturnPct: number;
}

export interface CoastPointResult {
  /** True if currentValue already coasts to the target with zero more contributions. */
  canCoastNow: boolean;
  /** Month index (0 = this month) at which coasting becomes possible, or null if not reachable within the horizon even with full contributions. */
  coastMonthsFromNow: number | null;
  /** ISO date (yyyy-mm) for the coast point, or null if unreachable. */
  coastDate: string | null;
  /** Value at the coast point. */
  valueAtCoastPoint: number | null;
}

function monthsBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

/** Value today's balance alone reaches after `months` of compounding, no contributions. */
function growAlone(value: number, monthlyRate: number, months: number): number {
  return value * Math.pow(1 + monthlyRate, months);
}

export function solveCoastPoint(input: CoastPointInput): CoastPointResult {
  const { currentValue, targetAmount, targetDate, monthlyContribution, blendedAnnualReturnPct } = input;

  const today = new Date();
  const target = new Date(targetDate);
  const totalMonths = monthsBetween(today, target);
  const monthlyRate = blendedAnnualReturnPct / 100 / 12;

  if (totalMonths <= 0 || targetAmount <= 0) {
    return { canCoastNow: false, coastMonthsFromNow: null, coastDate: null, valueAtCoastPoint: null };
  }

  // Can we coast right now?
  if (growAlone(currentValue, monthlyRate, totalMonths) >= targetAmount) {
    return { canCoastNow: true, coastMonthsFromNow: 0, coastDate: today.toISOString().slice(0, 7), valueAtCoastPoint: currentValue };
  }

  // Walk forward month by month (still contributing each month) until the
  // running balance, left alone for the remaining months, would clear the target.
  // A linear scan is used rather than a closed-form solve: contributions make the
  // "balance if we stopped contributing at month k" function well-behaved
  // (non-decreasing in k) for realistic positive contributions, so this always
  // terminates and is easy to audit — no algebraic derivation to get subtly wrong
  // in a financial calculation a client will see.
  let balance = currentValue;
  for (let k = 1; k <= totalMonths; k++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    const remaining = totalMonths - k;
    if (growAlone(balance, monthlyRate, remaining) >= targetAmount) {
      return {
        canCoastNow: false,
        coastMonthsFromNow: k,
        coastDate: addMonths(today, k).toISOString().slice(0, 7),
        valueAtCoastPoint: balance,
      };
    }
  }

  // Even contributing every month through the target date doesn't clear it —
  // there's no coast point within this horizon at the given contribution rate.
  return { canCoastNow: false, coastMonthsFromNow: null, coastDate: null, valueAtCoastPoint: null };
}

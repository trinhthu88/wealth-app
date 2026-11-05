/**
 * Future value of equal monthly contributions, made at the end of each month.
 * The annual target return is converted to a nominal monthly rate, matching the
 * app's other monthly projection calculations. This is an illustration only.
 */
export function projectRegularSavings(
  monthlyContribution: number,
  annualReturnPct: number,
  years: number,
): number {
  const monthlyRate = annualReturnPct / 100 / 12;
  if (
    !Number.isFinite(monthlyContribution) || monthlyContribution < 0
    || !Number.isFinite(annualReturnPct) || monthlyRate <= -1
    || !Number.isFinite(years) || years < 0
  ) {
    throw new RangeError("Projection inputs must be finite and non-negative where applicable");
  }

  let balance = 0;
  for (let month = 0; month < Math.trunc(years * 12); month += 1) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
  }
  return Math.round((balance + Number.EPSILON) * 100) / 100;
}

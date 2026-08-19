// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: BottomSheet spring animation (open/close)
// ✓ ALLOWED: Single item appearing after user action (e.g. new holding added to list)
// ✓ ALLOWED: Chart/number counting animation on first load
// ✗ BANNED:  Page-load stagger (no initial opacity:0 + animate opacity:1 on page content)
// ✗ BANNED:  Orchestrated delays (no transition={{ delay: 0.05 * index }})
// ✗ BANNED:  Hero cards with gradient navy background (#042C53 → #0a4a8a)
//            Use stat cards with white bg + teal accent border instead.

// ── Advised plan calculations ──────────────────────────────────

export function calcPlanGainLoss(
  currentValue: number,
  netContribution: number
): { gainLoss: number; gainLossPct: number } {
  const gainLoss = currentValue - netContribution;
  const gainLossPct = netContribution > 0
    ? ((currentValue - netContribution) / netContribution) * 100
    : 0;
  return { gainLoss, gainLossPct };
}

export function calcCAGR(
  currentValue: number,
  netContribution: number,
  effectiveDate: string
): number {
  if (netContribution <= 0 || currentValue <= 0) return 0;
  const years = (Date.now() - new Date(effectiveDate).getTime())
    / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 0.1) return 0;
  return (Math.pow(currentValue / netContribution, 1 / years) - 1) * 100;
}

export function calcPeriodReturn(
  investmentReturns: number,
  openingValue: number
): number {
  if (openingValue <= 0) return 0;
  return (investmentReturns / openingValue) * 100;
}

export function calcTotalFees(statement: {
  policy_fee: number;
  asset_management_fee: number;
  admin_charges: number;
  advisory_services_fee: number;
  bid_offer_spread: number;
}): number {
  return Math.abs(statement.policy_fee || 0)
    + Math.abs(statement.asset_management_fee || 0)
    + Math.abs(statement.admin_charges || 0)
    + Math.abs(statement.advisory_services_fee || 0)
    + Math.abs(statement.bid_offer_spread || 0);
}

// ── Self-holding calculations ───────────────────────────────────

export function calcHoldingCurrentValue(
  unitsHeld: number,
  currentPrice: number
): number {
  return unitsHeld * currentPrice;
}

export function calcHoldingGainLoss(
  unitsHeld: number,
  averageCostPrice: number,
  currentPrice: number
): { costBasis: number; currentValue: number; gainLoss: number; gainLossPct: number } {
  const costBasis = unitsHeld * averageCostPrice;
  const currentValue = unitsHeld * currentPrice;
  const gainLoss = currentValue - costBasis;
  const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
  return { costBasis, currentValue, gainLoss, gainLossPct };
}

// Recovering from a d% drop requires growing by a factor of 1/(1-d), not 1+d
// (e.g. a 50% drop needs a 100% gain to recover, not a 50% gain). This is the
// one formula from the Phase 2 bugfix — kept here, next to the scenario engine
// that actually ships to users, rather than in the unused lib/investmentGoalProjection.ts.
export function calcMarketDropRecoveryMonths(dropPct: number, annualReturnPct: number): number {
  const monthlyRate = annualReturnPct / 100 / 12;
  if (monthlyRate <= 0 || dropPct <= 0) return 0;
  return Math.ceil(Math.log(1 / (1 - dropPct / 100)) / Math.log(1 + monthlyRate));
}

// ── Scenario projection ──────────────────────────────────────────

export function projectMonthlyGrowth(
  currentValue: number,
  monthlyContrib: number,
  annualReturnPct: number,
  months: number
): Array<{ month: number; value: number }> {
  const monthlyRate = annualReturnPct / 100 / 12;
  const result = [];
  let value = currentValue;
  for (let m = 0; m <= months; m++) {
    result.push({ month: m, value: Math.round(value) });
    value = value * (1 + monthlyRate) + monthlyContrib;
  }
  return result;
}

// ── Scenario types ────────────────────────────────────────────────

export type ScenarioParams =
  | { type: "increase_monthly";    currentValue: number; currentMonthly: number; newMonthly: number;       annualReturnPct: number; months: number }
  | { type: "add_lump_sum";        currentValue: number; currentMonthly: number; lumpSumAmount: number; lumpSumDelayMonths: number; annualReturnPct: number; months: number }
  | { type: "reduce_monthly";      currentValue: number; currentMonthly: number; newMonthly: number;       annualReturnPct: number; months: number }
  | { type: "pause_contributions"; currentValue: number; currentMonthly: number; pauseMonths: number;      annualReturnPct: number; months: number }
  | { type: "market_drop";         currentValue: number; currentMonthly: number; dropPct: number; recoveryMonths: number; annualReturnPct: number; months: number }
  | { type: "retire_earlier";      currentValue: number; currentMonthly: number; targetAmount: number; currentTargetMonths: number; newTargetMonths: number; annualReturnPct: number };

export interface ScenarioDataPoint {
  month: number;
  label: string;
  baseline: number;
  scenario: number;
}

export interface ScenarioResult {
  params: ScenarioParams;
  dataPoints: ScenarioDataPoint[];
  baselineFinalValue: number;
  scenarioFinalValue: number;
  deltaValue: number;
  deltaPct: number;
  monthsToGoalBaseline: number | null;
  monthsToGoalScenario: number | null;
  yearsSavedOrLost: number | null;
  requiredMonthly?: number;
  extraMonthly?: number;
  lumpSumDelayMonths?: number;
}

function monthLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function buildResult(
  params: ScenarioParams,
  baselineRaw: Array<{ month: number; value: number }>,
  scenarioRaw: Array<{ month: number; value: number }>
): ScenarioResult {
  const dataPoints: ScenarioDataPoint[] = baselineRaw.map((b, i) => ({
    month: b.month,
    label: monthLabel(b.month),
    baseline: b.value,
    scenario: scenarioRaw[i]?.value ?? scenarioRaw[scenarioRaw.length - 1].value,
  }));
  const baselineFinal = dataPoints[dataPoints.length - 1].baseline;
  const scenarioFinal = dataPoints[dataPoints.length - 1].scenario;
  return {
    params, dataPoints, baselineFinalValue: baselineFinal, scenarioFinalValue: scenarioFinal,
    deltaValue: scenarioFinal - baselineFinal,
    deltaPct: baselineFinal > 0 ? ((scenarioFinal - baselineFinal) / baselineFinal) * 100 : 0,
    monthsToGoalBaseline: null, monthsToGoalScenario: null, yearsSavedOrLost: null,
  };
}

export function runScenario(params: ScenarioParams): ScenarioResult {
  switch (params.type) {
    case "increase_monthly": {
      const baseline = projectMonthlyGrowth(params.currentValue, params.currentMonthly, params.annualReturnPct, params.months);
      const scenario = projectMonthlyGrowth(params.currentValue, params.newMonthly, params.annualReturnPct, params.months);
      return buildResult(params, baseline, scenario);
    }
    case "add_lump_sum": {
      const baseline = projectMonthlyGrowth(params.currentValue, params.currentMonthly, params.annualReturnPct, params.months);
      // Lump sum added at delay month
      const delay = params.lumpSumDelayMonths ?? 0;
      let scenarioRaw: Array<{ month: number; value: number }>;
      if (delay === 0) {
        scenarioRaw = projectMonthlyGrowth(params.currentValue + params.lumpSumAmount, params.currentMonthly, params.annualReturnPct, params.months);
      } else {
        const phase1 = projectMonthlyGrowth(params.currentValue, params.currentMonthly, params.annualReturnPct, delay);
        const phase1Final = phase1[phase1.length - 1].value;
        const phase2 = projectMonthlyGrowth(phase1Final + params.lumpSumAmount, params.currentMonthly, params.annualReturnPct, params.months - delay);
        scenarioRaw = [...phase1, ...phase2.slice(1).map(pt => ({ month: pt.month + delay, value: pt.value }))];
      }
      const result = buildResult(params, baseline, scenarioRaw);
      result.lumpSumDelayMonths = delay;
      return result;
    }
    case "reduce_monthly": {
      const baseline = projectMonthlyGrowth(params.currentValue, params.currentMonthly, params.annualReturnPct, params.months);
      const scenario = projectMonthlyGrowth(params.currentValue, params.newMonthly, params.annualReturnPct, params.months);
      return buildResult(params, baseline, scenario);
    }
    case "pause_contributions": {
      const baseline = projectMonthlyGrowth(params.currentValue, params.currentMonthly, params.annualReturnPct, params.months);
      const phase1 = projectMonthlyGrowth(params.currentValue, 0, params.annualReturnPct, params.pauseMonths);
      const phase1Final = phase1[phase1.length - 1].value;
      const remainingMonths = Math.max(0, params.months - params.pauseMonths);
      const phase2 = projectMonthlyGrowth(phase1Final, params.currentMonthly, params.annualReturnPct, remainingMonths);
      const scenarioRaw = [...phase1, ...phase2.slice(1).map(pt => ({ month: pt.month + params.pauseMonths, value: pt.value }))];
      return buildResult(params, baseline, scenarioRaw);
    }
    case "market_drop": {
      const baseline = projectMonthlyGrowth(params.currentValue, params.currentMonthly, params.annualReturnPct, params.months);
      const droppedValue = Math.round(params.currentValue * (1 - params.dropPct / 100));
      const phase2 = projectMonthlyGrowth(droppedValue, params.currentMonthly, 0, params.recoveryMonths);
      const phase2Final = phase2[phase2.length - 1].value;
      const remainingMonths = Math.max(0, params.months - params.recoveryMonths);
      const phase3 = projectMonthlyGrowth(phase2Final, params.currentMonthly, params.annualReturnPct, remainingMonths);
      const scenarioValues = [
        droppedValue,
        ...phase2.slice(1).map(pt => pt.value),
        ...phase3.slice(1).map(pt => pt.value),
      ];
      const dataPoints: ScenarioDataPoint[] = baseline.map((b, i) => ({
        month: b.month,
        label: monthLabel(b.month),
        baseline: b.value,
        scenario: scenarioValues[i] ?? scenarioValues[scenarioValues.length - 1],
      }));
      const bFinal = dataPoints[dataPoints.length - 1].baseline;
      const sFinal = dataPoints[dataPoints.length - 1].scenario;
      return {
        params, dataPoints, baselineFinalValue: bFinal, scenarioFinalValue: sFinal,
        deltaValue: sFinal - bFinal, deltaPct: bFinal > 0 ? ((sFinal - bFinal) / bFinal) * 100 : 0,
        monthsToGoalBaseline: null, monthsToGoalScenario: null, yearsSavedOrLost: null,
      };
    }
    case "retire_earlier": {
      const monthlyRate = params.annualReturnPct / 100 / 12;
      const baselineRaw = projectMonthlyGrowth(params.currentValue, params.currentMonthly, params.annualReturnPct, params.currentTargetMonths);

      // Find month when baseline reaches target
      let monthsToGoalBaseline: number | null = null;
      for (let i = 0; i < baselineRaw.length; i++) {
        if (baselineRaw[i].value >= params.targetAmount) { monthsToGoalBaseline = i; break; }
      }

      // Binary search for required monthly
      let lo = 0, hi = params.currentMonthly * 20, requiredMonthly = params.currentMonthly;
      for (let iter = 0; iter < 60; iter++) {
        const mid = (lo + hi) / 2;
        let v = params.currentValue;
        for (let m = 1; m <= params.newTargetMonths; m++) v = v * (1 + monthlyRate) + mid;
        if (v >= params.targetAmount) { requiredMonthly = mid; hi = mid; }
        else lo = mid;
        if (hi - lo < 0.5) break;
      }

      const scenarioRaw = projectMonthlyGrowth(params.currentValue, requiredMonthly, params.annualReturnPct, params.currentTargetMonths);
      const dataPoints: ScenarioDataPoint[] = baselineRaw.map((b, i) => ({
        month: b.month,
        label: monthLabel(b.month),
        baseline: b.value,
        scenario: scenarioRaw[i]?.value ?? scenarioRaw[scenarioRaw.length - 1].value,
      }));
      const bFinal = dataPoints[dataPoints.length - 1].baseline;
      const sFinal = dataPoints[dataPoints.length - 1].scenario;
      const yearsSaved = monthsToGoalBaseline != null ? (monthsToGoalBaseline - params.newTargetMonths) / 12 : null;
      return {
        params, dataPoints, baselineFinalValue: bFinal, scenarioFinalValue: sFinal,
        deltaValue: sFinal - bFinal, deltaPct: bFinal > 0 ? ((sFinal - bFinal) / bFinal) * 100 : 0,
        monthsToGoalBaseline, monthsToGoalScenario: params.newTargetMonths, yearsSavedOrLost: yearsSaved,
        requiredMonthly: Math.round(requiredMonthly),
        extraMonthly: Math.round(requiredMonthly - params.currentMonthly),
      };
    }
  }
}

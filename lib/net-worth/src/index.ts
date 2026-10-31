import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  advisedPlansTable,
  assetsTable,
  clientHoldingsTable,
  liabilitiesTable,
  netWorthSnapshotsTable,
  priceCacheTable,
  profilesTable,
} from "@workspace/db";
import { convertToUsd, getCurrencyRatesFor, type CurrencyRates } from "./currencyRates";

export {
  convertToUsd,
  getCurrencyRates,
  getCurrencyRatesFor,
  FALLBACK_CURRENCY_RATES,
} from "./currencyRates";
export type { CurrencyRates } from "./currencyRates";

export const TICKER_BASED_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond"]);

type HoldingValueInput = Pick<
  typeof clientHoldingsTable.$inferSelect,
  | "holdingType"
  | "unitsHeld"
  | "averageCostPrice"
  | "ticker"
  | "coinSymbol"
  | "currentEstimatedValue"
  | "currentBalance"
  | "currentBalancePension"
  | "currentValueOther"
  | "currency"
>;

/** The shared current-value rule for self-managed holdings and goal funding. */
export function valueOfHolding(
  holding: HoldingValueInput,
  priceBySymbol: Map<string, number>,
  rates: CurrencyRates,
): number {
  const type = holding.holdingType;
  if (TICKER_BASED_TYPES.has(type) || type === "crypto") {
    const symbol = (type === "crypto" ? holding.coinSymbol : holding.ticker)?.toUpperCase() ?? "";
    const units = Number.parseFloat(holding.unitsHeld ?? "0") || 0;
    const averageCost = Number.parseFloat(holding.averageCostPrice ?? "0") || 0;
    const marketPriceUsd = priceBySymbol.get(symbol);
    return units * (marketPriceUsd ?? convertToUsd(averageCost, holding.currency, rates));
  }
  if (type === "property") {
    return convertToUsd(Number.parseFloat(holding.currentEstimatedValue ?? "0") || 0, holding.currency, rates);
  }
  if (type === "cash") {
    return convertToUsd(Number.parseFloat(holding.currentBalance ?? "0") || 0, holding.currency, rates);
  }
  if (type === "pension") {
    return convertToUsd(Number.parseFloat(holding.currentBalancePension ?? "0") || 0, holding.currency, rates);
  }
  return convertToUsd(Number.parseFloat(holding.currentValueOther ?? "0") || 0, holding.currency, rates);
}

export type NetWorthItemSource = "holding" | "advised_plan" | "asset" | "liability" | "mortgage";

export interface NetWorthItem {
  source: NetWorthItemSource;
  id: string;
  label: string;
  category: string;
  value: number;
  currency: "USD";
}

export interface NetWorthSummary {
  asOf: string;
  currency: "USD";
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  portfolio: {
    selfManaged: number;
    advised: number;
    total: number;
  };
  items: NetWorthItem[];
}

export async function computeNetWorth(
  userId: string,
  options: { currency?: string } = {},
): Promise<NetWorthSummary> {
  const currency = options.currency ?? "USD";
  if (currency !== "USD") {
    throw new Error(`Unsupported net-worth currency "${currency}"; source values are USD.`);
  }

  const [holdings, plans, assets, liabilities] = await Promise.all([
    db.select().from(clientHoldingsTable)
      .where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.isActive, true))),
    db.select().from(advisedPlansTable)
      .where(and(
        eq(advisedPlansTable.userId, userId),
        eq(advisedPlansTable.status, "inforce"),
        eq(advisedPlansTable.isVisibleToClient, true),
      )),
    db.select().from(assetsTable).where(eq(assetsTable.userId, userId)),
    db.select().from(liabilitiesTable).where(eq(liabilitiesTable.userId, userId)),
  ]);
  const rates = await getCurrencyRatesFor([
    ...holdings.map((holding) => holding.currency),
    ...plans.map((plan) => plan.currency),
    ...assets.map((asset) => asset.currencyOriginal),
    ...liabilities.map((liability) => liability.currencyOriginal),
  ]);

  const symbols = holdings
    .filter((holding) => TICKER_BASED_TYPES.has(holding.holdingType) || holding.holdingType === "crypto")
    .map((holding) => (holding.holdingType === "crypto" ? holding.coinSymbol : holding.ticker)?.toUpperCase())
    .filter((symbol): symbol is string => Boolean(symbol));
  const prices = symbols.length > 0
    ? await db.select({ symbol: priceCacheTable.symbol, priceUsd: priceCacheTable.priceUsd })
        .from(priceCacheTable)
        .where(inArray(priceCacheTable.symbol, symbols))
    : [];
  const priceBySymbol = new Map(prices.map((price) => [
    price.symbol.toUpperCase(),
    Number.parseFloat(price.priceUsd) || 0,
  ]));

  const holdingItems: NetWorthItem[] = holdings.map((holding) => ({
    source: "holding",
    id: holding.id,
    label: holding.label,
    category: holding.holdingType,
    value: valueOfHolding(holding, priceBySymbol, rates),
    currency: "USD",
  }));
  const planItems: NetWorthItem[] = plans.map((plan) => ({
    source: "advised_plan",
    id: plan.id,
    label: plan.nickname ?? plan.productName,
    category: "investment",
    value: convertToUsd(
      Number.parseFloat(plan.latestAccountValue ?? "0") || 0,
      plan.currency,
      rates,
    ),
    currency: "USD",
  }));
  const assetItems: NetWorthItem[] = assets.map((asset) => ({
    source: "asset",
    id: asset.id,
    label: asset.name,
    category: asset.category,
    value: convertToUsd(
      Number.parseFloat(asset.valueOriginal ?? asset.valueUsd ?? "0") || 0,
      asset.currencyOriginal,
      rates,
    ),
    currency: "USD",
  }));
  const liabilityItems: NetWorthItem[] = liabilities.map((liability) => ({
    source: "liability",
    id: liability.id,
    label: liability.name,
    category: liability.category,
    value: convertToUsd(
      Number.parseFloat(liability.balanceOriginal ?? liability.balanceUsd ?? "0") || 0,
      liability.currencyOriginal,
      rates,
    ),
    currency: "USD",
  }));
  const mortgageItems: NetWorthItem[] = holdings.flatMap((holding) => {
    const mortgage = convertToUsd(
      Number.parseFloat(holding.outstandingMortgage ?? "0") || 0,
      holding.currency,
      rates,
    );
    if (!holding.isActive || holding.holdingType !== "property" || mortgage <= 0) return [];
    return [{
      source: "mortgage" as const,
      id: holding.id,
      label: `${holding.label} mortgage`,
      category: "mortgage",
      value: mortgage,
      currency: "USD" as const,
    }];
  });

  const selfManaged = holdingItems.reduce((sum, item) => sum + item.value, 0);
  const advised = planItems.reduce((sum, item) => sum + item.value, 0);
  const manualAssets = assetItems.reduce((sum, item) => sum + item.value, 0);
  const manualLiabilities = liabilityItems.reduce((sum, item) => sum + item.value, 0);
  const mortgageLiabilities = mortgageItems.reduce((sum, item) => sum + item.value, 0);
  const totalAssets = selfManaged + advised + manualAssets;
  const totalLiabilities = manualLiabilities + mortgageLiabilities;
  const netWorth = totalAssets - totalLiabilities;
  const asOf = new Date().toISOString().slice(0, 10);

  await db.insert(netWorthSnapshotsTable).values({
    userId,
    snapshotDate: asOf,
    totalAssetsUsd: String(totalAssets),
    totalLiabilitiesUsd: String(totalLiabilities),
    netWorthUsd: String(netWorth),
    createdBy: "server",
  }).onConflictDoUpdate({
    target: [netWorthSnapshotsTable.userId, netWorthSnapshotsTable.snapshotDate],
    set: {
      totalAssetsUsd: String(totalAssets),
      totalLiabilitiesUsd: String(totalLiabilities),
      netWorthUsd: String(netWorth),
      createdBy: "server",
    },
  });

  return {
    asOf,
    currency: "USD",
    totalAssets,
    totalLiabilities,
    netWorth,
    portfolio: { selfManaged, advised, total: selfManaged + advised },
    items: [...holdingItems, ...planItems, ...assetItems, ...liabilityItems, ...mortgageItems],
  };
}

export async function computeAndSnapshotAllInvestmentClients(): Promise<number> {
  const clients = await db.select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.role, "investment_client"));
  for (const client of clients) await computeNetWorth(client.id, { currency: "USD" });
  return clients.length;
}

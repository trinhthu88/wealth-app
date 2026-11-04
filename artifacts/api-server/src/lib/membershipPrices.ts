import { eq } from "drizzle-orm";
import { db, membershipSettingsTable } from "@workspace/db";
import type { MembershipPlan } from "@workspace/tier-policy";
import { getPaymentProvider, type ProviderPriceDetail } from "./payments";

/**
 * The provider owns the amount; the admin only chooses which of its prices the app sells. The settings
 * row is read fresh every time, so a change reaches every instance at once. Only the provider's price
 * objects are cached, by id, so the amount shown and the price charged come from the same selection.
 */
const PRICE_CACHE_MS = 5 * 60 * 1000;
const priceCache = new Map<string, { price: ProviderPriceDetail; fetchedAt: number }>();

export type PriceSource = "settings" | "env";
export interface ConfiguredPrices {
  monthlyPriceId: string;
  annualPriceId: string;
  source: PriceSource;
}

/** The settings row, else the provider's env prices. Null when neither names both prices. */
export async function getConfiguredPrices(): Promise<ConfiguredPrices | null> {
  const [row] = await db.select().from(membershipSettingsTable).where(eq(membershipSettingsTable.id, 1));
  if (row) return { monthlyPriceId: row.monthlyPriceId, annualPriceId: row.annualPriceId, source: "settings" };
  const fromEnv = getPaymentProvider().envPriceIds();
  return fromEnv ? { ...fromEnv, source: "env" } : null;
}

export function priceIdForPlan(prices: ConfiguredPrices, plan: MembershipPlan): string {
  return plan === "member_annual" ? prices.annualPriceId : prices.monthlyPriceId;
}

async function getPriceCached(id: string): Promise<ProviderPriceDetail> {
  const provider = getPaymentProvider();
  const key = `${provider.name}:${id}`;
  const hit = priceCache.get(key);
  if (hit && Date.now() - hit.fetchedAt < PRICE_CACHE_MS) return hit.price;
  const price = await provider.getPrice(id);
  priceCache.set(key, { price, fetchedAt: Date.now() });
  return price;
}

function describe(price: ProviderPriceDetail, plan: MembershipPlan, label: string) {
  return {
    plan,
    priceId: price.id,
    label,
    amount: price.unitAmount,
    currency: price.currency,
    interval: price.interval,
    active: price.active,
  };
}

/** What GET /billing/prices answers. Null when no prices are configured. */
export async function getBillingPrices() {
  const configured = await getConfiguredPrices();
  if (!configured) return null;
  const [monthly, annual] = await Promise.all([
    getPriceCached(configured.monthlyPriceId),
    getPriceCached(configured.annualPriceId),
  ]);
  return {
    monthly: describe(monthly, "member_monthly", "Monthly"),
    annual: describe(annual, "member_annual", "Annual"),
    source: configured.source,
  };
}

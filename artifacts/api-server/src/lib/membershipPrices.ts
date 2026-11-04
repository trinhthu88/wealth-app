import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, membershipSettingsTable } from "@workspace/db";
import type { MembershipPlan } from "@workspace/tier-policy";
import { getStripe } from "./stripe";

/**
 * Stripe owns the amount; the admin only chooses which Stripe price the app sells. The settings row
 * is read fresh every time, so a change reaches every instance at once. Only Stripe's price objects
 * are cached, by id, so the amount shown and the price charged always come from the same selection.
 */
const PRICE_CACHE_MS = 5 * 60 * 1000;
const priceCache = new Map<string, { price: Stripe.Price; fetchedAt: number }>();

export type PriceSource = "settings" | "env";
export interface ConfiguredPrices {
  monthlyPriceId: string;
  annualPriceId: string;
  source: PriceSource;
}

/** The settings row, else the env vars. Null when neither names both prices. */
export async function getConfiguredPrices(): Promise<ConfiguredPrices | null> {
  const [row] = await db.select().from(membershipSettingsTable).where(eq(membershipSettingsTable.id, 1));
  if (row) return { monthlyPriceId: row.monthlyPriceId, annualPriceId: row.annualPriceId, source: "settings" };
  const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY;
  const annualPriceId = process.env.STRIPE_PRICE_ANNUAL;
  return monthlyPriceId && annualPriceId ? { monthlyPriceId, annualPriceId, source: "env" } : null;
}

export function priceIdForPlan(prices: ConfiguredPrices, plan: MembershipPlan): string {
  return plan === "member_annual" ? prices.annualPriceId : prices.monthlyPriceId;
}

async function getPriceCached(id: string): Promise<Stripe.Price> {
  const hit = priceCache.get(id);
  if (hit && Date.now() - hit.fetchedAt < PRICE_CACHE_MS) return hit.price;
  const price = await getStripe().prices.retrieve(id);
  priceCache.set(id, { price, fetchedAt: Date.now() });
  return price;
}

function describe(price: Stripe.Price, plan: MembershipPlan, label: string) {
  return {
    plan,
    priceId: price.id,
    label,
    amount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval ?? null,
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

/** Why this price can't be sold on this plan, or null if it can. */
export function priceProblem(price: Stripe.Price, interval: "month" | "year"): string | null {
  if (!price.active) return `${price.id} is not active in Stripe.`;
  if (price.type !== "recurring" || !price.recurring) return `${price.id} is not a recurring price.`;
  if (price.recurring.interval !== interval || price.recurring.interval_count !== 1) {
    return `${price.id} does not bill once a ${interval}.`;
  }
  // These would leave no single amount to show the member before they pay.
  if (price.unit_amount === null || price.recurring.usage_type === "metered") {
    return `${price.id} does not have a fixed amount.`;
  }
  const product = price.product;
  if (typeof product === "object" && "active" in product && !product.active) {
    return `${price.id} belongs to a product that is not active in Stripe.`;
  }
  return null;
}

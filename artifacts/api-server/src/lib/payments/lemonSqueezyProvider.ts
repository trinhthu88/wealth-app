import { createHmac, timingSafeEqual } from "node:crypto";
import { TRIAL_DAYS, type MembershipStatus } from "@workspace/tier-policy";
import {
  PriceNotFoundError,
  type BillingInterval, type CheckoutInput, type PaymentProvider, type ProviderCheckout, type ProviderEvent,
  type ProviderPrice, type ProviderPriceDetail, type ProviderSubscription,
} from "./provider";

const API = "https://api.lemonsqueezy.com/v1";
const CHECKOUT_LIFETIME_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;

const SUBSCRIPTION_EVENTS = new Set([
  "subscription_created", "subscription_updated", "subscription_cancelled", "subscription_resumed",
  "subscription_expired", "subscription_paused", "subscription_unpaused",
]);
// These deliver a subscription invoice, so data.id is the invoice and the subscription is an attribute.
const INVOICE_EVENTS = new Set([
  "subscription_payment_failed", "subscription_payment_success", "subscription_payment_recovered",
]);

class LemonSqueezyError extends Error {
  constructor(readonly status: number, path: string) {
    // The path only: never the key, and not the response, which could echo the request.
    super(`Lemon Squeezy answered ${status} for ${path.split("?")[0]}`);
    this.name = "LemonSqueezyError";
  }
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new LemonSqueezyError(res.status, path);
  return res.json();
}

/** Every row of a list, across pages. */
async function requestAll(path: string): Promise<any[]> {
  const rows: any[] = [];
  for (let page = 1; ; page++) {
    const body = await request(`${path}&page[size]=${PAGE_SIZE}&page[number]=${page}`);
    rows.push(...body.data);
    if (page >= (body.meta?.page?.lastPage ?? 1)) return rows;
  }
}

const storeId = () => process.env.LEMONSQUEEZY_STORE_ID ?? "";
const toDate = (value: string | null | undefined) => (value ? new Date(value) : null);

// Variants have no currency of their own, and a store's currency is set once, so one read is enough.
let cachedCurrency: { store: string; currency: string } | null = null;
async function storeCurrency(): Promise<string> {
  const id = storeId();
  if (cachedCurrency?.store === id) return cachedCurrency.currency;
  const body = await request(`/stores/${encodeURIComponent(id)}`);
  const store = body?.data;
  if (!store || Array.isArray(store) || typeof store !== "object" || String(store.id) !== id) {
    throw new Error("Lemon Squeezy store lookup did not return the requested single store.");
  }
  const currency = store.attributes?.currency;
  if (typeof currency !== "string" || !currency.trim()) {
    throw new Error("Lemon Squeezy store lookup did not include a currency.");
  }
  cachedCurrency = { store: id, currency: currency.toLowerCase() };
  return cachedCurrency.currency;
}

/**
 * The variant and its product, or PriceNotFoundError. A variant in another store on the same API key
 * counts as not found, since this store couldn't sell it.
 *
 * DECISION: amounts and billing come from the variant's own attributes. Lemon Squeezy has deprecated
 * them in favour of Price objects but still returns them, while its docs don't say how to pick a
 * variant's current row from the price history that replaces them.
 */
async function loadVariant(id: string): Promise<{ variant: any; product: any }> {
  let variant: any;
  let product: any;
  try {
    variant = (await request(`/variants/${encodeURIComponent(id)}`)).data;
    product = (await request(`/products/${encodeURIComponent(String(variant.attributes.product_id))}`)).data;
  } catch (err) {
    if (err instanceof LemonSqueezyError && err.status === 404) throw new PriceNotFoundError(id);
    throw err;
  }
  if (String(product.attributes.store_id) !== storeId()) throw new PriceNotFoundError(id);
  return { variant, product };
}

function toProviderPrice(variant: any, productName: string | null, currency: string): ProviderPrice {
  const a = variant.attributes;
  return {
    id: String(variant.id),
    productName,
    name: a.name ?? null,
    unitAmount: a.pay_what_you_want ? null : a.price ?? null,
    currency,
    interval: a.is_subscription ? a.interval ?? null : null,
  };
}

/**
 * The addendum's mapping. Paid-through is renews_at while on_trial or active, and ends_at when
 * cancelled. It is null while past_due, so the date already stored stands: renews_at then means the
 * next charge attempt, not a paid period. Null too once expired, which is over whatever the date says.
 */
export function mapSubscription(id: string, a: any, interval: string | null): ProviderSubscription {
  const statuses: Record<string, MembershipStatus> = {
    on_trial: "trialing", active: "active", past_due: "past_due", unpaid: "past_due",
    cancelled: "canceled", paused: "canceled", expired: "canceled",
  };
  const status = statuses[a.status] ?? "none";
  const paidThrough = a.status === "on_trial" ? toDate(a.renews_at ?? a.trial_ends_at)
    : a.status === "active" ? toDate(a.renews_at)
    : a.status === "cancelled" || a.status === "paused" ? toDate(a.ends_at)
    : null;
  return {
    id,
    customerId: String(a.customer_id),
    priceId: a.variant_id != null ? String(a.variant_id) : null,
    interval,
    status,
    paidThrough,
    trialEndsAt: toDate(a.trial_ends_at),
    // Access is still running out, and this is how the store tells that from having ended.
    cancelAtPeriodEnd: a.status === "cancelled",
    userId: null,
  };
}

export const lemonSqueezyProvider: PaymentProvider = {
  name: "lemonsqueezy",

  isConfigured() {
    return !!process.env.LEMONSQUEEZY_API_KEY && /^\d+$/.test(storeId());
  },

  async listPrices() {
    const [currency, products] = await Promise.all([
      storeCurrency(),
      requestAll(`/products?filter[store_id]=${encodeURIComponent(storeId())}`),
    ]);
    const published = products.filter((p) => p.attributes.status === "published");
    const lists = await Promise.all(published.map(async (product) => {
      const variants = await requestAll(`/variants?filter[product_id]=${encodeURIComponent(String(product.id))}&filter[status]=published`);
      return variants
        .filter((v) => v.attributes.is_subscription)
        .map((v) => toProviderPrice(v, product.attributes.name ?? null, currency));
    }));
    return lists.flat();
  },

  async getPrice(id): Promise<ProviderPriceDetail> {
    // In this order, so a variant from another store answers not found before the store is read.
    const { variant, product } = await loadVariant(id);
    const currency = await storeCurrency();
    return {
      ...toProviderPrice(variant, product.attributes.name ?? null, currency),
      active: variant.attributes.status === "published" && product.attributes.status === "published",
    };
  },

  async priceProblem(id, interval: BillingInterval) {
    const { variant, product } = await loadVariant(id);
    const a = variant.attributes;
    if (a.status !== "published") return `${id} is not published in Lemon Squeezy.`;
    if (product.attributes.status !== "published") return `${id} belongs to a product that is not published in Lemon Squeezy.`;
    if (!a.is_subscription) return `${id} is not a subscription variant.`;
    if (a.interval !== interval || a.interval_count !== 1) return `${id} does not bill once a ${interval}.`;
    if (a.pay_what_you_want || !a.price) return `${id} does not have a fixed amount.`;
    // The trial is set on the variant here, not at checkout, so the owner's decision is checked here.
    const trialDays = a.trial_interval === "day" ? a.trial_interval_count
      : a.trial_interval === "week" ? a.trial_interval_count * 7
      : null;
    if (!a.has_free_trial || trialDays !== TRIAL_DAYS) return `${id} must have a ${TRIAL_DAYS}-day free trial.`;
    return null;
  },

  envPriceIds() {
    // Lemon Squeezy's prices are chosen on /admin/membership only.
    return null;
  },

  async createCheckout({ userId, email, priceId, trialDays }: CheckoutInput): Promise<ProviderCheckout> {
    const expiresAt = new Date(Date.now() + CHECKOUT_LIFETIME_MS);
    const body = await request("/checkouts", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: { email, custom: { user_id: userId } },
            // The variant carries the 7-day trial, and this takes it away for a returning member.
            checkout_options: { skip_trial: trialDays <= 0 },
            product_options: { redirect_url: `${process.env.APP_URL}/billing/success` },
            expires_at: expiresAt.toISOString(),
          },
          relationships: {
            store: { data: { type: "stores", id: storeId() } },
            variant: { data: { type: "variants", id: priceId } },
          },
        },
      }),
    });
    return { url: body.data.attributes.url, sessionId: String(body.data.id), expiresAt };
  },

  async isCheckoutOpen(sessionId) {
    const body = await request(`/checkouts/${encodeURIComponent(sessionId)}`);
    const expires = toDate(body.data.attributes.expires_at);
    return !expires || expires > new Date();
  },

  async closeCheckout() {
    // Lemon Squeezy has no way to end a checkout early; it runs until expires_at.
  },

  async portalUrl(providerCustomerId) {
    const body = await request(`/customers/${encodeURIComponent(providerCustomerId)}`);
    const url = body.data.attributes.urls?.customer_portal;
    if (!url) throw new Error("This customer has no portal link");
    return url;
  },

  verifyWebhook(rawBody, headers): ProviderEvent {
    // An empty secret would let anyone sign, so it refuses rather than computing with one.
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) throw new Error("The webhook secret is not set");
    const signature = headers["x-signature"];
    if (typeof signature !== "string" || !signature) throw new Error("Missing signature");
    const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
    const given = Buffer.from(signature, "utf8");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new Error("Invalid signature");

    const payload = JSON.parse(rawBody.toString("utf8"));
    const type: string = payload.meta?.event_name ?? "";
    const data = payload.data ?? {};
    const subscriptionId = SUBSCRIPTION_EVENTS.has(type) ? data.id
      : INVOICE_EVENTS.has(type) ? data.attributes?.subscription_id
      : null;
    const userId = payload.meta?.custom_data?.user_id;
    return {
      // Lemon Squeezy events carry no id, so one is derived, as the addendum sets out.
      id: `${type}:${data.id}:${data.attributes?.updated_at}`,
      type,
      subscriptionId: subscriptionId != null ? String(subscriptionId) : null,
      userId: userId != null ? String(userId) : null,
    };
  },

  async fetchSubscription(id): Promise<ProviderSubscription> {
    const body = await request(`/subscriptions/${encodeURIComponent(id)}`);
    const a = body.data.attributes;
    let interval: string | null = null;
    try {
      interval = (await request(`/variants/${encodeURIComponent(String(a.variant_id))}`)).data.attributes.interval ?? null;
    } catch (err) {
      // A deleted variant only costs the plan label. Anything else is worth Lemon Squeezy's retry.
      if (!(err instanceof LemonSqueezyError && err.status === 404)) throw err;
    }
    return mapSubscription(String(body.data.id), a, interval);
  },
};

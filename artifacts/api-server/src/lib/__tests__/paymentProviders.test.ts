import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Stripe resources are faked, but its webhooks helper is the real one, so signatures are really checked.
const fakeStripe = vi.hoisted(() => ({ client: null as any }));
vi.mock("../stripe", () => ({ getStripe: () => fakeStripe.client }));

const { default: Stripe } = await import("stripe");
const { getPaymentProvider, PriceNotFoundError } = await import("../payments");
const { stripeProvider } = await import("../payments/stripeProvider");
const { lemonSqueezyProvider, mapSubscription } = await import("../payments/lemonSqueezyProvider");

const STRIPE_SECRET = "whsec_test_secret";
const LS_SECRET = "ls_test_secret";
const FUTURE = Math.floor(Date.now() / 1000) + 86_400;

function installStripe() {
  const stripePrice = {
    id: "price_m", active: true, type: "recurring", nickname: "Monthly", unit_amount: 700, currency: "usd",
    product: { id: "prod", name: "tala membership", active: true },
    recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
  };
  fakeStripe.client = {
    webhooks: new Stripe("sk_test_x").webhooks,
    prices: {
      list: async () => ({ data: [stripePrice] }),
      retrieve: async (id: string) => {
        if (id !== "price_m") throw Object.assign(new Error("missing"), { code: "resource_missing" });
        return stripePrice;
      },
    },
    checkout: { sessions: { create: async () => ({ id: "cs_1", url: "https://pay.test/1", expires_at: FUTURE }) } },
    billingPortal: { sessions: { create: async () => ({ url: "https://portal.test/1" }) } },
    subscriptions: {
      retrieve: async (id: string) => ({
        id, customer: "cus_1", status: "active", cancel_at_period_end: false, trial_end: null, metadata: { userId: "user_1" },
        items: { data: [{ current_period_start: FUTURE - 100, current_period_end: FUTURE, price: { id: "price_m", recurring: { interval: "month" } } }] },
      }),
    },
  };
}

const lsVariant = {
  id: "11",
  attributes: {
    product_id: 5, name: "Monthly", status: "published", price: 700, is_subscription: true, interval: "month", interval_count: 1,
    has_free_trial: true, trial_interval: "day", trial_interval_count: 7, pay_what_you_want: false,
  },
};
const lsRoutes: Record<string, unknown> = {
  "GET /stores/99": { data: { id: "99", attributes: { currency: "USD" } } },
  "GET /products?filter[store_id]=99&page[size]=100&page[number]=1": { data: [{ id: "5", attributes: { status: "published", name: "tala membership" } }], meta: { page: { lastPage: 1 } } },
  "GET /variants?filter[product_id]=5&filter[status]=published&page[size]=100&page[number]=1": { data: [lsVariant], meta: { page: { lastPage: 1 } } },
  "GET /variants/11": { data: lsVariant },
  "GET /products/5": { data: { id: "5", attributes: { store_id: 99, status: "published", name: "tala membership" } } },
  "GET /customers/cus_1": { data: { id: "cus_1", attributes: { urls: { customer_portal: "https://portal.test/1" } } } },
  "GET /subscriptions/sub_1": {
    data: { id: "sub_1", attributes: { customer_id: "cus_1", variant_id: 11, status: "active", renews_at: new Date(FUTURE * 1000).toISOString(), ends_at: null, trial_ends_at: null } },
  },
  "POST /checkouts": { data: { id: "ck_1", attributes: { url: "https://pay.test/1" } } },
};
let lsCalls: { key: string; init: RequestInit }[] = [];
function installLemonSqueezy() {
  lsCalls = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const key = `${init.method ?? "GET"} ${decodeURI(url).replace("https://api.lemonsqueezy.com/v1", "")}`;
    lsCalls.push({ key, init });
    const body = lsRoutes[key];
    return body
      ? new Response(JSON.stringify(body), { status: 200 })
      : new Response(JSON.stringify({ errors: [] }), { status: 404 });
  });
}

function stripeSigned(payload: string) {
  return { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: STRIPE_SECRET }) };
}
const lsSign = (payload: string, secret = LS_SECRET) => createHmac("sha256", secret).update(payload).digest("hex");

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", STRIPE_SECRET);
  vi.stubEnv("LEMONSQUEEZY_API_KEY", "ls_key_for_tests");
  vi.stubEnv("LEMONSQUEEZY_STORE_ID", "99");
  vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", LS_SECRET);
  vi.stubEnv("APP_URL", "https://app.test");
  installStripe();
  installLemonSqueezy();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const adapters = [
  {
    provider: stripeProvider, priceId: "price_m", subscriptionId: "sub_1", customerId: "cus_1",
    event: JSON.stringify({ id: "evt_1", object: "event", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } }),
    sign: stripeSigned, missing: {},
  },
  {
    provider: lemonSqueezyProvider, priceId: "11", subscriptionId: "sub_1", customerId: "cus_1",
    event: JSON.stringify({ meta: { event_name: "subscription_updated", custom_data: { user_id: "user_1" } }, data: { type: "subscriptions", id: "sub_1", attributes: { updated_at: "2026-11-04T00:00:00.000000Z" } } }),
    sign: (payload: string) => ({ "x-signature": lsSign(payload) }), missing: {},
  },
];

describe.each(adapters)("the PaymentProvider contract: $provider.name", ({ provider, priceId, subscriptionId, customerId, event, sign, missing }) => {
  it("reports whether its keys are set", () => {
    expect(provider.isConfigured()).toBe(true);
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("LEMONSQUEEZY_API_KEY", "");
    expect(provider.isConfigured()).toBe(false);
  });

  it("lists prices in one shape", async () => {
    const [price] = await provider.listPrices();
    expect(price).toEqual({ id: priceId, productName: "tala membership", name: "Monthly", unitAmount: 700, currency: "usd", interval: "month" });
  });

  it("reads one price, and says plainly when there's no such price", async () => {
    expect(await provider.getPrice(priceId)).toMatchObject({ id: priceId, unitAmount: 700, currency: "usd", interval: "month", active: true });
    await expect(provider.getPrice("nope")).rejects.toBeInstanceOf(PriceNotFoundError);
  });

  it("accepts a valid price and refuses the wrong interval", async () => {
    expect(await provider.priceProblem(priceId, "month")).toBeNull();
    expect(await provider.priceProblem(priceId, "year")).toMatch(/year/);
    await expect(provider.priceProblem("nope", "month")).rejects.toBeInstanceOf(PriceNotFoundError);
  });

  it("creates a checkout with a url, a session id and an expiry", async () => {
    const checkout = await provider.createCheckout({ userId: "user_1", email: "a@test.local", priceId, trialDays: 7 });
    expect(checkout.url).toBe("https://pay.test/1");
    expect(checkout.sessionId).toBeTruthy();
    expect(checkout.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("gives a portal url", async () => {
    expect(await provider.portalUrl(customerId)).toBe("https://portal.test/1");
  });

  it("re-reads a subscription in one shape", async () => {
    expect(await provider.fetchSubscription(subscriptionId)).toMatchObject({
      id: subscriptionId, customerId, priceId, interval: "month", status: "active", trialEndsAt: null, cancelAtPeriodEnd: false,
    });
  });

  describe("verifyWebhook", () => {
    it("accepts a valid signature and names the subscription", () => {
      const result = provider.verifyWebhook(Buffer.from(event), sign(event));
      expect(result.subscriptionId).toBe(subscriptionId);
      expect(result.id).toBeTruthy();
    });

    it("refuses a tampered body", () => {
      const headers = sign(event);
      expect(() => provider.verifyWebhook(Buffer.from(event.replace("sub_1", "sub_2")), headers)).toThrow();
    });

    it("refuses a missing header", () => {
      expect(() => provider.verifyWebhook(Buffer.from(event), missing)).toThrow();
    });
  });
});

describe("LemonSqueezyProvider", () => {
  const payload = (overrides: Record<string, unknown> = {}, name = "subscription_updated") => JSON.stringify({
    meta: { event_name: name, custom_data: { user_id: "user_1" } },
    data: { type: "subscriptions", id: "sub_1", attributes: { updated_at: "2026-11-04T00:00:00.000000Z", ...overrides } },
  });
  const verify = (body: string) => lemonSqueezyProvider.verifyWebhook(Buffer.from(body), { "x-signature": lsSign(body) });

  describe("configuration", () => {
    it("requires a non-empty API key and a digits-only store id", () => {
      expect(lemonSqueezyProvider.isConfigured()).toBe(true);
      vi.stubEnv("LEMONSQUEEZY_STORE_ID", "");
      expect(lemonSqueezyProvider.isConfigured()).toBe(false);
      vi.stubEnv("LEMONSQUEEZY_STORE_ID", "99x");
      expect(lemonSqueezyProvider.isConfigured()).toBe(false);
      vi.stubEnv("LEMONSQUEEZY_STORE_ID", " 99");
      expect(lemonSqueezyProvider.isConfigured()).toBe(false);
      vi.stubEnv("LEMONSQUEEZY_STORE_ID", "99");
      vi.stubEnv("LEMONSQUEEZY_API_KEY", "");
      expect(lemonSqueezyProvider.isConfigured()).toBe(false);
    });

    it("fails clearly when the store lookup does not return one matching store", async () => {
      vi.stubEnv("LEMONSQUEEZY_STORE_ID", "98");
      lsRoutes["GET /stores/98"] = { data: [{ id: "98", attributes: { currency: "USD" } }] };
      lsRoutes["GET /products?filter[store_id]=98&page[size]=100&page[number]=1"] = {
        data: [], meta: { page: { lastPage: 1 } },
      };
      await expect(lemonSqueezyProvider.listPrices())
        .rejects.toThrow("Lemon Squeezy store lookup did not return the requested single store.");
    });
  });

  describe("signature", () => {
    it("refuses a signature made with another secret, and one of a different length", () => {
      const body = payload();
      expect(() => lemonSqueezyProvider.verifyWebhook(Buffer.from(body), { "x-signature": lsSign(body, "other") })).toThrow(/Invalid/);
      expect(() => lemonSqueezyProvider.verifyWebhook(Buffer.from(body), { "x-signature": "abc" })).toThrow(/Invalid/);
      expect(() => lemonSqueezyProvider.verifyWebhook(Buffer.from(body), { "x-signature": ["a", "b"] })).toThrow(/Missing/);
    });

    it("refuses everything when the secret isn't set, rather than signing with an empty key", () => {
      vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", "");
      const body = payload();
      expect(() => lemonSqueezyProvider.verifyWebhook(Buffer.from(body), { "x-signature": lsSign(body, "") })).toThrow();
    });
  });

  describe("events", () => {
    it("derives one id for a redelivery, and another once the subscription changes", () => {
      expect(verify(payload()).id).toBe(verify(payload()).id);
      expect(verify(payload({ updated_at: "2026-11-05T00:00:00.000000Z" })).id).not.toBe(verify(payload()).id);
      expect(verify(payload({}, "subscription_cancelled")).id).not.toBe(verify(payload()).id);
    });

    it("takes the subscription from a payment event's invoice, not data.id", () => {
      for (const name of ["subscription_payment_failed", "subscription_payment_success", "subscription_payment_recovered"]) {
        const body = JSON.stringify({
          meta: { event_name: name },
          data: { type: "subscription-invoices", id: "inv_9", attributes: { subscription_id: 1234, updated_at: "2026-11-04T00:00:00.000000Z" } },
        });
        expect(verify(body)).toMatchObject({ subscriptionId: "1234", userId: null });
      }
    });

    it("handles every subscribed subscription event the same way, and ignores others", () => {
      for (const name of ["subscription_created", "subscription_updated", "subscription_cancelled", "subscription_resumed", "subscription_expired", "subscription_paused", "subscription_unpaused"]) {
        expect(verify(payload({}, name))).toMatchObject({ subscriptionId: "sub_1", userId: "user_1" });
      }
      expect(verify(payload({}, "order_created")).subscriptionId).toBeNull();
    });
  });

  describe("status mapping", () => {
    const renews = "2026-12-01T00:00:00.000000Z";
    const ends = "2026-11-20T00:00:00.000000Z";
    it.each([
      ["on_trial", "trialing", renews, false],
      ["active", "active", renews, false],
      ["past_due", "past_due", null, false],
      ["unpaid", "past_due", null, false],
      ["cancelled", "canceled", ends, true],
      ["paused", "canceled", ends, false],
      ["expired", "canceled", null, false],
    ])("%s becomes %s, paid through %s", (lsStatus, status, paidThrough, cancelAtPeriodEnd) => {
      const sub = mapSubscription("1", { status: lsStatus, customer_id: 7, variant_id: 11, renews_at: renews, ends_at: ends, trial_ends_at: null }, "month");
      expect(sub.status).toBe(status);
      expect(sub.paidThrough?.getTime() ?? null).toBe(paidThrough ? new Date(paidThrough).getTime() : null);
      expect(sub.cancelAtPeriodEnd).toBe(cancelAtPeriodEnd);
    });
  });

  describe("variants", () => {
    const refuse = async (attributes: Record<string, unknown>) => {
      lsRoutes["GET /variants/12"] = { data: { id: "12", attributes: { ...lsVariant.attributes, ...attributes } } };
      return lemonSqueezyProvider.priceProblem("12", "month");
    };

    it("holds the owner's 7-day trial, in days or as a week", async () => {
      expect(await refuse({ trial_interval_count: 14 })).toMatch(/7-day/);
      expect(await refuse({ has_free_trial: false })).toMatch(/7-day/);
      expect(await refuse({ trial_interval: "week", trial_interval_count: 1 })).toBeNull();
    });

    it("refuses what couldn't be sold as a plan", async () => {
      expect(await refuse({ status: "draft" })).toMatch(/not published/);
      expect(await refuse({ is_subscription: false })).toMatch(/subscription/);
      expect(await refuse({ interval_count: 3 })).toMatch(/once a month/);
      expect(await refuse({ pay_what_you_want: true })).toMatch(/fixed amount/);
    });

    it("treats a variant from another store on the same key as not found", async () => {
      vi.stubEnv("LEMONSQUEEZY_STORE_ID", "100");
      await expect(lemonSqueezyProvider.getPrice("11")).rejects.toBeInstanceOf(PriceNotFoundError);
    });
  });

  describe("checkout", () => {
    const sent = () => JSON.parse(lsCalls.find((c) => c.key === "POST /checkouts")!.init.body as string).data;

    it("sends the user, email, store, variant and a 24-hour expiry", async () => {
      await lemonSqueezyProvider.createCheckout({ userId: "user_1", email: "a@test.local", priceId: "11", trialDays: 7 });
      const data = sent();
      expect(data.attributes.checkout_data).toEqual({ email: "a@test.local", custom: { user_id: "user_1" } });
      expect(data.relationships.store.data.id).toBe("99");
      expect(data.relationships.variant.data.id).toBe("11");
      const hours = (new Date(data.attributes.expires_at).getTime() - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(23.9);
      expect(hours).toBeLessThanOrEqual(24);
    });

    it("keeps the trial for a first membership and skips it for a returning one", async () => {
      await lemonSqueezyProvider.createCheckout({ userId: "u", email: "a@test.local", priceId: "11", trialDays: 7 });
      expect(sent().attributes.checkout_options.skip_trial).toBe(false);
      lsCalls = [];
      await lemonSqueezyProvider.createCheckout({ userId: "u", email: "a@test.local", priceId: "11", trialDays: 0 });
      expect(sent().attributes.checkout_options.skip_trial).toBe(true);
    });

    it("sends the key only in the Authorization header", async () => {
      await lemonSqueezyProvider.createCheckout({ userId: "u", email: "a@test.local", priceId: "11", trialDays: 7 });
      const call = lsCalls.find((c) => c.key === "POST /checkouts")!;
      expect((call.init.headers as Record<string, string>).Authorization).toBe("Bearer ls_key_for_tests");
      expect(call.init.body as string).not.toContain("ls_key_for_tests");
      expect(call.key).not.toContain("ls_key_for_tests");
    });
  });

  it("doesn't put its error bodies or key in the errors it throws", async () => {
    vi.stubGlobal("fetch", async () => new Response("secret detail", { status: 500 }));
    const error = await lemonSqueezyProvider.fetchSubscription("sub_1").catch((e: Error) => e);
    expect(String((error as Error).message)).toMatch(/500/);
    expect(String((error as Error).message)).not.toMatch(/secret detail|ls_key_for_tests/);
  });
});

describe("getPaymentProvider", () => {
  it("selects by PAYMENT_PROVIDER, defaulting to Lemon Squeezy", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    expect(getPaymentProvider().name).toBe("stripe");
    vi.stubEnv("PAYMENT_PROVIDER", "lemonsqueezy");
    expect(getPaymentProvider().name).toBe("lemonsqueezy");
    vi.stubEnv("PAYMENT_PROVIDER", "");
    expect(getPaymentProvider().name).toBe("lemonsqueezy");
  });

  it("refuses a value it doesn't know, so a typo can't sell through the wrong provider", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "lemonsqeezy");
    expect(() => getPaymentProvider()).toThrow(/PAYMENT_PROVIDER/);
  });
});

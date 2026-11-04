import { readdirSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

// Every scenario here runs through whichever provider PAYMENT_PROVIDER selects. Fixtures are written
// once, in Stripe's shape, and a fake of the selected provider serves them: the Stripe SDK is replaced
// whole, and Lemon Squeezy's HTTP API is faked below. Nothing here can reach a real API. The webhook
// re-reads the subscription, so a test sets what the provider "knows" in `subscriptions`.
const stripeState = vi.hoisted(() => ({
  subscriptions: new Map<string, any>(),
  created: [] as any[],
  sessionStatus: "open",
  expired: [] as string[],
  failRetrieve: false,
  prices: new Map<string, any>(),
  priceRetrievals: [] as string[],
  failPrices: false,
}));
vi.mock("stripe", () => {
  class Stripe {
    static API_VERSION = "test";
    webhooks = {
      constructEvent: (body: Buffer, sig: string) => {
        if (sig !== "valid") throw new Error("bad signature");
        return JSON.parse(body.toString());
      },
    };
    subscriptions = {
      retrieve: async (id: string) => {
        if (stripeState.failRetrieve) throw new Error("stripe is down");
        return stripeState.subscriptions.get(id);
      },
    };
    prices = {
      retrieve: async (id: string) => {
        stripeState.priceRetrievals.push(id);
        if (stripeState.failPrices) throw new Error("stripe is down");
        const price = stripeState.prices.get(id);
        if (!price) throw Object.assign(new Error("No such price"), { code: "resource_missing" });
        return price;
      },
      list: async (params: any) => {
        if (stripeState.failPrices) throw new Error("stripe is down");
        return { data: [...stripeState.prices.values()].filter((p) => p.active === params.active && p.type === params.type) };
      },
    };
    checkout = {
      sessions: {
        create: async (params: any, options: any) => {
          stripeState.created.push({ params, options });
          const n = stripeState.created.length;
          return { id: `cs_${n}`, url: `https://checkout.test/${n}`, expires_at: Math.floor(Date.now() / 1000) + 86_400 };
        },
        retrieve: async () => ({ status: stripeState.sessionStatus }),
        expire: async (id: string) => { stripeState.expired.push(id); },
      },
    };
    billingPortal = { sessions: { create: async () => ({ url: "https://portal.test/session" }) } };
  }
  return { default: Stripe };
});

process.env.PAYMENT_PROVIDER ||= "lemonsqueezy";
const PROVIDER = process.env.PAYMENT_PROVIDER;
const LS = PROVIDER === "lemonsqueezy";
const LS_STORE = "99";
process.env.LEMONSQUEEZY_API_KEY = "ls_key_for_tests";
process.env.LEMONSQUEEZY_STORE_ID = LS_STORE;
process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "ls_secret_for_tests";
process.env.STRIPE_SECRET_KEY = "sk_test_x";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
process.env.STRIPE_PRICE_MONTHLY = "price_monthly";
process.env.STRIPE_PRICE_ANNUAL = "price_annual";

// ---- A fake of Lemon Squeezy's API, serving the same fixtures.
const iso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);
const LS_STATUS: Record<string, string> = { trialing: "on_trial", active: "active", past_due: "past_due", canceled: "expired" };
const lsVariant = (p: any) => ({
  id: p.id,
  attributes: {
    product_id: `prod-${p.id}`,
    name: p.nickname,
    status: p.active ? "published" : "draft",
    price: p.unit_amount ?? 0,
    pay_what_you_want: p.unit_amount === null || p.recurring?.usage_type === "metered",
    is_subscription: p.type === "recurring",
    interval: p.recurring?.interval ?? null,
    interval_count: p.recurring?.interval_count ?? null,
    has_free_trial: true, trial_interval: "day", trial_interval_count: 7,
  },
});
const lsJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
async function fakeLemonSqueezy(url: string, init: RequestInit = {}): Promise<Response> {
  const path = decodeURI(url).replace("https://api.lemonsqueezy.com/v1", "");
  const [route, query = ""] = path.split("?");
  const [, resource, id] = route.split("/");
  if (resource === "subscriptions") {
    if (stripeState.failRetrieve) throw new Error("lemon squeezy is down");
    const sub = stripeState.subscriptions.get(id);
    const item = sub.items.data[0];
    return lsJson({
      data: {
        id: sub.id,
        attributes: {
          status: sub.lsStatus ?? LS_STATUS[sub.status],
          customer_id: sub.customer,
          variant_id: item.price.id,
          renews_at: iso(item.current_period_end),
          ends_at: sub.ends_at ? iso(sub.ends_at) : null,
          trial_ends_at: iso(sub.trial_end),
        },
      },
    });
  }
  if (resource === "checkouts" && init.method === "POST") {
    const { attributes, relationships } = JSON.parse(init.body as string).data;
    const params = {
      mode: "subscription",
      payment_method_collection: "always",
      customer_email: attributes.checkout_data.email,
      line_items: [{ price: relationships.variant.data.id, quantity: 1 }],
      subscription_data: {
        metadata: { userId: attributes.checkout_data.custom.user_id },
        ...(attributes.checkout_options.skip_trial ? {} : { trial_period_days: 7 }),
      },
    };
    stripeState.created.push({ params });
    const n = stripeState.created.length;
    return lsJson({ data: { id: `ck_${n}`, attributes: { url: `https://checkout.test/${n}` } } });
  }
  if (resource === "checkouts") {
    const expires = stripeState.sessionStatus === "open" ? Date.now() + 3_600_000 : Date.now() - 1000;
    return lsJson({ data: { id, attributes: { expires_at: new Date(expires).toISOString() } } });
  }
  if (resource === "customers") return lsJson({ data: { id, attributes: { urls: { customer_portal: "https://portal.test/session" } } } });
  if (stripeState.failPrices) throw new Error("lemon squeezy is down");
  if (resource === "stores") return lsJson({ data: { id, attributes: { currency: "USD" } } });
  if (resource === "products" && id) {
    const p = stripeState.prices.get(id.replace("prod-", ""));
    return lsJson({ data: { id, attributes: { store_id: Number(LS_STORE), status: p?.product?.active === false ? "draft" : "published", name: p?.product?.name } } });
  }
  if (resource === "products") {
    return lsJson({ data: [{ id: "all", attributes: { status: "published", name: "tala Membership" } }], meta: { page: { lastPage: 1 } } });
  }
  if (resource === "variants" && id) {
    stripeState.priceRetrievals.push(id);
    const p = stripeState.prices.get(id);
    return p ? lsJson({ data: lsVariant(p) }) : lsJson({ errors: [] }, 404);
  }
  if (resource === "variants") {
    const rows = [...stripeState.prices.values()].filter((p) => !query.includes("filter[status]=published") || p.active).map(lsVariant);
    return lsJson({ data: rows, meta: { page: { lastPage: 1 } } });
  }
  throw new Error(`The Lemon Squeezy fake has no route for ${path}`);
}
if (LS) vi.stubGlobal("fetch", fakeLemonSqueezy);

const { default: app } = await import("../../app");
const {
  db, profilesTable, clientProfilesTable, leadsTable, membershipsTable,
  clientHoldingsTable, conversionCheckpointsTable, paymentWebhookEventsTable, advisorAssignmentsTable, membershipSettingsTable,
  subscriptionsTable, pathwayProgressTable,
} = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const created: string[] = [];
const eventIds: string[] = [];
let counter = 0;
const DAY_S = 86_400;
const nowS = () => Math.floor(Date.now() / 1000);

async function makeUser(role: "free_user" | "investment_client" | "advisor" | "super_admin" = "free_user") {
  const id = `mem-${++counter}-${RUN_ID}`;
  created.push(id);
  await db.insert(profilesTable).values({ id, email: `${id}@test.local`, fullName: `User ${counter}`, role });
  return id;
}
const asUser = (id: string) => ({ "x-test-user-id": id });

function setSubscription(userId: string, overrides: Record<string, any> = {}) {
  const id = overrides.id ?? `sub_${userId}`;
  const firstItem = overrides.items?.data?.[0];
  if (LS && firstItem && !stripeState.prices.has(firstItem.price.id)) {
    makePrice(firstItem.price.id, {}, { interval: firstItem.price.recurring?.interval ?? "month" });
  }
  if (LS && !stripeState.prices.has("price_monthly")) makePrice("price_monthly");
  const sub = {
    id,
    customer: `cus_${userId}`,
    status: "active",
    metadata: { userId },
    cancel_at_period_end: false,
    trial_end: null,
    items: { data: [{ current_period_start: nowS() - DAY_S, current_period_end: nowS() + 29 * DAY_S, price: { id: "price_monthly", recurring: { interval: "month" } } }] },
    ...overrides,
  };
  stripeState.subscriptions.set(id, sub);
  return sub;
}

const LS_EVENTS: Record<string, string> = {
  "checkout.session.completed": "subscription_created",
  "customer.subscription.updated": "subscription_updated",
  "customer.subscription.deleted": "subscription_expired",
  "invoice.payment_failed": "subscription_payment_failed",
};
// A Lemon Squeezy event has no id of its own, so the same fixture id must give the same updated_at.
const lsUpdatedAt = new Map<string, string>();
let lsClock = Date.now();

function lemonSqueezyBody(type: string, object: any, id: string): string {
  const event_name = LS_EVENTS[type] ?? type;
  const subscriptionId: string = object.parent?.subscription_details?.subscription ?? object.subscription ?? object.id;
  if (!lsUpdatedAt.has(id)) lsUpdatedAt.set(id, new Date(lsClock += 1000).toISOString());
  const updated_at = lsUpdatedAt.get(id)!;
  const userId = object.noCustomData ? undefined : stripeState.subscriptions.get(subscriptionId)?.metadata?.userId;
  const custom_data = userId ? { user_id: userId } : undefined;
  const isInvoice = event_name.startsWith("subscription_payment_");
  const data = isInvoice
    ? { type: "subscription-invoices", id: `inv_${id}`, attributes: { subscription_id: subscriptionId, updated_at } }
    : { type: "subscriptions", id: subscriptionId, attributes: { updated_at } };
  eventIds.push(`${event_name}:${data.id}:${updated_at}`);
  return JSON.stringify({ meta: { event_name, custom_data }, data });
}

function sendEvent(type: string, object: any, id = `evt_${++counter}_${RUN_ID}`, signature = "valid", path = "/api/webhooks/payments") {
  eventIds.push(id);
  const post = request(app).post(path).set("content-type", "application/json");
  if (!LS) return post.set("stripe-signature", signature).send(JSON.stringify({ id, type, data: { object } }));
  const body = lemonSqueezyBody(type, object, id);
  const digest = createHmac("sha256", process.env.LEMONSQUEEZY_WEBHOOK_SECRET!).update(body).digest("hex");
  return post.set("x-signature", signature === "valid" ? digest : "0".repeat(digest.length)).send(body);
}
const completed = (sub: { id: string; customer: string }) =>
  sendEvent("checkout.session.completed", { mode: "subscription", subscription: sub.id, customer: sub.customer });
const memberRow = async (id: string) => (await db.select().from(membershipsTable).where(eq(membershipsTable.userId, id)))[0];
const entitlements = async (id: string) => (await request(app).get("/api/me/entitlements").set(asUser(id)).expect(200)).body;
const leadsOf = (id: string) => db.select().from(leadsTable).where(eq(leadsTable.userId, id));
const checkpointsOf = (id: string) => db.select().from(conversionCheckpointsTable).where(eq(conversionCheckpointsTable.userId, id));

function makePrice(id: string, overrides: Record<string, any> = {}, recurring: Record<string, any> = {}) {
  const price = {
    id, active: true, type: "recurring", nickname: null, currency: "usd", unit_amount: 1000,
    product: { id: "prod_1", name: "tala Membership", active: true },
    recurring: { interval: "month", interval_count: 1, usage_type: "licensed", ...recurring },
    ...overrides,
  };
  stripeState.prices.set(id, price);
  return price;
}

// The settings row is one shared row, so this file owns it for its run and puts it back afterwards.
let savedSettings: (typeof membershipSettingsTable.$inferSelect)[] = [];
beforeAll(async () => {
  savedSettings = await db.select().from(membershipSettingsTable);
  await db.delete(membershipSettingsTable);
});
afterAll(async () => {
  await db.delete(membershipSettingsTable);
  if (savedSettings.length) await db.insert(membershipSettingsTable).values(savedSettings);
});

beforeEach(() => {
  stripeState.failPrices = false;
  stripeState.priceRetrievals.length = 0;
  stripeState.created.length = 0;
  stripeState.expired.length = 0;
  stripeState.sessionStatus = "open";
  stripeState.failRetrieve = false;
});

afterAll(async () => {
  await db.delete(paymentWebhookEventsTable).where(inArray(paymentWebhookEventsTable.eventId, eventIds));
  await db.delete(conversionCheckpointsTable).where(inArray(conversionCheckpointsTable.userId, created));
  await db.delete(clientHoldingsTable).where(inArray(clientHoldingsTable.userId, created));
  await db.delete(leadsTable).where(inArray(leadsTable.userId, created));
  await db.delete(advisorAssignmentsTable).where(inArray(advisorAssignmentsTable.clientUserId, created));
  await db.delete(clientProfilesTable).where(inArray(clientProfilesTable.userId, created));
  await db.delete(pathwayProgressTable).where(inArray(pathwayProgressTable.userId, created));
  await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.userId, created));
  await db.delete(profilesTable).where(inArray(profilesTable.id, created));
});

// Lemon Squeezy's prices are chosen by an admin, with no env fallback, so a checkout needs a row.
async function ensureSellablePrices() {
  makePrice("price_monthly");
  makePrice("price_annual", {}, { interval: "year" });
  if (!LS) return;
  await db.delete(membershipSettingsTable);
  await db.insert(membershipSettingsTable).values({ id: 1, monthlyPriceId: "price_monthly", annualPriceId: "price_annual" });
}

describe(`POST /api/webhooks/payments (${PROVIDER})`, () => {
  it("refuses a bad signature and writes nothing", async () => {
    const u = await makeUser();
    const sub = setSubscription(u);
    await sendEvent("customer.subscription.updated", sub, undefined, "forged").expect(400);
    expect(await memberRow(u)).toBeUndefined();
  });

  it("the same event twice changes nothing", async () => {
    const u = await makeUser();
    const sub = setSubscription(u);
    const id = `evt_dup_${u}`;
    await sendEvent("customer.subscription.updated", sub, id).expect(200);
    const first = await memberRow(u);
    expect(first.status).toBe("active");

    // If the replay were applied, this changed state would be written.
    setSubscription(u, { status: "canceled" });
    await sendEvent("customer.subscription.updated", sub, id).expect(200);
    const second = await memberRow(u);
    expect(second).toEqual(first);
    expect(await leadsOf(u)).toHaveLength(1);
    expect((await checkpointsOf(u)).filter((c) => c.code === "C12_lapsed")).toHaveLength(0);
  });

  it("answers 500 when the provider can't be read, and the retry succeeds", async () => {
    const u = await makeUser();
    const sub = setSubscription(u);
    const id = `evt_retry_${u}`;
    stripeState.failRetrieve = true;
    await sendEvent("customer.subscription.updated", sub, id).expect(500);
    expect(await memberRow(u)).toBeUndefined();
    stripeState.failRetrieve = false;
    await sendEvent("customer.subscription.updated", sub, id).expect(200);
    expect((await memberRow(u)).status).toBe("active");
  });

  it.each(["/api/webhooks/stripe", "/api/billing/webhook"])("still accepts the alias %s", async (path) => {
    const u = await makeUser();
    const sub = setSubscription(u);
    await sendEvent("customer.subscription.updated", sub, `evt_old_${u}`, "valid", path).expect(200);
    expect((await memberRow(u)).status).toBe("active");
  });

  it("records a trial, its end date and the annual plan", async () => {
    const u = await makeUser();
    const trialEnd = nowS() + 7 * DAY_S;
    const sub = setSubscription(u, {
      status: "trialing", trial_end: trialEnd,
      items: { data: [{ current_period_start: nowS(), current_period_end: trialEnd, price: { id: "price_annual", recurring: { interval: "year" } } }] },
    });
    await completed(sub).expect(200);
    const row = await memberRow(u);
    expect(row).toMatchObject({ status: "trialing", plan: "member_annual", source: PROVIDER, provider: PROVIDER, providerCustomerId: sub.customer });
    expect(row.trialEndsAt?.getTime()).toBe(trialEnd * 1000);
    expect((await entitlements(u)).tier).toBe("track_b");
  });

  it("does not let a late cancel of an old subscription end a newer one", async () => {
    const u = await makeUser();
    const newer = setSubscription(u, { id: `sub_new_${u}` });
    await sendEvent("customer.subscription.updated", newer).expect(200);
    const older = setSubscription(u, { id: `sub_old_${u}`, status: "canceled" });
    await sendEvent("customer.subscription.deleted", older).expect(200);
    expect(await memberRow(u)).toMatchObject({ status: "active", providerSubscriptionId: newer.id });
  });
});

describe("grace window after a failed payment", () => {
  // Paid up to a date, and then a renewal fails. Each provider then reports a later date, which is no
  // longer what was paid for: Stripe's rolled-forward period end, Lemon Squeezy's next charge attempt.
  async function paidThenFailed(paidThrough: number) {
    const u = await makeUser();
    await sendEvent("customer.subscription.updated", setSubscription(u, {
      items: { data: [{ current_period_start: paidThrough - 30 * DAY_S, current_period_end: paidThrough, price: { id: "price_monthly", recurring: { interval: "month" } } }] },
    })).expect(200);
    const sub = setSubscription(u, {
      status: "past_due",
      items: { data: [{ current_period_start: paidThrough, current_period_end: paidThrough + 30 * DAY_S, price: { id: "price_monthly", recurring: { interval: "month" } } }] },
    });
    await sendEvent("invoice.payment_failed", { parent: { subscription_details: { subscription: sub.id } } }).expect(200);
    return u;
  }

  it("counts seven days from the paid-through date, not the date the provider has moved on to", async () => {
    const paidThrough = nowS() - 3 * DAY_S;
    const u = await paidThenFailed(paidThrough);
    const row = await memberRow(u);
    expect(row.status).toBe("past_due");
    expect(row.currentPeriodEnd?.getTime()).toBe(paidThrough * 1000);
    expect((await entitlements(u)).tier).toBe("track_b");
  });

  it("drops to free once the seven days have passed, even with a later date from the provider", async () => {
    const u = await paidThenFailed(nowS() - 8 * DAY_S);
    const e = await entitlements(u);
    expect(e.tier).toBe("free");
    expect(e.membership).toMatchObject({ status: "past_due", isActive: false });
  });
});

describe("lapse", () => {
  it("a Track B client with 8 holdings keeps reading all 8, can't add a ninth, and the advisor still reads them", async () => {
    const advisor = await makeUser("advisor");
    const u = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: u, advisorId: advisor });
    const sub = setSubscription(u);
    await sendEvent("customer.subscription.updated", sub).expect(200);
    for (let i = 0; i < 8; i++) {
      await request(app).post("/api/client/holdings").set(asUser(u)).send({ holdingType: "other", label: `H${i}` }).expect(201);
    }

    setSubscription(u, { status: "canceled" });
    await sendEvent("customer.subscription.deleted", sub).expect(200);

    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, u));
    expect(profile.role).toBe("investment_client");
    const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, u));
    expect(cp.advisorId).toBe(advisor);

    const e = await entitlements(u);
    expect(e).toMatchObject({ tier: "free", membership: { status: "canceled", isActive: false }, advisor: { id: advisor } });
    expect(e.gates.messages).toBe("full");

    const own = await request(app).get("/api/client/holdings").set(asUser(u)).expect(200);
    expect((own.body.holdings ?? own.body).filter((h: any) => h.isActive !== false)).toHaveLength(8);
    const refused = await request(app).post("/api/client/holdings").set(asUser(u)).send({ holdingType: "other", label: "Ninth" });
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: "LIMIT", capability: "holdings", limit: 5 });

    const advisorView = await request(app).get(`/api/advisor/leads/${u}/holdings`).set(asUser(advisor)).expect(200);
    expect(advisorView.body.holdings ?? advisorView.body).toHaveLength(8);
  });

  it("re-activating restores the tier at once", async () => {
    const u = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: u });
    const sub = setSubscription(u);
    await sendEvent("customer.subscription.updated", sub).expect(200);
    setSubscription(u, { status: "canceled" });
    await sendEvent("customer.subscription.deleted", sub).expect(200);
    expect((await entitlements(u)).tier).toBe("free");
    const renewed = setSubscription(u, { id: `sub_again_${u}` });
    await sendEvent("customer.subscription.updated", renewed).expect(200);
    expect((await entitlements(u)).tier).toBe("track_b");
  });

  it("fires C12 once, with no lead, and a replay doesn't fire it again", async () => {
    const u = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: u });
    const sub = setSubscription(u);
    await sendEvent("customer.subscription.updated", sub).expect(200);
    setSubscription(u, { status: "canceled" });
    await sendEvent("customer.subscription.deleted", sub).expect(200);
    await sendEvent("customer.subscription.updated", sub).expect(200);
    const fired = (await checkpointsOf(u)).filter((c) => c.code === "C12_lapsed");
    expect(fired).toHaveLength(1);
    await request(app).post(`/api/me/checkpoint/${fired[0].id}/accept`).set(asUser(u)).expect(200);
    expect(await leadsOf(u)).toHaveLength(0);
  });
});

describe("self-serve door", () => {
  it("creates exactly one unassigned lead with source self_serve_member, at full client limits", async () => {
    const u = await makeUser();
    const sub = setSubscription(u);
    await completed(sub).expect(200);
    await sendEvent("customer.subscription.updated", sub).expect(200);
    await sendEvent("customer.subscription.updated", sub).expect(200);

    const leads = await leadsOf(u);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ source: "self_serve_member", status: "unassigned", assignedAdvisorId: null });

    const e = await entitlements(u);
    expect(e.tier).toBe("track_b");
    expect(e.limits.goals).toBeNull();
    expect(e.advisor).toBeNull();
    // Membership opens the limits; messages still wait for an advisor.
    expect(e.gates).toMatchObject({ goals: "full", messages: "after_assign", plan: "after_assign" });
  });

  it("does not add a second lead for a user who already has one", async () => {
    const u = await makeUser();
    await db.insert(leadsTable).values({ email: `${u}@test.local`, userId: u, source: "C7_direct", status: "unassigned" });
    await completed(setSubscription(u)).expect(200);
    const leads = await leadsOf(u);
    expect(leads).toHaveLength(1);
    expect(leads[0].source).toBe("C7_direct");
  });

  it("assignment sets the advisor pointer, so the new advisor can reach the client routes", async () => {
    const admin = await makeUser("super_admin");
    const advisor = await makeUser("advisor");
    const u = await makeUser();
    await completed(setSubscription(u)).expect(200);
    const [lead] = await leadsOf(u);

    const res = await request(app).put(`/api/leads/${lead.id}/assign`).set(asUser(admin)).send({ advisorId: advisor }).expect(200);
    expect(res.body.status).toBe("client");

    const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, u));
    expect(cp).toMatchObject({ advisorId: advisor, status: "active" });
    await request(app).get(`/api/advisor/clients/${u}/networth/summary`).set(asUser(advisor)).expect(200);
    const e = await entitlements(u);
    expect(e).toMatchObject({ tier: "track_b", advisor: { id: advisor } });
    expect(e.gates).toMatchObject({ messages: "full", plan: "full" });
  });
});

describe("advisor-led door", () => {
  it("leaves the user at free limits until the webhook, then at client limits", async () => {
    const admin = await makeUser("super_admin");
    const advisor = await makeUser("advisor");
    const u = await makeUser();
    const [lead] = await db.insert(leadsTable).values({ email: `${u}@test.local`, userId: u, source: "C7_direct", status: "unassigned" }).returning();
    await request(app).put(`/api/leads/${lead.id}/assign`).set(asUser(admin)).send({ advisorId: advisor }).expect(200);
    await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisor)).send({ status: "client" }).expect(200);

    const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, u));
    expect(cp).toMatchObject({ status: "pending_payment", advisorId: advisor });
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, u));
    expect(profile.role).toBe("investment_client");

    const before = await entitlements(u);
    expect(before).toMatchObject({ tier: "free", advisor: { id: advisor }, membership: { pendingPayment: true, isActive: false } });
    expect(before.limits.goals).toBe(1);

    // Staff see the state on both lists.
    const clients = await request(app).get("/api/advisor/clients").set(asUser(advisor)).expect(200);
    expect(clients.body.find((c: any) => c.id === u).status).toBe("pending_payment");
    const leads = await request(app).get("/api/leads").set(asUser(advisor)).expect(200);
    expect(leads.body.find((l: any) => l.id === lead.id).pendingPayment).toBe(true);

    await completed(setSubscription(u)).expect(200);

    const after = await entitlements(u);
    expect(after).toMatchObject({ tier: "track_b", membership: { pendingPayment: false, isActive: true } });
    expect(after.limits.goals).toBeNull();
    expect(await leadsOf(u)).toHaveLength(1);
    const [cpAfter] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, u));
    expect(cpAfter.status).toBe("active");
  });

  it("promotes straight to active when the membership is already active", async () => {
    const advisor = await makeUser("advisor");
    const u = await makeUser();
    await completed(setSubscription(u)).expect(200);
    const [lead] = await leadsOf(u);
    await db.update(leadsTable).set({ status: "active", assignedAdvisorId: advisor }).where(eq(leadsTable.id, lead.id));
    await request(app).put(`/api/leads/${lead.id}`).set(asUser(advisor)).send({ status: "client" }).expect(200);
    const [cp] = await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, u));
    expect(cp.status).toBe("active");
  });
});

describe("POST /api/membership/checkout", () => {
  beforeEach(ensureSellablePrices);

  it("writes no membership, and asks for a card with a 7-day trial", async () => {
    const u = await makeUser();
    const res = await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_monthly" }).expect(200);
    expect(res.body.url).toMatch(/checkout\.test/);
    expect(await memberRow(u)).toBeUndefined();
    const { params } = stripeState.created[0];
    expect(params).toMatchObject({
      mode: "subscription",
      payment_method_collection: "always",
      line_items: [{ price: "price_monthly", quantity: 1 }],
      subscription_data: { trial_period_days: 7, metadata: { userId: u } },
    });
  });

  it("returns the same session while it's open, and a new one once it isn't", async () => {
    const u = await makeUser();
    const first = await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_monthly" }).expect(200);
    const again = await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_monthly" }).expect(200);
    expect(again.body.url).toBe(first.body.url);
    expect(stripeState.created).toHaveLength(1);

    stripeState.sessionStatus = "expired";
    const fresh = await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_monthly" }).expect(200);
    expect(fresh.body.url).not.toBe(first.body.url);
  });

  it("closes the open session when the plan changes", async () => {
    const u = await makeUser();
    await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_monthly" }).expect(200);
    await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_annual" }).expect(200);
    // Lemon Squeezy has no way to close a checkout early; it runs out after 24 hours.
    expect(stripeState.expired).toHaveLength(LS ? 0 : 1);
    expect(stripeState.created[1].params.line_items[0].price).toBe("price_annual");
  });

  it("refuses staff, a current member and an unknown plan", async () => {
    const staff = await makeUser("advisor");
    await request(app).post("/api/membership/checkout").set(asUser(staff)).send({ plan: "member_monthly" }).expect(403);
    const member = await makeUser();
    await completed(setSubscription(member)).expect(200);
    await request(app).post("/api/membership/checkout").set(asUser(member)).send({ plan: "member_monthly" }).expect(409);
    const u = await makeUser();
    await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "lifetime" }).expect(400);
  });

  it("gives no second trial to someone who has already been a member", async () => {
    const u = await makeUser();
    const sub = setSubscription(u);
    await completed(sub).expect(200);
    setSubscription(u, { status: "canceled" });
    await sendEvent("customer.subscription.deleted", sub).expect(200);
    await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_monthly" }).expect(200);
    const { params } = stripeState.created[0];
    expect(params.subscription_data.trial_period_days).toBeUndefined();
    // Lemon Squeezy matches a returning customer by email.
    if (LS) expect(params.customer_email).toBe(`${u}@test.local`);
    else expect(params.customer).toBe(sub.customer);
  });

  it("tells the screens the same thing about the trial that checkout will do", async () => {
    const u = await makeUser();
    expect((await entitlements(u)).membership.trialEligible).toBe(true);
    const sub = setSubscription(u);
    await completed(sub).expect(200);
    expect((await entitlements(u)).membership.trialEligible).toBe(false);
    setSubscription(u, { status: "canceled" });
    await sendEvent("customer.subscription.deleted", sub).expect(200);
    expect((await entitlements(u)).membership.trialEligible).toBe(false);
  });
});

describe("POST /api/membership/portal", () => {
  it("is for members only", async () => {
    const u = await makeUser();
    await request(app).post("/api/membership/portal").set(asUser(u)).expect(404);
    await completed(setSubscription(u)).expect(200);
    const res = await request(app).post("/api/membership/portal").set(asUser(u)).expect(200);
    expect(res.body.url).toMatch(/portal\.test/);
    expect((await entitlements(u)).membership.manageUrl).toBe("/membership/portal");
  });
});

describe("PUT /api/admin/users/:id/membership", () => {
  it("is super admin only and needs a reason", async () => {
    const advisor = await makeUser("advisor");
    const admin = await makeUser("super_admin");
    const u = await makeUser("investment_client");
    await request(app).put(`/api/admin/users/${u}/membership`).set(asUser(advisor)).send({ action: "comp", reason: "x" }).expect(403);
    await request(app).put(`/api/admin/users/${u}/membership`).set(asUser(admin)).send({ action: "comp" }).expect(400);
    await request(app).put(`/api/admin/users/${u}/membership`).set(asUser(admin)).send({ action: "comp", reason: "  " }).expect(400);
  });

  it("comps with a reason, shows it on the lists, and a webhook can't undo it", async () => {
    const admin = await makeUser("super_admin");
    const advisor = await makeUser("advisor");
    const u = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: u, advisorId: advisor, status: "pending_payment" });
    await request(app).put(`/api/admin/users/${u}/membership`).set(asUser(admin)).send({ action: "comp", reason: "Founding client" }).expect(200);
    expect(await memberRow(u)).toMatchObject({ status: "active", source: "comped", reason: "Founding client" });
    expect((await entitlements(u)).tier).toBe("track_b");

    const adminList = await request(app).get("/api/admin/clients").set(asUser(admin)).expect(200);
    expect(adminList.body.find((c: any) => c.id === u)).toMatchObject({ membershipSource: "comped", status: "active" });
    const advisorList = await request(app).get("/api/advisor/clients").set(asUser(advisor)).expect(200);
    expect(advisorList.body.find((c: any) => c.id === u).membershipSource).toBe("comped");

    await sendEvent("customer.subscription.deleted", setSubscription(u, { status: "canceled" })).expect(200);
    expect(await memberRow(u)).toMatchObject({ status: "active", source: "comped" });
  });

  it("gives a comped free user client limits and a lead for assignment", async () => {
    const admin = await makeUser("super_admin");
    const u = await makeUser();
    await request(app).put(`/api/admin/users/${u}/membership`).set(asUser(admin)).send({ action: "comp", reason: "Partner" }).expect(200);
    expect((await entitlements(u)).tier).toBe("track_b");
    const leads = await leadsOf(u);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ source: "comped_member", status: "unassigned" });
  });

  it("revokes a comp, but won't touch a paying member in either direction", async () => {
    const admin = await makeUser("super_admin");
    const comped = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: comped });
    await request(app).put(`/api/admin/users/${comped}/membership`).set(asUser(admin)).send({ action: "comp", reason: "x" }).expect(200);
    await request(app).put(`/api/admin/users/${comped}/membership`).set(asUser(admin)).send({ action: "revoke", reason: "Ended" }).expect(200);
    expect(await memberRow(comped)).toMatchObject({ status: "canceled", reason: "Ended" });
    expect((await entitlements(comped)).tier).toBe("free");
    expect((await checkpointsOf(comped)).filter((c) => c.code === "C12_lapsed")).toHaveLength(1);

    const paying = await makeUser();
    await completed(setSubscription(paying)).expect(200);
    await request(app).put(`/api/admin/users/${paying}/membership`).set(asUser(admin)).send({ action: "comp", reason: "x" }).expect(409);
    await request(app).put(`/api/admin/users/${paying}/membership`).set(asUser(admin)).send({ action: "revoke", reason: "x" }).expect(409);
    expect((await memberRow(paying)).source).toBe(PROVIDER);
  });

  it("refuses staff accounts", async () => {
    const admin = await makeUser("super_admin");
    const advisor = await makeUser("advisor");
    await request(app).put(`/api/admin/users/${advisor}/membership`).set(asUser(admin)).send({ action: "comp", reason: "x" }).expect(400);
  });
});

describe("C11_trial_ending", () => {
  it("fires inside two days of the trial's end, on the daily check-in, with no lead", async () => {
    const u = await makeUser();
    const trialEnd = nowS() + DAY_S;
    await completed(setSubscription(u, {
      status: "trialing", trial_end: trialEnd,
      items: { data: [{ current_period_start: nowS() - 6 * DAY_S, current_period_end: trialEnd, price: { id: "price_monthly", recurring: { interval: "month" } } }] },
    })).expect(200);
    const fired = (await checkpointsOf(u)).filter((c) => c.code === "C11_trial_ending");
    expect(fired).toHaveLength(1);
    await request(app).post(`/api/me/checkpoint/${fired[0].id}/accept`).set(asUser(u)).expect(200);
    const leads = await leadsOf(u);
    expect(leads.every((l) => l.source === "self_serve_member")).toBe(true);
  });

  it("does not fire earlier than that", async () => {
    const u = await makeUser();
    const trialEnd = nowS() + 5 * DAY_S;
    await completed(setSubscription(u, {
      status: "trialing", trial_end: trialEnd,
      items: { data: [{ current_period_start: nowS() - 2 * DAY_S, current_period_end: trialEnd, price: { id: "price_monthly", recurring: { interval: "month" } } }] },
    })).expect(200);
    expect((await checkpointsOf(u)).filter((c) => c.code === "C11_trial_ending")).toHaveLength(0);
  });
});

describe("admin-configured prices", () => {
  const settings = (admin: string, body: unknown) =>
    request(app).put("/api/admin/membership/settings").set(asUser(admin)).send(body as object);
  const monthly = (id: string, overrides = {}) => makePrice(id, overrides);
  const annual = (id: string, overrides = {}) => makePrice(id, overrides, { interval: "year" });
  let n = 0;
  const id = (tag: string) => `price_${tag}_${++n}`;
  // A Lemon Squeezy store has one currency; a Stripe price has its own.
  const CURRENCY = LS ? "usd" : "sgd";
  beforeEach(async () => { await db.delete(membershipSettingsTable); });

  describe("PUT /api/admin/membership/settings", () => {
    it("is for super admins only", async () => {
      const advisor = await makeUser("advisor");
      await settings(advisor, { monthlyPriceId: "a", annualPriceId: "b" }).expect(403);
      const free = await makeUser();
      await request(app).get("/api/admin/membership/prices").set(asUser(free)).expect(403);
      await request(app).get("/api/admin/membership/settings").set(asUser(free)).expect(403);
    });

    it("needs both price ids", async () => {
      const admin = await makeUser("super_admin");
      await settings(admin, { monthlyPriceId: "price_x" }).expect(400);
      await settings(admin, { monthlyPriceId: " ", annualPriceId: "price_y" }).expect(400);
    });

    it.each([
      ["an inactive monthly price", () => monthly(id("m"), { active: false }), () => annual(id("a"))],
      ["a one-off monthly price", () => monthly(id("m"), { type: "one_time", recurring: null }), () => annual(id("a"))],
      ["a yearly price in the monthly slot", () => annual(id("m")), () => annual(id("a"))],
      ["a monthly price in the annual slot", () => monthly(id("m")), () => monthly(id("a"))],
      ["a price billed every three months", () => makePrice(id("m"), {}, { interval_count: 3 }), () => annual(id("a"))],
      ["a metered price", () => makePrice(id("m"), {}, { usage_type: "metered" }), () => annual(id("a"))],
      ["a price with no fixed amount", () => monthly(id("m"), { unit_amount: null }), () => annual(id("a"))],
      ["a price on an archived product", () => monthly(id("m"), { product: { id: "p", name: "Old", active: false } }), () => annual(id("a"))],
    ])("refuses %s and saves nothing", async (_label, makeMonthly, makeAnnual) => {
      const admin = await makeUser("super_admin");
      await settings(admin, { monthlyPriceId: makeMonthly().id, annualPriceId: makeAnnual().id }).expect(400);
      expect(await db.select().from(membershipSettingsTable)).toHaveLength(0);
    });

    it("refuses a price Stripe doesn't have", async () => {
      const admin = await makeUser("super_admin");
      const res = await settings(admin, { monthlyPriceId: "price_missing", annualPriceId: annual(id("a")).id }).expect(400);
      expect(res.body.error).toMatch(/no price/i);
    });

    it("saves nothing when Stripe can't be reached", async () => {
      const admin = await makeUser("super_admin");
      const body = { monthlyPriceId: monthly(id("m")).id, annualPriceId: annual(id("a")).id };
      stripeState.failPrices = true;
      await settings(admin, body).expect(502);
      expect(await db.select().from(membershipSettingsTable)).toHaveLength(0);
    });

    it("saves valid prices to one row, and a second save replaces them", async () => {
      const admin = await makeUser("super_admin");
      await settings(admin, { monthlyPriceId: monthly(id("m")).id, annualPriceId: annual(id("a")).id }).expect(200);
      const next = { monthlyPriceId: monthly(id("m")).id, annualPriceId: annual(id("a")).id };
      await settings(admin, next).expect(200);
      const rows = await db.select().from(membershipSettingsTable);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: 1, ...next, updatedBy: admin });
      const read = await request(app).get("/api/admin/membership/settings").set(asUser(admin)).expect(200);
      expect(read.body).toMatchObject({ ...next, source: "settings" });
    });
  });

  describe("GET /api/admin/membership/prices", () => {
    it("lists active recurring prices with their product's name", async () => {
      const admin = await makeUser("super_admin");
      const listed = makePrice(id("list"), { nickname: "Launch", unit_amount: 700, currency: CURRENCY });
      const hidden = makePrice(id("hidden"), { active: false });
      const res = await request(app).get("/api/admin/membership/prices").set(asUser(admin)).expect(200);
      expect(res.body.find((p: any) => p.id === listed.id)).toEqual({
        id: listed.id, nickname: "Launch", productName: "tala Membership", unitAmount: 700, currency: CURRENCY, interval: "month",
      });
      expect(res.body.map((p: any) => p.id)).not.toContain(hidden.id);
    });
  });

  describe("GET /api/billing/prices", () => {
    it("returns Stripe's amounts for the selected prices", async () => {
      const admin = await makeUser("super_admin");
      const m = monthly(id("m"), { unit_amount: 777, currency: CURRENCY });
      const a = annual(id("a"), { unit_amount: 7000, currency: CURRENCY });
      await settings(admin, { monthlyPriceId: m.id, annualPriceId: a.id }).expect(200);
      const res = await request(app).get("/api/billing/prices").expect(200);
      expect(res.body).toMatchObject({
        source: "settings",
        monthly: { plan: "member_monthly", priceId: m.id, amount: 777, currency: CURRENCY, interval: "month", active: true },
        annual: { plan: "member_annual", priceId: a.id, amount: 7000, currency: CURRENCY, interval: "year", active: true },
      });
    });

    it.runIf(LS)("has no env fallback on Lemon Squeezy, so it answers 503 until an admin chooses", async () => {
      await request(app).get("/api/billing/prices").expect(503);
    });

    it.skipIf(LS)("falls back to the env prices, and says so", async () => {
      makePrice("price_monthly", { unit_amount: 111 });
      makePrice("price_annual", { unit_amount: 1111 }, { interval: "year" });
      const res = await request(app).get("/api/billing/prices").expect(200);
      expect(res.body.source).toBe("env");
      expect(res.body.monthly).toMatchObject({ priceId: "price_monthly", amount: 111 });
    });

    it("caches Stripe's objects, but a new selection shows at once", async () => {
      const admin = await makeUser("super_admin");
      const m = monthly(id("m"));
      const a = annual(id("a"));
      await settings(admin, { monthlyPriceId: m.id, annualPriceId: a.id }).expect(200);
      stripeState.priceRetrievals.length = 0;
      await request(app).get("/api/billing/prices").expect(200);
      await request(app).get("/api/billing/prices").expect(200);
      expect(stripeState.priceRetrievals.filter((p) => p === m.id)).toHaveLength(1);

      const m2 = monthly(id("m"), { unit_amount: 2222 });
      await settings(admin, { monthlyPriceId: m2.id, annualPriceId: a.id }).expect(200);
      const res = await request(app).get("/api/billing/prices").expect(200);
      expect(res.body.monthly).toMatchObject({ priceId: m2.id, amount: 2222 });
    });

    it("answers 503, with no amount, when Stripe can't be read", async () => {
      makePrice("price_monthly");
      const admin = await makeUser("super_admin");
      const m = monthly(id("m"));
      const a = annual(id("a"));
      await settings(admin, { monthlyPriceId: m.id, annualPriceId: a.id }).expect(200);
      stripeState.failPrices = true;
      const fresh = monthly(id("m"));
      await db.update(membershipSettingsTable).set({ monthlyPriceId: fresh.id });
      const res = await request(app).get("/api/billing/prices").expect(503);
      expect(res.body.monthly).toBeUndefined();
    });
  });

  describe("POST /api/membership/checkout", () => {
    it("sells the configured price for each plan, not the env one", async () => {
      const admin = await makeUser("super_admin");
      const m = monthly(id("m"));
      const a = annual(id("a"));
      await settings(admin, { monthlyPriceId: m.id, annualPriceId: a.id }).expect(200);
      const u = await makeUser();
      await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_monthly" }).expect(200);
      expect(stripeState.created[0].params.line_items[0].price).toBe(m.id);
      const v = await makeUser();
      await request(app).post("/api/membership/checkout").set(asUser(v)).send({ plan: "member_annual" }).expect(200);
      expect(stripeState.created[1].params.line_items[0].price).toBe(a.id);
    });

    it.runIf(LS)("answers 503 with no settings row, and creates nothing", async () => {
      const u = await makeUser();
      await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_annual" }).expect(503);
      expect(stripeState.created).toHaveLength(0);
    });

    it.skipIf(LS)("falls back to the env price with no settings row", async () => {
      const u = await makeUser();
      await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_annual" }).expect(200);
      expect(stripeState.created[0].params.line_items[0].price).toBe("price_annual");
    });

    it("won't reuse an open session for a price the admin has replaced", async () => {
      const admin = await makeUser("super_admin");
      const a = annual(id("a"));
      const first = monthly(id("m"));
      await settings(admin, { monthlyPriceId: first.id, annualPriceId: a.id }).expect(200);
      const u = await makeUser();
      const before = await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_monthly" }).expect(200);

      const second = monthly(id("m"));
      await settings(admin, { monthlyPriceId: second.id, annualPriceId: a.id }).expect(200);
      const after = await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_monthly" }).expect(200);
      expect(after.body.url).not.toBe(before.body.url);
      expect(stripeState.created[1].params.line_items[0].price).toBe(second.id);
      expect(stripeState.expired).toHaveLength(LS ? 0 : 1);
    });
  });

  it("records the plan by billing interval, so a changed selection doesn't mislabel a subscriber", async () => {
    const u = await makeUser();
    const sub = setSubscription(u, { items: { data: [{ current_period_start: nowS(), current_period_end: nowS() + 365 * DAY_S, price: { id: "price_old_annual", recurring: { interval: "year" } } }] } });
    await completed(sub).expect(200);
    expect((await memberRow(u)).plan).toBe("member_annual");
  });
});

describe.runIf(LS)("Lemon Squeezy through the store", () => {
  const event = "customer.subscription.updated";
  const inDays = (days: number) => nowS() + days * DAY_S;
  const c12 = async (u: string) => (await checkpointsOf(u)).filter((c) => c.code === "C12_lapsed");

  it("cancelled but paid through keeps access until the date, then expiry ends it and fires C12 once", async () => {
    const u = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: u });
    const sub = setSubscription(u);
    await sendEvent(event, sub).expect(200);

    const ends = inDays(10);
    setSubscription(u, { lsStatus: "cancelled", ends_at: ends });
    await sendEvent("subscription_cancelled", sub).expect(200);
    const row = await memberRow(u);
    expect(row).toMatchObject({ status: "canceled", cancelAtPeriodEnd: true });
    expect(row.currentPeriodEnd?.getTime()).toBe(ends * 1000);
    const during = await entitlements(u);
    expect(during.tier).toBe("track_b");
    expect(during.membership.isActive).toBe(true);
    // They still have what they paid for, so nothing says it has ended.
    expect(await c12(u)).toHaveLength(0);
    // Still a member, so checkout refuses rather than selling them a second subscription.
    await ensureSellablePrices();
    await request(app).post("/api/membership/checkout").set(asUser(u)).send({ plan: "member_monthly" }).expect(409);

    setSubscription(u, { lsStatus: "expired", ends_at: nowS() - 1 });
    await sendEvent("subscription_expired", sub).expect(200);
    expect(await memberRow(u)).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false, currentPeriodEnd: null });
    expect((await entitlements(u)).tier).toBe("free");
    expect(await c12(u)).toHaveLength(1);

    await sendEvent("subscription_updated", sub).expect(200);
    expect(await c12(u)).toHaveLength(1);
  });

  it("resuming during the paid-through time restores it, with no C12", async () => {
    const u = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: u });
    const sub = setSubscription(u);
    setSubscription(u, { lsStatus: "cancelled", ends_at: inDays(5) });
    await sendEvent("subscription_cancelled", sub).expect(200);
    setSubscription(u);
    await sendEvent("subscription_resumed", sub).expect(200);
    expect(await memberRow(u)).toMatchObject({ status: "active", cancelAtPeriodEnd: false });
    expect(await c12(u)).toHaveLength(0);
  });

  it("a date that has passed with no expiry event still ends access", async () => {
    const u = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: u });
    const sub = setSubscription(u, { lsStatus: "cancelled", ends_at: nowS() - 60 });
    await sendEvent("subscription_cancelled", sub).expect(200);
    expect((await entitlements(u)).tier).toBe("free");
  });

  it("paused ends access until it's unpaused", async () => {
    const u = await makeUser("investment_client");
    await db.insert(clientProfilesTable).values({ userId: u });
    const sub = setSubscription(u);
    await sendEvent(event, sub).expect(200);
    setSubscription(u, { lsStatus: "paused" });
    await sendEvent("subscription_paused", sub).expect(200);
    expect((await entitlements(u)).tier).toBe("free");
    setSubscription(u);
    await sendEvent("subscription_unpaused", sub).expect(200);
    expect((await entitlements(u)).tier).toBe("track_b");
  });

  it("past_due keeps the stored date through repeated updates as renews_at moves", async () => {
    const u = await makeUser();
    const paidThrough = inDays(-2);
    await sendEvent(event, setSubscription(u, {
      items: { data: [{ current_period_start: paidThrough - 30 * DAY_S, current_period_end: paidThrough, price: { id: "price_monthly", recurring: { interval: "month" } } }] },
    })).expect(200);
    for (const attempt of [3, 6]) {
      const sub = setSubscription(u, {
        status: "past_due",
        items: { data: [{ current_period_start: paidThrough, current_period_end: inDays(attempt), price: { id: "price_monthly", recurring: { interval: "month" } } }] },
      });
      await sendEvent("subscription_updated", sub).expect(200);
      expect((await memberRow(u)).currentPeriodEnd?.getTime()).toBe(paidThrough * 1000);
    }
  });

  it("recovering a payment returns to active with the new date", async () => {
    const u = await makeUser();
    const first = setSubscription(u);
    await sendEvent(event, first).expect(200);
    const renewed = inDays(30);
    const sub = setSubscription(u, { items: { data: [{ current_period_start: nowS(), current_period_end: renewed, price: { id: "price_monthly", recurring: { interval: "month" } } }] } });
    await sendEvent("subscription_payment_recovered", { parent: { subscription_details: { subscription: sub.id } } }).expect(200);
    const row = await memberRow(u);
    expect(row.status).toBe("active");
    expect(row.currentPeriodEnd?.getTime()).toBe(renewed * 1000);
  });

  it("finds the user by customer when a later event carries no custom data", async () => {
    const u = await makeUser();
    const sub = setSubscription(u);
    await sendEvent("subscription_created", sub).expect(200);
    setSubscription(u, { lsStatus: "cancelled", ends_at: inDays(3) });
    await sendEvent("subscription_cancelled", { ...sub, noCustomData: true }).expect(200);
    expect(await memberRow(u)).toMatchObject({ status: "canceled", cancelAtPeriodEnd: true });
  });

  it("writes nothing for a subscription it can't connect to a user", async () => {
    const stranger = `sub_stranger_${RUN_ID}`;
    stripeState.subscriptions.set(stranger, { ...setSubscription(`nobody_${RUN_ID}`, { id: stranger }), metadata: {}, customer: `cus_none_${RUN_ID}` });
    await sendEvent(event, { id: stranger, noCustomData: true }).expect(200);
    const rows = await db.select().from(membershipsTable).where(eq(membershipsTable.providerSubscriptionId, stranger));
    expect(rows).toHaveLength(0);
  });

});

describe("only the membership store writes memberships", () => {
  it("has no other writer in the API source", () => {
    const srcRoot = path.join(__dirname, "../..");
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return name === "__tests__" ? [] : walk(full);
      return full.endsWith(".ts") ? [full] : [];
    });
    const writers = walk(srcRoot).filter((file) =>
      /\.(insert|update|delete)\(\s*membershipsTable\b/.test(readFileSync(file, "utf8")));
    expect(writers.map((f) => path.relative(srcRoot, f))).toEqual(["lib/membershipStore.ts"]);
  });
});

const repoRoot = path.join(__dirname, "../../../../..");
const tsx = path.join(repoRoot, "scripts/node_modules/.bin/tsx");
const runScript = (script: string, args: string[]) =>
  execFileSync(tsx, [path.join(repoRoot, "scripts/src", `${script}.ts`), ...args], { env: process.env, encoding: "utf8" });

describe("backfill-memberships", () => {
  const seed = async () => {
    const paying = await makeUser("investment_client");
    await db.insert(subscriptionsTable).values({
      userId: paying, stripeCustomerId: `cus_${paying}`, stripeSubscriptionId: `sub_${paying}`, stripePriceId: "price_monthly",
      status: "active", currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });
    const unpaid = await makeUser("investment_client");
    return { paying, unpaid };
  };

  it("reports without writing, then carries live subscriptions over and leaves other clients alone", async () => {
    const { paying, unpaid } = await seed();
    const flags = [`--user=${paying}`, `--user=${unpaid}`];
    const dry = runScript("backfill-memberships", flags);
    expect(dry).toContain('"paidBackfilled":1');
    expect(dry).toContain('"clientsWithoutMembership":1');
    expect(await memberRow(paying)).toBeUndefined();

    runScript("backfill-memberships", [...flags, "--apply"]);
    expect(await memberRow(paying)).toMatchObject({ status: "active", source: "stripe", providerCustomerId: `cus_${paying}` });
    expect(await memberRow(unpaid)).toBeUndefined();
  }, 90_000);

  it("comps other clients only when asked, and a second run changes nothing", async () => {
    const { paying, unpaid } = await seed();
    const flags = [`--user=${paying}`, `--user=${unpaid}`, "--apply", "--comp-existing-clients"];
    runScript("backfill-memberships", flags);
    const first = await memberRow(unpaid);
    expect(first).toMatchObject({ status: "active", source: "comped" });
    expect((await memberRow(paying)).source).toBe("stripe");
    runScript("backfill-memberships", flags);
    expect(await memberRow(unpaid)).toEqual(first);
  }, 90_000);
});

describe("migrate-free-tier-to-client: onboarding_stage", () => {
  const stage = async (u: string) =>
    (await db.select().from(clientProfilesTable).where(eq(clientProfilesTable.userId, u)))[0]?.onboardingStage;
  const run = (u: string, ...flags: string[]) => runScript("migrate-free-tier-to-client", [`--user=${u}`, ...flags]);

  it("completes a user whose old onboardingComplete was true, even with no pathway rows", async () => {
    const u = await makeUser();
    await db.update(profilesTable).set({ onboardingComplete: true }).where(eq(profilesTable.id, u));
    const dry = run(u);
    expect(dry).toContain('"onboardingCompleted":1');
    expect(await stage(u)).toBeUndefined();
    run(u, "--apply");
    expect(await stage(u)).toBe("complete");
  }, 90_000);

  it("completes a user who finished pathway step 6", async () => {
    const u = await makeUser();
    await db.insert(clientProfilesTable).values({ userId: u, onboardingStage: "profile" });
    await db.insert(pathwayProgressTable).values({ userId: u, stepNumber: 6, stepName: "risk", status: "completed", formData: {} });
    run(u, "--apply");
    expect(await stage(u)).toBe("complete");
  }, 90_000);

  it("leaves a user who stopped before step 6 alone, and staff too", async () => {
    const partial = await makeUser();
    await db.insert(pathwayProgressTable).values([
      { userId: partial, stepNumber: 5, stepName: "net worth", status: "completed", formData: {} },
      { userId: partial, stepNumber: 6, stepName: "risk", status: "in_progress", formData: {} },
    ]);
    run(partial, "--apply");
    expect(await stage(partial)).toBeUndefined();

    const staff = await makeUser("advisor");
    await db.update(profilesTable).set({ onboardingComplete: true }).where(eq(profilesTable.id, staff));
    run(staff, "--apply");
    expect(await stage(staff)).toBeUndefined();
  }, 90_000);

  it("a second run changes nothing", async () => {
    const u = await makeUser();
    await db.update(profilesTable).set({ onboardingComplete: true }).where(eq(profilesTable.id, u));
    run(u, "--apply");
    expect(run(u, "--apply")).toContain('"onboardingCompleted":0');
  }, 90_000);
});

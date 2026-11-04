import { readdirSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

// Stripe is replaced whole: nothing here can reach the real API. The webhook re-reads the
// subscription from Stripe, so a test sets what Stripe "knows" in `subscriptions`.
const stripeState = vi.hoisted(() => ({
  subscriptions: new Map<string, any>(),
  created: [] as any[],
  sessionStatus: "open",
  expired: [] as string[],
  failRetrieve: false,
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

process.env.STRIPE_SECRET_KEY = "sk_test_x";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
process.env.STRIPE_PRICE_MONTHLY = "price_monthly";
process.env.STRIPE_PRICE_ANNUAL = "price_annual";

const { default: app } = await import("../../app");
const {
  db, profilesTable, clientProfilesTable, leadsTable, membershipsTable,
  clientHoldingsTable, conversionCheckpointsTable, stripeWebhookEventsTable, advisorAssignmentsTable,
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

function sendEvent(type: string, object: any, id = `evt_${++counter}_${RUN_ID}`, signature = "valid") {
  eventIds.push(id);
  return request(app).post("/api/webhooks/stripe")
    .set("stripe-signature", signature).set("content-type", "application/json")
    .send(JSON.stringify({ id, type, data: { object } }));
}
const completed = (sub: { id: string; customer: string }) =>
  sendEvent("checkout.session.completed", { mode: "subscription", subscription: sub.id, customer: sub.customer });
const memberRow = async (id: string) => (await db.select().from(membershipsTable).where(eq(membershipsTable.userId, id)))[0];
const entitlements = async (id: string) => (await request(app).get("/api/me/entitlements").set(asUser(id)).expect(200)).body;
const leadsOf = (id: string) => db.select().from(leadsTable).where(eq(leadsTable.userId, id));
const checkpointsOf = (id: string) => db.select().from(conversionCheckpointsTable).where(eq(conversionCheckpointsTable.userId, id));

beforeEach(() => {
  stripeState.created.length = 0;
  stripeState.expired.length = 0;
  stripeState.sessionStatus = "open";
  stripeState.failRetrieve = false;
});

afterAll(async () => {
  await db.delete(stripeWebhookEventsTable).where(inArray(stripeWebhookEventsTable.eventId, eventIds));
  await db.delete(conversionCheckpointsTable).where(inArray(conversionCheckpointsTable.userId, created));
  await db.delete(clientHoldingsTable).where(inArray(clientHoldingsTable.userId, created));
  await db.delete(leadsTable).where(inArray(leadsTable.userId, created));
  await db.delete(advisorAssignmentsTable).where(inArray(advisorAssignmentsTable.clientUserId, created));
  await db.delete(clientProfilesTable).where(inArray(clientProfilesTable.userId, created));
  await db.delete(pathwayProgressTable).where(inArray(pathwayProgressTable.userId, created));
  await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.userId, created));
  await db.delete(profilesTable).where(inArray(profilesTable.id, created));
});

describe("POST /api/webhooks/stripe", () => {
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

  it("answers 500 when Stripe can't be read, and the retry succeeds", async () => {
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

  it("still accepts the old /billing/webhook path during the cutover", async () => {
    const u = await makeUser();
    const sub = setSubscription(u);
    const id = `evt_old_${u}`;
    eventIds.push(id);
    await request(app).post("/api/billing/webhook").set("stripe-signature", "valid").set("content-type", "application/json")
      .send(JSON.stringify({ id, type: "customer.subscription.updated", data: { object: sub } })).expect(200);
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
    expect(row).toMatchObject({ status: "trialing", plan: "member_annual", source: "stripe", providerCustomerId: sub.customer });
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
  it("counts seven days from the paid-through date, not Stripe's rolled-forward period end", async () => {
    const u = await makeUser();
    const paidThrough = nowS() - 3 * DAY_S;
    const sub = setSubscription(u, {
      status: "past_due",
      items: { data: [{ current_period_start: paidThrough, current_period_end: paidThrough + 30 * DAY_S, price: { id: "price_monthly", recurring: { interval: "month" } } }] },
    });
    await sendEvent("invoice.payment_failed", { parent: { subscription_details: { subscription: sub.id } } }).expect(200);
    const row = await memberRow(u);
    expect(row.status).toBe("past_due");
    expect(row.currentPeriodEnd?.getTime()).toBe(paidThrough * 1000);
    expect((await entitlements(u)).tier).toBe("track_b");
  });

  it("drops to free once the seven days have passed, even with a future Stripe period end", async () => {
    const u = await makeUser();
    const paidThrough = nowS() - 8 * DAY_S;
    const sub = setSubscription(u, {
      status: "past_due",
      items: { data: [{ current_period_start: paidThrough, current_period_end: paidThrough + 30 * DAY_S, price: { id: "price_monthly", recurring: { interval: "month" } } }] },
    });
    await sendEvent("invoice.payment_failed", { parent: { subscription_details: { subscription: sub.id } } }).expect(200);
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
    expect(stripeState.expired).toHaveLength(1);
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
    expect(params.customer).toBe(sub.customer);
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
    expect((await memberRow(paying)).source).toBe("stripe");
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

describe("GET /api/billing/prices", () => {
  it("prices the annual plan at ten months", async () => {
    const res = await request(app).get("/api/billing/prices").expect(200);
    expect(res.body.annual.amount).toBe(res.body.monthly.amount * 10);
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

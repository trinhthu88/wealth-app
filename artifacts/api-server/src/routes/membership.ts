import { Router, type IRouter } from "express";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, membershipCheckoutSessionsTable, membershipSettingsTable, membershipsTable, profilesTable } from "@workspace/db";
import { MEMBERSHIP_PLANS, TRIAL_DAYS, isTrialEligible, type MembershipStatus } from "@workspace/tier-policy";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { handleStripeEvent, isRowActive } from "../lib/membershipStore";
import { getBillingPrices, getConfiguredPrices, priceIdForPlan, priceProblem } from "../lib/membershipPrices";
import { getStripe } from "../lib/stripe";

const router: IRouter = Router();
const checkoutBody = z.object({ plan: z.enum(MEMBERSHIP_PLANS) });
const settingsBody = z.object({ monthlyPriceId: z.string().trim().min(1), annualPriceId: z.string().trim().min(1) });
const adminGuard = [requireAuth, requireRole("super_admin")];

// Amounts come from Stripe, so the frontend never holds one.
router.get("/billing/prices", async (_req, res): Promise<void> => {
  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Membership prices aren't available right now." });
    return;
  }
  try {
    const prices = await getBillingPrices();
    if (!prices) {
      logger.error("No membership prices are configured");
      res.status(503).json({ error: "Membership prices aren't available right now." });
      return;
    }
    res.json(prices);
  } catch (err) {
    logger.error({ err }, "Reading membership prices from Stripe failed");
    res.status(503).json({ error: "Membership prices aren't available right now." });
  }
});

router.get("/admin/membership/prices", ...adminGuard, async (_req, res): Promise<void> => {
  if (!process.env.STRIPE_SECRET_KEY) { res.status(503).json({ error: "Stripe isn't configured." }); return; }
  try {
    const prices = await getStripe().prices.list({ active: true, type: "recurring", limit: 100, expand: ["data.product"] });
    res.json(prices.data.map((price) => ({
      id: price.id,
      nickname: price.nickname,
      productName: typeof price.product === "object" && "name" in price.product ? price.product.name : null,
      unitAmount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null,
    })));
  } catch (err) {
    logger.error({ err }, "Listing Stripe prices failed");
    res.status(502).json({ error: "We couldn't reach Stripe." });
  }
});

router.get("/admin/membership/settings", ...adminGuard, async (_req, res): Promise<void> => {
  const [row] = await db.select().from(membershipSettingsTable).where(eq(membershipSettingsTable.id, 1));
  const configured = await getConfiguredPrices();
  res.json({
    monthlyPriceId: configured?.monthlyPriceId ?? null,
    annualPriceId: configured?.annualPriceId ?? null,
    source: configured?.source ?? null,
    updatedBy: row?.updatedBy ?? null,
    updatedAt: row?.updatedAt ?? null,
  });
});

router.put("/admin/membership/settings", ...adminGuard, async (req, res): Promise<void> => {
  const parsed = settingsBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "monthlyPriceId and annualPriceId are required" }); return; }
  const { monthlyPriceId, annualPriceId } = parsed.data;
  if (!process.env.STRIPE_SECRET_KEY) { res.status(503).json({ error: "Stripe isn't configured." }); return; }

  const stripe = getStripe();
  let problem: string | null;
  try {
    const [monthly, annual] = await Promise.all(
      [monthlyPriceId, annualPriceId].map((id) => stripe.prices.retrieve(id, { expand: ["product"] })),
    );
    problem = priceProblem(monthly, "month") ?? priceProblem(annual, "year");
  } catch (err) {
    if ((err as { code?: string }).code === "resource_missing") {
      res.status(400).json({ error: "Stripe has no price with that id." });
      return;
    }
    logger.error({ err }, "Verifying Stripe prices failed");
    res.status(502).json({ error: "We couldn't reach Stripe, so nothing was saved." });
    return;
  }
  if (problem) { res.status(400).json({ error: problem }); return; }

  const values = { monthlyPriceId, annualPriceId, updatedBy: (req as any).userId as string, updatedAt: new Date() };
  const [saved] = await db.insert(membershipSettingsTable).values({ id: 1, ...values })
    .onConflictDoUpdate({ target: membershipSettingsTable.id, set: values }).returning();
  res.json({ ...saved, source: "settings" });
});

router.get("/billing/subscription", requireAuth, async (req, res): Promise<void> => {
  const [row] = await db.select({
    status: membershipsTable.status,
    plan: membershipsTable.plan,
    currentPeriodEnd: membershipsTable.currentPeriodEnd,
    trialEndsAt: membershipsTable.trialEndsAt,
    cancelAtPeriodEnd: membershipsTable.cancelAtPeriodEnd,
  }).from(membershipsTable).where(eq(membershipsTable.userId, (req as any).userId));
  res.json(row ?? { status: "none" });
});

// Writes the session record only. The membership is written when the webhook confirms payment.
router.post("/membership/checkout", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const parsed = checkoutBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "plan must be member_monthly or member_annual" }); return; }
  const { plan } = parsed.data;

  const [[profile], [membership], [open]] = await Promise.all([
    db.select({ role: profilesTable.role, email: profilesTable.email }).from(profilesTable).where(eq(profilesTable.id, userId)),
    db.select().from(membershipsTable).where(eq(membershipsTable.userId, userId)),
    db.select().from(membershipCheckoutSessionsTable).where(eq(membershipCheckoutSessionsTable.userId, userId)),
  ]);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  if (profile.role !== "free_user" && profile.role !== "investment_client") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (isRowActive(membership)) { res.status(409).json({ error: "You are already a member." }); return; }

  // Read fresh, not from the display cache: this is the price the member is charged.
  const configured = await getConfiguredPrices();
  const price = configured && priceIdForPlan(configured, plan);
  if (!price || !process.env.STRIPE_SECRET_KEY) {
    logger.error("Stripe is not configured for membership checkout");
    res.status(503).json({ error: "Membership sign-up isn't available right now." });
    return;
  }
  const stripe = getStripe();

  if (open && open.expiresAt > new Date()) {
    const session = await stripe.checkout.sessions.retrieve(open.sessionId);
    if (session.status === "open") {
      if (open.plan === plan && open.priceId === price) { res.json({ url: open.url }); return; }
      // Changing plan, or an admin changing the price, closes the other session, so a user can't
      // complete both or pay an amount the app no longer sells.
      await stripe.checkout.sessions.expire(open.sessionId);
    }
  }

  // DECISION: see isTrialEligible. The screens read the same rule through entitlements.
  const trial = isTrialEligible((membership?.status ?? null) as MembershipStatus | null);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    ...(membership?.providerCustomerId ? { customer: membership.providerCustomerId } : { customer_email: profile.email }),
    client_reference_id: userId,
    payment_method_collection: "always",
    subscription_data: {
      metadata: { userId },
      ...(trial ? { trial_period_days: TRIAL_DAYS } : {}),
    },
    success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/billing/cancel`,
    allow_promotion_codes: true,
  }, {
    // Two clicks racing past the lookup above carry the same key and get one session.
    idempotencyKey: `membership-checkout:${userId}:${price}:${open?.sessionId ?? "first"}`,
  });

  const record = {
    sessionId: session.id,
    plan,
    priceId: price,
    url: session.url!,
    expiresAt: new Date(session.expires_at * 1000),
  };
  await db.insert(membershipCheckoutSessionsTable).values({ userId, ...record })
    .onConflictDoUpdate({ target: membershipCheckoutSessionsTable.userId, set: record });
  res.json({ url: session.url });
});

router.post("/membership/portal", requireAuth, async (req, res): Promise<void> => {
  const [membership] = await db.select({ customer: membershipsTable.providerCustomerId }).from(membershipsTable)
    .where(eq(membershipsTable.userId, (req as any).userId));
  if (!membership?.customer) { res.status(404).json({ error: "No membership to manage." }); return; }
  const session = await getStripe().billingPortal.sessions.create({
    customer: membership.customer,
    return_url: `${process.env.APP_URL}/dashboard`,
  });
  res.json({ url: session.url });
});

// /billing/webhook is the path Stripe is configured with today. It stays until the endpoint
// has been moved in the Stripe dashboard, so no event is lost during the cutover.
router.post(["/webhooks/stripe", "/billing/webhook"], async (req, res): Promise<void> => {
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // The raw Buffer; see the express.raw() mount in app.ts.
      req.headers["stripe-signature"] as string,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    res.status(400).json({ error: "Webhook signature verification failed" });
    return;
  }
  try {
    await handleStripeEvent(event, stripe);
    res.json({ received: true });
  } catch (err) {
    logger.error({ err, eventId: event.id, eventType: event.type }, "Stripe webhook failed");
    res.status(500).json({ error: "Webhook handling failed" });
  }
});

export default router;

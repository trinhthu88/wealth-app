import { Router, type IRouter } from "express";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, membershipCheckoutSessionsTable, membershipsTable, profilesTable } from "@workspace/db";
import { ANNUAL_MONTHS_FREE, MEMBERSHIP_PLANS, TRIAL_DAYS, isTrialEligible, type MembershipPlan, type MembershipStatus } from "@workspace/tier-policy";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { handleStripeEvent, isRowActive } from "../lib/membershipStore";
import { getStripe } from "../lib/stripe";

const MONTHLY_CENTS = 499;
const PRICES = {
  monthly: { plan: "member_monthly", label: "Monthly", amount: MONTHLY_CENTS, interval: "month" },
  annual: { plan: "member_annual", label: "Annual", amount: MONTHLY_CENTS * (12 - ANNUAL_MONTHS_FREE), interval: "year" },
} as const;

function priceIdFor(plan: MembershipPlan): string | undefined {
  return plan === "member_annual" ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY;
}

const router: IRouter = Router();
const checkoutBody = z.object({ plan: z.enum(MEMBERSHIP_PLANS) });

// One place for the display prices, so the frontend never hardcodes an amount.
router.get("/billing/prices", (_req, res): void => {
  res.json(PRICES);
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

  const price = priceIdFor(plan);
  if (!price || !process.env.STRIPE_SECRET_KEY) {
    logger.error("Stripe is not configured for membership checkout");
    res.status(503).json({ error: "Membership sign-up isn't available right now." });
    return;
  }
  const stripe = getStripe();

  if (open && open.expiresAt > new Date()) {
    const session = await stripe.checkout.sessions.retrieve(open.sessionId);
    if (session.status === "open") {
      if (open.plan === plan) { res.json({ url: open.url }); return; }
      // Changing plan closes the other session, so one user can't complete both.
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
    idempotencyKey: `membership-checkout:${userId}:${plan}:${open?.sessionId ?? "first"}`,
  });

  const record = {
    sessionId: session.id,
    plan,
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

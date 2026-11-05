import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, membershipCheckoutSessionsTable, membershipSettingsTable, membershipsTable, profilesTable } from "@workspace/db";
import { MEMBERSHIP_PLANS, TRIAL_DAYS, isTrialEligible, type MembershipStatus } from "@workspace/tier-policy";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { handleProviderEvent, isRowActive } from "../lib/membershipStore";
import { getBillingPrices, getConfiguredPrices, priceIdForPlan } from "../lib/membershipPrices";
import { PriceNotFoundError, getPaymentProvider, type ProviderEvent } from "../lib/payments";

const router: IRouter = Router();
const checkoutBody = z.object({ plan: z.enum(MEMBERSHIP_PLANS) });
const settingsBody = z.object({ monthlyPriceId: z.string().trim().min(1), annualPriceId: z.string().trim().min(1) });
const adminGuard = [requireAuth, requireRole("super_admin")];

// Amounts come from the provider, so the frontend never holds one.
router.get("/billing/prices", async (_req, res): Promise<void> => {
  if (!getPaymentProvider().isConfigured()) {
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
    logger.error({ err }, "Reading membership prices from the payment provider failed");
    res.status(503).json({ error: "Membership prices aren't available right now." });
  }
});

router.get("/admin/membership/prices", ...adminGuard, async (_req, res): Promise<void> => {
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) { res.status(503).json({ error: "The payment provider isn't configured." }); return; }
  try {
    const prices = await provider.listPrices();
    res.json(prices.map(({ name, ...price }) => ({ ...price, nickname: name })));
  } catch (err) {
    logger.error({ err }, "Listing the payment provider's prices failed");
    res.status(502).json({ error: "We couldn't reach the payment provider." });
  }
});

router.get("/admin/membership/settings", ...adminGuard, async (_req, res): Promise<void> => {
  const [row] = await db.select().from(membershipSettingsTable).where(eq(membershipSettingsTable.id, 1));
  const configured = await getConfiguredPrices();
  res.json({
    monthlyPriceId: configured?.monthlyPriceId ?? null,
    annualPriceId: configured?.annualPriceId ?? null,
    source: configured?.source ?? null,
    provider: getPaymentProvider().name,
    updatedBy: row?.updatedBy ?? null,
    updatedAt: row?.updatedAt ?? null,
  });
});

router.put("/admin/membership/settings", ...adminGuard, async (req, res): Promise<void> => {
  const parsed = settingsBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "monthlyPriceId and annualPriceId are required" }); return; }
  const { monthlyPriceId, annualPriceId } = parsed.data;
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) { res.status(503).json({ error: "The payment provider isn't configured." }); return; }

  let problem: string | null;
  try {
    const [monthlyProblem, annualProblem] = await Promise.all([
      provider.priceProblem(monthlyPriceId, "month"),
      provider.priceProblem(annualPriceId, "year"),
    ]);
    problem = monthlyProblem ?? annualProblem;
  } catch (err) {
    if (err instanceof PriceNotFoundError) {
      res.status(400).json({ error: "The payment provider has no price with that id." });
      return;
    }
    logger.error({ err }, "Verifying the payment provider's prices failed");
    res.status(502).json({ error: "We couldn't reach the payment provider, so nothing was saved." });
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
  const provider = getPaymentProvider();
  if (!price || !provider.isConfigured()) {
    logger.error("The payment provider is not configured for membership checkout");
    res.status(503).json({ error: "Membership sign-up isn't available right now." });
    return;
  }

  try {
    if (open && open.expiresAt > new Date() && await provider.isCheckoutOpen(open.sessionId)) {
      if (open.plan === plan && open.priceId === price) { res.json({ url: open.url }); return; }
      // Changing plan, or an admin changing the price, closes the other session, so a user can't
      // complete both or pay an amount the app no longer sells.
      await provider.closeCheckout(open.sessionId);
    }

    // DECISION: see isTrialEligible. The screens read the same rule through entitlements.
    const trial = isTrialEligible((membership?.status ?? null) as MembershipStatus | null);
    const checkout = await provider.createCheckout({
      userId,
      email: profile.email,
      priceId: price,
      trialDays: trial ? TRIAL_DAYS : 0,
      customerId: membership?.provider === provider.name ? membership.providerCustomerId : null,
      // Two clicks racing past the lookup above carry the same key and get one session.
      idempotencyKey: `membership-checkout:${userId}:${price}:${open?.sessionId ?? "first"}`,
    });

    const record = { sessionId: checkout.sessionId, plan, priceId: price, url: checkout.url, expiresAt: checkout.expiresAt };
    await db.insert(membershipCheckoutSessionsTable).values({ userId, ...record })
      .onConflictDoUpdate({ target: membershipCheckoutSessionsTable.userId, set: record });
    res.json({ url: checkout.url });
  } catch (err) {
    logger.error({ err }, "Creating a membership checkout failed");
    res.status(503).json({ error: "Membership sign-up isn't available right now." });
  }
});

router.post("/membership/portal", requireAuth, async (req, res): Promise<void> => {
  const provider = getPaymentProvider();
  const [membership] = await db.select({ customer: membershipsTable.providerCustomerId, provider: membershipsTable.provider })
    .from(membershipsTable).where(eq(membershipsTable.userId, (req as any).userId));
  // A customer id from another provider means nothing to this one.
  if (!membership?.customer || membership.provider !== provider.name) {
    res.status(404).json({ error: "No membership to manage." });
    return;
  }
  try {
    res.json({ url: await provider.portalUrl(membership.customer) });
  } catch (err) {
    logger.error({ err }, "Opening the billing portal failed");
    res.status(502).json({ error: "We couldn't open your billing page just now." });
  }
});

// /webhooks/payments is the endpoint. The Stripe paths stay as aliases until that provider is removed.
router.post(["/webhooks/payments", "/webhooks/stripe", "/billing/webhook"], async (req, res): Promise<void> => {
  const provider = getPaymentProvider();
  let event: ProviderEvent;
  try {
    event = provider.verifyWebhook(req.body, req.headers); // The raw Buffer; see the express.raw() mount in app.ts.
  } catch {
    res.status(400).json({ error: "Webhook signature verification failed" });
    return;
  }
  try {
    await handleProviderEvent(event, provider);
    res.json({ received: true });
  } catch (err) {
    logger.error({ err, eventId: event.id, eventType: event.type }, "Payment webhook failed");
    res.status(500).json({ error: "Webhook handling failed" });
  }
});

export default router;

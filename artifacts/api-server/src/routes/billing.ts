import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db, profilesTable, subscriptionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const PRICES = {
  monthly: {
    id: process.env.STRIPE_PRICE_MONTHLY!, // set in env
    label: "Monthly",
    amount: 499, // cents
    interval: "month",
  },
  yearly: {
    id: process.env.STRIPE_PRICE_YEARLY!, // set in env
    label: "Yearly",
    amount: 4192, // cents — $41.92 (30% off $59.88)
    interval: "year",
  },
} as const;

type PlanKey = keyof typeof PRICES;

// Constructed lazily, not at module scope: this throws if STRIPE_SECRET_KEY
// isn't set, and this route file is imported eagerly by routes/index.ts
// alongside every other route — a top-level throw here would take down the
// whole server (and every other route's tests) until Stripe is configured.
// Deferring construction to request time means every other route keeps
// working regardless, and only a request that actually needs Stripe fails.
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: Stripe.API_VERSION,
    });
  }
  return stripeClient;
}

async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const [existing] = await db.select({ stripeCustomerId: subscriptionsTable.stripeCustomerId })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));
  if (existing) return existing.stripeCustomerId;

  const customer = await getStripe().customers.create({ email, metadata: { userId } });
  await db.insert(subscriptionsTable).values({
    userId,
    stripeCustomerId: customer.id,
    status: "inactive",
  });
  return customer.id;
}

const router: IRouter = Router();

// Public pricing info for the frontend's plan picker and billing-success page.
// This is the one place plan prices are defined (the PRICES constant above);
// the frontend must read them from here rather than hardcoding amounts so the
// two can never drift. `id` (the Stripe price ID) is included so the success
// page can match a subscription's stripePriceId back to a plan label — it
// isn't secret, it's already visible to the browser via the Checkout flow.
router.get("/billing/prices", (_req, res): void => {
  res.json({
    monthly: { id: PRICES.monthly.id, label: PRICES.monthly.label, amount: PRICES.monthly.amount, interval: PRICES.monthly.interval },
    yearly: { id: PRICES.yearly.id, label: PRICES.yearly.label, amount: PRICES.yearly.amount, interval: PRICES.yearly.interval },
  });
});

router.post("/billing/create-checkout-session", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const { plan } = req.body as { plan?: string };
  if (plan !== "monthly" && plan !== "yearly") {
    res.status(400).json({ error: "plan must be 'monthly' or 'yearly'" });
    return;
  }

  const [profile] = await db.select({ email: profilesTable.email }).from(profilesTable).where(eq(profilesTable.id, userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(userId, profile.email);

  const session = await getStripe().checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: PRICES[plan as PlanKey].id, quantity: 1 }],
    success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/billing/cancel`,
    subscription_data: {
      metadata: { userId },
    },
    allow_promotion_codes: true,
  });

  res.json({ url: session.url });
});

router.post("/billing/create-portal-session", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;

  const [sub] = await db.select({ stripeCustomerId: subscriptionsTable.stripeCustomerId })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));
  if (!sub) {
    res.status(404).json({ error: "No subscription found" });
    return;
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${process.env.APP_URL}/dashboard`,
  });

  res.json({ url: session.url });
});

router.get("/billing/subscription", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const [sub] = await db.select({
    status: subscriptionsTable.status,
    currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
    cancelAtPeriodEnd: subscriptionsTable.cancelAtPeriodEnd,
    stripePriceId: subscriptionsTable.stripePriceId,
  }).from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));

  if (!sub) {
    res.json({ status: "inactive" });
    return;
  }
  res.json(sub);
});

router.post("/billing/webhook", async (req, res): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body, // must be raw Buffer, not parsed JSON — see the express.raw() mount in app.ts
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    res.status(400).json({ error: `Webhook signature verification failed: ${(err as Error).message}` });
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const sub = await getStripe().subscriptions.retrieve(session.subscription as string);
      const periodEnd = sub.items.data[0]?.current_period_end;
      await db.update(subscriptionsTable)
        .set({
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0]?.price.id,
          status: sub.status,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        })
        .where(eq(subscriptionsTable.stripeCustomerId, session.customer as string));
      // Promote user role to investment_client
      const checkoutUserId = sub.metadata.userId;
      if (checkoutUserId) {
        await db.update(profilesTable)
          .set({ role: "investment_client" })
          .where(eq(profilesTable.id, checkoutUserId));
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata.userId;
      const periodEnd = sub.items.data[0]?.current_period_end;
      await db.update(subscriptionsTable)
        .set({
          stripePriceId: sub.items.data[0]?.price.id,
          status: sub.status,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        })
        .where(eq(subscriptionsTable.stripeCustomerId, sub.customer as string));
      // If reactivated after cancel, restore role
      if (sub.status === "active" && userId) {
        await db.update(profilesTable)
          .set({ role: "investment_client" })
          .where(eq(profilesTable.id, userId));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await db.update(subscriptionsTable)
        .set({ status: "canceled" })
        .where(eq(subscriptionsTable.stripeCustomerId, sub.customer as string));
      // Revert to free user
      const userId = sub.metadata.userId;
      if (userId) {
        await db.update(profilesTable)
          .set({ role: "free_user" })
          .where(eq(profilesTable.id, userId));
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await db.update(subscriptionsTable)
        .set({ status: "past_due" })
        .where(eq(subscriptionsTable.stripeCustomerId, invoice.customer as string));
      break;
    }
  }

  res.json({ received: true });
});

export default router;

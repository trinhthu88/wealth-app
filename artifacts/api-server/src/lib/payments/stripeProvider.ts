import type Stripe from "stripe";
import type { MembershipStatus } from "@workspace/tier-policy";
import { getStripe } from "../stripe";
import {
  PriceNotFoundError,
  type BillingInterval, type CheckoutInput, type PaymentProvider, type ProviderCheckout, type ProviderEvent,
  type ProviderPrice, type ProviderPriceDetail, type ProviderSubscription,
} from "./provider";

function statusFromStripe(status: Stripe.Subscription.Status): MembershipStatus {
  switch (status) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due":
    case "unpaid": return "past_due";
    case "canceled":
    case "paused": return "canceled";
    default: return "none"; // incomplete, incomplete_expired: nothing was ever paid.
  }
}

const fromUnix = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000) : null);

/**
 * DECISION: while past_due, paidThrough is the end of the last paid period. The grace rule is
 * currentPeriodEnd + 7 days, but Stripe rolls current_period_end forward as soon as the renewal
 * invoice is created, even if payment then fails, so using its value would give a monthly member
 * about 37 days and an annual member over a year. The new period's start is the date they paid through.
 *
 * DECISION: a canceled Stripe subscription has no paid-through date. A future date now keeps access
 * (Lemon Squeezy's cancelled state needs that), but Stripe only reports canceled once it has ended.
 */
function paidThrough(sub: Stripe.Subscription, status: MembershipStatus): Date | null {
  if (status === "canceled") return null;
  const item = sub.items.data[0];
  return fromUnix(status === "past_due" ? item?.current_period_start : item?.current_period_end);
}

function customerId(customer: Stripe.Subscription["customer"]): string {
  return typeof customer === "string" ? customer : customer.id;
}

/** The subscription an event is about, whichever object Stripe delivered. */
function subscriptionIdFor(event: Stripe.Event): string | null {
  const idOf = (s: string | { id: string } | null | undefined) => (typeof s === "string" ? s : s?.id ?? null);
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      return session.mode === "subscription" ? idOf(session.subscription) : null;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return (event.data.object as Stripe.Subscription).id;
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      return idOf(invoice.parent?.subscription_details?.subscription);
    }
    default:
      return null;
  }
}

function toProviderPrice(price: Stripe.Price): ProviderPrice {
  return {
    id: price.id,
    productName: typeof price.product === "object" && "name" in price.product ? price.product.name : null,
    name: price.nickname,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval ?? null,
  };
}

async function retrievePrice(id: string, options?: Stripe.PriceRetrieveParams): Promise<Stripe.Price> {
  try {
    return await getStripe().prices.retrieve(id, options);
  } catch (err) {
    if ((err as { code?: string }).code === "resource_missing") throw new PriceNotFoundError(id);
    throw err;
  }
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  isConfigured() {
    return !!process.env.STRIPE_SECRET_KEY;
  },

  async listPrices() {
    const prices = await getStripe().prices.list({ active: true, type: "recurring", limit: 100, expand: ["data.product"] });
    return prices.data.map(toProviderPrice);
  },

  async getPrice(id): Promise<ProviderPriceDetail> {
    const price = await retrievePrice(id);
    return { ...toProviderPrice(price), active: price.active };
  },

  async priceProblem(id, interval: BillingInterval) {
    const price = await retrievePrice(id, { expand: ["product"] });
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
  },

  envPriceIds() {
    const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY;
    const annualPriceId = process.env.STRIPE_PRICE_ANNUAL;
    return monthlyPriceId && annualPriceId ? { monthlyPriceId, annualPriceId } : null;
  },

  async createCheckout({ userId, email, priceId, trialDays, customerId: customer, idempotencyKey }: CheckoutInput): Promise<ProviderCheckout> {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(customer ? { customer } : { customer_email: email }),
      client_reference_id: userId,
      payment_method_collection: "always",
      subscription_data: {
        metadata: { userId },
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      },
      success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/billing/cancel`,
      allow_promotion_codes: true,
    }, idempotencyKey ? { idempotencyKey } : undefined);
    return { url: session.url!, sessionId: session.id, expiresAt: new Date(session.expires_at * 1000) };
  },

  async isCheckoutOpen(sessionId) {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    return session.status === "open";
  },

  async closeCheckout(sessionId) {
    await getStripe().checkout.sessions.expire(sessionId);
  },

  async portalUrl(providerCustomerId) {
    const session = await getStripe().billingPortal.sessions.create({
      customer: providerCustomerId,
      return_url: `${process.env.APP_URL}/dashboard`,
    });
    return session.url;
  },

  verifyWebhook(rawBody, headers): ProviderEvent {
    const event = getStripe().webhooks.constructEvent(
      rawBody,
      headers["stripe-signature"] as string,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
    return { id: event.id, type: event.type, subscriptionId: subscriptionIdFor(event), userId: null };
  },

  async fetchSubscription(id): Promise<ProviderSubscription> {
    const sub = await getStripe().subscriptions.retrieve(id);
    const status = statusFromStripe(sub.status);
    const price = sub.items.data[0]?.price;
    return {
      id: sub.id,
      customerId: customerId(sub.customer),
      priceId: price?.id ?? null,
      interval: price?.recurring?.interval ?? null,
      status,
      paidThrough: paidThrough(sub, status),
      trialEndsAt: fromUnix(sub.trial_end),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      userId: sub.metadata?.userId ?? null,
    };
  },
};

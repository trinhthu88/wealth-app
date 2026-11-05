import type { MembershipStatus } from "@workspace/tier-policy";

export type ProviderName = "lemonsqueezy" | "stripe";
export type BillingInterval = "month" | "year";

/** What the admin page shows. unitAmount is null when a price has no single amount. */
export interface ProviderPrice {
  id: string;
  productName: string | null;
  name: string | null;
  unitAmount: number | null;
  currency: string;
  interval: string | null;
}

export interface ProviderPriceDetail extends ProviderPrice {
  active: boolean;
}

export interface ProviderSubscription {
  id: string;
  customerId: string;
  priceId: string | null;
  /** Decides the plan. By interval, not id: subscribers stay on prices the admin has since replaced. */
  interval: string | null;
  status: MembershipStatus;
  /** Null while past_due means the provider can't say, so the date already stored stands. */
  paidThrough: Date | null;
  trialEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  userId: string | null;
}

export interface ProviderEvent {
  id: string;
  type: string;
  subscriptionId: string | null;
  /** The link to our user when the event carries it. Lemon Squeezy's subscriptions don't. */
  userId: string | null;
}

export interface CheckoutInput {
  userId: string;
  email: string;
  priceId: string;
  /** 0 means no trial. */
  trialDays: number;
  customerId?: string | null;
  idempotencyKey?: string;
}

export interface ProviderCheckout {
  url: string;
  sessionId: string;
  expiresAt: Date;
}

/** No such price at this provider, as opposed to the provider being unreachable. */
export class PriceNotFoundError extends Error {
  constructor(id: string) {
    super(`No price with id ${id}`);
    this.name = "PriceNotFoundError";
  }
}

export interface PaymentProvider {
  readonly name: ProviderName;
  /** False when this provider's keys are missing. Routes answer 503. */
  isConfigured(): boolean;
  listPrices(): Promise<ProviderPrice[]>;
  /** Throws PriceNotFoundError. */
  getPrice(id: string): Promise<ProviderPriceDetail>;
  /** Why this price can't be sold on this plan, or null if it can. Throws PriceNotFoundError. */
  priceProblem(id: string, interval: BillingInterval): Promise<string | null>;
  /** The prices named in the environment, used until an admin chooses. Null when there are none. */
  envPriceIds(): { monthlyPriceId: string; annualPriceId: string } | null;
  createCheckout(input: CheckoutInput): Promise<ProviderCheckout>;
  isCheckoutOpen(sessionId: string): Promise<boolean>;
  /** Stops a checkout being completed, where the provider allows that. */
  closeCheckout(sessionId: string): Promise<void>;
  portalUrl(providerCustomerId: string): Promise<string>;
  /** Throws on a bad signature. */
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ProviderEvent;
  /** Re-reads the subscription, because webhook payloads and delivery order can't be trusted. */
  fetchSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;
}

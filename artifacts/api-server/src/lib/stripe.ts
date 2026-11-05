import Stripe from "stripe";

// Constructed lazily, not at module scope: this throws if STRIPE_SECRET_KEY isn't set, and
// the route files are imported eagerly by routes/index.ts, so a top-level throw would take
// down the whole server until Stripe is configured. Only a request that needs Stripe fails.
let stripeClient: Stripe | null = null;
export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: Stripe.API_VERSION });
  }
  return stripeClient;
}

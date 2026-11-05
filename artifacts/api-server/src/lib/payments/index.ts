import { lemonSqueezyProvider } from "./lemonSqueezyProvider";
import type { PaymentProvider } from "./provider";
import { stripeProvider } from "./stripeProvider";

export * from "./provider";

const PROVIDERS: Record<string, PaymentProvider> = {
  lemonsqueezy: lemonSqueezyProvider,
  stripe: stripeProvider,
};

/**
 * PAYMENT_PROVIDER picks the adapter, defaulting to Lemon Squeezy. A value it doesn't know throws:
 * index.ts calls this at boot, so a typo stops the deploy instead of selling through the wrong provider.
 */
export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER || "lemonsqueezy";
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`PAYMENT_PROVIDER must be lemonsqueezy or stripe, not "${name}"`);
  return provider;
}

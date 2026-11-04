# Addendum: Lemon Squeezy as the membership payment provider (Phase 8)

Supplements `subscription-addendum.md`. Stripe is not available to a Vietnam-registered business, so the membership provider becomes Lemon Squeezy, a merchant of record that pays out to Vietnamese banks. Every owner decision stands: 7-day trial with card, 7-day grace, one price for both tracks, annual at two months free, admin comps with a reason, comp existing clients at deploy.

## Principle

Nothing in the membership design changes. `memberships` stays the only owner table, written only by the provider webhook and the super-admin comp route. The provider is behind one interface so Stripe can come back later, or MoMo can be added, as an adapter.

```ts
// artifacts/api-server/src/lib/payments/provider.ts
export interface PaymentProvider {
  readonly name: "lemonsqueezy" | "stripe";
  listPrices(): Promise<ProviderPrice[]>;                 // what the admin page shows
  createCheckout(input: { userId: string; email: string; priceId: string; trialDays: number }): Promise<{ url: string; sessionId: string; expiresAt: Date }>;
  portalUrl(providerCustomerId: string): Promise<string>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ProviderEvent; // throws on bad signature
  fetchSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>; // re-read, never trust the payload
}
export interface ProviderPrice { id: string; productName: string; name: string; unitAmount: number; currency: string; interval: "month" | "year"; }
export interface ProviderSubscription { id: string; customerId: string; priceId: string; status: MembershipStatus; paidThrough: Date | null; trialEndsAt: Date | null; cancelAtPeriodEnd: boolean; userId: string | null; }
export interface ProviderEvent { id: string; type: string; subscriptionId: string | null; }
```

`membershipStore.handleProviderEvent(event, provider)` replaces `handleStripeEvent` and contains no provider-specific code. Keep `StripeProvider` as the existing code moved behind the interface; add `LemonSqueezyProvider`. `PAYMENT_PROVIDER=lemonsqueezy|stripe` selects at boot; missing keys make checkout answer 503 as today.

## Lemon Squeezy mapping

| Concept | Stripe | Lemon Squeezy |
|---|---|---|
| Sellable price | Price on a Product | **Variant** on a Product (one product "tala membership", two variants: Monthly, Annual) |
| Trial | `trial_period_days` on checkout | the variant's own free-trial setting (7 days), card required by default |
| Checkout | Checkout Session | `POST /v1/checkouts` with `checkout_data.custom.user_id` and `checkout_data.email`; returns `data.attributes.url`; set `expires_at` to +24h |
| Customer | Customer | Customer (`customer_id` on the subscription) |
| Billing portal | Billing Portal session | `subscription.attributes.urls.customer_portal` (and `update_payment_method`) |
| Re-read subscription | `subscriptions.retrieve` | `GET /v1/subscriptions/{id}` |
| Webhook signature | `stripe-signature`, HMAC via SDK | `X-Signature` header, HMAC-SHA256 of the raw body with the signing secret; compare with a constant-time check |
| Idempotency key | `event.id` | `meta.event_name` + `data.id` + `data.attributes.updated_at` (Lemon Squeezy events carry no event id; derive one and store it in `stripe_webhook_events`, renamed `payment_webhook_events`) |
| User link | `subscription.metadata.userId` | `meta.custom_data.user_id` on the webhook, and `subscription.attributes.first_subscription_item` has no custom data, so store `providerCustomerId` → userId on first event and look up by customer afterwards |

Status mapping (`attributes.status`):

| Lemon Squeezy | memberships.status |
|---|---|
| `on_trial` | trialing |
| `active` | active |
| `past_due`, `unpaid` | past_due |
| `cancelled` (still paid through `ends_at`), `paused` | canceled, with `currentPeriodEnd = ends_at` so access runs to the paid-through date |
| `expired` | canceled |

Paid-through: `renews_at` while on_trial/active; `ends_at` when cancelled; for past_due keep the previous paid-through value already stored (Lemon Squeezy does not roll it forward the way Stripe does, but do not trust a moved `renews_at` during dunning). Grace = paid-through + 7 days, unchanged.

Webhook events to subscribe to: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`, `subscription_payment_failed`, `subscription_payment_success`, `subscription_payment_recovered`. Every one of them is handled the same way: derive the subscription id, re-read it from the API, upsert `memberships`.

## Routes

- `POST /api/webhooks/payments` (no auth, raw body, signature verified). Keep `/api/webhooks/stripe` mounted as an alias until the Stripe provider is removed.
- `POST /api/membership/checkout`, `POST /api/membership/portal`, `GET /billing/prices`, `GET/PUT /api/admin/membership/*` keep their shapes; only the provider behind them changes. The admin page lists variants as "prices".

## Secrets

`PAYMENT_PROVIDER=lemonsqueezy`, `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `APP_URL`. Never log or return them.

## Tests

- Provider interface contract test run against both adapters with mocked HTTP.
- Signature verification: valid, tampered body, missing header.
- Status mapping table, including cancelled-but-paid-through and past_due keeping the old paid-through date.
- Idempotency: the same Lemon Squeezy event delivered twice changes nothing.
- The existing Phase 5 and Phase 7 suites pass with `PAYMENT_PROVIDER=lemonsqueezy` and with `stripe`.

## Deploy note

The Stripe prices step in the deploy order is replaced by: create the product and two variants in Lemon Squeezy, select them on `/admin/membership`, point the Lemon Squeezy webhook at `/api/webhooks/payments`. Test mode in Lemon Squeezy is a dashboard toggle; test-mode API keys and webhooks are separate from live ones.

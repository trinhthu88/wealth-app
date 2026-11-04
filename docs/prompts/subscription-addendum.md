# Addendum: subscription fee for Track A and Track B clients

Supplements `implement-free-tier-conversion.md`. Paste after it, or point the session at this file. It changes decision 1 from the implementation notes: paid sign-up stays, as a membership fee that every client (Track A and Track B) pays to use the application.

## The rule

A user is an investment client only while two things are true: `profiles.role = investment_client` **and** an active membership. The membership is a separate fact with its own owner table. Advisor assignment and track are unchanged.

```
tier = free                     when role = free_user, or membership is not active
tier = track_b                  when role = investment_client and membership active and no in-force advised plan
tier = track_a                  when role = investment_client and membership active and an in-force advised plan exists
```

A lapsed membership does not delete or move anything. The user drops to free limits on the same data, keeps their advisor assignment, and the advisor keeps read access. Re-activating restores the tier instantly.

## Owner table (the only place membership is written)

`memberships(userId pk, provider "stripe", providerCustomerId, providerSubscriptionId, plan, status, currentPeriodEnd, trialEndsAt, cancelAtPeriodEnd, source, updatedAt)`

- `status` enum: `none | trialing | active | past_due | canceled`. Active for entitlement purposes = `trialing | active`, plus `past_due` inside a 7-day grace window.
- Written only by the Stripe webhook handler (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`) and by one super-admin route for comped memberships (`source = "comped"`, with a reason). No other code path may write it.
- `plan` enum: `member_monthly | member_annual`. One price for both tracks. If Track A members should pay nothing because the advised plan carries advisory fees, express that as `source = "advised_plan"` set by the webhook-equivalent server hook when a plan goes in force, not as a different tier.

Add `membership: { status, plan, currentPeriodEnd, trialEndsAt, manageUrl }` to `GET /api/me/entitlements`. Nothing in the browser decides whether a membership is active.

## Where payment sits in the journey

Two doors into the client rung, same destination.

**Advisor-led (default).** Free user accepts a checkpoint → lead → super admin assigns → advisor promotes. Promotion sets `role = investment_client` and `advisorId`, and creates a Stripe Checkout session; the user's next sign-in shows an "Activate your membership" screen (price, what unlocks, 14-day trial). Until the webhook confirms, the user is in state `pending_payment`: role is client, tier resolves to free, advisor card shows the advisor's name with "Activate to start". The advisor sees `pending_payment` on the client and lead lists.

**Self-serve.** The advisor card's second action, "Become a member", opens Checkout directly for a free user with no lead. The webhook sets membership active and creates a lead with `source = "self_serve_member"`, `status = unassigned`, so the super admin assigns an advisor as usual. Until assignment the user has full client limits and the advisor card shows "We are matching you with an advisor".

Both doors end in the same state: `role = investment_client`, membership active, `advisorId` set.

## Checkpoint changes

- C7 becomes two actions on the advisor card: "Talk to an advisor" (interest, free) and "Become a member" (Checkout). Every other checkpoint keeps the interest action; a checkpoint's accept screen may show the membership price as information, never as a second button.
- New checkpoint `C11_trial_ending`: fires 3 days before `trialEndsAt` for `trialing` members with no card on file, shown on the dashboard, action = manage membership. Not a lead.
- New checkpoint `C12_lapsed`: fires once when membership drops to `canceled`; shows what the user lost and a reactivate action; cool-down 30 days. Not a lead.

## Entitlement and gate changes

`lib/tier-policy`: `resolveTier(role, clientTrack, hasInforcePlan, membershipStatus, graceUntil)`. `requireAllowance` reads membership through the same resolver. No new gates: a lapsed client simply gets free limits.

Locked-feature copy for a free user now says what unlocks with membership and what unlocks with an advisor, because they are different:

- Membership unlocks: unlimited goals and holdings, 12-month budget and 24-month trend, all six scenarios, full coast point, full score breakdown, Sol allowance.
- Advisor unlocks: messages, documents, financial plan and milestones, review requests, advised plans.

## Routes

- `POST /api/membership/checkout` (auth): creates a Checkout session for the caller, returns `{ url }`. Idempotent per user while a session is open.
- `POST /api/membership/portal` (auth, members only): Stripe billing portal URL.
- `POST /api/webhooks/stripe` (no auth, signature verified with `STRIPE_WEBHOOK_SECRET`, raw body; mount before `express.json()` like the Clerk proxy). Upserts `memberships`, then runs the self-serve lead creation when a free user's first membership becomes active.
- `PUT /api/admin/users/:id/membership` (super_admin): comp or revoke, with a reason, recorded in `memberships.source`.

Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` from the environment. Never log them; never return them.

## Promotion transaction

`promoteLeadToClient` adds one step: if the user has no active membership, create the Checkout session and store `pending_payment` on `client_profiles.status`. `client_profiles.status` enum becomes `pending_payment | active | paused | churned`. The existing `active` default applies when membership is already active or comped.

## Tests to add

- Tier resolution for every combination of role, track, in-force plan and membership status, including the grace window.
- Webhook idempotency: the same event twice changes nothing.
- Lapse: a Track B client with 8 holdings whose membership is canceled can still read all 8 but cannot add a ninth, and the advisor can still read them.
- Self-serve door creates exactly one unassigned lead with `source = self_serve_member`.
- Advisor-led door leaves the user at free limits until the webhook, then at client limits.

## Decisions for the owner (defaults in brackets)

1. Trial length and card-up-front [14 days, card required].
2. Grace window after a failed payment [7 days].
3. Does an in-force advised plan waive the fee [no; one price for everyone, revisit with advisory-fee data].
4. Annual plan discount [two months free].
5. Whether a super admin can comp a membership [yes, with a reason, visible on the client list].

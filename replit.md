# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Environment Variables

- `artifacts/wealthapp` — `VITE_POSTHOG_KEY`: PostHog product analytics key (see `.env.example`). Analytics only initializes in production builds; get a free key from posthog.com. Tracks the free-user and investment_client funnels (onboarding, goals, budget, health score, upgrade CTAs, milestones) — not yet wired into the advisor or admin portals.

### Required environment variables (membership payments)

`artifacts/api-server` — see `.env.example`. `PAYMENT_PROVIDER` selects the adapter behind `src/lib/payments`, and defaults to `lemonsqueezy`. An unknown value stops the server at boot. Missing keys make checkout answer 503.

```
PAYMENT_PROVIDER=lemonsqueezy
LEMONSQUEEZY_API_KEY=...             # Settings → API. Test-mode keys and webhooks are separate from live ones.
LEMONSQUEEZY_STORE_ID=...            # Settings → Stores
LEMONSQUEEZY_WEBHOOK_SECRET=...      # the signing secret you choose for the webhook
APP_URL=https://your-replit-app.repl.co   # your deployed Replit URL
```

**Creating the prices** — in Lemon Squeezy, create one subscription product, "tala membership", with two variants: Monthly and Annual (two months free is the usual choice). Each variant needs a 7-day free trial, or `/admin/membership` refuses it. A super admin then chooses them at `/admin/membership`.

**Creating the webhook** — Settings → Webhooks:
- URL: `https://your-replit-app.repl.co/api/webhooks/payments` — note the `/api` prefix; every api-server route is mounted under `/api` (see `src/app.ts`).
- Events: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`, `subscription_payment_failed`, `subscription_payment_success`, `subscription_payment_recovered`
- The signing secret you enter → `LEMONSQUEEZY_WEBHOOK_SECRET`

**Stripe** remains as an adapter: `PAYMENT_PROVIDER=stripe`, with `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and, until a super admin chooses prices, `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL`. `/api/webhooks/stripe` and `/api/billing/webhook` stay as aliases of the endpoint until that provider is removed.

The webhook route reads the raw request body (required for the signature check) via an `express.raw()` mount on all three paths in `app.ts`, registered before the global `express.json()` — do not reorder those two.

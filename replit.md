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

### Required environment variables (Stripe billing)

`artifacts/api-server` — see `.env.example`:

```
STRIPE_SECRET_KEY=sk_live_...        # from Stripe dashboard → API keys
STRIPE_WEBHOOK_SECRET=whsec_...      # from Stripe dashboard → Webhooks
STRIPE_PRICE_MONTHLY=price_...       # create in Stripe dashboard (see note)
STRIPE_PRICE_ANNUAL=price_...        # create in Stripe dashboard (see note)
APP_URL=https://your-replit-app.repl.co   # your deployed Replit URL
```

**Creating the Stripe prices** — in the Stripe dashboard → Products → Add product:
- Name: "tala Membership"
- Add two prices:
  1. A monthly recurring price
  2. A yearly recurring price (two months free is the usual choice)

A super admin chooses which prices the app sells at `/admin/membership`. Until then the app sells the prices in `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL`, which may be left unset once a selection is saved.

**Creating the webhook** — in the Stripe dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://your-replit-app.repl.co/api/webhooks/stripe` — note the `/api` prefix; every api-server route is mounted under `/api` (see `src/app.ts`). The old `/api/billing/webhook` path still works, and should be removed once the endpoint has moved.
- Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

The webhook route reads the raw request body (required for Stripe's signature check) via an `express.raw()` mount on both paths in `app.ts`, registered before the global `express.json()` — do not reorder those two.

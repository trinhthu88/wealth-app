repo: trinhthu88/wealth-app
branch: main
path: artifacts/wealthapp/src

## Last sync
date: 2026-08-17T08:48:01Z

### Updated in this project
- Built the tala Investment Client mobile prototype from the repo's real brand tokens (cream/navy/green, Sora + Plus Jakarta Sans + JetBrains Mono eyebrows, 1rem radius).
- Reused the Sol mark geometry from `components/Sol.tsx` / `components/client/AppShell.tsx` for the mascot states.
- Benchmark-deviation pattern grounded in `components/BenchmarkCard.tsx`; dual-currency display follows `components/client/CurrencyDisplay.tsx`.

## Screen map
| Screen (in prototype) | Repo source read |
| --- | --- |
| Dashboard | pages/client/dashboard.tsx, components/client/AppShell.tsx |
| Accounts (managed / self-tracked) | components/client/HoldingTypeBadge.tsx, components/BenchmarkCard.tsx, components/client/CurrencyDisplay.tsx |
| Scenario comparison | pages/client/dashboard.tsx (advisor-pushed scenario pattern) |
| Onboarding | PRODUCT.md (5-step wizard description) |
| Health score | components/HealthScoreRing.tsx (referenced), index.css tokens |

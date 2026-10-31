---
name: Shared net-worth calculation
description: Keep API consumers and the nightly snapshot job on one calculation implementation.
---

Keep the database-backed net-worth calculation and `valueOfHolding` in a shared workspace library. Re-export them from the API server's `src/lib/netWorthService.ts` facade, and have scheduled scripts import the shared library directly. Do not make the scripts package depend on the API-server artifact or duplicate its formula.

**Why:** the scheduled snapshot command and HTTP consumers must calculate from the same holdings, plans, assets, liabilities, and mortgage rules, while the workspace keeps scripts and artifacts as separate package boundaries.

**How to apply:** when adding another consumer, import the shared net-worth package. Keep HTTP authorization and response validation in the API artifact; keep calculation and snapshot persistence in the shared package.

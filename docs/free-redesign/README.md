# Free-plan redesign

The free-plan screens follow the approved Claude Design canvas "tala Free User App". That canvas copies the "tala Investor App Redesign" and the live investment-client app.

Screenshots: a 390px phone viewport with sample data for one persona.

## Navigation

The menu bar is the same as the investment client's: **Home · Budget · Wealth · (Sol) · Goals · Advisor**.
- **Wealth** has tabs: Net worth | Portfolio.
- **Goals** has tabs: Goals | Pathway | Milestones.
- **Health score** and **Settings** open from Home with a back button.
- **Advisor** is where a free user meets an advisor (`/free/advisor`): what an advisor adds, plan prices, and a free call.
- **Onboarding** stays a standalone flow.

## Free-plan limits shown in the design

- 1 goal
- 5 self-tracked holdings
- 3 months of history

The app enforces the numbers in `lib/tier-policy` (`TIER_LIMITS.free`), the one place they are set. The screenshots were taken when the design showed 2 holdings; the limit is 5, as in the free-user journey map.

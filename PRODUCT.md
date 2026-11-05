# PRODUCT.md — tala

## Product Purpose

tala is a wealth management platform for expats and international professionals, primarily in Southeast Asia (Vietnam focus). It connects investment clients with financial advisors, providing portfolio tracking, financial planning, goal management, and scenario modeling.

## Register

product

## Users

**Investment clients** (`investment_client`): Expats and high-net-worth individuals who invest through tala advisors. They onboard via a 5-step wizard, then use the portal for portfolio monitoring, goal tracking, scenario planning, and advisor communication.

**Free tier users** (`free`): Prospective or self-service users who use basic financial tracking (budget, net worth, goals, health score) without an advisor relationship.

**Advisors** (`advisor`): Financial advisors managing client portfolios, tasks, leads, and communication.

**Admins** (`super_admin`): Platform administrators managing users, funds, pricing, and content.

## Brand

- **Name**: tala (always lowercase)
- **Palette** (2026 redesign): Soft Cloud #FFFEFD (background), Cobalt Pulse #0C21A4 (text, buttons, hero cards, menu bar), Spring Field #D4D67D (highlights, active tab), Blue Breeze #B8C7F8 (soft cards), Sunset Pop #FF891F (Sol and "needs attention" only). Tokens live in `artifacts/wealthapp/src/index.css`.
- **Type**: Fraunces for page titles and key numbers (medium weight for titles, light for big numbers); Montserrat for everything else, including section subtitles. One focal number per screen; keep bold rare.
- **Navigation (investment client)**: Home · Portfolio · Sol · Goals · Advisor in a floating Cobalt menu bar; the monthly budget opens from Home.
- **Navigation (free plan)**: free users use the client screens and menu bar, with tier limits and upgrade checkpoints (see `docs/maps/free-tier-conversion-journey.html`). The investor-style free redesign in `docs/free-redesign/` is the visual reference for restyling those shared screens.
- **Brand tone**: Trusted, professional, calm. Not flashy; builds confidence.
- **Logo**: Sol — a flat, scalloped sun with a calm closed-eye face, also tala's in-app money buddy (voice and behavior rules: `SOL_PERSONA.md`)

## Anti-references

- Crypto-bro dashboards (neon on dark, aggressive animations)
- Robinhood-style gamification
- Generic SaaS blue (#3B82F6 dominance)
- Heavy glassmorphism

## Strategic Principles

1. Clarity over cleverness — users are making real financial decisions
2. Advisor-client relationship is central — everything supports it
3. Mobile-first — many clients access via phone
4. Trust signals over marketing — calm palette, honest data display

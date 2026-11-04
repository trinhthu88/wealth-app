# Free-plan redesign: screen prototype

The free-plan screens use the same 2026 tala design as the investment-client app:
Soft Cloud background, Cobalt Pulse text and hero cards, Spring Field highlights,
Blue Breeze soft tiles, and Sunset Pop only for Sol and "needs attention".
Titles and key numbers are set in Fraunces, everything else in Montserrat, with one focal number per screen.

These are screenshots at a 390px-wide phone viewport, rendered with sample data for one persona.

## Navigation

The free plan has a floating Cobalt menu bar: **Home · Wealth · Sol · Goals · More**.

| Section | Tabs |
|---|---|
| Home | Overview · Budget · Health score |
| Wealth | Net worth · Portfolio |
| Goals | Goals · Pathway · Milestones |

- **Sol** opens the Sol chat.
- **More** opens a drawer with every destination, Settings and the advised-plan card.
- **Desktop** shows the same groups in a sidebar.
- **Onboarding** stays a standalone full-screen flow.
- **Pathway** is the dark Cobalt "long view" screen, like My plan on the client side.

| # | Screen | Focal element |
|---|---|---|
| 01 | Home | Net worth number. The Cobalt card is the health score; budget, goals and streak sit below. |
| 02 | Budget | Cobalt card with "kept this month" |
| 03 | Health score | Score ring on a Cobalt card, then the four sub-scores |
| 04 | Net worth | Net worth number and trend; assets and liabilities lists |
| 05 | Portfolio | Self-tracked value, allocation bar, holdings |
| 06 | Goals | Goal tiles in Spring Field (on track) or Sunset tint (at risk) |
| 07 | Pathway | Six-step recap on Cobalt |
| 08 | Milestones | Badge count, with earned and locked badge grid |
| 09 | Settings | Profile card and form |
| 10 | Onboarding | Six-step wizard with Sol, sticky Continue |

Each screen shows at most one upgrade prompt from free to advised, styled as a Blue Breeze card with a Cobalt button.

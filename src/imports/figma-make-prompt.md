Build an interactive web app called "Product Simulator" with the tagline "Learn how product decisions compound over time." It is a turn-based decision simulation where the player is the Head of Product at a fictional SaaS startup, moving one month per turn across a 60-month (5-year) game. Use mock/client-side state only, no real backend or live AI calls needed. Style: clean, modern SaaS dashboard aesthetic, dark or light mode, data-dense but not cluttered, confident use of charts and numeric readouts, subtle color coding for good/bad trends (green for improving, red/amber for declining).

## Design system / visual language

Draw the visual language from strategy and board games rather than a generic SaaS dashboard, while keeping the actual UI a clean, readable web app:

- **World and tone:** think of the warm, painterly, isometric look of 4X strategy games like Civilization: rich terrain colors, soft lighting, a sense of a living world. You won't be rendering a literal map, but let this inform the color palette (warm greens, ochres, warm blues) and the idea of a "world" the player is shaping turn by turn. A stylized isometric or map-like illustration could work well as a decorative header on the Start screen.
- **Tactile, tabletop feel for components:** take cues from physical strategy board games (the kind with hex tiles, wooden resource tokens, and player mats spread across a table). Apply that tactility to the event cards, choice buttons, and stat cards: slightly raised card surfaces, soft drop shadows, rounded corners, a sense of physical "pieces" on a table rather than flat software widgets. Domain tags (Engineering, Sales, Marketing, Finance, Customers) can borrow the feel of faction or resource icons: simple, bold, colored badges rather than plain text labels.
- **Clarity of a modern classic like Catan:** borrow its restraint and legibility. Resource/stat icons are simple and instantly recognizable, cards have clear hierarchy (title, cost or effect, one supporting line), and the overall board stays uncluttered even with many pieces in play. Apply this discipline to the dashboard: each stat card should read in under a second, and the "building cost" style card layout (icon, label, number) is a good model for how choice options are presented on event cards.
- Overall: a warm, tactile, game-table aesthetic layered on top of clean, modern web UI patterns. Avoid a cold, corporate SaaS-analytics look; avoid photorealism. Rounded sans-serif typography, warm neutral backgrounds (parchment/cream or soft dark), and confident use of color-coded icons throughout.

## Screens to build

### 1. Start screen
- Title, tagline, short one-paragraph pitch ("You're the new Head of Product at a fictional SaaS startup...").
- A choice of starting scenario as cards: "Startup" (50 customers, scrappy) and "Series A" (growing, more pressure). Each card shows 2-3 starting stat previews.
- A "Begin" button that loads the Dashboard for month 1.

### 2. Dashboard (main screen, always visible during play)
Show these metrics as labeled stat cards or a compact grid, each with a current value and a small trend indicator (up/down arrow, colored):
- Revenue (ARR)
- MRR Growth (%)
- Burn Rate (£/month)
- Runway (months)
- NPS
- Retention (%)
- Employee Morale (%)
- Technical Debt (%)
- Customer Trust (%)
- Market Share (%)

Include a header showing "Month X of 60" and the current in-game date, plus a persistent small "Company Health" summary line synthesizing 2-3 of the above.

Below the stat grid, show two opposing progress bars for "Feature Velocity" vs "Technical Debt" that visually shift over time (velocity shrinks as debt grows).

### 3. Event / decision panel
Below or alongside the dashboard, show the current month's event(s), 1 to 3 per turn. Each event is a card with:
- A domain tag/badge: Engineering, Sales, Marketing, Finance, or Customers (each with a distinct color)
- A short scenario headline and 1-2 sentence description
- 3-4 choice buttons, each a short action label (e.g. "Ignore", "Allocate one sprint", "Rewrite authentication", "Hire platform engineers")

Sample events to hardcode for the prototype (build at least these five, one per domain):
- Engineering: "Legacy authentication system is slowing development." Choices: Ignore / Allocate one sprint / Rewrite authentication / Hire platform engineers
- Sales: "Enterprise customer requests SAML." Choices: Build it / Delay / Sell around it / Create premium tier
- Marketing: "Competitor launches AI feature." Choices: Match it / Differentiate / Ignore / Lower pricing
- Finance: "Cash runway now under 10 months." Choices: Layoffs / Raise prices / Raise investment / Freeze hiring
- Customers: "Churn increased 3%." Choices: Interview customers / Add requested features / Improve onboarding / Offer discounts

When a choice is picked, animate a brief confirmation, then advance the month: update the visible stat grid with a small immediate change, and (behind the scenes) schedule a delayed consequence that will surface a few turns later as a new "Consequence" event card (visually distinct, perhaps with a small "chain reaction" icon) explaining that this outcome traces back to an earlier decision.

### 4. Causality graph view
A screen or expandable panel the player can open from any consequence card, titled "Why did this happen?" Show a simple vertical flow diagram (boxes connected by downward arrows) tracing the chain, for example:

Ignored onboarding improvements → Activation down 12% → Support tickets up 24% → Customer satisfaction down → Churn up

Build this as a reusable component that can render any 3-5 step chain passed to it, since multiple different chains should be demoable (at minimum: one churn chain, one revenue chain, and one hiring/velocity chain).

### 5. Quarterly board meeting screen
Every 3 months, interrupt the normal flow with a modal or full screen: "The board has questions." Show 1-2 short questions (e.g. "Revenue slowed. Why?") with 2-3 pre-written response options for the player to choose from. After selecting, show a brief board reaction line that references whether the response lines up with what actually happened this quarter.

### 6. End of game report (month 60)
A single summary screen styled like a shareable report card:
- Final ARR, net retention, technical debt status (healthy/strained/critical), employee morale, investor sentiment
- One "Standout Strength" and one "Standout Weakness" line, each 1 sentence
- A "Play Again" button back to the Start screen
- A visual (simple line chart) of ARR growth across all 60 months

## Interaction and state notes
- All state can be mock/local (React state or similar): starting stats, a rules table mapping each choice to immediate stat deltas and a scheduled delayed effect, and a small queue of pending consequences.
- Progressing a month should feel snappy: update numbers with a brief animated transition rather than an instant jump.
- Keep the whole flow playable end to end with hardcoded content: start screen, several turns of dashboard plus events, at least one consequence chain surfacing via the causality graph, one board meeting, and the end of game report.

## Out of scope for this build
Do not build multiplayer, live AI-generated dialogue, or any real backend integration. All "AI employee" commentary and board dialogue should be short, pre-written lines tied to specific events, not open-ended generation.

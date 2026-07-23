import { useState, useCallback } from 'react'
import logo from "images/game-logo.png";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'start' | 'game' | 'end'
type Domain = 'Engineering' | 'Sales' | 'Marketing' | 'Finance' | 'Customers' | 'Partners'

interface Stats {
  arr: number
  mrrGrowth: number
  burnRate: number
  runway: number
  nps: number
  retention: number
  morale: number
  techDebt: number
  customerTrust: number
  marketShare: number
}

interface GameChoice {
  label: string
  deltas: Partial<Stats>
  consequence?: ConsequenceTemplate
}

interface ConsequenceTemplate {
  monthsLater: number
  domain: Domain
  headline: string
  description: string
  causalityChain: string[]
  choices: GameChoice[]
}

interface GameEvent {
  id: string
  domain: Domain
  headline: string
  description: string
  choices: GameChoice[]
  isConsequence?: boolean
  causalityChain?: string[]
}

interface PendingConsequence {
  triggerMonth: number
  event: Omit<GameEvent, 'id'>
}

interface BoardAnswer {
  text: string
  honest: boolean
  reaction: string
}

interface BoardQuestion {
  question: string
  answers: BoardAnswer[]
}

// ─── Domain config ────────────────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<Domain, { color: string; bg: string; icon: string }> = {
  Engineering: { color: '#5b4fcf', bg: '#ede9fe', icon: '⚙' },
  Sales:       { color: '#0e7a48', bg: '#d1fce7', icon: '📈' },
  Marketing:   { color: '#c4500a', bg: '#fff0e8', icon: '📣' },
  Finance:     { color: '#a07008', bg: '#fef9d8', icon: '💰' },
  Customers:   { color: '#1a60c4', bg: '#e8f3ff', icon: '👥' },
  Partners:    { color: '#0e3c7c', bg: '#e8f3ff', icon: '🤝' },
}

// ─── Starting stats ───────────────────────────────────────────────────────────

const STARTUP_STATS: Stats = {
  arr: 120000, mrrGrowth: 8, burnRate: 18000, runway: 14,
  nps: 42, retention: 87, morale: 75, techDebt: 25,
  customerTrust: 78, marketShare: 0.8,
}

const SERIES_A_STATS: Stats = {
  arr: 800000, mrrGrowth: 12, burnRate: 65000, runway: 18,
  nps: 52, retention: 91, morale: 68, techDebt: 35,
  customerTrust: 82, marketShare: 2.1,
}

// ─── Stat display definitions ─────────────────────────────────────────────────

const STAT_DEFS = [
  {
    key: 'arr' as keyof Stats, label: 'ARR', goodDir: 1,
    format: (v: number) => v >= 1_000_000 ? `£${(v / 1_000_000).toFixed(2)}M` : `£${(v / 1000).toFixed(0)}k`,
    delta: (d: number) => `${d >= 0 ? '+' : ''}£${Math.abs(d / 1000).toFixed(0)}k`,
    warn: (v: number) => v < 50000,
  },
  {
    key: 'mrrGrowth' as keyof Stats, label: 'MRR Growth', goodDir: 1,
    format: (v: number) => `${v.toFixed(1)}%`,
    delta: (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}pp`,
    warn: (v: number) => v < 0,
  },
  {
    key: 'burnRate' as keyof Stats, label: 'Burn Rate', goodDir: -1,
    format: (v: number) => `£${(v / 1000).toFixed(1)}k/mo`,
    delta: (d: number) => `${d >= 0 ? '+' : ''}£${(d / 1000).toFixed(1)}k`,
    warn: (v: number) => v > 100000,
  },
  {
    key: 'runway' as keyof Stats, label: 'Runway', goodDir: 1,
    format: (v: number) => `${Math.round(v)} mo`,
    delta: (d: number) => `${d >= 0 ? '+' : ''}${Math.round(d)} mo`,
    warn: (v: number) => v < 6,
  },
  {
    key: 'nps' as keyof Stats, label: 'NPS', goodDir: 1,
    format: (v: number) => `${Math.round(v)}`,
    delta: (d: number) => `${d >= 0 ? '+' : ''}${Math.round(d)}`,
    warn: (v: number) => v < 20,
  },
  {
    key: 'retention' as keyof Stats, label: 'Retention', goodDir: 1,
    format: (v: number) => `${v.toFixed(1)}%`,
    delta: (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}pp`,
    warn: (v: number) => v < 80,
  },
  {
    key: 'morale' as keyof Stats, label: 'Morale', goodDir: 1,
    format: (v: number) => `${Math.round(v)}%`,
    delta: (d: number) => `${d >= 0 ? '+' : ''}${Math.round(d)}pp`,
    warn: (v: number) => v < 45,
  },
  {
    key: 'techDebt' as keyof Stats, label: 'Tech Debt', goodDir: -1,
    format: (v: number) => `${Math.round(v)}%`,
    delta: (d: number) => `${d >= 0 ? '+' : ''}${Math.round(d)}pp`,
    warn: (v: number) => v > 65,
  },
  {
    key: 'customerTrust' as keyof Stats, label: 'Trust', goodDir: 1,
    format: (v: number) => `${Math.round(v)}%`,
    delta: (d: number) => `${d >= 0 ? '+' : ''}${Math.round(d)}pp`,
    warn: (v: number) => v < 60,
  },
  {
    key: 'marketShare' as keyof Stats, label: 'Mkt Share', goodDir: 1,
    format: (v: number) => `${v.toFixed(1)}%`,
    delta: (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(2)}pp`,
    warn: (_v: number) => false,
  },
] as const

// ─── Event pool ───────────────────────────────────────────────────────────────

const EVENT_POOL: Omit<GameEvent, 'id'>[] = [
  {
    domain: 'Engineering',
    headline: 'Legacy authentication system is slowing development',
    description: 'The old auth code causes 2 incidents a month and blocks every new login feature. Engineers are frustrated.',
    choices: [
      {
        label: 'Ignore it',
        deltas: { techDebt: 5, morale: -3 },
        consequence: {
          monthsLater: 4,
          domain: 'Engineering',
          headline: 'Auth outage causes major churn',
          description: 'The auth system failed for 6 hours. Three enterprise customers are threatening to leave.',
          causalityChain: [
            'Ignored legacy auth system',
            'Technical debt accumulated (+5%)',
            'Auth outage lasted 6 hours',
            'Enterprise customers threatened to leave',
            'Customer Trust −15%, Retention −4%',
          ],
          choices: [
            { label: 'Emergency hotfix', deltas: { techDebt: -5, customerTrust: 5, morale: -8, burnRate: 3000 } },
            { label: 'Apologise and refund', deltas: { customerTrust: 8, arr: -15000, retention: 2 } },
          ],
        },
      },
      { label: 'Allocate one sprint', deltas: { techDebt: -8, morale: 5, mrrGrowth: 1 } },
      {
        label: 'Full auth rewrite',
        deltas: { techDebt: -20, morale: 8, mrrGrowth: -3, burnRate: 5000 },
        consequence: {
          monthsLater: 3,
          domain: 'Engineering',
          headline: 'Auth rewrite ships — velocity restored',
          description: 'The new system is live. Incidents dropped to zero and engineers are shipping faster.',
          causalityChain: [
            'Invested in full auth rewrite',
            'Removed 3 years of technical debt',
            'Incident rate dropped to near-zero',
            'Engineer productivity up 20%',
            'Feature Velocity +18%, Tech Debt −20%',
          ],
          choices: [
            { label: 'Celebrate with the team', deltas: { morale: 10, customerTrust: 5 } },
            { label: 'Tackle next debt area', deltas: { techDebt: -8, morale: 5 } },
          ],
        },
      },
      { label: 'Hire platform engineers', deltas: { techDebt: -5, burnRate: 12000, runway: -1, morale: 8 } },
    ],
  },
   {
    domain: 'Engineering',
    headline: 'Flaky test suite is causing repeated production bugs',
    description: 'Flaky tests in code causes 2 incidents a month and blocks half of all deployments. Engineers are concerned.',
    choices: [
      {
        label: 'Ignore it',
        deltas: { techDebt: 5, morale: -2 },
        consequence: {
          monthsLater: 4,
          domain: 'Engineering',
          headline: 'Deployment delays negatively affect velocity',
          description: 'Testing issues mean deployments are slow. Engineers are starting to complain about overtime.',
          causalityChain: [
            'Flaky test suite',
            'Technical debt accumulated (+5%)',
            'Half of all deployments are delayed',
            'Engineering complaining, as are others affected by delays',
            'Customer Trust −5%, Retention −1%',
          ],
          choices: [
            { label: 'Emergency hotfix', deltas: { techDebt: -5, customerTrust: 2, morale: -4, burnRate: 3000 } },
            { label: 'Delay fix', deltas: { customerTrust: 8, arr: -8000, retention: 1.2 } },
          ],
        },
      },
      { label: 'Assign a dedicated sprint to fix', deltas: { techDebt: -8, morale: 5, mrrGrowth: 1 } },
      {
        label: 'Invest in automated testing infrastructure',
        deltas: { techDebt: -20, morale: 8, mrrGrowth: -3, burnRate: 5000 },
        consequence: {
          monthsLater: 3,
          domain: 'Engineering',
          headline: 'Flaky tests fixed — velocity restored',
          description: 'The test fixes are live. Incidents dropped to zero and engineers are shipping faster.',
          causalityChain: [
            'Invested in automted test infrastructure',
            'Removed 2 years of technical debt',
            'Incident rate dropped to near-zero',
            'Engineer productivity up 10%',
            'Feature Velocity +18%, Tech Debt −20%',
          ],
          choices: [
            { label: 'Celebrate with the team', deltas: { morale: 10, customerTrust: 5 } },
            { label: 'Tackle next debt area', deltas: { techDebt: -8, morale: 5 } },
          ],
        },
      },
      { label: 'Slow down release cadence', deltas: { techDebt: -5, burnRate: 12000, runway: -1, morale: 8 } },
    ],
  },
  {
    domain: 'Sales',
    headline: 'Enterprise customer requests SAML SSO',
    description: "Acme Corp will sign a £60k deal — but only if you ship SAML authentication within 60 days.",
    choices: [
      {
        label: 'Build it now',
        deltas: { arr: 60000, morale: -5, techDebt: 8, burnRate: 4000 },
        consequence: {
          monthsLater: 2,
          domain: 'Sales',
          headline: 'SAML closes Acme — two more enterprises enquire',
          description: 'Acme signed the contract. Two other enterprises noticed and booked demos.',
          causalityChain: [
            'Built SAML SSO on request',
            'Acme Corp deal closed (£60k ARR)',
            'Enterprise credibility established',
            'Two further enterprise demos booked',
            'ARR pipeline +£120k',
          ],
          choices: [
            { label: 'Double down on enterprise', deltas: { arr: 80000, burnRate: 8000, morale: -5 } },
            { label: 'Stay SMB-focused', deltas: { customerTrust: 5, mrrGrowth: 3 } },
          ],
        },
      },
      { label: 'Delay 3 months', deltas: { morale: -2, customerTrust: -5 } },
      { label: 'Sell around it', deltas: { customerTrust: -8, arr: -10000 } },
      { label: 'Create an enterprise tier', deltas: { arr: 40000, mrrGrowth: 4, burnRate: 2000 } },
    ],
  },
  {
    domain: 'Marketing',
    headline: 'Competitor launches AI writing feature',
    description: "Rival just shipped an AI assistant and it's dominating social. Your mentions dropped 40% this week.",
    choices: [
      {
        label: 'Match it immediately',
        deltas: { techDebt: 12, morale: -8, marketShare: 1, mrrGrowth: 2 },
        consequence: {
          monthsLater: 5,
          domain: 'Engineering',
          headline: 'Rushed AI feature causing instability',
          description: 'Cutting corners on the AI feature has tripled our P1 bug rate this month.',
          causalityChain: [
            'Rushed AI feature to match competitor',
            'Engineering shortcuts taken under pressure',
            'P1 bug rate tripled',
            'Customer satisfaction declining',
            'Retention −3%, Customer Trust −8%',
          ],
          choices: [
            { label: 'Slow down and fix properly', deltas: { techDebt: -10, morale: 5, mrrGrowth: -2 } },
            { label: 'Ship a stabilisation patch', deltas: { techDebt: -3, customerTrust: 5 } },
          ],
        },
      },
      { label: 'Differentiate instead', deltas: { customerTrust: 8, marketShare: 0.5, morale: 5 } },
      { label: 'Ignore the competitor', deltas: { marketShare: -1, mrrGrowth: -1 } },
      { label: 'Respond with lower pricing', deltas: { arr: -20000, marketShare: 1.5, mrrGrowth: 3, customerTrust: -3 } },
    ],
  },
  {
    domain: 'Finance',
    headline: 'Cash runway now under 10 months',
    description: "You have 8 months of cash at current burn. The board is asking for a plan. Investors are watching.",
    choices: [
      {
        label: 'Lay off 20% of staff',
        deltas: { burnRate: -15000, morale: -25, customerTrust: -5, runway: 5 },
        consequence: {
          monthsLater: 3,
          domain: 'Customers',
          headline: 'Support quality collapses post-layoffs',
          description: 'Losing support staff means tickets are taking 5× longer. Customers are furious.',
          causalityChain: [
            'Laid off 20% of staff to extend runway',
            'Support team reduced by half',
            'Ticket response time up 500%',
            'Customer satisfaction plummeting',
            'NPS −12, Retention −5%',
          ],
          choices: [
            { label: 'Rehire support staff', deltas: { burnRate: 8000, morale: 10, customerTrust: 8 } },
            { label: 'Build self-serve help centre', deltas: { techDebt: 5, customerTrust: 5, burnRate: 1000 } },
          ],
        },
      },
      { label: 'Raise prices 20%', deltas: { arr: 40000, mrrGrowth: -3, customerTrust: -8, retention: -4 } },
      { label: 'Raise a bridge round', deltas: { runway: 12, burnRate: 2000, morale: 5 } },
      { label: 'Freeze all new hiring', deltas: { burnRate: -5000, morale: -10, runway: 3, mrrGrowth: -2 } },
    ],
  },
  {
    domain: 'Partners',
    headline: 'Partner delayed implementing integration',
    description: "Projections are impacted. The board is asking for a plan. Investors are watching.",
    choices: [
      {
        label: 'Lay off 20% of staff',
        deltas: { burnRate: -15000, morale: -25, customerTrust: -5, runway: 5 },
        consequence: {
          monthsLater: 3,
          domain: 'Partners',
          headline: 'Support quality collapses post-layoffs',
          description: 'Losing support staff means tickets are taking 5× longer. Customers are furious.',
          causalityChain: [
            'Laid off 20% of staff to extend runway',
            'Support team reduced by half',
            'Ticket response time up 500%',
            'Customer satisfaction plummeting',
            'NPS −12, Retention −5%',
          ],
          choices: [
            { label: 'Rehire support staff', deltas: { burnRate: 8000, morale: 10, customerTrust: 8 } },
            { label: 'Build self-serve help centre', deltas: { techDebt: 5, customerTrust: 5, burnRate: 1000 } },
          ],
        },
      },
      { label: 'Seek new partners', deltas: { arr: 40000, mrrGrowth: -3, customerTrust: -8, retention: -4 } },
      { label: 'Raise a bridge round', deltas: { runway: 12, burnRate: 2000, morale: 5 } },
      { label: 'Divert engineers from current projects', deltas: { burnRate: -5000, morale: -10, runway: 3, mrrGrowth: -2 } },
    ],
  },
  {
    domain: 'Customers',
    headline: 'Monthly churn increased by 3%',
    description: 'Exit surveys cite "missing features" and "confusing onboarding" as top reasons for leaving.',
    choices: [
      {
        label: 'Interview churned customers',
        deltas: { customerTrust: 5, morale: 3 },
        consequence: {
          monthsLater: 2,
          domain: 'Customers',
          headline: 'Research reveals the onboarding root cause',
          description: 'Onboarding completion sits at just 34%. Fixing Day 1 could halve churn.',
          causalityChain: [
            'Proactively interviewed churned customers',
            'Identified onboarding completion at 34%',
            'Root cause: confusing Day 1 experience',
            'Roadmap updated to fix activation flow',
            'Retention +6%, NPS +8 projected',
          ],
          choices: [
            { label: 'Fix onboarding this sprint', deltas: { retention: 6, nps: 8, morale: 5, customerTrust: 8 } },
            { label: 'Add it to the backlog', deltas: { techDebt: 3, morale: -3 } },
          ],
        },
      },
      { label: 'Add requested features fast', deltas: { retention: 3, techDebt: 8, morale: -5, mrrGrowth: 2 } },
      { label: 'Improve onboarding now', deltas: { retention: 5, nps: 6, morale: 5, customerTrust: 5 } },
      { label: 'Offer discounts to at-risk accounts', deltas: { retention: 4, arr: -25000, customerTrust: 3 } },
    ],
  },
  {
    domain: 'Engineering',
    headline: 'CI/CD pipeline takes 45 minutes — devs are frustrated',
    description: "Half the team's day disappears waiting for builds. Three engineers raised it independently in 1:1s.",
    choices: [
      { label: 'Invest in CI infrastructure', deltas: { morale: 12, techDebt: -5, burnRate: 2000 } },
      { label: 'Accept the slow builds', deltas: { morale: -8, techDebt: 5 } },
      { label: 'Buy a cloud CI solution', deltas: { morale: 10, burnRate: 3500 } },
      { label: 'Optimise the test suite', deltas: { morale: 8, techDebt: -3 } },
    ],
  },
  {
    domain: 'Sales',
    headline: "Top sales rep wants to leave for a competitor",
    description: "Jordan closed £200k ARR last year and has been offered 30% more salary elsewhere.",
    choices: [
      { label: 'Match the offer', deltas: { burnRate: 4000, morale: 5, arr: 10000 } },
      { label: 'Let her go', deltas: { morale: -12, arr: -60000, mrrGrowth: -2 } },
      { label: 'Counter with equity', deltas: { morale: 8, burnRate: 1000 } },
      { label: 'Promote to VP Sales', deltas: { morale: 10, burnRate: 6000, mrrGrowth: 3 } },
    ],
  },
  {
    domain: 'Marketing',
    headline: 'Industry conference next month — sponsor or skip?',
    description: "Full sponsorship is £8k and gets you a booth. Last year competitors generated 60+ leads here.",
    choices: [
      { label: 'Full sponsorship package', deltas: { marketShare: 0.8, arr: 30000, burnRate: 8000 } },
      { label: 'Send one person to attend', deltas: { marketShare: 0.2, burnRate: 1500 } },
      { label: 'Skip this year', deltas: { marketShare: -0.3 } },
      { label: 'Run a competing online event', deltas: { marketShare: 0.5, burnRate: 3000, morale: 5 } },
    ],
  },
  {
    domain: 'Finance',
    headline: 'CFO proposes cutting the UX design budget',
    description: 'Saving £6k/month extends runway ~1.5 months. The design team is already stretched thin.',
    choices: [
      { label: 'Cut the design budget', deltas: { burnRate: -6000, morale: -15, customerTrust: -5, runway: 2 } },
      { label: 'Protect the design budget', deltas: { morale: 8, customerTrust: 5 } },
      { label: 'Reduce by 50%', deltas: { burnRate: -3000, morale: -5, runway: 1 } },
      { label: 'Move designer to part-time', deltas: { burnRate: -3000, morale: -8 } },
    ],
  },
  {
    domain: 'Customers',
    headline: 'Enterprise customers request a public API',
    description: 'Three key accounts want an API for workflow integrations. Engineering estimates 6 weeks of effort.',
    choices: [
      { label: 'Build the full API', deltas: { arr: 45000, techDebt: 10, morale: 5, burnRate: 3000 } },
      { label: 'Delay two quarters', deltas: { customerTrust: -8, arr: -10000 } },
      { label: 'Ship a limited beta API', deltas: { arr: 20000, techDebt: 5, morale: 8 } },
      { label: 'Partner with an integration platform', deltas: { arr: 15000, burnRate: 1500, morale: 3 } },
    ],
  },
]

// ─── Standalone causality chains ──────────────────────────────────────────────

const CAUSALITY_CHAINS = {
  churn: {
    title: 'Churn Spiral',
    steps: [
      'Ignored onboarding improvements (Month 2)',
      'Activation rate dropped to 34%',
      'Support ticket volume up 24%',
      'Customer satisfaction scores declined',
      'Monthly churn increased by 3.2%',
    ],
  },
  revenue: {
    title: 'Revenue Stall',
    steps: [
      'Rushed feature release to match competitor',
      'Quality trade-offs accumulated over 3 months',
      'Key enterprise customer churned (£60k ARR)',
      'ARR growth stalled at −1% MoM',
      'Board flagged as top risk in Q3 review',
    ],
  },
  velocity: {
    title: 'Velocity Decay',
    steps: [
      'Deferred technical debt for 6 months',
      'Code complexity increased significantly',
      'Feature velocity dropped 40%',
      'Releases slowed from weekly to monthly',
      'Engineer morale declined — attrition risk rising',
    ],
  },
}

// ─── Board meetings ───────────────────────────────────────────────────────────

const BOARD_MEETINGS: BoardQuestion[][] = [
  [
    {
      question: "Revenue growth slowed this quarter. What's driving that?",
      answers: [
        { text: "We've been investing in platform stability, which will unlock faster growth next half.", honest: true, reaction: "\"Platform bets pay off — but we need to see that growth reverse soon.\" Cautiously supportive." },
        { text: "We have a strong pipeline that will convert next quarter.", honest: false, reaction: "\"We've heard that before. Show us the actual pipeline numbers.\" Tension rises." },
        { text: "Market conditions are tough across the sector right now.", honest: false, reaction: "\"Everyone's in the same market. What are you doing differently?\" Sceptical faces." },
      ],
    },
  ],
  [
    {
      question: "Technical debt is flagged in our risk register. How serious is it?",
      answers: [
        { text: "It's manageable. We've allocated 20% of engineering capacity to reducing it each sprint.", honest: true, reaction: "\"Good. Make sure that allocation doesn't slip under delivery pressure.\"" },
        { text: "We've completed a full assessment and have a remediation roadmap.", honest: true, reaction: "\"Send us the roadmap — this is exactly the proactive thinking we want to see.\" Positive energy." },
        { text: "Our engineers say it's under control.", honest: false, reaction: "\"'Under control' is not a metric. We want to see numbers next quarter.\" Cold reaction." },
      ],
    },
  ],
  [
    {
      question: "NPS has dropped this quarter. What's the customer feedback saying?",
      answers: [
        { text: "We ran exit interviews. Onboarding is the main friction — we're fixing it this sprint.", honest: true, reaction: "\"Good diagnosis. Execution is what counts now.\" Cautiously supportive." },
        { text: "A few vocal detractors are skewing the metric.", honest: false, reaction: "\"NPS doesn't lie. Don't blame the customers.\" Uncomfortable silence." },
        { text: "We're investing in customer success to improve satisfaction scores.", honest: true, reaction: "\"Make sure CS has the resources to actually move the needle.\" Reasonable response." },
      ],
    },
  ],
  [
    {
      question: "Burn rate has increased significantly. Walk us through the P&L.",
      answers: [
        { text: "We front-loaded hiring to capture market share. Revenue will follow in H2.", honest: true, reaction: "\"The timing risk is real. What's your Plan B if revenue lags?\" They want contingencies." },
        { text: "Infrastructure costs scaled with growth — that's a good problem to have.", honest: true, reaction: "\"Fair point on infra. We'd like more detail on headcount costs.\" Engaged response." },
        { text: "We're investing in the future of the company.", honest: false, reaction: "\"That's not an answer. Specifics, please.\" Sharp looks around the table." },
      ],
    },
  ],
  [
    {
      question: "Retention metrics look concerning. What's your recovery plan?",
      answers: [
        { text: "We've identified onboarding as the root cause. A fix ships next week.", honest: true, reaction: "\"Good. We'll want to see the retention trend reverse within 90 days.\"" },
        { text: "We're adding features customers have been requesting for months.", honest: true, reaction: "\"Features matter, but make sure you're solving the root problem first.\"" },
        { text: "Short-term noise. Our long-term customers are very sticky.", honest: false, reaction: "\"New customer churn IS a long-term problem. We're not satisfied with this response.\"" },
      ],
    },
  ],
]

// ─── Game helpers ─────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function applyDeltas(stats: Stats, deltas: Partial<Stats>): Stats {
  return {
    arr:           clamp(stats.arr + (deltas.arr ?? 0), 0, 50_000_000),
    mrrGrowth:     clamp(stats.mrrGrowth + (deltas.mrrGrowth ?? 0), -20, 100),
    burnRate:      clamp(stats.burnRate + (deltas.burnRate ?? 0), 0, 500_000),
    runway:        clamp(stats.runway + (deltas.runway ?? 0), 0, 120),
    nps:           clamp(stats.nps + (deltas.nps ?? 0), -100, 100),
    retention:     clamp(stats.retention + (deltas.retention ?? 0), 0, 100),
    morale:        clamp(stats.morale + (deltas.morale ?? 0), 0, 100),
    techDebt:      clamp(stats.techDebt + (deltas.techDebt ?? 0), 0, 100),
    customerTrust: clamp(stats.customerTrust + (deltas.customerTrust ?? 0), 0, 100),
    marketShare:   clamp(stats.marketShare + (deltas.marketShare ?? 0), 0, 100),
  }
}

function monthlyDrift(stats: Stats): Stats {
  const arrGrowth = stats.arr * (stats.mrrGrowth / 100) / 12
  const debtDrag = stats.techDebt > 60 ? 0.8 : stats.techDebt > 40 ? 0.3 : 0
  const moraleDrag = stats.techDebt > 60 ? 1.2 : 0
  return {
    ...stats,
    arr:       stats.arr + arrGrowth,
    runway:    clamp(stats.runway - 1, 0, 120),
    retention: clamp(stats.retention - debtDrag, 0, 100),
    morale:    clamp(stats.morale - moraleDrag, 0, 100),
    nps:       clamp(stats.nps + (stats.retention > 92 ? 0.3 : stats.retention < 80 ? -0.5 : 0), -100, 100),
  }
}

function getHealthSummary(stats: Stats): { text: string; color: string } {
  if (stats.runway < 4) return { text: 'CRITICAL: runway is nearly exhausted. Immediate action required.', color: '#a02020' }
  if (stats.techDebt > 70 && stats.morale < 45) return { text: 'High technical debt is crushing morale. Velocity at risk.', color: '#a02020' }
  if (stats.retention < 78) return { text: 'Retention is falling — churn is compounding. Investigate root causes.', color: '#a04010' }
  if (stats.runway < 9) return { text: 'Runway under 9 months. Consider financing options.', color: '#a06010' }
  if (stats.mrrGrowth > 15 && stats.retention > 90) return { text: 'Strong growth engine with solid retention — compounding well.', color: '#2a6a3a' }
  if (stats.nps > 60) return { text: `Exceptional NPS of ${Math.round(stats.nps)} — customers are advocates.`, color: '#2a6a3a' }
  return { text: 'Steady as she goes. Monitor tech debt and runway closely.', color: '#2a4a6a' }
}

function getInGameDate(month: number): string {
  const currentYear  = new Date().getFullYear();
  //const currentMonth = new Date().getMonth();
  const totalMonth = 1 + month - 1
  const year = currentYear + Math.floor((totalMonth - 1) / 12)
  const m = (totalMonth - 1) % 12
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[m]} ${year}`
}

let _eid = 0
function genId() { return `ev-${++_eid}` }

function getEventsForMonth(
  month: number,
  pending: PendingConsequence[],
): { current: GameEvent[]; remaining: PendingConsequence[] } {
  const triggered = pending.filter(p => p.triggerMonth <= month)
  const remaining  = pending.filter(p => p.triggerMonth > month)
  const current: GameEvent[] = triggered.map(p => ({ ...p.event, id: genId(), isConsequence: true }))

  if (current.length < 2) {
    const idx = (month - 1) % EVENT_POOL.length
    current.push({ ...EVENT_POOL[idx], id: genId() })
  }
  if (current.length < 2 && month % 3 !== 0) {
    const idx2 = month % EVENT_POOL.length
    current.push({ ...EVENT_POOL[idx2], id: genId() })
  }

  return { current: current.slice(0, 2), remaining }
}

// ─── UI sub-components ────────────────────────────────────────────────────────

function TrendArrow({ diff, goodDir }: { diff: number; goodDir: number }) {
  if (Math.abs(diff) < 0.005) return <span style={{ color: '#9a8a70', fontSize: 11 }}>—</span>
  const good = (diff > 0 && goodDir > 0) || (diff < 0 && goodDir < 0)
  return (
    <span style={{ color: good ? '#2a6a3a' : '#a02020', fontWeight: 900, fontSize: 12, lineHeight: 1 }}>
      {diff > 0 ? '▲' : '▼'}
    </span>
  )
}

type StatDef = typeof STAT_DEFS[number]

function StatCard({ def, value, prevValue }: { def: StatDef; value: number; prevValue: number }) {
  const diff = value - prevValue
  const good = (diff > 0 && def.goodDir > 0) || (diff < 0 && def.goodDir < 0)
  const bad  = (diff > 0 && def.goodDir < 0) || (diff < 0 && def.goodDir > 0)
  const warn = def.warn(value)
  const valueColor = warn ? (def.goodDir > 0 ? '#a02020' : '#a06010') : '#2a1f0e'

  return (
    <div style={{
      background: '#fdf6e8',
      border: `1.5px solid ${warn ? '#e0a0a0' : '#d4b87a'}`,
      borderRadius: 12,
      padding: '11px 13px',
      boxShadow: '0 2px 8px rgba(80,50,10,0.09), 0 1px 0 rgba(255,255,255,0.85) inset',
      display: 'flex', flexDirection: 'column', gap: 5,
      transition: 'border-color 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#8a6a38', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {def.label}
        </span>
        <TrendArrow diff={diff} goodDir={def.goodDir} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: valueColor, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.1 }}>
        {def.format(value)}
      </div>
      {Math.abs(diff) >= 0.005 && (
        <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: good ? '#2a6a3a' : bad ? '#a02020' : '#8a6a38' }}>
          {def.delta(diff)}
        </div>
      )}
    </div>
  )
}

function DomainBadge({ domain }: { domain: Domain }) {
  const cfg = DOMAIN_CONFIG[domain]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.bg, color: cfg.color,
      border: `1.5px solid ${cfg.color}55`,
      borderRadius: 20, padding: '2px 9px',
      fontSize: 11, fontWeight: 800, fontFamily: "'Nunito', sans-serif",
      whiteSpace: 'nowrap',
    }}>
      {cfg.icon} {domain}
    </span>
  )
}

function CausalityPanel({ chain, title, onClose }: { chain: string[]; title: string; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(20,12,4,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(5px)', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="fade-in"
        style={{
          background: '#fdf6e8', border: '2px solid #c4a060',
          borderRadius: 20, padding: '28px 28px 24px',
          maxWidth: 460, width: '100%',
          boxShadow: '0 28px 72px rgba(80,40,0,0.35)',
          maxHeight: '85vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#8a6a38', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
              ⛓ Why did this happen?
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#2a1f0e', fontFamily: "'Cinzel', serif" }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a6a38', fontSize: 18, padding: 4, lineHeight: 1 }}
          >✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {chain.map((step, i) => {
            const isFirst = i === 0
            const isLast  = i === chain.length - 1
            return (
              <div key={i}>
                <div style={{
                  background: isFirst ? '#f5ecd0' : isLast ? '#fde8e8' : '#fff8ef',
                  border: `1.5px solid ${isFirst ? '#c4a060' : isLast ? '#d06060' : '#dcc890'}`,
                  borderRadius: 10, padding: '10px 14px',
                  fontSize: 13.5, lineHeight: 1.45,
                  color: isLast ? '#7a2020' : '#2a1f0e',
                  fontWeight: isFirst || isLast ? 700 : 500,
                  fontFamily: "'Nunito', sans-serif",
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span style={{ color: '#b09050', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, paddingTop: 1, flexShrink: 0 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {step}
                </div>
                {i < chain.length - 1 && (
                  <div style={{ textAlign: 'center', fontSize: 16, color: '#c4a060', padding: '3px 0', lineHeight: 1 }}>↓</div>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 20, width: '100%',
            background: '#4a7c59', color: '#fff', border: 'none',
            borderRadius: 10, padding: '11px 0',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Nunito', sans-serif",
          }}
        >Close</button>
      </div>
    </div>
  )
}

function EventCard({
  event, onChoose, isLocked, chosenIndex, onViewCausality,
}: {
  event: GameEvent
  onChoose: (i: number) => void
  isLocked: boolean
  chosenIndex: number | null
  onViewCausality: () => void
}) {
  return (
    <div
      className="fade-in"
      style={{
        background: '#fdf6e8',
        border: `2px solid ${event.isConsequence ? '#c86060' : '#d4b87a'}`,
        borderRadius: 16, padding: 18,
        boxShadow: '0 4px 18px rgba(80,50,10,0.11), 0 1px 0 rgba(255,255,255,0.88) inset',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <DomainBadge domain={event.domain} />
          {event.isConsequence && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#fde8e8', color: '#a02020',
              border: '1.5px solid #f0a0a0',
              borderRadius: 20, padding: '2px 9px',
              fontSize: 11, fontWeight: 800,
            }}>
              ⛓ Consequence
            </span>
          )}
        </div>
        <h3 style={{ margin: '0 0 5px', fontSize: 15, fontWeight: 900, color: '#2a1f0e', fontFamily: "'Cinzel', serif", lineHeight: 1.3 }}>
          {event.headline}
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: '#6a4a24', lineHeight: 1.55 }}>
          {event.description}
        </p>
      </div>

      {event.isConsequence && event.causalityChain && (
        <button
          onClick={onViewCausality}
          style={{
            alignSelf: 'flex-start',
            background: '#f5edd0', border: '1.5px solid #c4a060',
            borderRadius: 8, padding: '5px 12px',
            fontSize: 12, fontWeight: 700, color: '#7a5020',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          ⛓ Why did this happen?
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 7 }}>
        {event.choices.map((choice, i) => {
          const chosen   = chosenIndex === i
          const dimmed   = chosenIndex !== null && !chosen
          return (
            <button
              key={i}
              disabled={isLocked}
              onClick={() => onChoose(i)}
              style={{
                background: chosen ? '#4a7c59' : '#fff',
                border: `1.5px solid ${chosen ? '#3a6a49' : '#c8a860'}`,
                borderRadius: 10, padding: '9px 13px',
                fontSize: 13, fontWeight: 700,
                color: chosen ? '#fff' : dimmed ? '#b0986a' : '#2a1f0e',
                cursor: isLocked ? 'default' : 'pointer',
                textAlign: 'left', transition: 'all 0.15s ease',
                opacity: dimmed ? 0.55 : 1,
                fontFamily: "'Nunito', sans-serif",
                boxShadow: chosen ? '0 2px 10px rgba(74,124,89,0.4)' : '0 1px 3px rgba(80,50,10,0.07)',
                lineHeight: 1.35,
              }}
            >
              {choice.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Terrain map (isometric hex illustration) ─────────────────────────────────

function TerrainMap() {
  const hexPts = (cx: number, cy: number, r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
    }).join(' ')

  const TC: Record<string, [string, string]> = {
    W: ['#2e6ea0', '#1e5890'], S: ['#4a90b8', '#3a7aa0'],
    P: ['#7ab840', '#5a9828'], F: ['#2a5f1e', '#1a4f10'],
    H: ['#748060', '#545e44'], M: ['#60504a', '#4a3c38'],
    C: ['#b09048', '#907830'], A: ['#c8a030', '#a88020'],
  }

  const MAP: string[][] = [
    ['W','W','W','W','S','S','P','P','H','H','M','M'],
    ['W','W','W','S','S','P','P','P','F','H','M','M'],
    ['W','W','S','S','P','P','F','F','F','H','H','M'],
    ['S','S','P','P','P','F','F','F','H','H','M','M'],
    ['S','P','P','A','A','F','F','H','H','M','M','M'],
    ['P','P','A','A','A','A','C','H','H','M','M','M'],
    ['P','A','A','A','A','C','H','H','M','M','M','M'],
  ]

  const r = 30
  const hw = Math.sqrt(3) * r
  const hh = 1.5 * r
  

  return (
    <div style={{ borderRadius: '18px 18px 0 0', overflow: 'hidden', height: 210, background: '#4a90b8' }}>
     
     
  
  >
    <img
      src="/game-logo.png"
      alt="Game logo"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  
);
     

    </div>
  )
}

// ─── ARR sparkline ────────────────────────────────────────────────────────────

function ArrChart({ history }: { history: number[] }) {
  if (history.length < 2) return null
  const W = 540, H = 130, pL = 52, pR = 12, pT = 14, pB = 30
  const iW = W - pL - pR
  const iH = H - pT - pB
  const max = Math.max(...history)
  const min = Math.min(...history)
  const range = max - min || 1

  const pts = history.map((v, i) => ({
    x: pL + (i / (history.length - 1)) * iW,
    y: pT + iH - ((v - min) / range) * iH,
  }))
  const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${pL},${pT+iH} ${line} ${pL+iW},${pT+iH}`

  const fmt = (v: number) => v >= 1_000_000 ? `£${(v/1_000_000).toFixed(1)}M` : `£${(v/1000).toFixed(0)}k`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a7c59" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#4a7c59" stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <line key={t} x1={pL} y1={pT + iH - t*iH} x2={W-pR} y2={pT + iH - t*iH}
          stroke="#d4b87a" strokeWidth="0.6" strokeDasharray="3,5"/>
      ))}
      <polygon points={area} fill="url(#ag)"/>
      <polyline points={line} fill="none" stroke="#4a7c59" strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round"/>
      {[0, Math.floor((history.length-1)/2), history.length-1].map(i => (
        <circle key={i} cx={pts[i].x} cy={pts[i].y} r={4}
          fill="#4a7c59" stroke="#fdf6e8" strokeWidth="2"/>
      ))}
      {[min, min + range*0.5, max].map((v, i) => (
        <text key={i} x={pL-4} y={pT + iH - i*(iH/2) + 4}
          textAnchor="end" fontSize="9" fill="#8a6a38"
          fontFamily="'JetBrains Mono', monospace">{fmt(v)}</text>
      ))}
      {[0, 14, 29, 44, history.length-1].map(i => {
        if (i >= history.length) return null
        const x = pL + (i / (history.length-1)) * iW
        return <text key={i} x={x} y={H-4} textAnchor="middle"
          fontSize="9" fill="#8a6a38" fontFamily="'JetBrains Mono', monospace">
          M{i+1}
        </text>
      })}
    </svg>
  )
}

// ─── Board meeting modal ──────────────────────────────────────────────────────

function BoardMeetingModal({ month, questions, onDone }: {
  month: number; questions: BoardQuestion[]; onDone: () => void
}) {
  const [answers, setAnswers]   = useState<(number|null)[]>(questions.map(() => null))
  const [revealed, setRevealed] = useState(false)
  const allAnswered = answers.every(a => a !== null)
  const quarter = Math.ceil(month / 3)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(20,12,4,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(7px)', padding: 20,
    }}>
      <div
        className="fade-in"
        style={{
          background: '#fdf6e8', border: '2px solid #c4a060',
          borderRadius: 24, padding: '30px 28px 26px',
          maxWidth: 540, width: '100%',
          boxShadow: '0 36px 90px rgba(80,40,0,0.45)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#8a6a38', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
            ⚖ Quarterly Board Review · Q{quarter} · Month {month}
          </div>
          <div>
          <img src="src/images/the-board.png"></img>
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 900, color: '#2a1f0e', fontFamily: "'Cinzel', serif" }}>
            The board has questions.
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: '#6a4a24', lineHeight: 1.5 }}>
            Choose your responses carefully. The board has access to your real metrics.
          </p>
        </div>

        {questions.map((q, qi) => (
          <div key={qi} style={{ marginBottom: 22 }}>
            <div style={{
              background: '#f0e8d0', border: '1.5px solid #c4a060',
              borderRadius: 10, padding: '11px 15px',
              fontSize: 14.5, fontWeight: 700, color: '#2a1f0e',
              fontFamily: "'Cinzel', serif", lineHeight: 1.35, marginBottom: 10,
            }}>
              "{q.question}"
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {q.answers.map((a, ai) => {
                const chosen = answers[qi] === ai
                const showR  = revealed && chosen
                return (
                  <div key={ai}>
                    <button
                      disabled={revealed}
                      onClick={() => setAnswers(p => { const n = [...p]; n[qi] = ai; return n })}
                      style={{
                        width: '100%',
                        background: chosen ? (a.honest ? '#d1fce7' : '#fde8e8') : '#fff',
                        border: `1.5px solid ${chosen ? (a.honest ? '#2d7a45' : '#c46060') : '#c8a860'}`,
                        borderRadius: 10, padding: '9px 14px',
                        fontSize: 13.5, fontWeight: 600,
                        color: chosen ? (a.honest ? '#1a5a30' : '#8a2020') : '#2a1f0e',
                        cursor: revealed ? 'default' : 'pointer',
                        textAlign: 'left', transition: 'all 0.15s',
                        fontFamily: "'Nunito', sans-serif",
                      }}
                    >
                      {a.text}
                    </button>
                    {showR && (
                      <div style={{
                        background: a.honest ? '#f0fdf4' : '#fff8f8',
                        border: `1px solid ${a.honest ? '#86efac' : '#fca5a5'}`,
                        borderTop: 'none',
                        borderRadius: '0 0 8px 8px', padding: '8px 14px',
                        fontSize: 13, color: a.honest ? '#166534' : '#991b1b',
                        fontStyle: 'italic', lineHeight: 1.55,
                        fontFamily: "'Nunito', sans-serif",
                      }}>
                        {a.reaction}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {!revealed ? (
          <button
            disabled={!allAnswered}
            onClick={() => setRevealed(true)}
            style={{
              width: '100%',
              background: allAnswered ? '#2a4a6a' : '#c4b090',
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '13px 0', fontSize: 15, fontWeight: 800,
              cursor: allAnswered ? 'pointer' : 'not-allowed',
              fontFamily: "'Cinzel', serif", letterSpacing: '0.04em',
            }}
          >
            Submit Responses to the Board
          </button>
        ) : (
          <button
            onClick={onDone}
            style={{
              width: '100%', background: '#4a7c59',
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '13px 0', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', fontFamily: "'Cinzel', serif",
              letterSpacing: '0.04em',
              boxShadow: '0 4px 16px rgba(74,124,89,0.35)',
            }}
          >
            Return to Game →
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Start screen ─────────────────────────────────────────────────────────────

function StartScreen({ onBegin }: { onBegin: (s: 'startup'|'series-a') => void }) {
  const [sel, setSel] = useState<'startup'|'series-a'|null>(null)

  const scenarios = [
    {
      id: 'startup' as const, emoji: '🌱', name: 'Scrappy Startup',
      desc: "You've just signed your first 50 paying customers. Low burn, full control — but every decision matters.",
      stats: [{ l: 'ARR', v: '£120k' }, { l: 'Runway', v: '14 months' }, { l: 'Team', v: '6 people' }],
    },
    {
      id: 'series-a' as const, emoji: '🚀', name: 'Series A',
      desc: "You closed your Series A last quarter. Growing fast, investor pressure rising, and tech debt already accumulating.",
      stats: [{ l: 'ARR', v: '£800k' }, { l: 'Runway', v: '18 months' }, { l: 'Team', v: '24 people' }],
    },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(155deg, #f2e8d0 0%, #e8d8b5 55%, #eee0c5 100%)',
      fontFamily: "'Nunito', sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 20px 60px',
    }}>
      <div style={{ maxWidth: 680, width: '100%' }}>

        {/* Terrain illustration */}
        <div style={{ marginBottom: 36, position: 'relative' }}>
          <div style={{
            borderRadius: 20, overflow: 'hidden',
            border: '2px solid #c4a060',
            boxShadow: '0 10px 36px rgba(80,40,0,0.22)',
          }}>
            <TerrainMap />
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 70,
            background: 'linear-gradient(to bottom, transparent, #f2e8d0)',
            borderRadius: '0 0 18px 18px',
          }}/>
        </div>

        {/* Title block */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{
            fontSize: 'clamp(34px, 6vw, 54px)',
            fontWeight: 900, fontFamily: "'Cinzel', serif",
            color: '#2a1f0e', margin: '0 0 6px',
            lineHeight: 1.08, letterSpacing: '-0.01em',
          }}>
            Product Lead Simulator
          </h1>
          <p style={{ fontSize: 15.5, color: '#7a5c30', fontWeight: 600, fontStyle: 'italic', margin: '0 0 18px' }}>
            Learn how product decisions compound over time.
          </p>
          <p style={{ fontSize: 14.5, color: '#5a3e1a', lineHeight: 1.72, maxWidth: 530, margin: '0 auto' }}>
            You're the new Head of Product at a fast-growing SaaS startup. Every month you'll face real decisions
            — engineering trade-offs, sales pressures, hiring calls, customer crises. Some choices ripple forward
            in ways you won't see for months. Play across 60 months and discover what kind of company you build.
          </p>
        </div>

        {/* Scenario cards */}
        <div style={{ fontSize: 11, fontWeight: 800, color: '#8a6a38', textTransform: 'uppercase', letterSpacing: '0.12em', textAlign: 'center', marginBottom: 14 }}>
          Choose Your Starting Scenario
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 22 }}>
          {scenarios.map(sc => {
            const active = sel === sc.id
            return (
              <button
                key={sc.id}
                onClick={() => setSel(sc.id)}
                style={{
                  background: active ? '#4a7c59' : '#fdf6e8',
                  border: `2px solid ${active ? '#3a6a49' : '#c8a860'}`,
                  borderRadius: 16, padding: '18px 18px 16px',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s ease',
                  boxShadow: active
                    ? '0 6px 24px rgba(74,124,89,0.38)'
                    : '0 4px 14px rgba(80,50,10,0.09), 0 1px 0 rgba(255,255,255,0.88) inset',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 7 }}>{sc.emoji}</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: active ? '#fff' : '#2a1f0e', fontFamily: "'Cinzel', serif", marginBottom: 6 }}>
                  {sc.name}
                </div>
                <div style={{ fontSize: 13, color: active ? 'rgba(255,255,255,0.82)' : '#6a4a24', lineHeight: 1.55, marginBottom: 12 }}>
                  {sc.desc}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderTop: `1px solid ${active ? 'rgba(255,255,255,0.2)' : '#e8d0a0'}`, paddingTop: 10 }}>
                  {sc.stats.map(s => (
                    <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: active ? 'rgba(255,255,255,0.7)' : '#8a6a38', fontWeight: 600 }}>{s.l}</span>
                      <span style={{ color: active ? '#fff' : '#2a1f0e', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        <button
          disabled={!sel}
          onClick={() => sel && onBegin(sel)}
          style={{
            display: 'block', width: '100%',
            background: sel ? '#4a7c59' : '#c4b090',
            color: '#fff', border: 'none', borderRadius: 14,
            padding: '16px 0', fontSize: 18, fontWeight: 800,
            cursor: sel ? 'pointer' : 'not-allowed',
            fontFamily: "'Cinzel', serif", letterSpacing: '0.04em',
            boxShadow: sel ? '0 4px 22px rgba(74,124,89,0.42)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {sel ? 'Begin → Month 1' : 'Select a scenario to begin'}
        </button>
      </div>
    </div>
  )
}

// ─── End screen ───────────────────────────────────────────────────────────────

function EndScreen({ stats, history, onRestart }: { stats: Stats; history: Stats[]; onRestart: () => void }) {
  const tdStatus  = stats.techDebt > 70 ? 'Critical' : stats.techDebt > 45 ? 'Strained' : 'Healthy'
  const tdColor   = stats.techDebt > 70 ? '#a02020' : stats.techDebt > 45 ? '#a06010' : '#2a6a3a'
  const ivSent    = stats.morale > 70 && stats.mrrGrowth > 10 ? 'Bullish' : stats.runway > 12 ? 'Cautious' : 'Concerned'
  const ivColor   = ivSent === 'Bullish' ? '#2a6a3a' : ivSent === 'Concerned' ? '#a02020' : '#a06010'

  const strength  =
    stats.nps > 60  ? `Exceptional customer advocacy — NPS of ${Math.round(stats.nps)} puts you in the top 10% of SaaS companies.`
    : stats.mrrGrowth > 15 ? `Strong growth engine — ${stats.mrrGrowth.toFixed(1)}% MRR growth is well above market median.`
    : stats.morale > 82 ? 'Outstanding team morale — your engineering org is motivated, shipping fast, and attracting talent.'
    : 'Consistent market share gains despite competitive pressure.'

  const weakness  =
    stats.techDebt > 62 ? `Technical debt reached ${Math.round(stats.techDebt)}% — a serious drag on future velocity and hiring.`
    : stats.retention < 84 ? `Customer retention at ${stats.retention.toFixed(1)}% — churn compounded into significant lost ARR.`
    : stats.morale < 58 ? 'Team morale issues persisted — ongoing talent risk and velocity loss were hard to recover from.'
    : stats.runway < 8  ? 'Runway crunch in the final stretch — financial pressure limited your strategic options.'
    : 'Burn rate stayed elevated relative to ARR growth, constraining long-term runway.'

  const finalSummary: { label: string; value: string; color: string }[] = [
    { label: 'Final ARR', value: stats.arr >= 1_000_000 ? `£${(stats.arr/1_000_000).toFixed(2)}M` : `£${(stats.arr/1000).toFixed(0)}k`, color: '#2a1f0e' },
    { label: 'Net Retention', value: `${stats.retention.toFixed(1)}%`, color: stats.retention > 90 ? '#2a6a3a' : stats.retention < 80 ? '#a02020' : '#2a1f0e' },
    { label: 'Tech Debt', value: tdStatus, color: tdColor },
    { label: 'Team Morale', value: `${Math.round(stats.morale)}%`, color: stats.morale > 70 ? '#2a6a3a' : stats.morale < 50 ? '#a02020' : '#2a1f0e' },
    { label: 'Market Share', value: `${stats.marketShare.toFixed(1)}%`, color: '#2a1f0e' },
    { label: 'Investor Sentiment', value: ivSent, color: ivColor },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(155deg, #f2e8d0 0%, #e8d8b5 60%, #eee0c5 100%)',
      fontFamily: "'Nunito', sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 20px 60px',
    }}>
      <div style={{ maxWidth: 660, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#8a6a38', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
            Final Report · Month 60
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 900, color: '#2a1f0e', margin: '0 0 8px', fontFamily: "'Cinzel', serif" }}>
            Your 5-Year Report Card
          </h1>
          <p style={{ fontSize: 14.5, color: '#6a4a24', margin: 0 }}>How did your product decisions compound?</p>
        </div>

        {/* ARR chart */}
        <div style={{
          background: '#fdf6e8', border: '1.5px solid #d4b87a',
          borderRadius: 16, padding: '20px 20px 12px',
          marginBottom: 16,
          boxShadow: '0 4px 16px rgba(80,50,10,0.09)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#8a6a38', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            ARR Growth Over 60 Months
          </div>
          <ArrChart history={history.map(s => s.arr)} />
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
          {finalSummary.map(item => (
            <div key={item.label} style={{
              background: '#fdf6e8', border: '1.5px solid #d4b87a',
              borderRadius: 12, padding: '12px 14px',
              boxShadow: '0 2px 8px rgba(80,50,10,0.08)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#8a6a38', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: item.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Strength & weakness */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 26 }}>
          <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>
              ★ Standout Strength
            </div>
            <p style={{ fontSize: 13.5, color: '#14532d', lineHeight: 1.65, margin: 0 }}>{strength}</p>
          </div>
          <div style={{ background: '#fff8f8', border: '1.5px solid #fca5a5', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>
              ⚠ Standout Weakness
            </div>
            <p style={{ fontSize: 13.5, color: '#7f1d1d', lineHeight: 1.65, margin: 0 }}>{weakness}</p>
          </div>
        </div>

        <button
          onClick={onRestart}
          style={{
            display: 'block', width: '100%',
            background: '#4a7c59', color: '#fff', border: 'none',
            borderRadius: 14, padding: '16px 0',
            fontSize: 18, fontWeight: 800, cursor: 'pointer',
            fontFamily: "'Cinzel', serif", letterSpacing: '0.04em',
            boxShadow: '0 4px 22px rgba(74,124,89,0.42)',
          }}
        >
          Play Again
        </button>
      </div>
    </div>
  )
}

// ─── Game screen ──────────────────────────────────────────────────────────────

function GameScreen({
  month, stats, prevStats, events, chosenMap, canEndMonth,
  showBoard, boardQs, onChoose, onEndMonth, onBoardDone,
  causalityData, onViewCausality, onCloseCausality,
}: {
  month: number; stats: Stats; prevStats: Stats
  events: GameEvent[]; chosenMap: Record<string,number>; canEndMonth: boolean
  showBoard: boolean; boardQs: BoardQuestion[]
  onChoose: (id: string, i: number) => void
  onEndMonth: () => void; onBoardDone: () => void
  causalityData: {chain: string[]; title: string}|null
  onViewCausality: (chain: string[], title: string) => void
  onCloseCausality: () => void
}) {
  const health = getHealthSummary(stats)
  const vel    = clamp(100 - stats.techDebt * 0.88 - (100 - stats.morale) * 0.14, 5, 100)
  const date   = getInGameDate(month)
  const pct    = Math.round((month / 60) * 100)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f0e8d2 0%, #e8d8b5 100%)', fontFamily: "'Nunito', sans-serif" }}>

      {/* Top header */}
      <div style={{
        background: '#2a1f0e',
        borderBottom: '2px solid #c4a060',
        padding: '11px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Cinzel', serif", fontWeight: 900, color: '#f0e0a8', fontSize: 17 }}>
            Product Lead Simulator
          </span>
          <span style={{ color: '#7a6040', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            Head of Product · {stats.arr >= 1_000_000 ? `£${(stats.arr/1_000_000).toFixed(2)}M ARR` : `£${(stats.arr/1000).toFixed(0)}k ARR`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 100, height: 6, background: '#4a3820', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#c4a060', borderRadius: 3, transition: 'width 0.4s ease' }}/>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#c8a060', fontSize: 11 }}>
              M{month}/60
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 800, color: '#f0e0a8', fontSize: 14 }}>
              Month {month} of 60
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#a08058', fontSize: 10 }}>{date}</div>
          </div>
        </div>
      </div>

      {/* Health summary */}
      <div style={{
        background: '#f5edd8', borderBottom: '1px solid #d4b87a',
        padding: '7px 20px', fontSize: 13, fontWeight: 600,
        color: health.color, fontFamily: "'Nunito', sans-serif",
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 8 }}>●</span> {health.text}
      </div>

      <div style={{ padding: '18px 18px 40px', maxWidth: 1080, margin: '0 auto' }}>

        {/* Stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 9, marginBottom: 14 }}>
          {STAT_DEFS.map(def => (
            <StatCard key={def.key} def={def} value={stats[def.key]} prevValue={prevStats[def.key]}/>
          ))}
        </div>

        {/* Velocity vs debt bars */}
        <div style={{
          background: '#fdf6e8', border: '1.5px solid #d4b87a',
          borderRadius: 12, padding: '13px 16px', marginBottom: 18,
          boxShadow: '0 2px 8px rgba(80,50,10,0.07)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { label: 'Feature Velocity', pct: vel, good: true, color1: '#4a7c59', color2: '#7ab840' },
              { label: 'Technical Debt',   pct: stats.techDebt, good: false, color1: '#d4800a', color2: '#a02020' },
            ].map(bar => (
              <div key={bar.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
                    color: bar.good ? '#2a6a3a' : (bar.pct > 60 ? '#a02020' : '#a06010'),
                  }}>{bar.label}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
                    color: bar.good ? '#2a6a3a' : (bar.pct > 60 ? '#a02020' : '#a06010'),
                  }}>{bar.pct.toFixed(0)}%</span>
                </div>
                <div style={{ background: '#e8dcc8', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    width: `${bar.pct}%`, height: '100%',
                    background: `linear-gradient(90deg, ${bar.color1}, ${bar.color2})`,
                    borderRadius: 4, transition: 'width 0.6s ease',
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Events section */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#8a6a38', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 11 }}>
            This Month — Make Your Decisions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map(ev => (
              <EventCard
                key={ev.id}
                event={ev}
                onChoose={i => onChoose(ev.id, i)}
                isLocked={ev.id in chosenMap}
                chosenIndex={chosenMap[ev.id] ?? null}
                onViewCausality={() => ev.causalityChain && onViewCausality(ev.causalityChain, ev.headline)}
              />
            ))}
          </div>
        </div>

        {/* Causality reference */}
        <div style={{
          background: '#f5edd8', border: '1px solid #d4b87a',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#8a6a38', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>
            ⛓ Decision Causality — trace how past decisions compound
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {Object.values(CAUSALITY_CHAINS).map(chain => (
              <button
                key={chain.title}
                onClick={() => onViewCausality(chain.steps, chain.title)}
                style={{
                  background: '#fdf6e8', border: '1.5px solid #c4a060',
                  borderRadius: 8, padding: '5px 11px',
                  fontSize: 12, fontWeight: 700, color: '#7a5020',
                  cursor: 'pointer', fontFamily: "'Nunito', sans-serif",
                  transition: 'background 0.15s',
                }}
              >
                {chain.title}
              </button>
            ))}
          </div>
        </div>

        {/* End month button */}
        <button
          disabled={!canEndMonth}
          onClick={onEndMonth}
          style={{
            display: 'block', width: '100%',
            background: canEndMonth ? '#2a4a6a' : '#b4a48a',
            color: '#fff', border: 'none', borderRadius: 14,
            padding: '15px 0', fontSize: 15.5, fontWeight: 800,
            cursor: canEndMonth ? 'pointer' : 'not-allowed',
            fontFamily: "'Cinzel', serif", letterSpacing: '0.05em',
            boxShadow: canEndMonth ? '0 4px 18px rgba(42,74,106,0.38)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {canEndMonth
            ? `End Month ${month} — Advance to ${getInGameDate(month + 1)} →`
            : `Decide on all ${events.filter(e => !(e.id in chosenMap)).length} remaining event${events.filter(e => !(e.id in chosenMap)).length !== 1 ? 's' : ''} to continue`}
        </button>
      </div>

      {showBoard && <BoardMeetingModal month={month} questions={boardQs} onDone={onBoardDone}/>}
      {causalityData && <CausalityPanel chain={causalityData.chain} title={causalityData.title} onClose={onCloseCausality}/>}
    </div>
  )
}

// ─── App (root state machine) ─────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen]             = useState<Screen>('start')
  const [month, setMonth]               = useState(1)
  const [stats, setStats]               = useState<Stats>(STARTUP_STATS)
  const [prevStats, setPrevStats]       = useState<Stats>(STARTUP_STATS)
  const [history, setHistory]           = useState<Stats[]>([])
  const [events, setEvents]             = useState<GameEvent[]>([])
  const [pending, setPending]           = useState<PendingConsequence[]>([])
  const [chosen, setChosen]             = useState<Record<string,number>>({})
  const [showBoard, setShowBoard]       = useState(false)
  const [boardQs, setBoardQs]           = useState<BoardQuestion[]>([])
  const [causality, setCausality]       = useState<{chain:string[];title:string}|null>(null)

  const initGame = useCallback((scenario: 'startup'|'series-a') => {
    const base = scenario === 'startup' ? STARTUP_STATS : SERIES_A_STATS
    setStats(base)
    setPrevStats(base)
    setHistory([base])
    setMonth(1)
    setPending([])
    setChosen({})
    setShowBoard(false)
    setCausality(null)
    const { current, remaining } = getEventsForMonth(1, [])
    setEvents(current)
    setPending(remaining)
    setScreen('game')
  }, [])

  const handleChoose = useCallback((id: string, i: number) => {
    setChosen(prev => ({ ...prev, [id]: i }))
  }, [])

  const canEnd = events.length > 0 && events.every(e => e.id in chosen)

  const handleEndMonth = useCallback(() => {
    if (!canEnd) return

    let ns = { ...stats }
    const np = [...pending]

    events.forEach(ev => {
      const choice = ev.choices[chosen[ev.id]]
      ns = applyDeltas(ns, choice.deltas)
      if (choice.consequence) {
        const c = choice.consequence
        np.push({
          triggerMonth: month + c.monthsLater,
          event: {
            domain: c.domain, headline: c.headline, description: c.description,
            choices: c.choices, isConsequence: true, causalityChain: c.causalityChain,
          },
        })
      }
    })

    ns = monthlyDrift(ns)
    const nextMonth = month + 1

    setPrevStats(stats)
    setStats(ns)
    setHistory(h => [...h, ns])
    setChosen({})

    if (nextMonth > 60 || ns.runway <= 0) {
      setScreen('end')
      return
    }

    const { current, remaining } = getEventsForMonth(nextMonth, np)
    setEvents(current)
    setPending(remaining)
    setMonth(nextMonth)

    if (month % 3 === 0) {
      const qi = Math.floor(month / 3 - 1) % BOARD_MEETINGS.length
      setBoardQs(BOARD_MEETINGS[qi])
      setShowBoard(true)
    }
  }, [canEnd, stats, events, chosen, pending, month])

  if (screen === 'start') return <StartScreen onBegin={initGame}/>
  if (screen === 'end')   return <EndScreen stats={stats} history={history} onRestart={() => setScreen('start')}/>

  return (
    <GameScreen
      month={month} stats={stats} prevStats={prevStats}
      events={events} chosenMap={chosen} canEndMonth={canEnd}
      showBoard={showBoard} boardQs={boardQs}
      onChoose={handleChoose} onEndMonth={handleEndMonth}
      onBoardDone={() => setShowBoard(false)}
      causalityData={causality}
      onViewCausality={(chain, title) => setCausality({ chain, title })}
      onCloseCausality={() => setCausality(null)}
    />
  )
}

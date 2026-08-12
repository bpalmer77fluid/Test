# Handoff — WhatsApp Commerce Client Experience Strategy

This doc hands off the next phase of the WhatsApp commerce work to a fresh
session. **Section 1 is the prompt to paste.** Section 2 is the context brief
behind it — paste it too if the session can't read this repo, otherwise the
prompt tells the agent where everything lives.

---

## 1. The prompt (copy-paste this)

```
You are my product strategist and CX architect for Fluid, a commerce platform
for direct-selling / MLM companies. I need a client-experience strategy and a
repeatable deployment playbook for WhatsApp commerce.

## What is already true (do not re-litigate or re-design this)

- Mike Tingey is building Fluid's integration with the Meta Commerce Manager
  API. Assume it ships complete: product sync, pricing, images, inventory,
  and every core Commerce API capability. Do NOT spend effort on integration
  engineering, API mechanics, or webhook plumbing — that layer is Mike's.
- Your scope is everything AFTER the integration exists: the experience we
  put in front of clients, their reps, and their customers — and the
  step-by-step process WE follow to deploy it for each client.

## Read these first (in this repo, under docs/)

- whatsapp-commerce-competitive-playbook.md — our prior market map (four
  layers), deep-dives on Yalo / Haptik / charles, conversion benchmarks,
  ease-of-deployment bar, Fluid's moat (nobody models a salesforce), and a
  capability gap table. Treat it as the starting hypothesis, not the answer.
- whatsapp-commerce-spec.md — what we already scaffolded (catalog → cart →
  M-Pesa STK push → receipt, template manager, cart recovery, rep
  attribution via wa.me deep links).
- forever-living-kenya-teardown.md — the anchor client case: manual WhatsApp
  ordering today, gray market, shadow commerce (reps DIY-ing Kyte
  storefronts), and the TikTok finding: TikTok Shop is NOT available in
  Kenya or anywhere in Africa, so social traffic must convert in chat.
- forever-living-kenya-competitive-landscape.md — Kenya market patterns
  incl. "social-first, chat-close" and the rep tooling layer (Kyte).
- whatsapp-tech-provider-strategy.md — our 3-stage Meta path (demo → BSP
  pilot → Tech Provider). Your plan must fit inside it, not replace it.
- whatsapp-demo-runbook.md — how we demo today, incl. Meta account-integrity
  rules we must not violate.

## Task 1 — Deep competitive research (fresh, not just the playbook)

Research the best WhatsApp commerce providers in the world with live web
sources. Cover at minimum, and add anyone I'm missing:

- Enterprise conversational commerce: Yalo, Haptik (Jio), Infobip, Gupshup,
  Twilio (incl. Segment tie-ins), LivePerson
- Mid-market/SMB SaaS: charles, Wati, SleekFlow, Interakt, Zoko, Spur,
  Rasayel, Trengo, respond.io, Chatfuel, DelightChat
- Rep/seller-layer tools our clients' distributors already reach for on
  their own: Kyte, Take App, WhatsApp Business app catalogs
- Adjacent proof points: JioMart's WhatsApp ordering (including its
  out-of-market failure mode — a US user hits a pincode wall and
  dead-ends), Meta's own commerce features roadmap (Flows, in-chat
  payments in India/Brazil/Singapore)

For each: what their onboarding feels like (time-to-first-sale), what their
customer-facing chat experience does that converts (catalog UX, cart,
checkout, recovery, re-order, order status), what they charge, what their
clients complain about (read reviews/G2/Reddit — complaints are the product
roadmap), and what is genuinely best-of-breed vs. marketing claims. Cite
sources. Where a number can't be verified, label it as unverified rather
than asserting it.

## Task 2 — The Fluid strategy (synthesis, not summary)

Write the strategy for Fluid's client-facing WhatsApp commerce experience,
grounded in Task 1. It must answer:

1. The customer journey we ship by default: entry points (rep link,
   click-to-WhatsApp ads, QR at events, social bio links), browse → cart →
   pay → receipt → order status → replenishment/re-order → win-back. Where
   do we match best-of-breed, and where do we deliberately do better?
2. The rep experience — this is our moat; nobody else models a salesforce.
   Rep link generation and sharing, attribution the rep can trust, what the
   rep sees (their orders, their conversion), and what the rep must STOP
   doing (hand-quoting prices, collecting ID numbers in chat, health/income
   claims). Compliance guardrails are a feature we sell, not friction.
3. The client admin experience: connect WABA → sync catalog (Mike's layer)
   → approve template pack → set payment rails → invite reps → go live.
   Benchmark: charles-level ease. Target a defensible "time to first live
   order" number and defend it.
4. Messaging/automation defaults we ship on day one: template library,
   cart-recovery cadence, order status, replenishment timing (e.g. 28-day
   consumable cycles), opt-out handling, 24-hour-window compliance, and
   quality-rating protection (what we auto-throttle when Meta's quality
   score drops).
5. Payments by market: M-Pesa-first for East Africa, then the sequencing
   for other rails (cards/PSPs, Pix, UPI, Meta native payments where they
   exist). Payment rail availability should drive market sequencing.
6. Pricing/packaging POV: how competitors price (per-seat, per-conversation,
   % of GMV, markup on Meta fees) and what fits Fluid's model.

## Task 3 — The deployment playbook (skill-ready)

Turn the strategy into a step-by-step playbook I can execute per client —
written so it can later become an automated skill. Structure it as:

- Inputs collected from the client (a literal intake checklist)
- Phase-by-phase steps with owner (Fluid / client / Mike's integration),
  duration, exit criteria, and verification ("how we know this step worked")
- The template pack to submit per vertical (supplements/wellness needs
  claims-safe copy — no health claims, no income claims)
- Launch sequence: pilot rep cohort → measure → widen
- The metrics reviewed weekly (client-facing dashboard list + our internal
  health metrics), with target ranges taken from Task 1 benchmarks
- Failure modes and their runbooks (template rejected, quality rating drops,
  payment callback failures, rep link misuse)

## Task 4 — Gap list

Everything the strategy needs that doesn't exist yet, split into: (a) asks
for Mike's integration layer, (b) Fluid product/engineering asks, (c) ops
and content asks (template copy, training materials). Prioritized.

## Hard constraints

- No health claims, no income claims, anywhere — templates, site copy,
  training examples.
- Respect Meta platform rules absolutely: approved templates outside the
  24-hour window, no workarounds, no new Meta accounts to sidestep the
  restricted "Fluid Demo" portfolio (recovery = appeal, Fluid's verified
  corporate portfolio, or a BSP).
- TikTok Shop does not exist in Africa — social traffic converts in chat or
  not at all. Design for that.
- Handle out-of-market visitors gracefully (the JioMart pincode trap).

## Output

Four markdown deliverables matching the four tasks, in docs/:
1. whatsapp-cx-competitor-research.md
2. whatsapp-cx-strategy.md
3. whatsapp-deployment-playbook.md
4. whatsapp-cx-gap-list.md

Research with live web sources and cite them inline. Depth over speed.
```

---

## 2. Context brief (paste only if the new session can't read this repo)

**Fluid** is a droplet platform for direct-selling companies (Fastify +
Prisma backend, React frontend, DIT token auth). The anchor case study is
**Forever Living Kenya**: orders today happen by free-text WhatsApp message
(product names + national ID number), manual M-Pesa transfer, manual
reconciliation, office pickup, and rep commission only if the customer
remembers to name their rep.

**What we already built** (PR #3 on `claude/forever-living-kenya-docs-ic4l7x`):
a working scaffold where a customer taps a rep's `wa.me` link, browses a
native WhatsApp catalog, submits a cart, gets an M-Pesa STK push, and
receives a receipt in chat — with rep attribution bound first-touch to the
session. Plus a template manager (six compliance-reviewed UTILITY templates,
submitted to Meta via API, status-synced) and an abandoned-cart recovery arc
(30 min / 24 h / 72 h) that uses plain text inside the 24-hour customer
service window and approved templates outside it, skipping sends rather than
violating policy.

**Key prior findings:**
- Market has four layers: enterprise conversational commerce (Yalo, Haptik),
  mid-market SaaS (charles, Wati, SleekFlow…), rep-layer DIY tools (Kyte),
  and BSP infrastructure (Twilio, 360dialog, Gupshup).
- **Fluid's moat**: nobody in any layer models a salesforce — rep
  attribution, comp-plan integration, mobile-money reconciliation, downline
  governance, MLM compliance guardrails.
- **Shadow commerce validates demand**: FL reps already DIY WhatsApp
  storefronts on Kyte (`forever-living-products-7.kyte.site` — the `-7`
  means at least six other reps claimed the name first), with zero corporate
  visibility.
- Benchmarks worth pressure-testing: in-chat checkout ≈ 35% higher
  conversion / ≈ 23% fewer abandoned carts; WhatsApp cart recovery 18–23%;
  automated flows drive 60–70% of WhatsApp revenue; CTWA CTR 15–25%.
- **TikTok Shop is unavailable in all of Africa** (Somalia bans TikTok;
  South Sudan restricted) — social discovery must close in chat.
- Meta path: demo → BSP pilot → Meta Tech Provider (three-stage strategy
  already written). The "Fluid Demo" Meta portfolio is restricted; recovery
  must be compliant (appeal / corporate portfolio / BSP) — never a new
  account.
- Meta's native in-chat payments exist only in India, Brazil, Singapore; in
  Kenya the M-Pesa STK push delivers the same never-leave-the-chat
  experience and is the established local pattern.

**Who's who:** Mike Tingey owns the Meta Commerce Manager API integration
(product sync, pricing, images, inventory — assume complete). Mist is a
separate agent executing the FL Kenya site-clone work (two handoff docs
already delivered). This session's owner is building the client experience
and go-to-market on top.

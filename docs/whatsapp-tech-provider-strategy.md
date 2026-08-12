# Fluid × WhatsApp: Tech Provider Strategy

How Fluid turns the WhatsApp commerce droplet into a platform capability —
every Fluid client gets a WhatsApp storefront with rep attribution and local
payments, onboarded in minutes through Fluid's own UI, with Fluid holding the
direct Meta relationship as a **Tech Provider**.

Companion docs: [spec](./whatsapp-commerce-spec.md) ·
[runbook](./whatsapp-demo-runbook.md) ·
[FL Kenya teardown](./forever-living-kenya-teardown.md)

---

## 1. Why this is a Fluid-shaped opportunity

Fluid's clients are direct-selling companies. Their commerce already happens
in chat — reps close sales on WhatsApp in every emerging market — but today
it's free-text messages, manual payments, and lost attribution. The FL Kenya
teardown documented the cost: hours-to-days order cycles, ~0% automated
reconciliation, commission by memory, and gray-market marketplaces winning on
checkout convenience.

The droplet already solves this for one company. Tech Provider status is what
makes it **productizable for all of them**:

- **Embedded signup inside Fluid onboarding** — a client connects WhatsApp
  the way they connect a payment gateway: OAuth-style popup, done. No Meta
  developer console, no tickets.
- **Clients pay Meta directly** for messaging — no BSP margin (typically
  5–20%) in the middle, which matters since Meta moved to per-message
  billing in July 2025.
- **Fluid owns the platform relationship** — the same strategic position
  Shopify holds with its commerce integrations, rather than reselling
  someone else's.

The architecture is already the right shape: `whatsapp_configs` maps each
installation to its own `phone_number_id`, access token, and catalog. Tech
Provider onboarding just fills those rows automatically instead of manually.

## 2. The three-stage path

Each stage ships value on its own and hands off to the next without a
rewrite.

### Stage 1 — Prove it (now → ~1 month)
**Goal:** working demo + one lighthouse conversation.

- Resolve the Meta account problem: appeal the restricted "Fluid Demo"
  portfolio AND build under Fluid's real, verified corporate portfolio (see
  runbook warning — never a throwaway).
- Run the sandbox demo end-to-end (runbook Track B); record the 3-minute
  happy-path video.
- Pitch FL Kenya (or the most WhatsApp-native client in the pipeline) as the
  lighthouse: their Nairobi office + rep network is the perfect proving
  ground, and the teardown/competitive docs are the pitch material.

**Gate to Stage 2:** demo works; one client signed for pilot.

### Stage 2 — Pilot on a BSP (~1–4 months)
**Goal:** first paying tenant(s) live in production without waiting on
Meta approvals.

- Launch the pilot through **360dialog** (Cloud API-compatible payloads =
  minimal code change; no per-message markup, flat per-number fee; human
  support for number provisioning — insurance against the account-integrity
  issues we already hit).
- Production M-Pesa: client's paybill + Daraja production app, or a PSP
  (IntaSend/Pesapal) for Airtel Money + cards.
- Build the phase-2 product items from the spec: conversation state machine,
  payment retries/timeout queries, delivery/pickup selection, rep dashboard.
- Instrument the success metrics (below) — pilot data is the Tech Provider
  application's evidence and the sales deck's proof.

**Gate to Stage 3:** 1–3 tenants live, metrics green, support load
understood.

### Stage 3 — Become a Meta Tech Provider (~3–6 months, parallel start)
**Goal:** Fluid's own Meta app with embedded signup; clients onboard
self-serve and pay Meta directly.

Meta's requirements ([official guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers)):

1. **Meta Business portfolio, business-verified** — Fluid's corporate
   portfolio with registration documents. Start immediately; verification is
   the long pole and it also unblocks Stages 1–2.
2. **Meta app configured for WhatsApp** under that portfolio.
3. **App Review** for `whatsapp_business_management` and
   `whatsapp_business_messaging` permissions — requires **video evidence**
   of sending messages and managing templates. The pilot deployment *is*
   this evidence.
4. **Access Verification** (App Settings → Basic) — attests the tech
   provider relationship.
5. **Embedded Signup** integrated in Fluid's UI and the app toggled to
   **Live mode** (embedded signup errors in Development mode).

Engineering work in this stage:

- **Embedded signup flow** in the droplet frontend: client clicks "Connect
  WhatsApp" → Meta popup → callback returns the WABA + phone number → we
  exchange for a business token and write the `whatsapp_configs` row.
  (This replaces manual config; the runtime code path is unchanged.)
- **Token lifecycle**: encrypt stored tenant tokens, refresh/expiry
  handling, revocation on uninstall.
- **Template manager**: UI for clients to create/submit message templates
  (receipts, delivery updates, re-engagement) through Fluid.
- **Number + catalog provisioning**: guided flows for registering the
  client's display number and connecting their Commerce Manager catalog
  (auto-synced from Fluid products, already built).
- **Migration path**: move Stage 2 BSP numbers to the Fluid app (Meta
  supports number migration between providers; plan it, don't improvise).

**Gate to "scaled":** a new client connects WhatsApp end-to-end with zero
human touch.

## 3. Business model

Options, not mutually exclusive:

| Model | Mechanics | Fit |
|---|---|---|
| **Droplet subscription** | WhatsApp Commerce as a premium droplet, flat monthly per company | Simplest; matches existing droplet economics |
| **Per-order fee** | Small fee per WhatsApp-originated order | Aligns price with delivered value; needs volume metering (already have `orders.source`) |
| **Messaging pass-through** | Clients pay Meta directly (Tech Provider default) — Fluid charges zero margin on messages | A *selling point vs BSP-based competitors*, not a revenue line |

Recommended: subscription + per-order fee, with "you pay Meta's rates with
no markup" as the competitive wedge.

## 4. Go-to-market

- **Lighthouse:** FL Kenya-type client in an M-Pesa market — highest pain,
  clearest before/after story (hours → <3 minutes; the before/after graphic
  and teardown are the deck).
- **Vertical expansion:** the pitch generalizes to every direct-selling
  client — rep attribution in chat is the feature no horizontal WhatsApp
  tool (Wati/Zoko) offers.
- **Market sequencing by payment rail:** Kenya/East Africa (M-Pesa STK,
  built) → Brazil & Mexico (native WhatsApp Pay / Pix — huge direct-selling
  markets, even simpler payments) → SE Asia (gateway-based).
- **Positioning:** "Turn every rep's WhatsApp into an attributed
  storefront." Not a chatbot; a commerce channel with commissions wired in.

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Account integrity flags (already bitten once) | Verified corporate portfolio only; gradual ramp; appeal — never replace — restricted assets; BSP as Stage 2 buffer |
| App Review rejection / delays | Pilot video evidence; scope permissions minimally; 24h resolution typical for solution approval, but budget weeks for App Review |
| MLM + supplement content policy | Catalog copy review per client (no health/income claims); commerce policy pre-check in onboarding |
| Per-client support burden | Embedded signup + provisioning automation is the product answer; BSP pilot measures the load first |
| Fluid API order-shape mismatch | Confirm create/pay endpoints against current Fluid API docs before Stage 2 (flagged in runbook) |
| Meta pricing/policy shifts | Tech Provider = direct relationship; pricing changes hit clients' Meta bill, not Fluid's margin |

## 6. First 90 days

| When | Milestone |
|---|---|
| Week 1 | Appeal restricted portfolio; start business verification on the corporate portfolio; assign an owner for the Meta relationship |
| Weeks 1–2 | Sandbox demo green end-to-end (runbook Track B); record demo video |
| Weeks 2–4 | Lighthouse pitch with teardown + video; confirm Fluid order API shapes; pick pilot market/client |
| Weeks 4–8 | 360dialog account + number provisioning; production M-Pesa; phase-2 product build; pilot goes live |
| Weeks 8–12 | Pilot metrics review; submit Meta App Review with pilot evidence; start embedded-signup build |
| Day 90 | Go/no-go on full Tech Provider rollout, backed by pilot data |

## 7. Success metrics

- **Pilot (per tenant):** order cycle time <3 min; >95% auto-reconciled
  payments; >80% rep-attributed orders; STK abandonment <20%.
- **Platform:** time-to-connect for a new client (target <15 min via
  embedded signup); # tenants live; WhatsApp-originated GMV; support
  tickets per tenant per month (target near zero after onboarding).
- **Strategic:** Tech Provider approval; first client migrated off BSP;
  first non-African market live.

## 8. Sources

- Meta — [Get started for Tech Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers)
- 360dialog — [Become a Meta Tech Provider](https://docs.360dialog.com/partner/get-started/tech-provider-program/become-a-meta-tech-provider)
- Infobip — [Tech Provider Program integration guide](https://www.infobip.com/docs/whatsapp/tech-provider-program/setup-and-integration)
- Twilio — [Tech Provider Program guide](https://www.twilio.com/docs/whatsapp/isv/tech-provider-program/integration-guide)
- WhAutomate — [Tech Provider vs BSP economics](https://whautomate.com/whatsapp-tech-provider-vs-bsp)

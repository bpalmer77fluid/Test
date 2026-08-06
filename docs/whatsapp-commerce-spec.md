# WhatsApp Commerce Droplet — Technical Spec

> How this Fluid droplet delivers "WhatsApp commerce done properly" for
> Forever Living Kenya (and any direct-selling company in an M-Pesa market):
> native catalog + cart inside WhatsApp, automated order creation in Fluid,
> and in-chat M-Pesa payment via STK push. Companion to
> [forever-living-kenya-teardown.md](./forever-living-kenya-teardown.md)
> (opportunity #3). Rep flow diagram:
> [whatsapp-before-after.svg](./assets/whatsapp-before-after.svg).

---

## 1. Problem

FL Kenya's current WhatsApp flow is free-text: the customer messages the
office with product names, their full name, and national ID number; staff
manually price the order, wait for an unverified M-Pesa transfer, reconcile
it by hand, and arrange pickup. Reps get attribution only if the customer
remembers to mention them. Every step leaks orders, and none of it produces
structured data.

## 2. Solution Overview

```
Customer                WhatsApp Cloud API           Droplet backend              Fluid platform
   │  opens rep's         │                             │                            │
   │  wa.me link ────────▶│ referral (rep shareGuid)    │                            │
   │                      │──── messages webhook ──────▶│ bind session to rep        │
   │  browses catalog     │                             │                            │
   │  sends cart ────────▶│──── `order` message ───────▶│ create order ─────────────▶│ order (rep-attributed)
   │                      │                             │ STK push ──▶ Daraja        │
   │  M-Pesa PIN prompt ◀─┼─────────────────────────────┤                            │
   │  enters PIN          │                             │◀── payment callback        │
   │  receipt in chat  ◀──│◀─── confirmation message ───│ mark order paid ──────────▶│ fulfillment + commissions
```

Native Meta in-chat payments (WhatsApp Pay) are **not** available in Kenya —
only India and Brazil. The STK push pattern achieves the same UX: the M-Pesa
PIN prompt overlays WhatsApp, so the customer never leaves the chat. This is
the established Kenyan pattern (insurers and schools already collect payment
inside WhatsApp Flows this way).

## 3. Architecture

### Components

| Component | File | Status |
|---|---|---|
| WhatsApp webhook (verify + inbound messages) | `backend/src/routes/whatsapp.ts` | Scaffolded |
| WhatsApp Cloud API client (send text/catalog/confirmations, signature verification, inbound parsing) | `backend/src/services/whatsappService.ts` | Scaffolded |
| M-Pesa Daraja client (OAuth, STK push, callback parsing) | `backend/src/services/mpesaService.ts` | Scaffolded |
| M-Pesa callback route | `backend/src/routes/mpesa.ts` | Scaffolded |
| Session + payment persistence | `backend/prisma/schema.prisma` (`WhatsAppSession`, `MpesaPayment`) | Scaffolded |
| Meta catalog sync from Fluid products | `WhatsAppService.syncProductToCatalog` | Stub (TODO) |
| Fluid order creation/paid-marking via DIT token | TODOs in routes | Stub (TODO) |

### Data model additions

- **`whatsapp_sessions`** — one row per (installation, customer phone):
  conversation state, in-progress cart, and the attributed `repId` bound from
  the rep's deep-link referral. Attribution persists for the customer's
  lifetime unless a different rep link is used.
- **`mpesa_payments`** — one row per STK push attempt, keyed by Daraja
  `CheckoutRequestID`; stores status, M-Pesa receipt number, and the raw
  callback for audit.

### Message flow detail

1. **Entry** — each rep shares `https://wa.me/<company-number>?text=ref:<shareGuid>`.
   The prefilled `ref:` token (and Meta's `referral` payload on
   click-to-WhatsApp ads) lets the webhook bind the session to the rep row
   already synced by the existing rep webhook.
2. **Browse** — the bot replies to any text with a `catalog_message`. The
   customer browses products and builds a multi-item cart **natively in
   WhatsApp** — no bot menus.
3. **Cart → order** — WhatsApp delivers the cart as an `order`-type message
   with `product_retailer_id` per line (mapped to Fluid SKUs). The droplet
   creates a pending order (locally now; in Fluid via DIT token in phase 2).
4. **Pay** — the droplet fires an STK push for the cart total. Daraja pops
   the PIN prompt on the customer's phone.
5. **Settle** — the Daraja callback marks the payment success/failed, flips
   the order to `paid`, and the bot sends an in-chat receipt with the M-Pesa
   reference. Failures get a "reply *pay* to retry" message.

## 4. Configuration

### Environment variables

| Variable | Purpose |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | System-user token for the WhatsApp Business Account |
| `WHATSAPP_PHONE_NUMBER_ID` | Sender phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification handshake secret |
| `WHATSAPP_APP_SECRET` | Meta app secret for `X-Hub-Signature-256` validation |
| `WHATSAPP_CATALOG_ID` | Commerce Manager catalog ID |
| `MPESA_ENV` | `sandbox` or `production` |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | Daraja app credentials |
| `MPESA_SHORTCODE` | Paybill or till number |
| `MPESA_PASSKEY` | Lipa na M-Pesa Online passkey |
| `MPESA_CALLBACK_URL` | Public URL of `/api/webhook/mpesa/callback` |

### External setup checklist

- [ ] Meta Business verification for the company (1–3 days, the long pole)
- [ ] WhatsApp Business Account + dedicated number on the Cloud API
- [ ] Commerce Manager catalog created; compliance review for supplement listings
- [ ] Webhook subscribed to `messages` with the verify token
- [ ] Utility/marketing message templates approved (re-engagement outside the 24h window)
- [ ] M-Pesa paybill/till + Daraja production app (or a PSP like IntaSend/Pesapal to add Airtel Money + cards)
- [ ] For FL specifically: corporate sign-off to run this as an official channel

## 5. Phase Plan

### Phase 1 — MVP (scaffolded here; ~3–4 weeks to production)
- Webhook verification + inbound message handling ✅ scaffolded
- Session persistence with rep attribution ✅ scaffolded
- STK push + callback settlement + in-chat receipts ✅ scaffolded
- **5.1 Catalog sync** — push Fluid products to Meta via `/{catalog_id}/items_batch`
  (retailer_id = SKU), triggered from the existing product webhook (TODO)
- **5.2 Fluid order integration** — create the order in Fluid with the
  installation's DIT token and mark it paid on settlement, so fulfillment
  and rep commissions fire upstream (TODO)
- Raw-body capture in `config/fastify.ts` for signature verification (TODO)

### Phase 2 — Productionization
- Multi-tenant routing: map `phone_number_id` → installation (config table + UI)
- Conversation state machine: quantity edits, delivery vs pickup selection, retry flows
- Payment retries, idempotency on Daraja callbacks, STK timeout queries
- Delivery: courier handoff or office-pickup slot selection

### Phase 3 — Growth
- WhatsApp Flows checkout (address + confirmation screens in-chat)
- Rep dashboard in the droplet frontend: shared links, attributed orders, conversion
- Re-engagement templates: abandoned cart, replenishment reminders (28-day gel cycle)
- Airtel Money + card fallback via PSP; Somalia/South Sudan constraints per market

## 6. Risks & Constraints

| Risk | Mitigation |
|---|---|
| Meta business verification delays | Start first; everything else parallelizes |
| Supplement content rejected by commerce policy review | Pre-review catalog copy; avoid health claims in product descriptions |
| 24h customer-service window limits re-engagement | Approved utility templates for receipts/delivery updates |
| Daraja callbacks are unsigned | IP allowlist + secret path segment + status query reconciliation |
| STK push abandonment (PIN not entered) | Timeout query + one-tap retry message |
| Rep attribution gaming (link swapping) | First-touch binding stored per session; corporate policy decides override rules |

## 7. Success Metrics

- Order cycle time: WhatsApp message → paid (target: < 3 minutes vs hours/days today)
- % of orders auto-reconciled (target: > 95% vs ~0% manual today)
- % of orders with rep attribution (target: > 80% vs "customer remembers to mention" today)
- Cart abandonment at STK push step (watch metric; drives retry UX)

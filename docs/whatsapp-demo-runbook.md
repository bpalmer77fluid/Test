# WhatsApp Commerce — Demo Runbook

Step-by-step guide to experiencing and demoing the WhatsApp commerce flow,
runnable by anyone at Fluid from a US phone. Two tracks:

- **Track A (15 minutes, no code):** feel the native catalog/cart UX as a customer.
- **Track B (half a day):** run the full droplet flow — catalog → cart → order →
  M-Pesa sandbox payment → in-chat receipt.

Companion to [whatsapp-commerce-spec.md](./whatsapp-commerce-spec.md).

> ⚠️ **Meta account integrity warning (learned the hard way):** create the demo
> assets under an **established, verified Meta Business portfolio** — ideally
> Fluid's real corporate one — using your real identity, and ramp API activity
> gradually. A brand-new business portfolio that immediately drives automated
> API traffic pattern-matches Meta's "automation abuse" detector and gets
> restricted, often permanently. Do **not** create a replacement account to get
> around a restriction — Meta links accounts by admin identity, payment method,
> and domain, and ban evasion escalates to those linked assets. If a portfolio
> gets restricted, appeal it via Business Support Home with business
> verification documents instead.

---

## Track A — Feel the customer experience (15 minutes, no code)

The catalog and cart are **native WhatsApp features** — no bot or API needed
to experience them.

1. Install the free **WhatsApp Business** app on a spare number (second
   phone, dual-SIM, or eSIM).
2. In the app: **Settings → Business tools → Catalog**, then add 4–5
   FL-style products (Aloe Vera Gel — KSh 3,291, Bee Pollen, Aloe Berry
   Nectar…) with photos and prices.
3. From your personal WhatsApp, message the business number, tap the
   storefront icon, browse the catalog, **add items to cart, send the cart**.

What you see — catalog card, product pages, cart builder, sent-cart summary —
is pixel-identical to what FL Kenya customers would see, because it's the
same UI the Cloud API triggers. Screenshot each step; that's the UX spec.

## Track B — Run the full droplet flow

### B1. Meta setup (do this first; verification is the long pole)

1. Under the **verified corporate business portfolio** (see warning above),
   go to [developers.facebook.com](https://developers.facebook.com) →
   **Create App** → type "Business" → add the **WhatsApp** product.
2. The app comes with a **test number** (free, no approval) that can message
   up to 5 verified recipients — add your own phone.
3. Note three values from the WhatsApp → API Setup page:
   - `WHATSAPP_ACCESS_TOKEN` (temporary 24h token, or create a system-user token)
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_APP_SECRET` (App settings → Basic)
4. In [Commerce Manager](https://business.facebook.com/commerce): create a
   catalog, add the same 4–5 demo products, **set each item's Content ID /
   retailer_id to the Fluid SKU**, and connect the catalog to the WhatsApp
   account. Note the catalog ID → `WHATSAPP_CATALOG_ID`.

### B2. Daraja (M-Pesa) sandbox

1. Sign up at [developer.safaricom.co.ke](https://developer.safaricom.co.ke),
   create an app, and note `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET`.
2. Sandbox constants: `MPESA_ENV=sandbox`, `MPESA_SHORTCODE=174379`, and the
   public Lipa na M-Pesa sandbox passkey (shown on the portal) → `MPESA_PASSKEY`.
3. Sandbox test phone: `254708374149` (no real PIN prompt; callbacks are simulated).

### B3. Deploy and wire up

1. Deploy the backend (Render, same as the droplet template) with the env
   vars from B1/B2 plus:
   - `WHATSAPP_VERIFY_TOKEN` — any random string
   - `MPESA_CALLBACK_URL` — `https://<backend>/api/webhook/mpesa/callback?secret=<random>`
   - `MPESA_CALLBACK_SECRET` — the same `<random>` value
2. In the Meta app's WhatsApp → Configuration: set the webhook URL to
   `https://<backend>/api/webhook/whatsapp`, enter the verify token, and
   subscribe to the **messages** field. Meta calls the GET endpoint; the
   droplet echoes the challenge automatically.
3. Multi-tenant note: with a single tenant the env vars are enough. For more
   than one company, insert a `whatsapp_configs` row per installation
   (phoneNumberId, accessToken, catalogId) — inbound routing keys off the
   receiving number's `phone_number_id`.

### B4. Walk the flow as a customer

1. Get a rep `shareGuid` from the reps table (synced by the rep webhook), and
   open `https://wa.me/<test-number>?text=ref:<shareGuid>` on your phone.
2. Send the prefilled message → the bot replies with the **catalog message**.
3. Browse, build a cart, send it → watch the logs: local order created,
   Fluid order attempted, STK push fired, confirmation message received.
4. Simulate the payment result: the Daraja sandbox POSTs the callback, or
   replay one manually:
   ```bash
   curl -X POST "https://<backend>/api/webhook/mpesa/callback?secret=<random>" \
     -H "Content-Type: application/json" \
     -d '{"Body":{"stkCallback":{"MerchantRequestID":"demo","CheckoutRequestID":"<from logs>","ResultCode":0,"ResultDesc":"Success","CallbackMetadata":{"Item":[{"Name":"Amount","Value":3291},{"Name":"MpesaReceiptNumber","Value":"TEST123XYZ"},{"Name":"PhoneNumber","Value":254708374149}]}}}}'
   ```
5. The receipt message lands in the chat; the order flips to `paid`.

### B5. Demo checklist (what to verify / show)

- [ ] Rep link opens the chat and the session row carries the rep's ID
- [ ] Catalog message renders with products and KSh prices
- [ ] Sent cart creates an `orders` row with `pending_payment` and rep attribution in `orderData`
- [ ] STK push request logged; `mpesa_payments` row `pending`
- [ ] Success callback → payment `success`, order `paid`, receipt in chat
- [ ] Failure callback (ResultCode ≠ 0) → "reply *pay* to try again" message
- [ ] Replayed duplicate callback is ignored (idempotency)
- [ ] Product update webhook from Fluid syncs the item into the Meta catalog
- [ ] Stopwatch the happy path: first message → receipt (target < 3 minutes)

### Known gaps (deliberate, phase 2)

- Fluid order creation uses the v1 API shape from this template's order sync;
  confirm the exact create/pay endpoints against current Fluid API docs
  before production.
- No conversation state machine yet (quantity edits, delivery selection).
- STK timeout query (customer never enters PIN) not implemented — failures
  rely on Daraja's callback.
- The real PIN-prompt experience requires a production shortcode and a
  Safaricom line — one colleague in Nairobi gets you the true 3-minute demo
  video for pitching FL corporate.

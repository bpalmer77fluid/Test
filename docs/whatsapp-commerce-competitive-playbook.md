# WhatsApp Commerce — Who's Best in the World, and What to Copy

Research brief for building Fluid's WhatsApp connection to be **high quality,
easiest to use, easiest to deploy, and highest converting**. Reviewed August
2026.

Companions: [spec](./whatsapp-commerce-spec.md) ·
[Tech Provider strategy](./whatsapp-tech-provider-strategy.md) ·
[FL Kenya teardown](./forever-living-kenya-teardown.md)

---

## 1. The market has four distinct layers

Knowing which layer a company competes in prevents bad comparisons.

**Layer 1 — Infrastructure / BSPs.** Sell API access, numbers, and
deliverability. **Gupshup** (50,000+ customers in 130+ countries,
120B+ messages/year), **Infobip**, **Twilio**, **Sinch**, **Clickatell**,
**360dialog** (cleanest markup), **Take Blip** (LatAm's largest, backed by
SoftBank and Microsoft). Fluid is a *consumer* of this layer in Stage 2, then
bypasses it as a Tech Provider.

**Layer 2 — Enterprise conversational commerce.** Sell outcomes to big
brands. **Yalo**, **Haptik**, **charles**, Gupshup's commerce arm. *This is
Fluid's layer.*

**Layer 3 — D2C / Shopify SaaS.** Self-serve tools for online brands:
**Zoko** (3,000+ DTC brands, 70+ countries), **Wati**, **Interakt**,
**AiSensy**, **BIK**, **DelightChat**, **Chatarmin**, **Spur**. Feature-rich,
strong benchmarks, no attribution model for salesforces.

**Layer 4 — SMB self-serve catalogs.** **Kyte**, and WhatsApp Business app's
native catalog. Free, instant, everywhere — this is what individual reps use
today and it sets the "time to first value" bar.

## 2. The three to study hardest

### Yalo — the closest structural analog
AI-driven conversational commerce for **B2B CPG in Latin America**: Nestlé,
Unilever, Coca-Cola FEMSA selling to millions of corner-store owners over
WhatsApp. Why it maps to Fluid almost one-to-one: a brand serving a large
network of small, non-technical buyers in emerging markets, replacing a
manual sales-rep-driven order process. Their thesis — *in emerging markets
consumers spend 84% of screen time in messaging apps* — is the same bet.

Lessons to steal:
- They started as a conversation/workflow builder and **added native commerce
  later**, after repeatedly integrating commerce platforms by hand for
  clients. We are skipping straight to native commerce — the right call.
- **Personalized recommendations by micro-segment** (Grupo Mariposa case:
  store owners get order suggestions learned from their own neighbourhood
  rather than depending on a rep's memory). The direct-selling analogue is
  replenishment suggestions per customer and per rep's downline.
- Sell to the *brand*, deliver value to the *network*. Fluid's buyer is the
  company; the daily user is the rep.

### Haptik — the end-to-end consumer benchmark
Built **JioMart on WhatsApp** (Reliance-owned; the first true end-to-end
WhatsApp shopping experience — browse full catalog, cart, pay, all in chat).
Clients include KFC, Whirlpool, HP, Disney Hotstar. Study it for what
"complete" looks like: catalog search, pincode/serviceability checks, order
tracking in-chat, personalized recommendations. **Caveat we learned the hard
way:** JioMart gates on an Indian delivery pincode, so a non-Indian tester
hits a dead end — a reminder to design graceful failure for out-of-market
users.

### charles — the ease-of-deployment benchmark
EU conversational-commerce/CRM platform for D2C brands. Notable for
**onboarding customers within one day**, with CSM-driven setup of popups,
welcome flows, and integrations from out-of-the-box components. If Fluid's
target is "connect WhatsApp in under 15 minutes," charles is the service
model to beat.

## 3. Conversion mechanics that actually move numbers

Benchmarks to design against and to use in the pitch:

| Mechanic | Reported impact |
|---|---|
| **In-chat checkout** (no redirect) | ~35% higher conversion, ~23% fewer abandoned carts |
| **Abandoned-cart recovery via WhatsApp** | 18–23% recovery on optimized flows (good range 10–30%, best cases ~40%); 4x ROI vs email |
| **Automated flows** (cart, post-purchase, back-in-stock) | 60–70% of all WhatsApp revenue |
| **Fast recovery timing** | 18–25% of abandoned sessions convert within 30 minutes |
| **Click-to-WhatsApp ads** | CTR 15–25%; cost per conversation ~€1.50–8.00 |
| **Conversation hooks** ("Chat with us") vs site hooks ("Shop now") | 15–30% lift in conversion-to-conversation |
| **Channel baseline** | Open rates ~4x email; conversion ~2x SMS |
| **Response speed** | Sub-60-second replies compress decisions from hours to minutes |

Design rules that follow directly:

1. **Never redirect to pay.** The no-redirect checkout is the single largest
   documented lift. For Kenya this means M-Pesa STK push in-chat (built), not
   a link to a web checkout.
2. **Automations are the product, not a feature.** If automated flows drive
   60–70% of revenue, then cart recovery, order status, and replenishment
   nudges are roadmap-critical, not phase 3 nice-to-haves.
3. **Recover within 30 minutes**, then follow the proven three-message /
   72-hour arc: reminder → trust → incentive.
4. **Answer in under a minute**, always — automated first response, human
   handoff after.
5. **Opt-in has a floor:** below roughly 200 monthly opt-ins the automation
   effort doesn't pay back. Rep-shared links are Fluid's opt-in engine, which
   is a structural advantage over brands buying ads.

## 4. Ease of deployment — the real battleground

Observed onboarding times: **Wati ~30 minutes** guided, genuinely no-code;
**charles ~1 day** with a CSM; **Zoko** repeatedly criticized for
**onboarding friction, pricing escalation, and leaking WhatsApp Business API
complexity to the user**; **Kyte** is effectively instant and free.

The lesson is unambiguous: **the winner in this category is whoever hides
Meta's complexity best.** Every platform that makes the customer understand
WABAs, phone number registration, template approval, or the 24-hour window
gets punished in reviews.

Fluid's targets:
- **Company onboarding < 15 minutes**, zero Meta console visits (embedded
  signup does number + WABA + catalog).
- **Rep onboarding < 60 seconds** — they copy their link. That is the whole
  step.
- **Templates pre-built and pre-submitted** per vertical, so no client ever
  writes one from scratch.
- **No jargon in the UI.** Never surface "phone_number_id" or "template
  category" to a client.

## 5. What nobody in this market does — Fluid's moat

Every platform above optimizes brand→consumer. **None of them model a
salesforce.** Specifically missing across Layers 2–4:

1. **Rep attribution** — binding a conversation and its orders to the rep who
   sourced it (our `shareGuid` deep link + session binding).
2. **Compensation-plan integration** — orders landing in the company's
   commerce platform so commissions, ranks, and volume actually fire
   (`FluidService`).
3. **Automatic mobile-money reconciliation** — STK push tied to an order
   record, settled by callback, no human matching payments.
4. **Multi-tenant per-company provisioning** from one platform account
   (`whatsapp_configs` + Tech Provider embedded signup).
5. **Downline-aware governance** — approved templates and compliant copy
   pushed to thousands of reps, replacing the ungoverned Kyte/WordPress
   shadow storefronts documented in the teardown.
6. **Compliance guardrails for direct selling** — blocking health and income
   claims at the template level. This is an MLM-specific requirement no
   generic tool addresses, and a genuine risk-reduction sale to corporate.

Positioning: *Kyte sells a rep a storefront. Zoko sells a brand a chat
channel. Fluid sells a direct-selling company an attributed commerce channel
its whole field force can run.*

## 6. Capability checklist — where our build stands

| Capability | Best-in-class | Fluid today | Priority |
|---|---|---|---|
| Native catalog + cart in chat | Table stakes | ✅ built | — |
| No-redirect payment | JioMart, Flows+PSP | ✅ M-Pesa STK | — |
| Order → commerce platform | Yalo | ✅ FluidService | Confirm API shapes |
| Rep attribution | **nobody** | ✅ deep link + session | Extend to dashboards |
| Multi-tenant provisioning | BSP-grade | ✅ schema, manual | Embedded signup |
| Abandoned-cart recovery | 18–23% recovery | ❌ | **P1 — highest ROI gap** |
| Order-status / delivery updates | Table stakes | ❌ | P1 |
| Replenishment nudges | Yalo micro-segments | ❌ | P2 (28-day gel cycle) |
| Shared inbox / agent handoff | Wati, charles | ❌ | P2 |
| WhatsApp Flows (multi-screen) | charles, Haptik | ❌ | P2 (address capture) |
| Template manager | All Layer 3 | ❌ | P2 (needed for P1 flows) |
| Click-to-WhatsApp ads support | Layer 3 | Partial (referral parsing) | P3 |
| Analytics / attribution dashboard | All | ❌ | P2 (rep-facing) |
| Recommendations engine | Yalo | ❌ | P3 |

**Biggest single gap:** automated flows. Industry data says they generate
60–70% of WhatsApp revenue, and we have none. Cart recovery plus order-status
updates should jump ahead of most of the phase-2 list — and both require the
template manager, which makes it the real critical path.

## 7. Ten things to copy, in order

1. In-chat checkout with no redirect (done — protect it).
2. Abandoned-cart recovery, first message inside 30 minutes.
3. Order-status and delivery updates as approved templates.
4. Onboarding that never shows a client the Meta console.
5. Pre-built, pre-approved template library per vertical.
6. Sub-60-second automated first response, then human handoff.
7. Replenishment cadence per product (aloe gel ≈ 28 days).
8. Conversation-hook CTAs everywhere ("Chat to order"), not "Shop now".
9. Graceful out-of-market handling (the JioMart pincode trap).
10. Rep-facing analytics — because the rep is the daily user, and Yalo's
    lesson is that you win by making the network more effective, not just the
    brand.

## 8. Sources

- Yalo: [case study](https://medium.com/@chrishedge/conversational-workflow-builder-yalo-expands-into-native-commerce-to-help-cpgs-better-engage-49ecca1bee14) · [B Capital](https://b.capital/why-we-invested/why-we-invested-yalochat/) · [McKinsey — Grupo Mariposa](https://www.mckinsey.com/capabilities/tech-and-ai/how-we-help-clients/rewired-in-action/grupo-mariposa-harnessing-connected-technology-in-the-latam-food-and-beverage-market)
- Haptik: [JioMart case study](https://www.haptik.ai/resources/case-study/jio-mart) · [Meta announcement](https://about.fb.com/news/2022/08/shop-on-whatsapp-with-jiomart-in-india/)
- charles: [site](https://www.hello-charles.com/) · [G2 reviews](https://www.g2.com/products/charles/reviews)
- Gupshup: [conversational commerce](https://www.gupshup.io/en/customer-engagement/conversational-commerce)
- Take Blip: [SoftBank/Microsoft backing](https://techcrunch.com/2024/11/18/text-marketing-firm-blip-secures-backing-from-softbank-and-microsoft/)
- Zoko: [platform](https://www.zoko.io/post/conversational-commerce-platforms-benefits-leading-companies) · [review incl. criticism](https://respond.io/blog/zoko-review)
- Kyte: [digital catalog](https://www.kyteapp.com/engaging/digital-catalog) · [WhatsApp sales](https://www.kyteapp.com/selling/whatsapp-sales)
- Benchmarks: [Chatarmin cart recovery 18–23%](https://chatarmin.com/en/blog/how-to-recover-abandoned-carts-via-whatsapp) · [Flowcart checkout flows](https://www.flowcart.ai/blog/whatsapp-checkout-cart-flows) · [Kanal CTWA benchmarks](https://getkanal.com/blog/click-to-whatsapp-ads-benchmarks-2026) · [Kanal KPIs](https://getkanal.com/blog/whatsapp-marketing-roi-kpis-benchmarks) · [Kanal WhatsApp vs email](https://getkanal.com/blog/whatsapp-vs-email-abandoned-cart-recovery)
- Opt-in rules: [Meta — getting opt-in](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in) · [Blueticks opt-in practices](https://blueticks.co/blog/whatsapp-opt-in-best-practices)
- Flows governance: [8x8 best practices](https://developer.8x8.com/connect/docs/whatsapp/whatsapp-flows-best-practices/)

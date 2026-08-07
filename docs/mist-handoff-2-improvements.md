# Mist Handoff 2 of 2 — Localization Audit + Conversion Tweaks for FL Kenya

**Prerequisite:** Handoff 1 (fidelity pass) is complete, so the clone at
`https://forever-living-kenya.fluid.app/` faithfully mirrors
`https://foreverliving.com/ken/en-ke/home`.

**Goal:** audit how Forever Living localizes its country sites, then apply
**targeted, additive tweaks** to the Kenya page that raise conversion for the
Kenyan market.

## The governing constraint: tweak, don't rebuild

This is **not** a redesign. Keep Forever Living's brand, visual language,
page skeleton, and section order. Improvements must take one of two forms:

- **Type A — In-place edit** of an existing element (add a badge, add price
  to an existing card, change a CTA label, swap one image for a locally
  relevant one).
- **Type B — Additive band**: a new self-contained horizontal section
  inserted between existing sections, styled with the site's existing tokens.

**The model to follow is the creator-video social section already added to
the clone.** That is exactly the right pattern: a self-contained band that
adds local energy and proof without disturbing anything around it. Every
recommendation should be expressible as "insert a band here" or "edit this
element," never "restructure the page."

Anything that would require altering FL's global template, navigation, or
brand system goes in a separate **"Needs corporate approval"** list rather
than being built.

---

## Part 1 — Localization audit

### Objective

Answer with evidence:

1. Does FLP localize country sites at all, or ship one global template?
2. Which elements get localized, in which markets, and to what depth?
3. How localized is Kenya compared with a peer market that does it well?

### Business context you need

- FLP is a direct-selling/MLM company (aloe vera drinks, supplements, bee
  products, personal care) operating in 160+ countries.
- **Kenya**: established 2005; Nairobi office (Reinsurance Plaza, 4th Floor,
  Taifa Road, CBD) also serves as the East Africa hub for Ethiopia, Somalia,
  South Sudan, Rwanda, and Uganda.
- Kenya ordering today is **manual**: register as a Preferred Customer, then
  order by WhatsApp/phone message (name + national ID), paying by M-Pesa
  transfer or on pickup. There is **no integrated mobile-money checkout** on
  the official store.
- Reference price: Forever Aloe Vera Gel ≈ **KSh 3,291** officially, while
  third-party Jumia sellers list the same product at **KSh 2,280–3,999** —
  active gray-market price erosion and an authenticity problem.
- **Benchmark market = Canada**, not the USA: FLP is transitioning away from
  its sponsorship-based model in the U.S. (effective May 1, 2026), so Canada
  is the closest market whose homepage still does *both* jobs Kenya needs —
  retail conversion **and** FBO (Forever Business Owner) recruiting. Treat
  the **USA** site as the flagship/original template.
- **TikTok Shop does not exist in Kenya or anywhere in Africa**, so social
  traffic cannot convert in-app — it must land on web or WhatsApp. This is
  why the creator-video band matters and why it needs a clear next step.

### Pages to audit

Primary comparison:

- Kenya: https://foreverliving.com/ken/en-ke/home
- Canada (English): https://foreverliving.com/can/en-ca/home
- Canada (French): https://foreverliving.com/can/fr-ca/home
- USA (template baseline): https://foreverliving.com/usa/en-us/home

Pattern evidence (sample at least four):

- France: https://foreverliving.com/fra/fr-fr/home
- India: https://foreverliving.com/ind/en-us/welcome
- UK, South Africa, Nigeria, Japan, Mexico, Brazil — find exact locale paths
  via the site's country/region selector and record the pattern.

Supporting surfaces:

- Legacy shop per market: `https://shop.foreverliving.com/retail/entry/Shop.do?store=KEN`
  (swap KEN / CAN / USA) — capture currency, categories, checkout options.
- Kenya contact page vs the Canada equivalent.
- Whether any market has a modern self-service checkout vs the legacy store.

### What to record per page

URL locale pattern · languages offered and translation depth · hero
headline/subhead/image subject/CTA · secondary CTAs (shop, join, find a
distributor) · currency and whether prices appear on the homepage · featured
SKUs · payment methods surfaced anywhere · local trust signals (address,
phone, WhatsApp, delivery/pickup promises) · local social proof (faces,
testimonials, named FBOs, events) · recruiting prominence and income-claim
framing · market-specific legal/compliance terms · section order · page
weight and mobile rendering · whether the same image assets recur across
country sites (reverse-image or CDN-path comparison).

Also check **Kenya SEO/discovery**: search "Forever Living Kenya", "forever
aloe vera gel price Kenya", "how to join Forever Living Kenya" — record
whether corporate or third-party/distributor sites rank. Note `hreflang`
implementation across locales.

### Hypotheses to verify or falsify

These come from indexed metadata and secondary sources, **not** from viewing
the live pages (the analyst's environment could not reach them). Confirm each
with a screenshot or quote, and state plainly when one is wrong — a wrong
premise changes the recommendations.

- **H1 — One global template, tiered localization.** All markets share the
  same platform, structure, and "The Aloe Vera Company" identity at
  `foreverliving.com/{country}/{locale}/home`. Kenya's page title renders as
  "The Aloe Vera Company (Kenya)", Canada's as "The Aloe Vera Company (CA)".
- **H2 — Localization tiers exist.** Tier 1 (mature markets) get real
  language localization: Canada has both `en-ca` and `fr-ca`; France has
  `fr-fr`. Tier 2 (emerging markets) get the English template plus a currency
  swap — India's locale path is literally `ind/en-us`, the strongest single
  piece of evidence if confirmed.
- **H3 — What IS localized:** language (Tier 1 only), currency and product
  catalog in the shop layer, local contact details, and legally required
  business terms (e.g. the UK's £200 first-week FBO purchase cap).
- **H4 — What is NOT localized:** imagery (global campaign assets reused
  everywhere), core messaging and taglines, page structure, payment UX, and
  local social proof.
- **H5 — Kenya is Tier 2.** English only (no Swahili), KSh pricing confined
  to the legacy shop, a local contact page — and no local imagery, no M-Pesa
  presence on site, no Kenyan testimonials, no locally framed FBO pitch.
- **H6 — The conversion gap is payment and trust, not traffic.** The site
  never surfaces the payment rail (M-Pesa) or the channel (WhatsApp) Kenyan
  buyers actually use, while marketplace resellers offer mobile money and
  cash on delivery.

---

## Part 2 — Tweaks to build on the clone

Implement in this order. Each item states type, placement, and how to measure
it. Ship Type A edits and cheap bands first.

### Priority 1 — Surface the payment rail and channel (Type A, hero)

Add to the hero, without changing the hero image or headline: a **"Lipa na
M-Pesa"** badge and an **"Order on WhatsApp"** secondary button (a `wa.me`
deep link). Kenyans convert where their money already lives; today the site
hides its only local payment path behind a contact page.
*Measure:* clicks on the WhatsApp CTA; assisted orders attributed to it.

### Priority 2 — Show KSh prices on the homepage (Type A, product cards)

Put real prices on existing product cards ("Forever Aloe Vera Gel —
KSh 3,291"). This anchors legitimacy against the KSh 2,280–3,999 Jumia
spread and pre-qualifies clicks before the clunky legacy store.
*Measure:* product card CTR; bounce rate on the shop handoff.

### Priority 3 — Replace the "Aloe as Nature Intended" graphic

**Why it must change:** it is a decorative watercolor aloe with bold black
text set *on top of* the leaves — the type collides with the illustration and
hurts legibility. It carries no proof, no price, and no call to action, and it
consumes prime vertical space that pushes real content below the fold. It is
the single lowest-yield block on the page.

Replace it with one of the following, keeping the same slot and roughly the
same height. **Recommended: Option A**, because it converts *and* answers the
question every first-time Kenyan buyer actually has.

- **Option A (recommended) — "How to order in 3 steps" strip.** Three
  numbered icon-and-label steps: *1. Message us on WhatsApp → 2. Pay with
  M-Pesa → 3. Collect in Nairobi CBD or get countrywide delivery.* Turns dead
  decoration into the conversion path. Ends with the WhatsApp CTA.
- **Option B — Authenticity / anti-counterfeit band.** "Buy genuine Forever."
  Short proof points: 99.7% pure inner-leaf aloe, IASC-certified for purity
  and potency, sold only through registered FBOs and the Nairobi office, with
  a "verify your FBO" link. Directly attacks the gray-market problem.
- **Option C — Shoppable product spotlight.** The real Aloe Vera Gel bottle
  photograph, one-line benefit, KSh 3,291, and an order button. Converts the
  slot from illustration into a merchandising unit.
- **Option D — Kenyan proof band.** Two or three photo testimonials with
  first names and counties. Highest trust lift; requires sourcing real
  content and permission.

Whichever is chosen: keep the aloe-provenance *story* if it is on-brand, but
express it as legible proof points beside an image, never as text overlapping
an illustration. Never place body copy on top of a busy graphic.

### Priority 4 — Extend the creator-video social band (Type B, already added)

The band exists; make it earn its place. Each video tile needs **a next
step** — because TikTok Shop is unavailable in the region, the video itself
cannot convert. Add per-tile "Shop this product" or "Order on WhatsApp"
links, show the creator's handle for credibility, prefer Kenyan creators, and
lazy-load posters (see Priority 8). Consider a "Featured FBO of the month"
tile to double as recruiting.
*Measure:* video engagement → outbound click rate to shop/WhatsApp.

### Priority 5 — Localize the imagery (Type A)

Swap two images — ideally the hero and one section image — for photography of
Kenyan FBOs and customers. Global stock imagery reads as "not really here" and
undermines a trust purchase. If new photography is not available, source from
the local office's event and social archives with permission.
*Measure:* scroll depth past the hero; hero CTA CTR.

### Priority 6 — Make the FBO opportunity locally concrete (Type A/B)

Canada keeps a visible recruiting CTA; Kenya should lead with it. Frame it
locally: side-hustle language, earnings and thresholds expressed in KSh,
"free to register," and rep-attributed join links so the FBO who drove the
visit gets credit.
*Measure:* join-page starts and completions; share of signups carrying a rep
attribution.

### Priority 7 — Trust anchors in header and footer (Type A)

Add the Nairobi office address, the WhatsApp order number, and a
"collect in Nairobi CBD or countrywide delivery" line. Counters both
online-fraud wariness and counterfeit fear, and costs nothing but content.

### Priority 8 — Mobile weight and speed (technical)

Kenyan traffic is overwhelmingly mobile on metered data bundles. Compress
hero media, serve WebP/AVIF with correct `srcset`, lazy-load below-fold
imagery and video posters, and remove autoplay media. Target LCP under 2.5s
on a throttled 4G mid-range Android.
*Measure:* PageSpeed/Core Web Vitals before vs after; mobile bounce rate.

### Priority 9 — A Swahili gesture now, a `sw-ke` locale later (Type A)

A greeting such as "Karibu" and a few Swahili accents in headings cost
nothing and signal presence. A full `sw-ke` locale is a corporate ask — note
that Canada's dual `en-ca`/`fr-ca` setup proves the platform already supports
it.

### Priority 10 — SEO defense (technical/content)

Distributor micro-sites and review blogs currently outrank corporate for
"Forever Living Kenya" queries. Add localized homepage copy targeting
product-plus-KSh queries, plus Product and FAQ structured data, and correct
`hreflang`.
*Measure:* rankings for the three query sets above; organic entry sessions.

---

## Part 3 — Deliverable

One document containing:

1. **Executive summary** (≤200 words): FLP's localization strategy, Kenya's
   tier, and the top three fixes.
2. **Localization matrix**: markets × recorded fields.
3. **Hypothesis findings**: H1–H6 each marked confirmed / partly confirmed /
   falsified, with screenshot or quote evidence.
4. **Kenya vs Canada gap analysis**: element by element, each gap paired with
   its conversion consequence.
5. **Implemented tweaks**: what was changed on the clone, before/after
   screenshots at 390 / 768 / 1440, and which Type (A or B) each was.
6. **"Needs corporate approval" list**: anything requiring changes to FL's
   global template, brand system, navigation, or a new locale.
7. **Test plan**: 3–5 A/B or before/after tests with the primary metric for
   each, in priority order.
8. **Appendix**: URLs, capture dates, screenshots.

Write for a CMO audience: plain language, tables over prose, no jargon
without a definition. Every factual claim carries a source link or screenshot
reference.

## Constraints

- Cite or screenshot everything; separate observed fact from inference, and
  say when something could not be verified.
- Note capture dates — these pages change.
- **Preserve the brand.** Use FL's existing colors, type, and components. New
  bands must look native to the page, not bolted on.
- **Additive only.** Do not remove or reorder FL's existing sections; the one
  intended removal is the "Aloe as Nature Intended" graphic, which is
  *replaced* in its own slot.
- Test mobile explicitly (mid-range Android, throttled connection).
- No health claims and no income claims. Wellness copy must stay compliant,
  and FBO earnings framing must carry appropriate disclaimers.
- Use only imagery we have rights to; get permission for creator videos and
  customer testimonials before publishing.
- Keep the clone `noindex,nofollow` and do not present it as Forever Living's
  official site.
- Recommendations must be implementable by a marketing team on the existing
  platform; flag anything else rather than building it.

## Definition of done

- H1–H6 each explicitly ruled in or out with evidence.
- Priorities 1–3 implemented on the clone (payment/channel surfacing, KSh
  prices, aloe graphic replaced) with before/after screenshots.
- Every implemented tweak is Type A or Type B — no structural redesign.
- Each recommendation carries a measurement plan.
- A reader who has never seen the sites can explain FLP's localization
  strategy and what Kenya should change first.

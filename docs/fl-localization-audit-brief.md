# Handoff Brief — Forever Living Website Localization Audit

> Self-contained brief for an agent with live web-browsing/screenshot access.
> Written because `foreverliving.com` is egress-blocked in the environment
> where the hypotheses below were formed — they are **unverified** and must be
> confirmed or corrected against the live pages.

---

## 1. Role and objective

Act as an **ecommerce conversion (CRO) expert and CMO**.

Audit how Forever Living Products (FLP) localizes its country websites, then
deliver prioritized, implementable recommendations to make the **Kenya**
homepage more locally relevant and higher-converting.

Answer three questions with evidence:

1. **Does FLP localize country sites at all**, or ship one global template?
2. **Which elements get localized**, in which markets, and to what depth?
3. **How localized is Kenya** compared with a peer market that does it well?

## 2. Business context you need

- FLP is a direct-selling/MLM company (aloe vera drinks, supplements, bee
  products, personal care) operating in 160+ countries.
- **Kenya**: established 2005; Nairobi office (Reinsurance Plaza, 4th Floor,
  Taifa Road, CBD) also serves as the East Africa hub for Ethiopia, Somalia,
  South Sudan, Rwanda, Uganda.
- Kenya ordering today is **manual**: customers register as Preferred
  Customers, then order by WhatsApp/phone message (name + national ID),
  paying by M-Pesa transfer or on pickup. There is **no integrated
  mobile-money checkout** on the official store.
- Reference price: Forever Aloe Vera Gel ≈ **KSh 3,291** officially, while
  third-party Jumia sellers list the same product at **KSh 2,280–3,999** —
  active gray-market price erosion.
- **Benchmark market = Canada**, not the USA: FLP is transitioning away from
  its sponsorship-based model in the U.S. (effective May 1, 2026), so Canada
  is the closest market that still needs a homepage doing *both* jobs Kenya
  needs — retail conversion **and** FBO (Forever Business Owner) recruiting.
  Treat the **USA** site as the flagship/original template for comparison.
- TikTok Shop does not exist in Kenya or anywhere in Africa, so social
  traffic must convert via web or WhatsApp.

## 3. Pages to audit

Primary comparison:

- Kenya (English): https://foreverliving.com/ken/en-ke/home
- Canada (English): https://foreverliving.com/can/en-ca/home
- Canada (French): https://foreverliving.com/can/fr-ca/home
- USA (template baseline): https://foreverliving.com/usa/en-us/home

Pattern evidence from other markets (sample at least four):

- France: https://foreverliving.com/fra/fr-fr/home
- India: https://foreverliving.com/ind/en-us/welcome
- UK, South Africa, Nigeria, Japan, Mexico, Brazil — discover exact locale
  paths from the site's country/region selector and record the pattern.

Supporting surfaces:

- Legacy shop per market: `https://shop.foreverliving.com/retail/entry/Shop.do?store=KEN`
  (swap KEN / CAN / USA) — capture currency, categories, checkout options.
- Kenya contact page and the equivalent Canada page.
- Note whether any market offers a modern self-service checkout vs the legacy
  storefront.

## 4. Method

For **each** page: capture a full-page screenshot and record the fields
below. Build a comparison matrix with markets as columns.

Fields to record per page:

- **URL locale pattern** (country code + language code; note anomalies such
  as a non-native language code)
- **Language(s) available** and whether translation is full or partial
- **Hero**: headline, subhead, image subject (are the people/setting
  regionally plausible?), primary CTA label and destination
- **Secondary CTAs**: shop, join/become an FBO, find a distributor, contact
- **Currency and prices**: shown on homepage? which currency? formatting?
- **Featured products**: which SKUs, and do they differ by market?
- **Payment methods surfaced** anywhere on the page or checkout (cards,
  mobile money, cash on delivery, bank transfer)
- **Local trust signals**: office address, phone, WhatsApp number, local
  certifications, delivery/pickup promises
- **Local social proof**: testimonials, faces, named FBOs, events, awards
- **Recruiting prominence**: how visible is the FBO/business opportunity, and
  how is income framed (compliance language?)
- **Compliance/legal variations**: market-specific terms (e.g. purchase caps,
  income-claim disclaimers, cooling-off periods)
- **Page section order** — is the skeleton identical across markets?
- **Technical**: page weight, largest assets, mobile rendering, autoplay
  media, Core Web Vitals if measurable (PageSpeed Insights is fine)
- **Imagery provenance**: do the same image assets appear across multiple
  country sites? (reverse-image or filename/CDN-path comparison)

Also assess **SEO/discovery for Kenya**: search "Forever Living Kenya",
"forever aloe vera gel price Kenya", "how to join Forever Living Kenya" and
record whether the corporate site or third-party/distributor sites rank.
Note `hreflang` implementation across locales.

## 5. Working hypotheses to verify or falsify

These came from indexed metadata and secondary sources, **not** from viewing
the live pages. Confirm each with a screenshot or quote, and say plainly when
one is wrong.

- **H1 — One global template, tiered localization.** All markets share the
  same platform, structure, and "The Aloe Vera Company" identity at
  `foreverliving.com/{country}/{locale}/home`. Evidence: Kenya's page title
  renders as "The Aloe Vera Company (Kenya)", Canada's as "The Aloe Vera
  Company (CA)".
- **H2 — Localization tiers exist.** Tier 1 (mature markets) get real
  language localization — Canada has both `en-ca` and `fr-ca`, France has
  `fr-fr`. Tier 2 (emerging markets) get the English template plus a
  currency swap; India's locale path is literally `ind/en-us`, which would be
  the strongest single piece of evidence for this tier if confirmed.
- **H3 — What is localized:** language (Tier 1 only), currency and product
  catalog in the shop layer, local contact details, and legally required
  business terms (e.g. the UK's £200 first-week FBO purchase cap).
- **H4 — What is NOT localized:** imagery (global campaign assets reused
  everywhere), core messaging and taglines, page structure, payment UX, and
  local social proof.
- **H5 — Kenya is Tier 2.** English only (no Swahili), KSh pricing confined
  to the legacy shop, a local contact page — and no local imagery, no M-Pesa
  presence on site, no Kenyan testimonials, no locally framed FBO pitch.
- **H6 — The conversion gap is payment and trust**, not traffic: the site
  never surfaces the payment rail (M-Pesa) or the channel (WhatsApp) that
  Kenyan buyers actually use, while marketplace resellers offer mobile money
  and cash on delivery.

If any hypothesis fails, report the correction prominently — a wrong premise
changes the recommendations.

## 6. Deliverable

Produce a single document with these sections:

1. **Executive summary** (≤200 words): FLP's localization strategy in one
   paragraph, Kenya's tier, and the top three fixes.
2. **Localization matrix**: the comparison table across markets and fields
   from §4.
3. **Findings**: per-hypothesis verdict (confirmed / partly confirmed /
   falsified) with screenshot or quote evidence.
4. **Kenya vs Canada gap analysis**: side-by-side, element by element, with
   the conversion consequence of each gap named.
5. **Prioritized recommendations**: ranked by expected impact ÷ effort. For
   each — what to change, why it converts in this market, effort (content
   edit / design / platform), owner, and how to measure it. Separate
   "content-only, ship this week" from "needs platform work".
6. **Suggested test plan**: 3–5 A/B or before/after tests with the primary
   metric for each.
7. **Appendix**: screenshots, URLs, and dates captured.

Format for a CMO audience: plain language, tables over prose, no jargon
without a definition. Every factual claim carries a source link or a
screenshot reference.

## 7. Constraints

- **Cite or screenshot everything.** Distinguish observed facts from
  inference, and say so when something could not be verified.
- **Note the capture date** — these pages change.
- Check **mobile rendering explicitly** (emulate a mid-range Android on a
  throttled connection). Kenyan traffic is overwhelmingly mobile on metered
  data.
- Respect robots.txt and rate limits; normal browsing only, no bulk scraping.
- Do not evaluate the MLM business model itself — the scope is website
  localization and conversion.
- Recommendations must be implementable by a marketing team on FLP's existing
  platform. Flag anything requiring corporate/global approval, since country
  sites appear to be centrally controlled.

## 8. Definition of done

- All four primary pages plus ≥4 pattern markets captured and matrixed.
- Every hypothesis in §5 explicitly ruled in or out with evidence.
- Recommendations ranked, each with a measurement plan.
- A reader who has never seen the sites can explain FLP's localization
  strategy and what Kenya should change first.

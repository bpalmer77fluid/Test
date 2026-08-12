# Mist Handoff 1 of 2 — Make the Fluid Clone Match the Live FL Kenya Site

**Goal:** bring `https://forever-living-kenya.fluid.app/` (our scraped clone)
to visual and structural parity with the live
`https://foreverliving.com/ken/en-ke/home`, so that any later improvement is
measured against a faithful baseline.

**Do not do improvements in this pass.** Improvements are Handoff 2. This
pass is fidelity only.

**Critical rule — preserve intentional additions.** The clone already
contains deliberate additions that do **not** exist on the live site (for
example a social media section showing creator videos). **Do not delete
them.** Inventory them in an "Intentional Divergence" list and leave them in
place. Only unintentional drift gets corrected.

---

## Phase 0 — Set up the comparison

1. Open both URLs logged out, in a clean profile, cache disabled.
2. Capture full-page screenshots of each at three viewports:
   - Mobile 390×844 (primary — most Kenyan traffic)
   - Tablet 768×1024
   - Desktop 1440×900
3. Save the live site's rendered DOM (`document.documentElement.outerHTML`)
   and the clone's, to a file each. These are your diff sources.
4. Record the **capture date and time** — the live site can change under you.
5. If the live site geo-redirects or shows a country/consent interstitial,
   note it and capture the post-interstitial state.

## Phase 1 — Build the fidelity inventory

Produce one table. Rows = every discrete element, top to bottom. Columns =
`Live` / `Clone` / `Status` (Match / Drift / Missing / Extra-Intentional /
Extra-Unintentional) / `Fix action`.

Walk these in order and log every row:

**Global chrome**
- Announcement/promo bar (text, link, dismissible?)
- Logo (exact asset, dimensions, link target)
- Nav items in exact order and exact labels; dropdown/mega-menu contents
- Utility nav: search, account/login, cart, country/language selector
- Sticky behavior on scroll
- Footer: every column, every link label and href, social icons, legal
  links, copyright line, payment/certification badges

**Hero**
- Background image or video (exact asset, focal point, overlay opacity)
- Headline, subhead, eyebrow text — quote character-for-character
- Primary CTA label + href; secondary CTA label + href
- Height at each viewport; text alignment

**Every body section, in order**
- Section type (product grid, banner, editorial, testimonial, video, etc.)
- Heading and body copy — exact text
- Images (asset, aspect ratio, alt text)
- Product cards: product name, image, price, currency formatting, badge,
  CTA label, link target
- Any carousel: slide count, slide order, autoplay, timing, controls

**Design tokens**
- Colors: sample the actual hex values for background, text, primary
  button, link, borders. Do not eyeball — use devtools.
- Typography: font families (and whether webfonts actually load in the
  clone), weights, sizes, line-heights, letter-spacing for h1/h2/h3/body/
  button/caption
- Spacing rhythm: section padding, grid gutters, container max-width
- Button and card styles: radius, border, shadow, hover state

**Meta and technical**
- `<title>`, meta description, canonical, OG/Twitter tags, favicon
- `hreflang` tags present on live? replicate the pattern
- Structured data (JSON-LD) blocks
- Analytics/tag scripts on live (note them; do NOT copy tracking IDs into
  the clone — use our own or none)

## Phase 2 — Fix in dependency order

Work top-down in this order; each layer depends on the one before it.

**Step 1 — Structure and section order.** Make the clone's section sequence
and section count identical to live (plus intentional additions, which stay
where they are). Fix missing or reordered sections first — everything else
is cosmetic until the skeleton is right.

**Step 2 — Navigation and information architecture.** Restore exact nav
labels, order, and dropdown contents. Every nav item must point somewhere
sensible: match live's destination, or map to our clone's equivalent route.
Log any nav item we intentionally cannot support.

**Step 3 — Copy.** Replace all placeholder, truncated, or paraphrased text
with the live site's exact wording, including microcopy (button labels, form
labels, disclaimers, "learn more" links). Preserve live's capitalization and
punctuation. Flag — do not silently keep — any lorem ipsum or template
filler.

**Step 4 — Assets.** For each image: source the correct asset at the correct
resolution (prefer re-hosting the same visual on our own CDN over
hotlinking). Fix broken/placeholder images, wrong aspect ratios, and missing
alt text. Confirm the logo and favicon are correct, and that retina (2x)
variants exist where live has them.

**Step 5 — Design tokens.** Apply the sampled colors, fonts, sizes, and
spacing. Common failure: the scrape lost the webfont, so the clone renders in
a fallback and everything looks subtly wrong — check computed font-family, not
the stylesheet.

**Step 6 — Interactions.** Restore carousels, accordions, dropdowns, hover
states, scroll behaviors, and any modal. Match timing and direction, not just
presence.

**Step 7 — Responsive parity.** Compare at all three viewports. Fix
breakpoint mismatches, overflowing text, images that don't reflow, tap
targets under 44px, and any horizontal scroll on mobile.

**Step 8 — Links and routing.** Click or programmatically resolve **every**
link. Zero 404s, zero `href="#"`, zero links leaking to the live domain
unless intentional. Build a link table: label → clone href → status code.

**Step 9 — Meta and SEO parity.** Set title, description, OG tags, favicon,
and any JSON-LD to mirror live's pattern.

## Phase 3 — Known scrape-artifact checklist

Scraped clones fail in predictable ways. Explicitly verify each:

- [ ] Webfonts not loading → fallback typeface
- [ ] Images with absolute paths to the origin domain (hotlinked or broken)
- [ ] CSS background-images lost entirely
- [ ] Icon fonts / inline SVG sprites missing → invisible or box glyphs
- [ ] JavaScript-rendered sections absent (scraper captured pre-hydration)
- [ ] Carousels frozen on slide 1
- [ ] Forms present but with no action / non-functional
- [ ] Currency or price formatting wrong or hardcoded to another market
- [ ] Product data stale, mispriced, or partially populated
- [ ] Cookie/consent banner and privacy/terms links missing
- [ ] Duplicate or orphaned sections from a partial re-scrape
- [ ] Mixed content (http assets on an https page)
- [ ] `noindex` missing — a public clone of a real brand's site should be
      `noindex,nofollow` unless there is an explicit decision otherwise
- [ ] Live analytics/pixel IDs accidentally carried over

## Phase 4 — Acceptance criteria

The pass is done when all of the following are true:

1. Side-by-side full-page screenshots at 390 / 768 / 1440 show no
   *unintended* differences in section order, content, or styling.
2. Every text string in the clone matches live, or is on the Intentional
   Divergence list.
3. Every image renders (no broken/placeholder assets) at the right aspect
   ratio.
4. Computed font-family, primary color, and button style match live exactly.
5. Zero dead links; link table attached.
6. No horizontal scroll and no clipped content at 390px.
7. Intentional additions (e.g. the creator-video social section) are intact
   and documented.
8. Clone is `noindex,nofollow` and carries no live tracking IDs.

## Phase 5 — Deliverable

Produce a **Fidelity Report** containing:

1. **Summary**: how close the clone was, and the count of drift items fixed
   by category.
2. **Inventory table** from Phase 1 with final statuses.
3. **Before/after screenshots** at all three viewports.
4. **Intentional Divergence list** — every deliberate difference, with a
   one-line reason, so the next pass knows what is on purpose.
5. **Unresolvable gaps** — anything on live we cannot replicate (gated
   content, third-party widgets, licensed assets) with the reason.
6. **Link table** and **capture date**.
7. **Changelog** of files/components edited.

## Constraints

- Replicating a competitor's/client's page layout for internal prototyping is
  fine; do not present the clone publicly as Forever Living's own site. Keep
  it `noindex`, and keep any "demo/prototype" labeling that already exists.
- Do not copy live analytics IDs, tracking pixels, or third-party keys.
- Prefer re-hosting assets over hotlinking the origin.
- Respect robots.txt and normal request rates; this is manual-scale browsing,
  not bulk scraping.
- Note capture dates on every screenshot; the live site changes.

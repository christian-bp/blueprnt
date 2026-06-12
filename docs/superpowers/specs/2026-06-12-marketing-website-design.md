# Marketing website (apps/web): port and elevate the Lovable variant

Date: 2026-06-12
Status: approved (design), pending implementation

## Goal

Ship blueprnt's marketing site in `apps/web`: the Lovable variant the team
likes (at `/Users/ce/Downloads/Remix of Blueprnt`) ported into the monorepo
and elevated with the design-taste skill, in all five locales, with
wint.se-inspired tone for the new "Så funkar det" page.

## Decisions (settled with Christian)

1. **Pages (option B):** landing, "Så funkar det" (new, does not exist in
   the variant), and "Om oss". Contact is a CTA section on the landing, not
   a page.
2. **CTA (option A):** mailto only. The contact section shows the address
   (placeholder `hej@blueprnt.se`, lives in i18n messages so Christian can
   change it) and the primary CTA opens mail. No forms, no booking.
3. **Visual fidelity (option B): base + elevation.** The identity is LOCKED
   from the variant: brand rose (#f43f5e), pop emerald (#34d399), surface
   zinc-50, hairline, ink, Space Grotesk display + Plus Jakarta Sans body,
   the glow-blob hero with the isometric architecture illustration, the
   numbered three-step framework cards, the tone of the existing Swedish
   copy. The taste skill has the mandate to sharpen rhythm, spacing, mobile
   behavior, and microcopy WITHIN that identity, never to reinterpret it.
4. **Language behavior: browser-driven, URLs localized.** The existing
   next-intl middleware in `apps/web/proxy.ts` already detects
   Accept-Language on first visit and redirects to the locale (cookie
   remembers for a year). `routing.ts` stays UNTOUCHED (en default,
   `as-needed` prefix): Swedes auto-land on `/sv`, every locale has
   indexable URLs with hreflang, and the dashboard is unaffected.
5. **packages/ui + a theme layer in apps/web.** The web app's `globals.css`
   maps the shared shadcn CSS variables (`--primary`, `--background`,
   `--border`, ...) to the marketing palette and adds marketing-only tokens
   (`--brand`, `--pop`, `--surface`, `--hairline`, `--ink`,
   `--font-display`). packages/ui components (Button, Accordion,
   NavigationMenu, DropdownMenu) then render in the marketing identity with
   no per-call-site overrides. Marketing-specific layouts (hero, step
   cards, CTA band) are bespoke section components in
   `apps/web/components/`.
6. **Localized pathnames** via next-intl `pathnames` config:
   `/sa-funkar-det` (sv) ↔ `/how-it-works` (en) ↔ `/slik-fungerer-det` (nb)
   ↔ `/sadan-fungerer-det` (da) ↔ `/nain-se-toimii` (fi), and `/om-oss` ↔
   `/about` ↔ `/om-oss` ↔ `/om-os` ↔ `/meista`.

## Source material

- The variant: `/Users/ce/Downloads/Remix of Blueprnt` (TanStack
  Start/Lovable export). `src/routes/index.tsx` (landing: hero, framework
  three-step cards, model USP, compliance band, approach, contact CTA),
  `src/routes/about.tsx`, `src/components/Header.tsx`, `src/styles.css`
  (tokens), `src/assets/hero-architecture.png` (copy into
  `apps/web/public/` or imported asset). Its Swedish copy is CANONICAL: it
  ships as the sv strings; en is translated carefully from it; nb/da/fi are
  machine drafts flagged for native review.
- wint.se (tone reference for "Så funkar det"): friendly, punchy,
  entrepreneur-direct Swedish; the "så funkar det" page pattern.

## Pages

### Landing (`[locale]/page.tsx`)

The variant's six sections, each its own component in
`apps/web/components/`:
1. `hero.tsx`: badge pill, display headline with gradient word, lede, two
   CTAs (mailto primary, #framework secondary), isometric illustration with
   radial mask, glow blobs.
2. `framework-steps.tsx`: section heading + the three numbered cards
   (Riktade Faktorer / Guidad Viktning / Automagisk Struktur) with
   per-card tone colors (rose/emerald/amber), `[01] OBJEKTIVITET` mono
   accent.
3. `model-usp.tsx`: the configurable-factor-model section from the variant.
4. `compliance-band.tsx`: the Swedish pay-equity / EU directive band.
5. `approach.tsx`: the approach section from the variant.
6. `contact-cta.tsx`: full-width CTA with the mailto.

### Så funkar det (`[locale]/sa-funkar-det/page.tsx`, localized slugs)

New page, wint-tone, steps mirroring the REAL product flow (this is also
the page's honesty constraint: nothing described that the product does not
do): 1) Onboarda på minuter (branschmall eller egen modell), 2) Anpassa
modellen (kriterier, bedömningsankare, viktpoäng med fast poängbudget),
3) Betygsätt rollerna blint (ett kriterium i taget, ankartexterna som
val), 4) Band och resultat räknas fram automatiskt (aldrig manuellt satta),
5) Kalibrera med ankarroller. Ends with the contact CTA section reused.
Swedish copy drafted at implementation, flagged for Christian's review in
the landing summary.

### Om oss (`[locale]/om-oss/page.tsx`, localized slugs)

The variant's about page ported.

## Shared chrome

- `header.tsx`: logo (text wordmark), nav (Så funkar det, Om oss),
  language switcher (DropdownMenu with the five locales, switching
  preserves the current page via next-intl navigation), "Logga in" link to
  the dashboard URL (i18n key + env-configurable href,
  `NEXT_PUBLIC_APP_URL` fallback `https://app.blueprnt.se`), primary CTA
  button (mailto).
- `footer.tsx`: wordmark, mailto, nav links, language switcher reuse,
  copyright. No legal pages in v1 (no cookies beyond the locale cookie).

## i18n

All strings under `web.*` in the five message files (en first for the type
base, Swedish canonical content-wise). Namespaces: `web.nav`, `web.hero`,
`web.framework`, `web.model`, `web.compliance`, `web.approach`,
`web.contact`, `web.how` (so-funkar-det), `web.about`, `web.footer`,
`web.meta` (per-page titles/descriptions). The existing parity test guards
all five files.

## SEO

- `generateMetadata` per page per locale (title/description from
  `web.meta.*`; the variant's meta is the sv source).
- hreflang alternates via next-intl's metadata helpers.
- `app/sitemap.ts` covering all pages × locales (localized pathnames) and
  `app/robots.ts`.

## Theme layer (apps/web/app/globals.css + fonts)

- Map shared shadcn variables to the marketing palette (light mode only in
  v1; the variant is light-only): `--primary` = brand rose,
  `--background` white, `--muted`/`--secondary` from surface,
  `--border` hairline, `--ring` brand.
- Marketing tokens: `--brand`, `--brand-foreground`, `--pop`,
  `--pop-foreground`, `--surface`, `--hairline`, `--ink`,
  `--ink-foreground` (values from the variant's styles.css), exposed via
  `@theme inline` so `bg-brand`, `text-pop` etc. work.
- Fonts via `next/font`: Space Grotesk (`--font-display`) and Plus Jakarta
  Sans (`--font-sans`), applied on `<html>`; marketing only, the dashboard
  keeps its fonts.

## Testing

- Light render tests (Vitest + testing-library, same setup as dashboard):
  header (nav links with localized hrefs, login link, language switcher
  lists five locales), contact CTA (mailto href), landing page sections
  render their headings from messages. The i18n parity test covers the
  message files.
- `bun run build` for apps/web must pass (static generation across
  locales).

## Out of scope

Kundcase, FAQ, blog, pricing, contact forms, privacy-policy page (follow-up
when analytics/cookies arrive), dark mode for marketing, screenshots of
the product (the isometric illustration carries v1).

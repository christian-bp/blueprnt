# Marketing Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship blueprnt's marketing site in `apps/web`: the Lovable variant ported and taste-elevated, three pages, five locales, mailto CTA.

**Architecture:** apps/web keeps packages/ui components but gets its own theme layer (globals.css variable mapping + marketing tokens + Space Grotesk/Plus Jakarta fonts). Pages are server components under `app/[locale]/`; sections are bespoke components in `apps/web/components/`. Localized pathnames via the shared next-intl routing; browser-language detection already works via the existing proxy middleware.

**Tech Stack:** Next.js 16 app router, next-intl 4 (as-needed prefix + pathnames), Tailwind v4 tokens, packages/ui (shadcn), Vitest 4 + testing-library.

**Spec:** `docs/superpowers/specs/2026-06-12-marketing-website-design.md`
**Source variant:** `/Users/ce/Downloads/Remix of Blueprnt` (READ its files when porting: `src/routes/index.tsx`, `src/routes/about.tsx`, `src/components/Header.tsx`, `src/styles.css`, `src/assets/hero-architecture.png`). Its Swedish copy is canonical sv content.

**Taste mandate (applies to every UI task):** identity is LOCKED (rose brand, emerald pop, Space Grotesk display, glow-blob hero, numbered cards, the Swedish tone). Within it, elevate: consistent vertical rhythm (sections py-24/py-28, one scale), readable line lengths (max-w for ledes), mobile-first stacking that never crops the illustration awkwardly, hover states that don't shift layout (CLAUDE.md rule), focus-visible on all interactive elements. Never add: dark mode, new colors, new fonts, decorative animation beyond subtle transitions. Repo conventions bind: ALL text via i18n (`web.*`), `Link` from `@workspace/i18n/navigation` for internal nav (locale-aware), no em dashes, comments explain constraints.

**Conventions for every task:** work in `/Volumes/development/blueprnt/website` (branch feat/marketing-website); never push; `bun run test` (never `bun test`); `bunx biome check --write apps/web` before commits; the pre-commit hook runs Biome + typecheck + full tests and must pass.

---

### Task 1: Foundation — theme layer, fonts, assets, localized pathnames

**Files:**
- Create: `apps/web/app/globals.css`
- Modify: `apps/web/app/[locale]/layout.tsx`
- Create: `apps/web/public/hero-architecture.png` (copied from the variant)
- Modify: `packages/i18n/src/routing.ts` (pathnames)

- [ ] **Step 1: Copy the hero asset**

```bash
cp "/Users/ce/Downloads/Remix of Blueprnt/src/assets/hero-architecture.png" apps/web/public/hero-architecture.png
```

- [ ] **Step 2: Create the theme layer**

Create `apps/web/app/globals.css`:
```css
@import "@workspace/ui/globals.css";

/* Marketing theme layer: the shared shadcn variables remapped to the
   Lovable variant's palette, plus marketing-only tokens. packages/ui
   components pick these up with no per-call-site overrides. Light only. */
@theme inline {
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-pop: var(--pop);
  --color-pop-foreground: var(--pop-foreground);
  --color-surface: var(--surface);
  --color-hairline: var(--hairline);
  --color-ink: var(--ink);
  --color-ink-foreground: var(--ink-foreground);
  --font-display: var(--font-display-next), ui-sans-serif, system-ui, sans-serif;
}

:root {
  --radius: 1rem;

  --background: #ffffff;
  --foreground: #09090b;
  --ink: #09090b;
  --ink-foreground: #ffffff;
  --surface: #fafafa;
  --hairline: #e4e4e7;

  --brand: #f43f5e;
  --brand-foreground: #ffffff;
  --pop: #34d399;
  --pop-foreground: #052e1a;

  --card: #ffffff;
  --card-foreground: #09090b;
  --popover: #ffffff;
  --popover-foreground: #09090b;
  --primary: #09090b;
  --primary-foreground: #ffffff;
  --secondary: #fafafa;
  --secondary-foreground: #09090b;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --accent: #fff1f2;
  --accent-foreground: #f43f5e;
  --destructive: #f43f5e;
  --destructive-foreground: #ffffff;
  --border: #e4e4e7;
  --input: #e4e4e7;
  --ring: #f43f5e;
}
```
NOTE: read `packages/ui/src/styles/globals.css` first (the `@workspace/ui/globals.css` export) and adapt: if it defines its `@theme inline` off `:root` variables of the same names, the `:root` block above is enough and the duplicated mappings can shrink. Keep ONE source of truth; the goal is `bg-brand`, `text-pop`, `border-hairline`, `bg-surface`, `font-display` all usable in apps/web, and standard `bg-background`/`text-muted-foreground`/Button rendering with the marketing palette.

- [ ] **Step 3: Fonts + import the layer in the layout**

In `apps/web/app/[locale]/layout.tsx`: replace `Source_Sans_3` with `Plus_Jakarta_Sans` (variable `--font-sans`), add `Space_Grotesk` (variable `--font-display-next`), keep `Geist_Mono`; change the CSS import from `@workspace/ui/globals.css` to `../globals.css`; apply all three font variables on the `<html>` className. Delete the stale comment about radix-vega heading fonts.

- [ ] **Step 4: Localized pathnames**

In `packages/i18n/src/routing.ts`, add to `defineRouting({...})`:
```ts
  // Marketing pathnames: localized slugs per page (SEO). The dashboard
  // does not use URL locales, so this only affects apps/web.
  pathnames: {
    "/": "/",
    "/how-it-works": {
      en: "/how-it-works",
      sv: "/sa-funkar-det",
      nb: "/slik-fungerer-det",
      da: "/sadan-fungerer-det",
      fi: "/nain-se-toimii",
    },
    "/about": {
      en: "/about",
      sv: "/om-oss",
      nb: "/om-oss",
      da: "/om-os",
      fi: "/meista",
    },
  },
```
TypeScript note: `createNavigation(routing)` in `packages/i18n/src/navigation.ts` picks this up automatically; `Link href="/how-it-works"` becomes the locale slug.

- [ ] **Step 5: Verify**

Run from the worktree root: `bun run typecheck && cd apps/web && bun run build` (expect a successful static build; the existing placeholder page may warn about nothing). Then `cd .. && bun run test`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): marketing theme layer, fonts, hero asset, localized pathnames"
```

---

### Task 2: i18n content — the full web.* message tree in five locales

**Files:**
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (replace the existing `web` namespace)

- [ ] **Step 1: Extract the canonical Swedish copy from the variant**

READ `/Users/ce/Downloads/Remix of Blueprnt/src/routes/index.tsx`, `about.tsx`, and `src/components/Header.tsx` and lift EVERY user-facing string into the sv message tree below. The structure (en is the type base; fill sv with the variant's exact copy, translate en carefully FROM sv, then nb/da/fi as machine drafts):

```jsonc
"web": {
  "meta": {
    "landingTitle": "...", "landingDescription": "...",   // from the variant's head() meta (sv)
    "howTitle": "...", "howDescription": "...",            // new, see Task 5 copy
    "aboutTitle": "...", "aboutDescription": "..."
  },
  "nav": { "how": "Så funkar det", "about": "Om oss", "login": "Logga in", "cta": "Bygg ert ramverk" },
  "hero": { "badge": "...", "titleLead": "...", "titleAccent": "...", "lede": "...", "ctaPrimary": "...", "ctaSecondary": "...", "imageAlt": "..." },
  "framework": { "heading": "...", "lede": "...", "kicker": "[01] OBJEKTIVITET", "steps": { "factors": {"step": "01", "title": "...", "body": "..."}, "weighting": {...}, "structure": {...} } },
  "model": { ... every string in the model USP section ... },
  "compliance": { ... },
  "approach": { ... },
  "contact": { "heading": "...", "lede": "...", "cta": "...", "email": "hej@blueprnt.se" },
  "how": { ... Task 5's copy, keys defined there ... },
  "about": { ... every string from about.tsx ... },
  "footer": { "tagline": "...", "rights": "..." },
  "language": { "label": "Språk" }
}
```
Keys are illustrative of STRUCTURE; name leaf keys after content roles (title/body/cta), split multi-part headlines (gradient word separate: titleLead + titleAccent). The `how` namespace content comes from Task 5's copy block IN THIS PLAN (write it now so parity holds; Task 5 just consumes it). The existing `web` namespace in en.json (placeholder from app scaffolding) is REPLACED; grep apps/web for any old `web.` usage and update.

- [ ] **Step 2: Parity + types**

`cd packages/i18n && bun run test` (parity across five files) and `cd ../.. && bun run typecheck`.

- [ ] **Step 3: Commit**

```bash
git add packages/i18n apps/web && git commit -m "feat(web): marketing copy in all five locales (sv canonical)"
```

---

### Task 3: Chrome — header, footer, language switcher

**Files:**
- Create: `apps/web/components/site-header.tsx`, `apps/web/components/site-footer.tsx`, `apps/web/components/language-switcher.tsx`
- Modify: `apps/web/app/[locale]/layout.tsx` (render header/footer around children)
- Test: `apps/web/components/site-header.test.tsx`, `apps/web/components/language-switcher.test.tsx`
- Possibly create `apps/web/vitest.config.ts` + `apps/web/test-setup` mirroring apps/dashboard's (check `apps/dashboard/vitest.config.ts` and copy the react config pattern; every package with tests has its own config per CLAUDE.md). Add a `test` script to apps/web/package.json matching dashboard's.

Structure (port `Header.tsx` from the variant, elevate per the taste mandate):
- `site-header.tsx`: sticky header, wordmark "blueprnt" (font-display, Link to "/"), nav Links to "/how-it-works" and "/about" (via `@workspace/i18n/navigation` Link + `web.nav.*`), `LanguageSwitcher`, login link (`process.env.NEXT_PUBLIC_APP_URL ?? "https://app.blueprnt.se"`, plain `<a>` is correct here: EXTERNAL nav), CTA Button (packages/ui Button asChild → `<a href={"mailto:" + t("contact.email")}>`). Mobile: nav collapses to essentials (keep it simple: hide nav links under sm, keep CTA).
- `language-switcher.tsx`: packages/ui DropdownMenu; trigger shows the current locale's name; items = five locales with their native names (Svenska, English, Norsk, Dansk, Suomi as a LOCAL const, not i18n: each language in itself); selecting routes to the SAME pathname in the new locale via `useRouter`/`usePathname` from `@workspace/i18n/navigation` (`router.replace(pathname, {locale})`).
- `site-footer.tsx`: wordmark, mailto, the two nav links, `LanguageSwitcher`, `web.footer.rights` with year.

Tests (mirror dashboard's testing-library setup; NextIntlClientProvider with en messages):
```tsx
// site-header.test.tsx
it("renders localized nav links and the login url", ...)   // hrefs: /how-it-works, /about (en), login href = https://app.blueprnt.se
it("renders the mailto CTA", ...)                            // href starts with mailto:
// language-switcher.test.tsx
it("lists all five locales in the menu", ...)                // open via pointerDown+click (radix menu mounts in happy-dom; see criterion-item.test.tsx for the pattern)
it("switches locale preserving the path", ...)               // mock navigation hooks; assert replace called with {locale: "sv"}
```

Steps: write failing tests → verify fail → implement → pass → `bunx biome check --write apps/web` → commit `feat(web): site chrome with language switcher`.

---

### Task 4: Landing page — six sections ported and elevated

**Files:**
- Create: `apps/web/components/hero.tsx`, `framework-steps.tsx`, `model-usp.tsx`, `compliance-band.tsx`, `approach.tsx`, `contact-cta.tsx`
- Replace: `apps/web/app/[locale]/page.tsx`
- Test: `apps/web/components/landing-sections.test.tsx`

Port each section from `/Users/ce/Downloads/Remix of Blueprnt/src/routes/index.tsx` (READ IT in full). All strings from `web.*` messages (Task 2). The hero image via `next/image` (`/hero-architecture.png`, priority, alt from messages, keep the radial mask class). CTAs: primary = mailto from `web.contact.email`; secondary = `#framework` anchor. Sections are server components (no "use client" unless interaction exists; none does). `page.tsx` composes the six sections and exports `generateMetadata` reading `web.meta.landingTitle/Description` via `getTranslations`.

Test (render the page's sections with en messages; assert each section heading from messages is present, the contact CTA mailto href, and the hero image alt).

Steps: failing tests → implement (taste mandate!) → pass → Biome → typecheck → commit `feat(web): landing page`.

---

### Task 5: Så funkar det page

**Files:**
- Create: `apps/web/app/[locale]/how-it-works/page.tsx` (the DIRECTORY is the internal pathname `/how-it-works`; next-intl maps the localized slugs)
- Create: `apps/web/components/how-steps.tsx`
- Test: extend `apps/web/components/landing-sections.test.tsx` or new `how-steps.test.tsx`

Canonical Swedish copy (drafted for Christian's review; goes into `web.how` in Task 2):
- intro heading: "Så funkar Blueprnt" / lede: "Från noll till färdig jobbarkitektur i fem steg. Inga konsulttimmar, ingen Excel-akrobatik, bara en tydlig modell som hela organisationen kan lita på."
- steps (number, title, body):
  1. "Onboarda på minuter" / "Välj en branschmall eller börja från ett tomt ark. Rollfamiljer och roller sätts upp direkt i onboardingen, förifyllda för er bransch."
  2. "Anpassa modellen" / "Justera kriterier, bedömningsankare och viktpoäng tills modellen speglar vad ert bolag faktiskt värdesätter. Viktningen håller alltid en fast poängbudget, så helheten förblir balanserad."
  3. "Betygsätt blint" / "Roller betygsätts ett kriterium i taget mot tydliga ankartexter, utan att poäng eller band syns under tiden. Det håller bedömningen ärlig."
  4. "Band och resultat, automatiskt" / "Poäng räknas om till band direkt när något ändras. Inga manuella justeringar, ingen titelinflation, samma grund för alla roller."
  5. "Kalibrera med ankarroller" / "Utse ett par referensroller som hela organisationen är överens om och låt dem hålla modellen ärlig över tid."
- closing: reuse `contact-cta.tsx`.
- meta: howTitle "Så funkar det – Blueprnt", howDescription "Fem steg från noll till färdig jobbarkitektur: mall, modell, blind betygsättning, automatiska band och kalibrering med ankarroller."
HONESTY CONSTRAINT: every claim above maps to a shipped feature; do not add capabilities.

Layout: numbered vertical steps (mono step numbers in brand, generous py, alternating accent colors rose/emerald/amber like the landing cards), wint-like directness, ends with ContactCta. `generateMetadata` from `web.meta.how*`.

Steps: failing test (headings + 5 steps render) → implement → pass → Biome → commit `feat(web): how-it-works page`.

---

### Task 6: Om oss page + SEO files

**Files:**
- Create: `apps/web/app/[locale]/about/page.tsx` (port `about.tsx` from the variant; strings from `web.about`)
- Create: `apps/web/app/sitemap.ts` (all 3 pages × 5 locales with localized slugs via `getPathname` from `@workspace/i18n/navigation`; base URL from `NEXT_PUBLIC_SITE_URL ?? "https://blueprnt.se"`)
- Create: `apps/web/app/robots.ts` (allow all, point at the sitemap)
- Modify: each page already exports generateMetadata; verify hreflang alternates render (next-intl: set `alternates.languages` in generateMetadata via getPathname per locale, or use the canonical+languages pattern; implement it in a small shared helper `apps/web/lib/page-metadata.ts` used by all three pages)

Steps: implement → `cd apps/web && bun run build` (static output lists all locale routes) → spot-check `curl`-less by reading `.next/server/app` route list or build output → Biome → typecheck → full `bun run test` → commit `feat(web): about page and seo plumbing`.

---

### Task 7: Final review and landing

- [ ] Full-diff review vs the spec (dispatch a final reviewer: spec section by section against `git diff main...HEAD`), including the taste mandate (no new colors/fonts, i18n-only text, Link usage) and `bun run build` green for apps/web.
- [ ] Fix anything confirmed.
- [ ] Land per the worktree convention: squash-merge FROM THE MAIN CHECKOUT, containment check, remove worktree, delete branch. NO push. The squash body lists pages, locales, and flags nb/da/fi (and the new sv how-copy) for native/Christian review.

# blueprnt Email Template Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the three transactional email templates (`invitation`, `verifyEmail`, `resetPassword`) onto a polished, on-brand shared layout inspired by polyform's email system.

**Architecture:** Add a shared email design system to `packages/email` — a `theme.tsx` (color tokens, fonts, `EmailThemeProvider`, hosted-logo URL helper), a `BaseEmailTemplate` (wordmark header → title → content → footer), a `CtaButton`, and a `Footer` — then rebuild the three templates on top of it. Styling uses `@react-email/tailwind` (utility classes for layout/spacing, inline `style` for brand colors). The blueprnt wordmark is shipped as a hosted PNG on the dashboard origin. All copy flows through the existing `email.*` i18n keys in five locales.

**Tech Stack:** React Email (`@react-email/components` 1.0.12, `@react-email/render` 2.0.8, `react-email` 6.6.0 — all already installed), `@react-email/tailwind` (re-exported by `@react-email/components`; no new dependency), `next-intl`/`@workspace/i18n`, Vitest 4, `rsvg-convert` for the one-time SVG→PNG.

## Global Constraints

- **i18n, English-first:** every new string is added to `packages/i18n/messages/en.json` first (the `Messages`/`EmailMessages` type derives from `en`), then mirrored to `sv.json`, `nb.json`, `da.json`, `fi.json`. The i18n parity test fails if any locale's key set differs from `en`.
- **No hardcoded user-facing text.** All display copy comes from `email.*` keys.
- **Machine-translated locale strings are drafts** — flag the new sv/nb/da/fi strings for native review in the commit body; check the footer tagline against the Swedish domain glossary (`docs/contexts/`) for the canonical rendering of "job architecture".
- **Never use em dashes** in any copy (UI, comments, commits). Use a period, comma, colon, or parentheses.
- **No AI/Claude attribution** in commits or code. Write as the author.
- **Conventional Commits:** `type(scope): summary`, lowercase, imperative, no trailing period, ≤ ~72 chars.
- **New code ships with tests in the same commit.** The pre-commit hook runs Biome on staged files, a full `turbo run typecheck`, and the full `turbo run test` (cache-backed). All must pass. Never `--no-verify`.
- **Tests run with Vitest** via `bun run test` (never `bun test`). Per-package `vitest.config.ts` already exists for `@workspace/email`.
- **Brand color values:** `--brand` = `#eb3e5d` (rose), `--brand-foreground` = `#fafafa`. Radius token `--radius` = `0.625rem` = `10px`.
- **CTA button uses the brand rose** — a deliberate, spec-recorded exception to the app's "primary buttons stay neutral" rule (emails are a marketing-adjacent surface).
- **Do not push.** Commit locally only; the user pushes after explicit approval.

## File Structure

- `apps/dashboard/public/email/blueprnt-wordmark.svg` — **create**: brand-rose wordmark source (regeneration source, also servable).
- `apps/dashboard/public/email/blueprnt-wordmark.png` — **create**: the email-referenced logo, generated from the SVG.
- `packages/i18n/messages/{en,sv,nb,da,fi}.json` — **modify**: add `email.*.note`, `email.footer.copyright`, `email.footer.tagline`, `email.logoAlt`.
- `packages/email/src/components/theme.tsx` — **create**: `colors`, `FONT_FAMILY`, `LOGO_PATH`, `logoUrl()`, `EmailThemeProvider`.
- `packages/email/src/components/theme.test.ts` — **create**: `logoUrl()` unit tests.
- `packages/email/src/components/button.tsx` — **create**: `CtaButton`.
- `packages/email/src/components/footer.tsx` — **create**: `Footer`.
- `packages/email/src/components/base-email.tsx` — **create**: `BaseEmailTemplate`.
- `packages/email/src/components/base-email.test.tsx` — **create**: layout-chrome render test.
- `packages/email/src/templates/{invitation,verify-email,reset-password}.tsx` — **modify**: rebuild on `BaseEmailTemplate`; add `PreviewProps` + default export.
- `packages/email/src/render.test.ts` — **modify**: add branded-output assertions.
- `packages/email/src/render.ts` — **unchanged** (it calls the named template exports and computes subjects; both stay stable). Do not edit.

---

### Task 1: Generate and commit the blueprnt wordmark PNG

**Files:**
- Create: `apps/dashboard/public/email/blueprnt-wordmark.svg`
- Create: `apps/dashboard/public/email/blueprnt-wordmark.png` (generated, binary)

**Interfaces:**
- Consumes: nothing.
- Produces: the asset served at `https://app.blueprnt.se/email/blueprnt-wordmark.png` (path `/email/blueprnt-wordmark.png`), referenced by `logoUrl()` in Task 3.

- [ ] **Step 1: Create the source SVG.** Write `apps/dashboard/public/email/blueprnt-wordmark.svg` with the wordmark paths (copied verbatim from `apps/dashboard/components/logo.tsx`), filled with the brand rose:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="91 182 990 252" fill="#eb3e5d">
  <path d="M630.56,409.56c-2.93,16.05-16.51,24.56-31.56,23.22-11.44-1.02-20.6-7.42-22.98-19.14-1.21-5.97-1.72-12.83-1.04-19.49l11.77-115.09c1.8-17.56,8.25-43.83,28.54-45.94,9.64-1,17.8,1.96,23.26,10.43,12.63-10.54,29.06-12.88,45.92-7.13,12.5,4.26,23.8,15.88,28.58,31.06,7.78,24.67,5.94,52.02-4.31,75.97-13.29,31.06-43.06,42.44-73.52,31.2-1.47,12.23-2.55,23.33-4.67,34.9ZM653.01,284.85c-14.2-.64-17.61,43.78-4.65,44.11,14,.36,17.9-43.51,4.65-44.11Z" />
  <path d="M147.29,384.55c-38.06-4.16-56.65-34.9-54.45-69.96,2.1-33.5,6.35-65.97,11.67-99.05,1.39-8.62,4.29-16.91,10.01-23.41,9.59-10.9,27.58-12.25,38.47-2.49,11.75,10.52,8.23,36.37,6.25,50.57,27.68-9.79,55.08,4.19,63.97,31.5,6.79,20.86,5.83,42.74-.81,63.88-10.18,32.43-40.45,52.75-75.11,48.96ZM162.68,287.26c-15.54-1.49-18.65,43.71-4.6,43.99,14.74.29,19.16-42.6,4.6-43.99Z" />
  <path d="M923.39,375.08c-39.01-3.16-16.57-49.93-18.43-84.94-.09-1.64-2.41-4.76-3.89-4.92-7.25-.83-8.64,16.68-9.13,22.31-1.33,15.07-2.63,29.88-4.76,44.58-2.52,17.4-16.19,27.46-33.23,26.28-13.86-.96-24.18-10.81-22.7-25.98l7.85-80.09c.85-8.67,3.49-17.19,6.99-24.7,4.8-10.29,14.61-15.24,25.45-14.36,7.93.65,14.35,4.26,18.06,11.98,9.74-9.13,20.99-12.52,33.54-12.24,31.1.7,42.26,27.9,40.65,55.69-1.25,21.46-3.54,42.69-7.83,63.27-3.46,16.59-16.89,24.41-32.58,23.13Z" />
  <path d="M414.37,239.9c13.33-.04,22.74,7.14,25.4,19.72,4.62,21.85-1.06,61.79-10.1,82.78-6.86,15.93-18.34,28.91-34.4,35.79-17.81,7.63-37.57,8.51-56.03,3.01-23.86-7.12-34.39-29.81-34.56-53.41-.16-22.75,2.42-45.32,8.81-66.69,4.46-14.93,16.69-22.15,31.54-21.31,12.17.68,21.55,7.42,23.03,20.27,2.26,19.58-10.71,58.5-1.52,66.15,4.48,3.73,11.56-4.58,13.46-13.08,6.3-28.11-1.05-45.54,9.97-62.43,5.35-8.2,14.34-10.76,24.4-10.8Z" />
  <path d="M518.42,338.81c16.27.21,28.79-16.18,43.59-5.8,5.81,4.08,9.38,11.51,8.46,19.96-1.12,10.32-8.18,18.82-17.95,23.65-19.98,9.88-43.73,11.69-65.09,4.83-19.92-6.39-34.56-21.8-39.06-42.07-4.29-19.33-2.61-39.02,5.08-57.02,15.35-35.91,54.51-54.09,91.39-41.78,14.32,4.78,24.88,16.3,28.71,28.69,4.95,16,1.53,32.28-9.44,43.69-15.22,15.84-40.41,17.61-60.88,16.9,2.45,6.34,8.55,8.86,15.17,8.94ZM522.73,292.4c2.19-1.92,2.74-6.59,1.59-8.27-1.33-1.93-5.56-2.94-8.02-2.05-6.72,2.43-10.43,7.98-12.48,15.29,6.54.15,13.38-.15,18.9-4.97Z" />
  <path d="M1036.74,319.62c-.51,10.76,16.37,7.17,15.18,28.63-.78,14.04-9.7,25.86-23.72,29.11-11.82,2.74-24.56,1.03-34.46-6.36-24.44-18.24-11.73-58.04-10.3-84.41-4.95-1.46-10.28-3.56-12.25-7.71-6.6-13.93-.3-28.87,12.76-36.1,12.1-6.7,3.96-12.43,6.54-29.03,2.37-15.21,15.18-23.93,30.02-22.48,22.17,2.17,25.68,20.33,25.99,38.8,7.47.28,15.36.53,21.76,3.69,7.78,3.85,10.95,12.16,11.07,20.22.35,22.88-19.09,28.85-37.81,31.97-2.6,11.2-4.22,21.98-4.78,33.67Z" />
  <path d="M288.63,359.74c-2.23,11.33-10.62,20.06-19.64,22.6-10.96,3.09-23.18,1.1-30.19-7.8-5.1-6.47-6.87-15.66-6.36-24.36,2.54-43.88,6.93-86.75,12.69-130.28,2.48-18.74,8.95-38.28,32.04-36.73,24.78,1.66,26.6,27.59,24.82,47.36l-8.44,93.41c-1.09,12.09-2.51,23.58-4.92,35.81Z" />
  <path d="M786.21,291.63c-4.47,15.19-4.52,43.17-7.76,63.29-2.54,15.79-15.64,24.42-30.7,23.62-12.56-.67-22.95-7.78-24.2-21.22-1.82-19.54,4.08-67.51,6.99-88.98,1.01-7.48,3.41-14.65,6.03-21.32,5.24-9.79,14.01-15.51,25.04-15.24,9.46.23,17.1,4.68,21.02,14.64,9.02-11.4,22.81-16.45,36.77-12.11,20.74,6.45,22.12,35.06,10.73,51.3-8.69,12.39-25.65,14.03-36.35,4.17-.81-.75-3.15-1.67-4.05-1.47-1.13.25-3.19,2.18-3.52,3.31Z" />
</svg>
```

- [ ] **Step 2: Generate the PNG at 3x display size.**

Run: `rsvg-convert -w 420 apps/dashboard/public/email/blueprnt-wordmark.svg -o apps/dashboard/public/email/blueprnt-wordmark.png`
(`-w 420` scales proportionally; the 990×252 viewBox yields ~420×107, transparent background. Display size in the email is 140×36, i.e. 3x.)

- [ ] **Step 3: Verify the PNG dimensions.**

Run: `sips -g pixelWidth -g pixelHeight apps/dashboard/public/email/blueprnt-wordmark.png`
Expected: `pixelWidth: 420` and `pixelHeight: 107` (±1 on height).

- [ ] **Step 4: Commit.**

```bash
git add apps/dashboard/public/email/blueprnt-wordmark.svg apps/dashboard/public/email/blueprnt-wordmark.png
git commit -m "feat(email): add the blueprnt wordmark asset for email headers"
```

---

### Task 2: Add the new email i18n keys to all five locales

**Files:**
- Modify: `packages/i18n/messages/en.json` (the `email` block, currently lines ~10-29)
- Modify: `packages/i18n/messages/sv.json`, `nb.json`, `da.json`, `fi.json` (each `email` block)

**Interfaces:**
- Consumes: nothing.
- Produces: `EmailMessages` (= `(typeof en)["email"]`) gains `invitation.note`, `verifyEmail.note`, `resetPassword.note`, `footer.copyright`, `footer.tagline`, `logoAlt`. Tasks 3-5 read these keys.

- [ ] **Step 1: Run the i18n parity test to confirm a green baseline.**

Run: `bun run --filter @workspace/i18n test`
Expected: PASS (establishes the current keys are in parity before editing).

- [ ] **Step 2: Edit `en.json`.** Replace the `email` block with (existing `subject`/`heading`/`body`/`cta` unchanged; new keys added):

```json
  "email": {
    "invitation": {
      "subject": "{inviterName} invited you to {organizationName} on blueprnt",
      "heading": "Join {organizationName}",
      "body": "{inviterName} has invited you to the organization {organizationName}.",
      "cta": "Accept invitation",
      "note": "If you weren't expecting this invitation, you can ignore this email."
    },
    "verifyEmail": {
      "subject": "Verify your email address",
      "heading": "Verify your email",
      "body": "Confirm your email address to activate your blueprnt account.",
      "cta": "Verify email",
      "note": "If you didn't create a blueprnt account, you can ignore this email."
    },
    "resetPassword": {
      "subject": "Reset your password",
      "heading": "Reset your password",
      "body": "Click the button below to choose a new password.",
      "cta": "Reset password",
      "note": "If you didn't request this, you can safely ignore this email; your password won't change."
    },
    "footer": {
      "copyright": "© {year} Blueprnt Nordic AB",
      "tagline": "The job architecture that creates value."
    },
    "logoAlt": "blueprnt"
  },
```

- [ ] **Step 3: Edit `sv.json`** `email` block (existing keys unchanged; add):

```json
      "note": "Om du inte väntade dig den här inbjudan kan du ignorera det här mejlet."
```
(invitation),
```json
      "note": "Om du inte skapade ett blueprnt-konto kan du ignorera det här mejlet."
```
(verifyEmail),
```json
      "note": "Om du inte begärde detta kan du ignorera mejlet. Ditt lösenord ändras inte."
```
(resetPassword), and after `resetPassword`:
```json
    "footer": {
      "copyright": "© {year} Blueprnt Nordic AB",
      "tagline": "Jobbarkitekturen som skapar värde."
    },
    "logoAlt": "blueprnt"
```

- [ ] **Step 4: Edit `nb.json`** `email` block (add):

```json
      "note": "Hvis du ikke ventet denne invitasjonen, kan du ignorere denne e-posten."
```
(invitation),
```json
      "note": "Hvis du ikke opprettet en blueprnt-konto, kan du ignorere denne e-posten."
```
(verifyEmail),
```json
      "note": "Hvis du ikke ba om dette, kan du trygt ignorere e-posten. Passordet ditt endres ikke."
```
(resetPassword), and after `resetPassword`:
```json
    "footer": {
      "copyright": "© {year} Blueprnt Nordic AB",
      "tagline": "Jobbarkitekturen som skaper verdi."
    },
    "logoAlt": "blueprnt"
```

- [ ] **Step 5: Edit `da.json`** `email` block (add):

```json
      "note": "Hvis du ikke forventede denne invitation, kan du ignorere denne e-mail."
```
(invitation),
```json
      "note": "Hvis du ikke oprettede en blueprnt-konto, kan du ignorere denne e-mail."
```
(verifyEmail),
```json
      "note": "Hvis du ikke har anmodet om dette, kan du roligt ignorere e-mailen. Din adgangskode ændres ikke."
```
(resetPassword), and after `resetPassword`:
```json
    "footer": {
      "copyright": "© {year} Blueprnt Nordic AB",
      "tagline": "Jobarkitekturen der skaber værdi."
    },
    "logoAlt": "blueprnt"
```

- [ ] **Step 6: Edit `fi.json`** `email` block (add):

```json
      "note": "Jos et odottanut tätä kutsua, voit jättää tämän viestin huomiotta."
```
(invitation),
```json
      "note": "Jos et luonut blueprnt-tiliä, voit jättää tämän viestin huomiotta."
```
(verifyEmail),
```json
      "note": "Jos et pyytänyt tätä, voit jättää viestin huomiotta. Salasanasi ei muutu."
```
(resetPassword), and after `resetPassword`:
```json
    "footer": {
      "copyright": "© {year} Blueprnt Nordic AB",
      "tagline": "Työarkkitehtuuri, joka luo arvoa."
    },
    "logoAlt": "blueprnt"
```

- [ ] **Step 7: Run the parity test to confirm all locales stayed in sync.**

Run: `bun run --filter @workspace/i18n test`
Expected: PASS (every locale now has the same key set including the new keys).

- [ ] **Step 8: Commit.**

```bash
git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "feat(email): add footer, logo-alt, and security-note copy in all locales"
```

Commit body note: "sv/nb/da/fi strings are machine drafts pending native review; verify the footer tagline against the Swedish job-architecture glossary term."

---

### Task 3: Create the email theme module

**Files:**
- Create: `packages/email/src/components/theme.tsx`
- Test: `packages/email/src/components/theme.test.ts`

**Interfaces:**
- Consumes: `@react-email/components` (`Font`, `Head`, `Html`, `pixelBasedPreset`, `Tailwind`).
- Produces:
  - `colors`: `{ background, text, muted, border, brand, brandForeground }` (const).
  - `FONT_FAMILY: string`.
  - `LOGO_PATH = "/email/blueprnt-wordmark.png"`.
  - `logoUrl(): string` → `` `${process.env.SITE_URL ?? "https://app.blueprnt.se"}${LOGO_PATH}` ``.
  - `EmailThemeProvider({ lang, preview, children }: { lang: string; preview?: React.ReactNode; children: React.ReactNode })` → `<Html lang>` + `<Tailwind config={{ presets: [pixelBasedPreset] }}>` wrapping `<Head>` (Source Sans 3 fonts), `{preview}`, `{children}`.

- [ ] **Step 1: Write the failing test** `packages/email/src/components/theme.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest"
import { logoUrl } from "./theme"

const original = process.env.SITE_URL

afterEach(() => {
  if (original === undefined) delete process.env.SITE_URL
  else process.env.SITE_URL = original
})

describe("logoUrl", () => {
  it("builds the URL from SITE_URL when set", () => {
    process.env.SITE_URL = "https://app.example.test"
    expect(logoUrl()).toBe(
      "https://app.example.test/email/blueprnt-wordmark.png"
    )
  })

  it("falls back to the production origin when SITE_URL is unset", () => {
    delete process.env.SITE_URL
    expect(logoUrl()).toBe(
      "https://app.blueprnt.se/email/blueprnt-wordmark.png"
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `bun run --filter @workspace/email test -- theme`
Expected: FAIL (cannot resolve `./theme`).

- [ ] **Step 3: Write `packages/email/src/components/theme.tsx`:**

```tsx
import {
  Font,
  Head,
  Html,
  pixelBasedPreset,
  Tailwind,
} from "@react-email/components"
import type React from "react"

// Email color tokens, mirrored from the app theme (packages/ui globals.css).
// `brand` is the sRGB of --brand (oklch(0.6289 0.2079 15.74)); `brandForeground`
// is --brand-foreground. Email needs hex, not oklch.
export const colors = {
  background: "#ffffff",
  text: "#171717",
  muted: "#737373",
  border: "#e5e5e5",
  brand: "#eb3e5d",
  brandForeground: "#fafafa",
} as const

export const FONT_FAMILY =
  '"Source Sans 3", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

// Source Sans 3 latin subset (v19). The variable woff2 serves both weights; most
// clients ignore web fonts and use the fallback stack, which is the real target.
const SOURCE_SANS_3_WOFF2 =
  "https://fonts.gstatic.com/s/sourcesans3/v19/nwpStKy2OAdR1K-IwhWudF-R3w8aZejf5Hc.woff2"

export const LOGO_PATH = "/email/blueprnt-wordmark.png"

// Same origin the backend uses for action links (SITE_URL / requireSiteUrl),
// so the logo host always matches the link host. Read at render time inside the
// Convex action (process.env is available there) with a production default.
export function logoUrl(): string {
  return `${process.env.SITE_URL ?? "https://app.blueprnt.se"}${LOGO_PATH}`
}

export function EmailThemeProvider({
  lang,
  preview,
  children,
}: {
  lang: string
  preview?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Html lang={lang}>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head>
          <Font
            fontFamily="Source Sans 3"
            fallbackFontFamily="Helvetica"
            webFont={{ url: SOURCE_SANS_3_WOFF2, format: "woff2" }}
            fontWeight={400}
            fontStyle="normal"
          />
          <Font
            fontFamily="Source Sans 3"
            fallbackFontFamily="Helvetica"
            webFont={{ url: SOURCE_SANS_3_WOFF2, format: "woff2" }}
            fontWeight={600}
            fontStyle="normal"
          />
        </Head>
        {preview}
        {children}
      </Tailwind>
    </Html>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `bun run --filter @workspace/email test -- theme`
Expected: PASS (both `logoUrl` cases).

- [ ] **Step 5: Commit.**

```bash
git add packages/email/src/components/theme.tsx packages/email/src/components/theme.test.ts
git commit -m "feat(email): add shared email theme, fonts, and logo-url helper"
```

---

### Task 4: Create the Button, Footer, and BaseEmailTemplate

**Files:**
- Create: `packages/email/src/components/button.tsx`
- Create: `packages/email/src/components/footer.tsx`
- Create: `packages/email/src/components/base-email.tsx`
- Test: `packages/email/src/components/base-email.test.tsx`

**Interfaces:**
- Consumes (from Task 3): `colors`, `FONT_FAMILY`, `logoUrl`, `EmailThemeProvider`. (from Task 2): `email.footer.*`, `email.logoAlt`.
- Produces:
  - `CtaButton({ href, children }: { href: string; children: React.ReactNode })`.
  - `Footer({ locale }: { locale: string })`.
  - `BaseEmailTemplate({ preview, title, locale, children }: { preview: string; title?: React.ReactNode; locale: string; children: React.ReactNode })`. Tasks 5 uses `BaseEmailTemplate` and `CtaButton`.

- [ ] **Step 1: Write `packages/email/src/components/button.tsx`:**

```tsx
import { Button as ReactEmailButton, Section } from "@react-email/components"
import type React from "react"
import { colors } from "./theme"

// Centered call-to-action. Brand rose is a deliberate email-only exception to the
// app's neutral-primary rule (recorded in the design spec).
export function CtaButton({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Section className="text-center my-[32px]">
      <ReactEmailButton
        href={href}
        className="text-[14px] font-semibold no-underline px-[20px] py-[12px] rounded-[10px]"
        style={{
          backgroundColor: colors.brand,
          color: colors.brandForeground,
        }}
      >
        {children}
      </ReactEmailButton>
    </Section>
  )
}
```

- [ ] **Step 2: Write `packages/email/src/components/footer.tsx`:**

```tsx
import { Hr, Text } from "@react-email/components"
import { emailMessages, fillTemplate } from "../messages"
import { colors } from "./theme"

export function Footer({ locale }: { locale: string }) {
  const m = emailMessages(locale).footer
  const year = String(new Date().getFullYear())
  return (
    <>
      <Hr className="mx-0 my-[26px] w-full" style={{ borderColor: colors.border }} />
      <Text
        className="text-[12px] leading-[20px] m-0 text-center"
        style={{ color: colors.muted }}
      >
        {fillTemplate(m.copyright, { year })}
      </Text>
      <Text
        className="text-[12px] leading-[20px] m-0 text-center"
        style={{ color: colors.muted }}
      >
        {m.tagline}
      </Text>
    </>
  )
}
```

- [ ] **Step 3: Write `packages/email/src/components/base-email.tsx`:**

```tsx
import {
  Body,
  Container,
  Heading,
  Img,
  Preview,
  Section,
} from "@react-email/components"
import type React from "react"
import { emailMessages } from "../messages"
import { Footer } from "./footer"
import { colors, EmailThemeProvider, FONT_FAMILY, logoUrl } from "./theme"

export function BaseEmailTemplate({
  preview,
  title,
  locale,
  children,
}: {
  preview: string
  title?: React.ReactNode
  locale: string
  children: React.ReactNode
}) {
  const m = emailMessages(locale)
  return (
    <EmailThemeProvider lang={locale} preview={<Preview>{preview}</Preview>}>
      <Body className="bg-white mx-auto my-auto" style={{ fontFamily: FONT_FAMILY }}>
        <Container className="mx-auto my-[40px] max-w-[465px] px-[16px]">
          <Section className="mt-[32px]">
            <Img
              src={logoUrl()}
              width="140"
              height="36"
              alt={m.logoAlt}
              className="mx-auto my-0"
            />
          </Section>

          {title && (
            <Heading
              className="mx-0 my-[30px] p-0 text-center font-normal text-[24px]"
              style={{ color: colors.text }}
            >
              {title}
            </Heading>
          )}

          <Section>{children}</Section>

          <Footer locale={locale} />
        </Container>
      </Body>
    </EmailThemeProvider>
  )
}
```

- [ ] **Step 4: Write the failing test** `packages/email/src/components/base-email.test.tsx`:

```tsx
import { render } from "@react-email/render"
import { Text } from "@react-email/components"
import { describe, expect, it } from "vitest"
import { BaseEmailTemplate } from "./base-email"

describe("BaseEmailTemplate", () => {
  it("renders the wordmark, title, content, and footer chrome", async () => {
    const html = await render(
      BaseEmailTemplate({
        preview: "Preview text",
        title: "A title",
        locale: "en",
        children: <Text>Body content</Text>,
      })
    )
    expect(html).toContain("/email/blueprnt-wordmark.png")
    expect(html).toContain('alt="blueprnt"')
    expect(html).toContain("A title")
    expect(html).toContain("Body content")
    expect(html).toContain("Blueprnt Nordic AB")
    expect(html).toContain(String(new Date().getFullYear()))
    expect(html).toContain("The job architecture that creates value.")
  })
})
```

- [ ] **Step 5: Run the test to verify it passes** (components were written first, so this is green on first run; the assertions still gate the chrome):

Run: `bun run --filter @workspace/email test -- base-email`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add packages/email/src/components/button.tsx packages/email/src/components/footer.tsx packages/email/src/components/base-email.tsx packages/email/src/components/base-email.test.tsx
git commit -m "feat(email): add branded base layout, footer, and CTA button"
```

---

### Task 5: Rebuild the three templates and extend the render tests

**Files:**
- Modify: `packages/email/src/templates/invitation.tsx`
- Modify: `packages/email/src/templates/verify-email.tsx`
- Modify: `packages/email/src/templates/reset-password.tsx`
- Modify: `packages/email/src/render.test.ts`

**Interfaces:**
- Consumes (Task 4): `BaseEmailTemplate`, `CtaButton`. (Task 3): `colors`. (Task 2): `email.*.note`.
- Produces: same named exports (`InvitationEmail`, `VerifyEmail`, `ResetPasswordEmail`) with the same prop types — `render.ts` is unaffected.

- [ ] **Step 1: Write the failing render assertions.** Add these `it` blocks to `packages/email/src/render.test.ts` (keep the existing four tests):

```ts
  it("renders the branded layout for the reset email", async () => {
    const result = await renderEmail("resetPassword", {
      url: "https://x.example/reset",
      locale: "en",
    })
    expect(result.html).toContain("/email/blueprnt-wordmark.png")
    expect(result.html).toContain('alt="blueprnt"')
    expect(result.html.toLowerCase()).toContain("#eb3e5d")
    expect(result.html).toContain("https://x.example/reset")
    expect(result.html).toContain("you can safely ignore")
    expect(result.html).toContain("Blueprnt Nordic AB")
    expect(result.html).toContain(String(new Date().getFullYear()))
  })

  it("includes the CTA href and security note for verify and invitation", async () => {
    const verify = await renderEmail("verifyEmail", {
      url: "https://x.example/verify",
      locale: "en",
    })
    expect(verify.html).toContain("https://x.example/verify")
    expect(verify.html).toContain("you can ignore this email")

    const invite = await renderEmail("invitation", {
      inviterName: "Anna",
      organizationName: "Acme",
      acceptUrl: "https://x.example/accept-invitation/inv_1",
      locale: "en",
    })
    expect(invite.html).toContain("accept-invitation/inv_1")
    expect(invite.html).toContain("weren't expecting this invitation")
  })
```

- [ ] **Step 2: Run the render tests to verify the new ones fail.**

Run: `bun run --filter @workspace/email test -- render`
Expected: FAIL (templates don't yet render the logo/footer/note).

- [ ] **Step 3: Rewrite `packages/email/src/templates/invitation.tsx`:**

```tsx
import { Text } from "@react-email/components"
import { BaseEmailTemplate } from "../components/base-email"
import { CtaButton } from "../components/button"
import { colors } from "../components/theme"
import { emailMessages, fillTemplate } from "../messages"

export interface InvitationEmailProps {
  inviterName: string
  organizationName: string
  acceptUrl: string
  locale: string
}

export function InvitationEmail({
  inviterName,
  organizationName,
  acceptUrl,
  locale,
}: InvitationEmailProps) {
  const m = emailMessages(locale).invitation
  const params = { inviterName, organizationName }
  return (
    <BaseEmailTemplate
      preview={fillTemplate(m.subject, params)}
      title={fillTemplate(m.heading, params)}
      locale={locale}
    >
      <Text
        className="text-[16px] leading-[26px] m-0"
        style={{ color: colors.text }}
      >
        {fillTemplate(m.body, params)}
      </Text>
      <CtaButton href={acceptUrl}>{m.cta}</CtaButton>
      <Text
        className="text-[14px] leading-[22px] m-0"
        style={{ color: colors.muted }}
      >
        {m.note}
      </Text>
    </BaseEmailTemplate>
  )
}

InvitationEmail.PreviewProps = {
  inviterName: "Anna",
  organizationName: "Acme",
  acceptUrl: "https://app.blueprnt.se/accept-invitation/inv_1",
  locale: "en",
} satisfies InvitationEmailProps

export default InvitationEmail
```

- [ ] **Step 4: Rewrite `packages/email/src/templates/verify-email.tsx`:**

```tsx
import { Text } from "@react-email/components"
import { BaseEmailTemplate } from "../components/base-email"
import { CtaButton } from "../components/button"
import { colors } from "../components/theme"
import { emailMessages } from "../messages"

export interface VerifyEmailProps {
  url: string
  locale: string
}

export function VerifyEmail({ url, locale }: VerifyEmailProps) {
  const m = emailMessages(locale).verifyEmail
  return (
    <BaseEmailTemplate preview={m.subject} title={m.heading} locale={locale}>
      <Text
        className="text-[16px] leading-[26px] m-0"
        style={{ color: colors.text }}
      >
        {m.body}
      </Text>
      <CtaButton href={url}>{m.cta}</CtaButton>
      <Text
        className="text-[14px] leading-[22px] m-0"
        style={{ color: colors.muted }}
      >
        {m.note}
      </Text>
    </BaseEmailTemplate>
  )
}

VerifyEmail.PreviewProps = {
  url: "https://app.blueprnt.se/verify-email?token=preview",
  locale: "en",
} satisfies VerifyEmailProps

export default VerifyEmail
```

- [ ] **Step 5: Rewrite `packages/email/src/templates/reset-password.tsx`:**

```tsx
import { Text } from "@react-email/components"
import { BaseEmailTemplate } from "../components/base-email"
import { CtaButton } from "../components/button"
import { colors } from "../components/theme"
import { emailMessages } from "../messages"

export interface ResetPasswordEmailProps {
  url: string
  locale: string
}

export function ResetPasswordEmail({ url, locale }: ResetPasswordEmailProps) {
  const m = emailMessages(locale).resetPassword
  return (
    <BaseEmailTemplate preview={m.subject} title={m.heading} locale={locale}>
      <Text
        className="text-[16px] leading-[26px] m-0"
        style={{ color: colors.text }}
      >
        {m.body}
      </Text>
      <CtaButton href={url}>{m.cta}</CtaButton>
      <Text
        className="text-[14px] leading-[22px] m-0"
        style={{ color: colors.muted }}
      >
        {m.note}
      </Text>
    </BaseEmailTemplate>
  )
}

ResetPasswordEmail.PreviewProps = {
  url: "https://app.blueprnt.se/reset-password?token=preview",
  locale: "en",
} satisfies ResetPasswordEmailProps

export default ResetPasswordEmail
```

Note: `render.ts` imports `ResetPasswordEmail` and `VerifyEmail` as named exports and calls them as functions — unchanged. The new `default` export and `PreviewProps` are additive (TS "expando" function properties; the `satisfies` checks the shape). If the strict config rejects the property assignment, wrap with `Object.assign(function X(){...}, { PreviewProps: {...} })` instead.

- [ ] **Step 6: Run the full email test suite to verify all pass.**

Run: `bun run --filter @workspace/email test`
Expected: PASS (existing four + the two new render tests + the base-email + theme tests).

- [ ] **Step 7: Typecheck the package.**

Run: `bun run --filter @workspace/email typecheck`
Expected: PASS (no errors; confirms `PreviewProps`/default-export typing).

- [ ] **Step 8: Commit.**

```bash
git add packages/email/src/templates/invitation.tsx packages/email/src/templates/verify-email.tsx packages/email/src/templates/reset-password.tsx packages/email/src/render.test.ts
git commit -m "feat(email): rebuild transactional templates on the branded layout"
```

---

### Task 6: Verify the preview server renders all three templates

**Files:** none (verification only; the `PreviewProps` + default exports landed in Task 5, and the `preview` script already exists in `packages/email/package.json`).

**Interfaces:**
- Consumes (Task 5): the default exports + `PreviewProps` on each template.
- Produces: a working `bun run --filter @workspace/email preview` dev server.

- [ ] **Step 1: Start the preview server.**

Run: `bun run --filter @workspace/email preview`
Expected: the React Email dev server starts and lists `invitation`, `verify-email`, and `reset-password`. (If a workspace import fails to resolve in the preview bundler, that is a preview-only limitation; the templates and tests are unaffected. Note it and move on — do not block the deliverable.)

- [ ] **Step 2: Stop the server** (Ctrl-C) once the three templates render with the wordmark, brand-rose CTA, and footer.

- [ ] **Step 3 (only if any tracked file changed — e.g. a small import tweak to make preview resolve): Commit.**

```bash
git add -A packages/email
git commit -m "chore(email): make templates previewable in the react-email dev server"
```

If nothing changed, skip the commit; the preview already worked from Task 5.

---

### Final verification (run before handing back)

- [ ] **Full typecheck + test across the monorepo** (mirrors the pre-commit hook):

Run: `bun run typecheck && bun run test`
Expected: all packages PASS. In particular `@workspace/i18n` (parity), `@workspace/email` (render/theme/base-email), and `dashboard`/`@workspace/backend` typecheck (they consume `@workspace/email` / `EmailMessages`).

- [ ] **Confirm `render.ts` was not modified** (`git log --oneline -p -- packages/email/src/render.ts` shows no change in this branch) — the render API and subjects stayed stable.

## Self-Review

**1. Spec coverage:**
- Logo (hosted PNG, brand rose) → Task 1. ✓
- Decision: CTA brand rose → Task 4 (CtaButton `colors.brand`) + Task 5 assertion `#eb3e5d`. ✓
- Decision: Tailwind via `@react-email/components` → Tasks 3-4 import `Tailwind`/`pixelBasedPreset`/classes; no dep added. ✓
- Decision: Source Sans 3 400/600 → Task 3 `EmailThemeProvider` `<Font>`. ✓
- theme.tsx, base-email.tsx, button.tsx, footer.tsx → Tasks 3-4. ✓
- Templates rebuilt, render.ts unchanged, subjects stable → Task 5 + final check. ✓
- i18n new keys, en-first, all 5 locales, drafts flagged, glossary note → Task 2. ✓
- Logo asset generation (SVG→PNG, rsvg-convert, public/email) → Task 1. ✓
- Preview default exports + PreviewProps → Task 5 (added) + Task 6 (verified). ✓
- Tests: logo src/alt, CTA href, note text, footer year, brand hex, locale distinctness → Tasks 3-5. ✓
- Out of scope (no new email types, no send-path change) → respected (render.ts untouched, no outbox/auth edits). ✓

**2. Placeholder scan:** No TBD/TODO/"handle errors"/"similar to". Every code step shows full content. Copy strings are literal. ✓

**3. Type consistency:** `colors`, `FONT_FAMILY`, `logoUrl`, `LOGO_PATH`, `EmailThemeProvider` (Task 3) are consumed with the same names/signatures in Task 4; `BaseEmailTemplate({ preview, title, locale, children })` and `CtaButton({ href, children })` defined in Task 4 are used with those exact props in Task 5; `Footer({ locale })` consumed by `BaseEmailTemplate`; template prop interfaces (`InvitationEmailProps`, `VerifyEmailProps`, `ResetPasswordEmailProps`) preserved so `render.ts` and its `EmailProps` map are unaffected. ✓

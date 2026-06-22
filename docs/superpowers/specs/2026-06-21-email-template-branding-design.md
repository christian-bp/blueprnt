# Design: blueprnt transactional email templates

Date: 2026-06-21
Status: Approved design, pending spec review

## Problem

The Sweego migration (commit `fac9161`) moved transactional email onto the
`@christian-ek/sweego` Convex component with an admin email log, but the three
templates themselves were never designed. Today each template in
`packages/email/src/templates/` is bare React Email: `<Html><Body><Container>`
wrapping an unstyled `<Heading>`, `<Text>`, and `<Button>`. No logo, no layout,
no footer, no theme, no brand. They render as black-on-white default markup.

We want to redesign the three templates to a polished, on-brand standard, taking
structural inspiration from the email system in
`/Volumes/development/personal/polyform` (a shared `BaseEmailTemplate` + `Button`
+ `Footer` + theme tokens), branded as blueprnt.

## Scope

In scope: redesign the three existing templates (`invitation`, `verifyEmail`,
`resetPassword`) and introduce the shared email design system they sit on. No new
email types. No change to the send pipeline (`email/outbox.ts`), the Sweego
wiring, the admin email log, or the call sites in `auth.ts`. The render API
(`renderEmail(templateKey, props)`) and its subjects stay byte-stable so the
backend and tests are unaffected except where we deliberately extend them.

## Reference (polyform) and what we borrow

Polyform's `packages/email` uses React Email with a `BaseEmailTemplate`
(centered logo -> optional title -> content -> footer), a reusable `Button`, a
`Footer`, and a `theme` with a small color token set. 465px container, generous
spacing (32px between sections, 26px footer rule), minimalist black-on-white.

We borrow the **structure, proportions, and mechanism**: like polyform we style
with `@react-email/tailwind` (pixel-based preset) for layout/spacing classes plus
inline color values from a shared theme. We borrow nothing brand-specific:
blueprnt gets its own wordmark, font, accent color, and footer copy.

## Decisions

1. **Logo: hosted PNG wordmark (brand rose).** Inline SVG is stripped by Gmail
   and Outlook, so we render the existing wordmark (`apps/dashboard/components/logo.tsx`,
   the 8 paths, viewBox `91 182 990 252`) to a PNG, filled in the brand rose,
   and host it as a static asset on the dashboard origin. Email references it by
   absolute URL.
2. **CTA button: brand rose.** A deliberate departure from the app rule
   ("primary buttons stay neutral; brand rose is an identity accent only").
   Email is a marketing-adjacent surface where the rose CTA is wanted. Recorded
   here so a future reader does not "correct" it back to neutral. Button text
   uses `--brand-foreground` (near-white), matching the app's brand/foreground
   pairing.
3. **Styling: `@react-email/tailwind`, matching polyform.** The package gains
   `tailwindcss` + `@react-email/tailwind`, and templates are wrapped in
   `<Tailwind>` with the `pixelBasedPreset`. Layout and spacing use Tailwind
   utility classes (`text-[16px]`, `leading-[26px]`, `mt-[32px]`, etc.); colors
   come from the shared `colors` theme via inline `style`. Tailwind (over one-off
   inline styles) is chosen because more email templates are coming, and the
   utility classes keep them consistent and fast to author.
4. **Font: Source Sans 3 (the brand font), 400/600**, loaded via the React
   Email `<Font>` component with Google Fonts woff2 URLs and a system-sans
   fallback stack. Most clients ignore web fonts and use the fallback; the
   fallback is what we tune for legibility.

## Architecture

New shared building blocks under `packages/email/src/components/`:

- **`theme.tsx`**. Exports the design tokens and an `EmailThemeProvider` so every
  template reads one source of truth:
  - `EmailThemeProvider({ lang, children })` -> `<Html lang>` + `<Head>` (with
    `<Font>` loading Source Sans 3 400/600 via Google Fonts woff2 + a system-sans
    fallback) + `<Tailwind config={{ presets: [pixelBasedPreset] }}>{children}</Tailwind>`.
  - `colors`: `brand` (exact sRGB of `--brand` = `oklch(0.6289 0.2079 15.74)`,
    computed at implementation; approximately `#eb3e5d`), `brandForeground`
    (`#fafafa`, the sRGB of `--brand-foreground`), `text` `#171717`, `muted`
    `#737373`, `border` `#e5e5e5`, `background` `#ffffff`.
  - `fontFamily`: `'"Source Sans 3", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'`.
  - layout constants: container `maxWidth: 465`, `radius: 10` (the `--radius`
    token), section gap `32`, footer rule margin `26`.
  - `LOGO_PATH` = `/email/blueprnt-wordmark.png`, and a `logoUrl()` helper:
    `` `${process.env.SITE_URL ?? "https://app.blueprnt.se"}${LOGO_PATH}` ``.
    Same origin the backend uses for action links (`requireSiteUrl()` /
    `SITE_URL`), so the email host always matches the link host.

- **`base-email.tsx`** -> `BaseEmailTemplate({ preview, title, locale, children })`.
  Wraps `EmailThemeProvider lang={locale}` around `<Preview>{preview}</Preview>` +
  `<Body className="bg-white">` (the font stack) + `<Container>` (Tailwind:
  `max-w-[465px] mx-auto my-[40px] px-[16px]`). Inside: a centered logo
  `<Section>` with `<Img src={logoUrl()} alt={m.logoAlt} width={140} height={36}>`
  (height derived from the 990x252 aspect ratio at 140px wide), an optional
  `<Heading className="text-[24px] text-center font-normal" style={{ color: colors.text }}>`,
  the `children` content slot, then `<Footer locale={locale} />`.

Dependencies added to `packages/email`: `@react-email/tailwind` and
`tailwindcss` (peer of the Tailwind component). `@react-email/components`,
`@react-email/render`, and `react-email` are already present.

- **`button.tsx`** -> `CtaButton({ href, children })`. A centered `<Section
  className="text-center my-[32px]">` wrapping React Email `<Button
  className="text-[14px] font-semibold no-underline px-[20px] py-[12px] rounded-[10px]">`
  with inline `style={{ backgroundColor: colors.brand, color: colors.brandForeground }}`
  (color tokens stay inline; sizing/spacing are Tailwind classes).

- **`footer.tsx`** -> `Footer({ locale })`. `<Hr>` in `colors.border` (26px
  margins) then a centered 12px `colors.muted` `<Text>`: the copyright line
  (`email.footer.copyright` with `{year}` from `new Date().getFullYear()`) and,
  on the next line, the tagline (`email.footer.tagline`).

### Templates (rebuilt on `BaseEmailTemplate`)

Each becomes: title -> body `<Text>` -> `CtaButton` -> a muted helper/security
`<Text>` (`note`) -> footer. The `<Html>/<Body>/<Container>` boilerplate moves
into `BaseEmailTemplate`; templates shrink to content. Named exports stay
(`render.ts` imports them unchanged); subjects are unchanged.

- **invitation** — title `email.invitation.heading` (`Join {organizationName}`),
  body `email.invitation.body` (extended to `... on blueprnt.`), CTA
  `email.invitation.cta`, note `email.invitation.note`.
- **verifyEmail** — title/body/cta unchanged keys, note `email.verifyEmail.note`.
- **resetPassword** — title/body/cta unchanged keys, note `email.resetPassword.note`.

### render.ts

No structural change. It already loads `emailMessages(props.locale)` and renders
each component to html + plain text. Templates now read `note`/`footer` keys
internally, so `render.ts` needs no new wiring. Subjects unchanged.

## i18n

New keys, added to `packages/i18n/messages/en.json` first (English is the base;
`EmailMessages = (typeof en)["email"]` so the type enforces parity), then
mirrored to `sv`, `nb`, `da`, `fi`:

- `email.invitation.note`, `email.verifyEmail.note`, `email.resetPassword.note`
- `email.footer.copyright` = `"© {year} Blueprnt Nordic AB"`
- `email.footer.tagline` = `"The job architecture that creates value."` (the
  blueprnt.se hero tagline)
- `email.logoAlt` = `"blueprnt"` (same in every locale; the wordmark's alt text,
  kept in i18n for the no-hardcoded-text rule even though the brand name is
  locale-invariant)

English copy:
- invitation note: "If you weren't expecting this invitation, you can ignore this email."
- verifyEmail note: "If you didn't create a blueprnt account, you can ignore this email."
- resetPassword note: "If you didn't request this, you can safely ignore this email; your password won't change."

Nordic translations will be authored in the same commit and flagged for native
review (per CLAUDE.md, machine-translated locale strings are drafts). No em
dashes in any copy. The existing i18n parity test guards that every locale has
the same key set.

## Logo asset generation

1. Build a standalone SVG from the 8 wordmark paths with `viewBox="91 182 990 252"`,
   `fill="#<brand-hex>"`, explicit `width`/`height`.
2. Convert SVG -> PNG with whichever tool is available (`rsvg-convert`, `resvg`,
   `sharp`, or ImageMagick), transparent background, rendered at ~3x display
   size (about 420px wide) for crisp retina display.
3. Commit to `apps/dashboard/public/email/blueprnt-wordmark.png` (creating
   `apps/dashboard/public/email/`). Next.js serves it at
   `https://app.blueprnt.se/email/blueprnt-wordmark.png`.

In local React Email preview the asset resolves once the dashboard dev server is
running on `SITE_URL`'s origin; otherwise the image 404s harmlessly in preview.

## Preview tooling

The `preview` script already exists (`email dev --dir src/templates`) but the
templates are named exports, and `email dev` renders **default** exports, so
preview shows nothing today. We add to each template:

```ts
InvitationEmail.PreviewProps = { /* sample props */ } satisfies InvitationEmailProps
export default InvitationEmail
```

so `bun run --filter @workspace/email preview` renders all three with realistic
data. No new dependency (`react-email` is already a devDependency).

## Testing

Extend `packages/email/src/render.test.ts` (keeping the existing assertions):

- the rendered html contains the logo src substring `/email/blueprnt-wordmark`
  and `alt="blueprnt"`;
- the CTA `href` still appears (invitation already asserts this; add for verify
  and reset);
- the per-template `note` text appears in the html for `en`;
- the footer copyright line with the current year (`new Date().getFullYear()`)
  appears;
- the button's brand color hex appears in the html (guards the brand styling);
- the existing "every locale yields a distinct subject" test stays green.

Plain-text rendering still works (the `<Img>` degrades to its alt, the footer to
text). New code ships with these tests in the same commit; the pre-commit hook
runs the full `turbo run test`.

## Out of scope / non-goals

- No new email types (welcome, receipts, notifications, etc.).
- No change to send/delivery, the Sweego component, or the admin email log.
- No per-account locale work (still `en` for verify/reset; org locale for
  invitation) — that is the separate Task 12 slice.

## Footer tagline (resolved)

`email.footer.tagline` (en) = "The job architecture that creates value." (the
blueprnt.se hero tagline). The subheadline "Pay mapping, role evaluation,
framework, rethought." is the alternative if a shorter line is wanted. The
sv/nb/da/fi versions are brand- and domain-sensitive: they are authored as
drafts flagged for native review and **checked against the Swedish domain
glossary** (`docs/contexts/`) for the canonical rendering of "job architecture"
rather than translated literally.

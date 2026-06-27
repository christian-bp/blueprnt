# Shared split-screen layout for auth + onboarding

Status: design, pending review.
Date: 2026-06-26.

## 1. Overview

Unify the sign-in, password, 2FA, and organization-onboarding screens under one
shared split-screen layout inspired by the login in the midday project
(`/Volumes/development/personal/midday`): a branded left panel and a centered,
card-less right panel. Today the auth screens are centered shadcn Cards
(`max-w-sm`) while onboarding is a separate frame (top header with account menu,
`max-w-2xl`, bottom step dots). After this change both use the same shell.

Adapted to blueprnt's tokens (Source Sans 3, brand rose, existing components,
Motion), not midday's serif/video.

## 2. Decisions (locked)

1. **Left panel:** a calm branded panel (no video; we have no asset and this is a
   serious B2B product): brand-tinted dark surface with the wordmark, a tagline,
   and a slowly rotating short value line (the spirit of midday's rotating
   testimonials, text-only).
2. **Onboarding adopts the full split layout:** the left panel persists through
   onboarding; the steps, the step dots, and the account menu render in the right
   panel. Login and onboarding look identical.
3. **Card-less:** auth forms drop the shadcn `Card`. The right panel is the frame;
   forms are bare and centered with a heading, matching the onboarding
   `ScreenShell`.

## 3. Architecture

### 3.1 `AuthShell` (new shared layout)

`apps/dashboard/components/auth/auth-shell.tsx`. The single split-screen frame.

```
<div class="flex min-h-svh">
  <BrandPanel />                     {/* hidden lg:flex lg:w-1/2 */}
  <div class="relative flex w-full flex-col lg:w-1/2">
    {headerRight && <div class="absolute right-4 top-4">{headerRight}</div>}
    <main class="flex flex-1 flex-col items-center justify-center p-6 md:p-10">
      <Logo class="lg:hidden ..." />  {/* mobile-only wordmark; desktop shows it in BrandPanel */}
      <div class="w-full max-w-sm">{children}</div>
    </main>
    {footer && <div class="pb-8">{footer}</div>}
  </div>
</div>
```

Props: `children` (right-panel content), `headerRight?` (account menu; onboarding
only), `footer?` (the step dots; onboarding only). Responsive: below `lg` the
`BrandPanel` is hidden and the right column is full width with the mobile logo on
top. This is the only file that owns the split geometry; every screen composes it.

### 3.2 `BrandPanel` (left, new)

Inline in `auth-shell.tsx` or its own file. A fixed dark, lightly brand-tinted
surface (a near-black neutral; exact shade picked in implementation to read as
on-brand, not loud). Contains: the wordmark (top-left), a tagline, and a
`RotatingValueLine`. Light text on the dark surface. Fixed treatment (does not
follow the app light/dark theme; auth is pre-app, like midday's fixed dark video
side).

### 3.3 `RotatingValueLine` (new, client)

A small client component that cross-fades through 3-4 short value statements every
~6s using Motion (`AnimatePresence`, opacity only - no FLIP/scale, avoiding the
documented animation bugs). Respects reduced motion via the global
`MotionConfig reducedMotion="user"` (when reduced, it shows one line, no
rotation). Strings come from i18n (`dashboard.auth.brand.*`), all five locales.

## 4. Screens that adopt the shell, and what changes

- **Sign-in** (`sign-in-screen.tsx`): replace its `<main>`+`Logo`+`max-w-sm`
  wrapper with `<AuthShell>`. The credentials form and the 2FA challenge render as
  its children.
- **Email-password form** (`email-password-form.tsx`): drop the `Card`; render a
  heading block (`signIn.title` + `signIn.description`) followed by the bare form.
- **2FA challenge** (`two-factor-challenge.tsx`): already card-less; unchanged
  internally (renders inside the shell via sign-in).
- **2FA setup** (`two-factor-setup.tsx`): replace the internal `Shell` with
  `<AuthShell>`. Steps already render bare; keep them.
- **Forgot / reset password** (`app/forgot-password/page.tsx`,
  `app/reset-password/page.tsx`): replace the `<main>`+`Logo`+`Card` wrapper with
  `<AuthShell>`; drop the `Card`, keep a heading block + the bare form.
- **Onboarding wizard** (`onboarding-wizard.tsx`): render inside `<AuthShell>`.
  The step content (`ScreenShell` reveal + crossfade) is the shell's `children`;
  the step dots become the shell's `footer`; the account menu moves to the shell's
  `headerRight` slot. The standalone top header (`OnboardingHeader`) is retired:
  its account menu (avatar dropdown - org switch, language, sign out) moves into a
  small reusable `AccountMenu` rendered in `headerRight`. The "waiting for admin"
  and loading states render inside the shell too.

The `(app)/layout.tsx` gate wiring is unchanged (AuthLoading / Unauthenticated →
SignInScreen / Authenticated → TwoFactorGate → OnboardingGate); only what those
screens render changes.

## 5. Heading treatment (card-less)

Auth screens get a simple centered heading block in place of the removed
`CardHeader`: a title + muted description, reusing the existing i18n keys
(`signIn.*`, `resetPassword.*`, `forgotPassword.*`). Onboarding keeps its richer
`ScreenShell` (TextEffect blur-reveal heading). Both live in the right panel; the
visual scale is aligned (centered, same max width, same vertical rhythm).

## 6. Components extracted

- `AuthShell` - the split frame (owns geometry + the mobile logo).
- `BrandPanel` + `RotatingValueLine` - the left panel.
- `AccountMenu` - the avatar dropdown (org switch / language / sign out) extracted
  from `OnboardingHeader` so the shell's `headerRight` can host it without the old
  `h-14` header bar.

`OnboardingHeader` is removed once `AccountMenu` + `AuthShell.headerRight` replace
it. `OnboardingDots`, `ScreenShell`, `NextButton`, the step screens, and the
crossfade are reused unchanged.

## 7. i18n

New keys under `dashboard.auth.brand.*`: `tagline` and `values` (an array, or
`value1..valueN`) - 3-4 short value statements. English is the source; sv/nb/da/fi
are machine drafts flagged for native review. The `next-intl` array access pattern
must match what the repo already uses (verified in implementation); if arrays are
awkward, use numbered keys. No hardcoded copy in the components.

## 8. Animation

Per `docs/ui-animation.md` (read before implementing): the value-line cross-fade is
opacity-only (no layout/scale/height animation, so none of the documented FLIP /
height-clamp / gap bugs apply). Reduced motion is honored globally
(`MotionConfig reducedMotion="user"`); under it the value line is static. The
onboarding step crossfade and `ScreenShell` reveal are preserved as-is.

## 9. Testing

- `AuthShell`: renders children; renders `headerRight`/`footer` when passed; the
  brand panel is `lg`-only and the mobile logo is present (assert the structural
  classes / testids).
- `RotatingValueLine`: renders a value line; with reduced motion it shows one and
  does not error. (Timer-driven rotation is exercised lightly with fake timers or
  left to manual check; do not over-test the interval.)
- Existing form tests (sign-in, forgot/reset, 2FA, onboarding) must still pass.
  They query by label/role/text, so dropping the `Card` should not break them;
  update any test that asserted card-specific structure.
- i18n parity test covers the new keys automatically.

## 10. Non-goals

- No video or external media on the left panel (no asset; keep it text + brand).
- No new auth methods or flow changes; this is layout only.
- No change to the `(app)` dashboard shell (the post-onboarding app), the gates,
  or any backend.
- No light/dark theming work beyond the fixed dark left panel.

## 11. Implementation sequencing (for the plan)

1. `AccountMenu` extracted from `OnboardingHeader` (no behavior change), with tests.
2. `RotatingValueLine` + the `dashboard.auth.brand.*` i18n (5 locales).
3. `AuthShell` + `BrandPanel` (composes the above), with tests.
4. Move the auth screens onto `AuthShell` + drop their cards (sign-in/email-form,
   forgot, reset, 2FA setup), updating their tests.
5. Move the onboarding wizard onto `AuthShell` (dots → footer, account menu →
   headerRight, retire `OnboardingHeader`), updating onboarding tests.

Each slice is independently testable; the app keeps working between slices.

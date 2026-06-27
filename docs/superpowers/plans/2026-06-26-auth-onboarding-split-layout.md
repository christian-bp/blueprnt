# Shared Auth + Onboarding Split Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the sign-in, password, 2FA, and org-onboarding screens on one shared midday-style split-screen layout (branded left panel + card-less centered right panel).

**Architecture:** A new `AuthShell` owns the split geometry and a mobile-only logo; a fixed-dark `BrandPanel` (wordmark + tagline + opacity-cross-fading `RotatingValueLine`) fills the left half on `lg+`. Every auth screen and the onboarding wizard compose `AuthShell`; the onboarding step dots go in its `footer` slot and the account menu (extracted to `AccountMenu`) in its `headerRight` slot, retiring `OnboardingHeader`. Forms lose their shadcn `Card` chrome and gain a plain centered heading block.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4 + shadcn, `motion/react`, `next-intl`, Vitest 4 + Testing Library, Bun, Turborepo.

## Global Constraints

Copied from the spec and project rules. Every task implicitly includes these.

- **No em dashes** in any UI copy, comment, or commit message. Use a period, comma, colon, or parentheses.
- **All user-facing text via i18n** (`next-intl`). New strings go to `packages/i18n/messages/en.json` first, then mirrored to `sv.json`, `nb.json`, `da.json`, `fi.json` (the parity test fails otherwise). Non-English are machine drafts: flag for native review. Write non-ASCII as literal UTF-8 directly (never via shell perl/sed).
- **Locales:** `["en", "sv", "nb", "da", "fi"]`, default `en`.
- **Animation:** read `docs/ui-animation.md` before writing any animation. The value-line cross-fade is **opacity only** (no layout/scale/height animation). Reduced motion is honored via the global `MotionConfig reducedMotion="user"`; the value line also reads `useReducedMotion()` and does NOT auto-rotate when reduced. Use `motion/react`.
- **Minimize layout shift:** reserve space so the rotating line does not reflow the panel.
- **Forms:** keep the house pattern (react-hook-form + zodResolver + shadcn `Form` components, `FormMessage`, submit gated on `isValid`/`isSubmitting`). This change is layout only; do not alter form logic.
- **shadcn vendor code** (`packages/ui/src/*`) is not edited.
- **Internal navigation uses the Link component, never `<a>`.**
- **Brand:** the wordmark may use `text-brand` (identity accent); primary buttons stay neutral. Brand is never on a judgement value.
- **Commits:** Conventional Commits, lowercase imperative, no AI attribution / no `Co-Authored-By`.
- **Tests:** new code ships with tests in the same commit. The pre-commit hook runs Biome (staged) + full typecheck + full `turbo run test`; all must pass. Never `--no-verify`. Run `bun run format` before committing if you added imports.

### Design decisions (from the spec)
- Left panel: fixed dark, brand-tinted; no video. Wordmark + tagline + rotating value line.
- Onboarding adopts the full split layout (left panel persists; steps + dots + account menu in the right panel).
- Card-less: auth forms drop the shadcn `Card`; the panel is the frame.

---

## File Structure

**New components (`apps/dashboard/components/`):**
- `auth/auth-shell.tsx` — the split frame: left `BrandPanel` (lg+), right column with `headerRight`/`footer` slots, a mobile-only logo, and a `max-w-sm` (overridable) centered content area.
- `auth/brand-panel.tsx` — the left panel (fixed dark, wordmark + tagline + `RotatingValueLine`).
- `auth/rotating-value-line.tsx` — opacity cross-fade through the brand value lines.
- `account-menu.tsx` — the avatar dropdown (org switch / language / sign out) extracted from `OnboardingHeader`.

**Modified:**
- `components/auth/sign-in-screen.tsx`, `components/auth/email-password-form.tsx` — compose `AuthShell`, drop the `Card`.
- `app/forgot-password/page.tsx`, `app/reset-password/page.tsx` — compose `AuthShell`, drop the `Card`.
- `components/auth/two-factor-setup.tsx` — replace its local `Shell` with `AuthShell`.
- `components/onboarding/onboarding-wizard.tsx` — render inside `AuthShell` (dots → footer, account menu → headerRight).
- `components/onboarding/onboarding-header.tsx` — refactor to use `AccountMenu` (Task 1), then delete (Task 5).
- `packages/i18n/messages/{en,sv,nb,da,fi}.json` — add `dashboard.auth.brand.*`.

**Reused unchanged:** `Logo`, `ScreenShell`, `OnboardingDots`, `NextButton`, `TwoFactorChallenge`, the step screens, `OrgSwitchMenuSub`, `LanguageMenuSub`.

---

## Task 1: Extract `AccountMenu` from `OnboardingHeader`

Pull the avatar dropdown out so the shell's `headerRight` can host it. No behavior change yet; `OnboardingHeader` keeps working by delegating to it.

**Files:**
- Create: `apps/dashboard/components/account-menu.tsx`
- Modify: `apps/dashboard/components/onboarding/onboarding-header.tsx`
- Test: `apps/dashboard/components/account-menu.test.tsx`

**Interfaces:**
- Produces (Task 3, 5): `<AccountMenu />` — the avatar `DropdownMenu` (org switch, language, sign out). No props.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/account-menu.test.tsx`:
```tsx
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: "Karl Stolt", email: "karl@blueprnt.se" } } }),
    signOut: vi.fn(),
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/org-switch-menu", () => ({ OrgSwitchMenuSub: () => null }))
vi.mock("@/components/language-menu", () => ({ LanguageMenuSub: () => null }))

import { AccountMenu } from "@/components/account-menu"

afterEach(() => cleanup())

describe("AccountMenu", () => {
  it("renders the account trigger with the user's initials", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AccountMenu />
      </NextIntlClientProvider>
    )
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.onboarding.accountMenu,
      })
    ).toBeDefined()
    expect(screen.getByText("KS")).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- account-menu`
Expected: FAIL (module `@/components/account-menu` does not exist).

- [ ] **Step 3: Create `AccountMenu`**

Create `apps/dashboard/components/account-menu.tsx` (the dropdown lifted verbatim from `OnboardingHeader`, minus the `<header>`/`Logo`):
```tsx
"use client"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { LanguageMenuSub } from "@/components/language-menu"
import { OrgSwitchMenuSub } from "@/components/org-switch-menu"
import { authClient } from "@/lib/auth-client"

// Derive at most two initials from the display name, or fall back to the
// first letter of the email address, or "?" if neither is available.
function deriveInitials(name: string, email: string): string {
  if (name.trim().length > 0) {
    return name
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase()
  }
  if (email.length > 0) {
    return (email[0] ?? "").toUpperCase()
  }
  return "?"
}

// The signed-in user's account menu: switch company, change language, sign out.
// Used in the auth/onboarding shell's headerRight slot.
export function AccountMenu() {
  const t = useTranslations("dashboard")
  const router = useRouter()
  const { data: session } = authClient.useSession()

  const name = session?.user?.name ?? ""
  const email = session?.user?.email ?? ""
  const initials = deriveInitials(name, email)

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("onboarding.accountMenu")}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Lets the user switch away from a bare company's onboarding to an
            onboarded one; renders nothing with fewer than two companies. */}
        <OrgSwitchMenuSub />
        <LanguageMenuSub />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 4: Refactor `OnboardingHeader` to use it**

Replace the whole body of `apps/dashboard/components/onboarding/onboarding-header.tsx` with:
```tsx
"use client"

import { useTranslations } from "next-intl"
import { AccountMenu } from "@/components/account-menu"
import { Logo } from "@/components/logo"

export function OnboardingHeader() {
  const t = useTranslations("dashboard")
  return (
    <header className="flex h-14 items-center justify-between px-6">
      <Logo label={t("title")} className="h-8 text-brand" />
      <AccountMenu />
    </header>
  )
}
```
(`deriveInitials`, the session/sign-out logic, and the dropdown imports all moved to `AccountMenu`.)

- [ ] **Step 5: Run the test, expect PASS**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- account-menu`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

```bash
cd /Volumes/development/blueprnt/frontend
bun run turbo typecheck
git add apps/dashboard/components/account-menu.tsx apps/dashboard/components/account-menu.test.tsx apps/dashboard/components/onboarding/onboarding-header.tsx
git commit -m "refactor(auth): extract AccountMenu from OnboardingHeader"
```

---

## Task 2: `RotatingValueLine` + brand i18n

The cross-fading value line for the left panel, and its strings in all five locales.

**Files:**
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`
- Create: `apps/dashboard/components/auth/rotating-value-line.tsx`
- Test: `apps/dashboard/components/auth/rotating-value-line.test.tsx`

**Interfaces:**
- Consumes: `dashboard.auth.brand.{tagline,value1,value2,value3}`.
- Produces (Task 3): `<RotatingValueLine />` — renders one brand value line, cross-fading on a timer (static under reduced motion). No props.

- [ ] **Step 1: Add the i18n keys**

In each locale file, add a `brand` object inside `dashboard.auth` (a sibling of `signIn`/`twoFactor`). Use these blocks verbatim (en authoritative; Nordic are drafts for native review).

`en.json`:
```json
"brand": {
  "tagline": "The job architecture that creates value.",
  "value1": "Evaluate roles, not people.",
  "value2": "Pay decisions you can defend.",
  "value3": "Built for EU pay transparency."
}
```
`sv.json`:
```json
"brand": {
  "tagline": "Jobbarkitekturen som skapar värde.",
  "value1": "Värdera roller, inte personer.",
  "value2": "Lönebeslut du kan försvara.",
  "value3": "Byggd för EU:s lönetransparens."
}
```
`nb.json`:
```json
"brand": {
  "tagline": "Jobbarkitekturen som skaper verdi.",
  "value1": "Vurder roller, ikke personer.",
  "value2": "Lønnsbeslutninger du kan forsvare.",
  "value3": "Bygget for EUs lønnstransparens."
}
```
`da.json`:
```json
"brand": {
  "tagline": "Jobarkitekturen, der skaber værdi.",
  "value1": "Vurder roller, ikke personer.",
  "value2": "Lønbeslutninger, du kan forsvare.",
  "value3": "Bygget til EU's løngennemsigtighed."
}
```
`fi.json`:
```json
"brand": {
  "tagline": "Työarkkitehtuuri, joka luo arvoa.",
  "value1": "Arvioi rooleja, älä ihmisiä.",
  "value2": "Palkkapäätökset, jotka voit perustella.",
  "value3": "Rakennettu EU:n palkka-avoimuutta varten."
}
```

- [ ] **Step 2: Run the parity test, expect PASS**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter @workspace/i18n test`
Expected: PASS (all five locales have identical key sets).

- [ ] **Step 3: Write the failing component test**

Create `apps/dashboard/components/auth/rotating-value-line.test.tsx`:
```tsx
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { RotatingValueLine } from "./rotating-value-line"

afterEach(() => cleanup())

describe("RotatingValueLine", () => {
  it("renders the first brand value line", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RotatingValueLine />
      </NextIntlClientProvider>
    )
    expect(
      screen.getByText(messages.dashboard.auth.brand.value1)
    ).toBeDefined()
  })
})
```

- [ ] **Step 4: Run the test, expect FAIL**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- rotating-value-line`
Expected: FAIL (module does not exist).

- [ ] **Step 5: Implement `RotatingValueLine`**

Read `docs/ui-animation.md` first. Create `apps/dashboard/components/auth/rotating-value-line.tsx`:
```tsx
"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

// Brand value lines for the left auth panel. Numbered keys (not an array) keep
// next-intl access simple and type-checked.
const VALUE_KEYS = ["value1", "value2", "value3"] as const
const ROTATE_MS = 6000

// Opacity cross-fade only (no layout/scale animation, per docs/ui-animation.md).
// Under reduced motion it shows the first line and does not rotate. The min
// height reserves space so the panel never reflows as lines change.
export function RotatingValueLine() {
  const t = useTranslations("dashboard.auth.brand")
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % VALUE_KEYS.length)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [reduce])

  return (
    <div className="min-h-[3.5rem]">
      <AnimatePresence mode="wait">
        <motion.p
          key={VALUE_KEYS[index]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="font-semibold text-2xl leading-snug"
        >
          {t(VALUE_KEYS[index])}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 6: Run the test, expect PASS**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- rotating-value-line`
Expected: PASS.

- [ ] **Step 7: Typecheck + commit**

```bash
cd /Volumes/development/blueprnt/frontend
bun run turbo typecheck
git add packages/i18n/messages apps/dashboard/components/auth/rotating-value-line.tsx apps/dashboard/components/auth/rotating-value-line.test.tsx
git commit -m "feat(auth): add brand value lines and the rotating value-line component"
```

---

## Task 3: `AuthShell` + `BrandPanel`

The split frame and its branded left panel.

**Files:**
- Create: `apps/dashboard/components/auth/brand-panel.tsx`
- Create: `apps/dashboard/components/auth/auth-shell.tsx`
- Test: `apps/dashboard/components/auth/auth-shell.test.tsx`

**Interfaces:**
- Consumes (Task 2): `<RotatingValueLine />`; `dashboard.auth.brand.tagline`; the `Logo` component.
- Produces (Tasks 4, 5): `<AuthShell children headerRight? footer? contentClassName? />`. `children` = right-panel content (centered, `max-w-sm` by default; pass `contentClassName="max-w-xl"` to widen). `headerRight` = top-right node (account menu). `footer` = bottom node (step dots).

- [ ] **Step 1: Create `BrandPanel`**

Create `apps/dashboard/components/auth/brand-panel.tsx`:
```tsx
import { useTranslations } from "next-intl"
import { Logo } from "@/components/logo"
import { RotatingValueLine } from "@/components/auth/rotating-value-line"

// The branded left half of the auth/onboarding shell. Desktop only (the shell
// hides it below lg). Fixed dark surface regardless of app theme, so the
// treatment is stable across both auth and onboarding. Wordmark top, the
// rotating value line and tagline at the bottom (the midday composition).
export function BrandPanel() {
  const t = useTranslations("dashboard")
  return (
    <div className="hidden flex-col justify-between bg-neutral-950 p-12 text-neutral-100 lg:flex lg:w-1/2">
      <Logo label={t("title")} className="h-8 text-brand" />
      <div className="flex flex-col gap-3">
        <RotatingValueLine />
        <p className="text-neutral-400 text-sm">{t("auth.brand.tagline")}</p>
      </div>
    </div>
  )
}
```
Note: `bg-neutral-950` / `text-neutral-100` / `text-neutral-400` are fixed-dark palette colors. If the `neutral` palette is not in the Tailwind theme, substitute the nearest available fixed-dark scale (e.g. `zinc`); confirm the panel renders dark with light text.

- [ ] **Step 2: Write the failing shell test**

Create `apps/dashboard/components/auth/auth-shell.test.tsx`:
```tsx
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { AuthShell } from "./auth-shell"

function renderShell(props: Parameters<typeof AuthShell>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthShell {...props} />
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

describe("AuthShell", () => {
  it("renders its children", () => {
    renderShell({ children: <div data-testid="content" /> })
    expect(screen.getByTestId("content")).toBeDefined()
  })

  it("renders the headerRight and footer slots when provided", () => {
    renderShell({
      children: <div />,
      headerRight: <div data-testid="hr" />,
      footer: <div data-testid="ft" />,
    })
    expect(screen.getByTestId("hr")).toBeDefined()
    expect(screen.getByTestId("ft")).toBeDefined()
  })

  it("omits the slots when not provided", () => {
    renderShell({ children: <div /> })
    expect(screen.queryByTestId("hr")).toBeNull()
    expect(screen.queryByTestId("ft")).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test, expect FAIL**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- auth-shell`
Expected: FAIL (module does not exist).

- [ ] **Step 4: Implement `AuthShell`**

Create `apps/dashboard/components/auth/auth-shell.tsx`:
```tsx
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { BrandPanel } from "@/components/auth/brand-panel"
import { Logo } from "@/components/logo"

// The shared split-screen frame for sign-in, password, 2FA, and onboarding.
// Left: the branded panel (lg+ only). Right: a vertically centered, card-less
// content column with optional top-right (account menu) and bottom (step dots)
// slots, plus a mobile-only wordmark (the BrandPanel carries the wordmark on
// desktop). Pass contentClassName to widen the content past the default max-w-sm
// (e.g. the onboarding steps).
export function AuthShell({
  children,
  headerRight,
  footer,
  contentClassName,
}: {
  children: ReactNode
  headerRight?: ReactNode
  footer?: ReactNode
  contentClassName?: string
}) {
  const t = useTranslations("dashboard")
  return (
    <div className="flex min-h-svh">
      <BrandPanel />
      <div className="relative flex min-h-svh w-full flex-col lg:w-1/2">
        {headerRight ? (
          <div className="absolute top-4 right-4 z-10">{headerRight}</div>
        ) : null}
        <main className="flex flex-1 flex-col items-center justify-center p-6 md:p-10">
          <div
            className={cn(
              "flex w-full max-w-sm flex-col gap-8",
              contentClassName
            )}
          >
            <Logo
              label={t("title")}
              className="h-10 self-center text-brand lg:hidden"
            />
            {children}
          </div>
        </main>
        {footer ? <div className="pb-8">{footer}</div> : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the test, expect PASS**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- auth-shell`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck + commit**

```bash
cd /Volumes/development/blueprnt/frontend
bun run turbo typecheck
git add apps/dashboard/components/auth/brand-panel.tsx apps/dashboard/components/auth/auth-shell.tsx apps/dashboard/components/auth/auth-shell.test.tsx
git commit -m "feat(auth): add the AuthShell split layout and BrandPanel"
```

---

## Task 4: Move the auth screens onto `AuthShell` (drop the cards)

Sign-in, forgot, reset, and 2FA setup adopt the shell and lose their `Card`.

**Files:**
- Modify: `apps/dashboard/components/auth/sign-in-screen.tsx`
- Modify: `apps/dashboard/components/auth/email-password-form.tsx`
- Modify: `apps/dashboard/app/forgot-password/page.tsx`
- Modify: `apps/dashboard/app/reset-password/page.tsx`
- Modify: `apps/dashboard/components/auth/two-factor-setup.tsx`
- Tests: the existing `email-password-form.test.tsx`, `reset-password.test.tsx`, `two-factor-setup.test.tsx`, `two-factor-challenge.test.tsx` must still pass.

**Interfaces:**
- Consumes (Task 3): `<AuthShell>`.

- [ ] **Step 1: Sign-in screen → AuthShell**

Replace `apps/dashboard/components/auth/sign-in-screen.tsx` with:
```tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { AuthShell } from "@/components/auth/auth-shell"
import { EmailPasswordForm } from "@/components/auth/email-password-form"
import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge"
import { authClient } from "@/lib/auth-client"

// Rendered at / for unauthenticated visitors. Email + password first; if Better
// Auth requires a second factor (twoFactorRedirect), swap to the challenge
// before the session is created. On full success the reactive auth state swaps
// the route to the dashboard shell.
export function SignInScreen() {
  const router = useRouter()
  const [phase, setPhase] = useState<"credentials" | "challenge">("credentials")

  return (
    <AuthShell>
      {phase === "credentials" ? (
        <EmailPasswordForm
          onSubmit={async ({ email, password }) => {
            const { data, error } = await authClient.signIn.email({
              email,
              password,
            })
            if (error) throw error
            if (
              data !== null &&
              typeof data === "object" &&
              "twoFactorRedirect" in data &&
              data.twoFactorRedirect === true
            ) {
              setPhase("challenge")
              return
            }
            router.push("/")
          }}
        />
      ) : (
        <TwoFactorChallenge onVerified={() => router.push("/")} />
      )}
    </AuthShell>
  )
}
```
(The `<main>`/`Logo`/`max-w-sm` wrapper and the `useTranslations`/`Logo` imports are gone; `AuthShell` provides them.)

- [ ] **Step 2: Email-password form → card-less heading block**

In `apps/dashboard/components/auth/email-password-form.tsx`: remove the `Card`/`CardContent`/`CardDescription`/`CardHeader`/`CardTitle` import (lines 4-10). Replace the returned JSX (the `<Card>...</Card>`) with:
```tsx
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-semibold text-xl">{t("signIn.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("signIn.description")}
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* the two FormFields, the forgot-password Link, the error <p>, and
              the SubmitButton stay EXACTLY as they are today */}
        </form>
      </Form>
    </div>
  )
```
Keep everything inside `<form>` unchanged (the email + password `FormField`s, the `/forgot-password` `Link`, the `error` paragraph, the `SubmitButton`).

- [ ] **Step 3: Reset-password page → AuthShell, card-less**

In `apps/dashboard/app/reset-password/page.tsx`: remove the `Card*` import and the `Logo` import; add `import { AuthShell } from "@/components/auth/auth-shell"`. Drop the unused `tApp` translator. Replace the returned `<main>...</main>` with:
```tsx
  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-semibold text-xl">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        {token === null ? (
          <p role="alert" className="text-destructive text-sm">
            {t("missingToken")}
          </p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* the password FormField, the error <p>, and the SubmitButton
                  stay EXACTLY as they are today */}
            </form>
          </Form>
        )}
      </div>
    </AuthShell>
  )
```

- [ ] **Step 4: Forgot-password page → AuthShell, card-less**

In `apps/dashboard/app/forgot-password/page.tsx`: remove the `Card*` and `Logo` imports; add `import { AuthShell } from "@/components/auth/auth-shell"`. Drop the unused `tApp` translator EXCEPT it is still used for `tApp("auth.email")` on the field label, so keep `tApp`. Replace the returned `<main>...</main>` with:
```tsx
  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-semibold text-xl">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        {submitted ? (
          <div className="space-y-6">
            <p className="text-muted-foreground text-sm" role="status">
              {t("confirmation")}
            </p>
            <Link
              href="/"
              className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            >
              {t("backToSignIn")}
            </Link>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* the email FormField, the SubmitButton, and the backToSignIn
                  Link stay EXACTLY as they are today */}
            </form>
          </Form>
        )}
      </div>
    </AuthShell>
  )
```

- [ ] **Step 5: 2FA setup → replace `Shell` with `AuthShell`**

In `apps/dashboard/components/auth/two-factor-setup.tsx`: delete the local `Shell` function (the one wrapping `<main>`/`Logo`) and the now-unused `Logo` import; add `import { AuthShell } from "@/components/auth/auth-shell"`. Replace every `<Shell>...</Shell>` in the step renders with `<AuthShell>...</AuthShell>` (the inner step content, which already has its own per-step heading, is unchanged).

- [ ] **Step 6: Run the affected tests + the full dashboard suite**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test`
Expected: PASS. These suites query by label/role/text, so dropping the `Card` should not break them. If a test asserted a card-specific structure, update that assertion (do not change behavior). If `getByLabelText`/`getByRole` for a heading changed (e.g. a test looked for a `CardTitle`), point it at the new `<h1>` text instead.

- [ ] **Step 7: Typecheck, format, commit**

```bash
cd /Volumes/development/blueprnt/frontend
bun run turbo typecheck
bun run format
git add apps/dashboard/components/auth/sign-in-screen.tsx apps/dashboard/components/auth/email-password-form.tsx apps/dashboard/app/forgot-password/page.tsx apps/dashboard/app/reset-password/page.tsx apps/dashboard/components/auth/two-factor-setup.tsx
git commit -m "feat(auth): move the auth screens onto AuthShell and drop the card chrome"
```

---

## Task 5: Move the onboarding wizard onto `AuthShell`

The wizard renders inside the shell: dots in `footer`, account menu in `headerRight`. `OnboardingHeader` is retired.

**Files:**
- Modify: `apps/dashboard/components/onboarding/onboarding-wizard.tsx`
- Delete: `apps/dashboard/components/onboarding/onboarding-header.tsx`
- Tests: update `apps/dashboard/components/onboarding/onboarding-wizard.test.tsx` for the new frame; the full suite must pass.

**Interfaces:**
- Consumes (Task 1, 3): `<AccountMenu />`, `<AuthShell>`.

- [ ] **Step 1: Render the wizard inside `AuthShell`**

In `apps/dashboard/components/onboarding/onboarding-wizard.tsx`:
- Remove `import { OnboardingHeader } from "..."`; add `import { AccountMenu } from "@/components/account-menu"` and `import { AuthShell } from "@/components/auth/auth-shell"`.
- Replace the main return (the `<><OnboardingHeader /><main ...>...</main></>` block) with:
```tsx
  return (
    <AuthShell headerRight={<AccountMenu />} contentClassName="max-w-xl">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {step.render(ctx)}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  )
```
  ...wait — the dots belong in the shell `footer`. Render them via the slot instead of inside children. Pass `footer={<OnboardingDots steps={STEPS.map(({ key, dotLabelKey }) => ({ key, label: t(dotLabelKey) }))} activeIndex={current} maxReachedIndex={frontier} navLabel={t("dots.navLabel")} onSelect={(index) => { setBackTo(index < frontier ? index : null); setAcked((prev) => Math.max(prev ?? 0, index)) }} />}` on the `AuthShell`. So the final call is:
```tsx
  return (
    <AuthShell
      headerRight={<AccountMenu />}
      contentClassName="max-w-xl"
      footer={
        <OnboardingDots
          steps={STEPS.map(({ key, dotLabelKey }) => ({
            key,
            label: t(dotLabelKey),
          }))}
          activeIndex={current}
          maxReachedIndex={frontier}
          navLabel={t("dots.navLabel")}
          onSelect={(index) => {
            setBackTo(index < frontier ? index : null)
            setAcked((prev) => Math.max(prev ?? 0, index))
          }}
        />
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {step.render(ctx)}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  )
```

- [ ] **Step 2: Update the two early-return branches (waiting / loading)**

The non-admin "waiting for admin" branch and the `derived === -1` loading branch currently return `<><OnboardingHeader /><main ...>...</main></>`. Change each to render inside the shell:
```tsx
  // non-admin waiting branch:
  return (
    <AuthShell headerRight={<AccountMenu />}>
      <p className="text-center text-muted-foreground">{t("waitingForAdmin")}</p>
    </AuthShell>
  )
```
```tsx
  // loading branch (derived === -1):
  return (
    <AuthShell headerRight={<AccountMenu />}>
      <Spinner aria-label={t("loading")} />
    </AuthShell>
  )
```
(Keep the existing `Spinner` import; drop the now-unused `min-h-[calc(100svh-3.5rem)]` main wrappers.)

- [ ] **Step 3: Delete `OnboardingHeader`**

```bash
cd /Volumes/development/blueprnt/frontend
git rm apps/dashboard/components/onboarding/onboarding-header.tsx
```
Then grep for stragglers and remove any remaining import:
`grep -rn "onboarding-header\|OnboardingHeader" apps/dashboard` should return nothing.

- [ ] **Step 4: Update the onboarding-wizard test**

Open `apps/dashboard/components/onboarding/onboarding-wizard.test.tsx`. It renders `<OnboardingWizard>` and asserts step/dots behavior. Update any assertion or mock tied to the old frame: if it mocked `OnboardingHeader`, replace that with a mock of `@/components/account-menu` (`vi.mock("@/components/account-menu", () => ({ AccountMenu: () => null }))`) and a mock of `@/components/auth/auth-shell` that renders its `children`, `headerRight`, and `footer` (e.g. `vi.mock("@/components/auth/auth-shell", () => ({ AuthShell: (p) => (<div>{p.headerRight}{p.children}{p.footer}</div>) }))`) so the dots/step assertions still resolve. Keep the existing step/dots assertions. Do not weaken what the test verifies.

- [ ] **Step 5: Run the full dashboard suite**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test`
Expected: PASS. Fix any onboarding test still referencing the removed header.

- [ ] **Step 6: Manual layout check (the one thing tests can't cover)**

Run the app (`bun dev` or the project's command) and walk: sign-in, forgot, reset, 2FA setup, and every onboarding step (name, country, industry, families) at desktop and mobile widths. Confirm: the left panel shows on `lg+` and hides on mobile (logo appears on top instead); the right content is centered and not cramped. If an onboarding step's internal layout (e.g. the industry grid) overflows the narrower right panel, make a MINIMAL responsive tweak to that step's own container (do not redesign the step); note it in the report.

- [ ] **Step 7: Typecheck, format, commit**

```bash
cd /Volumes/development/blueprnt/frontend
bun run turbo typecheck
bun run format
git add apps/dashboard/components/onboarding/onboarding-wizard.tsx apps/dashboard/components/onboarding/onboarding-wizard.test.tsx
git commit -m "feat(onboarding): render the onboarding wizard in the shared AuthShell"
```

---

## Self-Review

**1. Spec coverage:**
- Shared `AuthShell` split layout: Task 3. Covered.
- Left brand panel (fixed dark, wordmark + tagline + rotating value line): Tasks 2-3. Covered.
- Card-less auth forms with heading block: Task 4. Covered.
- Onboarding adopts the full split (dots → footer, account menu → headerRight, header retired): Tasks 1, 5. Covered.
- 2FA challenge/setup, forgot/reset all on the shell: Task 4. Covered.
- Mobile collapse + mobile logo: Task 3 (`BrandPanel` `lg`-only, shell mobile logo). Covered.
- Animation opacity-only + reduced-motion: Task 2. Covered.
- i18n 5 locales: Task 2. Covered.
- Tests in same commit: every task. Covered.

**2. Placeholder scan:** The form-internals are described as "stays EXACTLY as today" with the surrounding wrapper shown in full, because the change is purely the wrapper; the implementer keeps the unchanged inner JSX rather than re-typing it. The `bg-neutral-950` palette note and the onboarding-step overflow check are concrete verification steps with a stated fallback, not unfinished work. No TBD/TODO.

**3. Type consistency:** `AuthShell` props (`children`, `headerRight?`, `footer?`, `contentClassName?`) are used consistently in Tasks 4-5. `AccountMenu` (no props) and `RotatingValueLine` (no props) match their consumers. The `dashboard.auth.brand.{tagline,value1,value2,value3}` keys are produced in Task 2 and consumed in Tasks 2-3.

**Known risk to watch:** the onboarding steps were designed for a `max-w-2xl` full-width frame; in the `max-w-xl` split right panel a step may need a minor responsive tweak (Task 5 Step 6). That is the one place that may need a small unplanned edit; it is flagged, not hidden.

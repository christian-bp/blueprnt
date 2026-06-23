# Forgot-Password Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-out user reset their own password: a "Forgot your password?" link on the sign-in card, leading to a `/forgot-password` page that emails them a reset link.

**Architecture:** Frontend only. Reuse the existing `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })` (already used by admins), the `sendResetPassword` backend hook, the reset email, and the working `/reset-password` page. Add one new page, one link, i18n keys, and tests. No backend changes.

**Tech Stack:** Next.js App Router (client components), Better Auth client (`@/lib/auth-client`), shadcn UI (`Card`/`Field`/`Input`/`Button`), next-intl, `next/link`, Vitest + Testing Library.

## Global Constraints

- **Do NOT commit per task.** Per CLAUDE.md, leave all changes uncommitted in the working tree for review; commit only after explicit approval, as one focused `feat` commit. Each task below ends at "tests pass," not at a commit.
- **No worktrees / feature branches** (CLAUDE.md): work directly in the main checkout's working tree.
- **i18n English-first:** add keys to `packages/i18n/messages/en.json` first (the `Messages` type derives from it), then mirror to `sv`, `nb`, `da`, `fi`. The parity test fails if any locale's key set differs.
- **No hardcoded user-facing text** — all copy via `dashboard.auth.*` keys. **No em dashes** in any copy. sv/nb/da/fi strings are drafts; flag for native review.
- **Enumeration-safe:** the forgot-password page shows one neutral confirmation regardless of whether the email exists, the request succeeds, or it is rate-limited (a thrown request is swallowed).
- **Reuse `redirectTo: "/reset-password"`** verbatim (matches the admin call sites); do not change routing or the reset page.
- **Internal links use `next/link`** (the dashboard convention).
- When the work is eventually committed, the pre-commit hook (Biome + full `turbo typecheck` + full `turbo test`) must pass; never `--no-verify`.

## File Structure

- `packages/i18n/messages/{en,sv,nb,da,fi}.json` — **modify**: add `dashboard.auth.forgotPasswordLink` and the `dashboard.auth.forgotPassword` object.
- `apps/dashboard/app/forgot-password/page.tsx` — **create**: the forgot-password page (email form -> request reset -> neutral confirmation).
- `apps/dashboard/app/forgot-password/forgot-password.test.tsx` — **create**: page tests.
- `apps/dashboard/components/auth/email-password-form.tsx` — **modify**: add the "Forgot your password?" link.
- `apps/dashboard/components/auth/email-password-form.test.tsx` — **create**: assert the link renders and points to `/forgot-password`.

---

### Task 1: Add the forgot-password i18n keys (all five locales)

**Files:**
- Modify: `packages/i18n/messages/en.json` (the `dashboard.auth` block, ~lines 411-434)
- Modify: `packages/i18n/messages/sv.json`, `nb.json`, `da.json`, `fi.json` (same block)

**Interfaces:**
- Produces: `dashboard.auth.forgotPasswordLink: string` and `dashboard.auth.forgotPassword.{title,description,cta,confirmation,backToSignIn}: string`, used by Tasks 2 and 3. The email field reuses the existing `dashboard.auth.email`.

- [ ] **Step 1: Confirm the parity baseline.**

Run: `bun run --filter @workspace/i18n test`
Expected: PASS.

- [ ] **Step 2: Edit `en.json`.** Inside the `dashboard.auth` object, add `forgotPasswordLink` after `password`, and a `forgotPassword` object after the `signIn` object (use the Edit tool, not shell). The `dashboard.auth` block becomes:

```json
    "auth": {
      "loading": "Checking your session",
      "email": "Email",
      "password": "Password",
      "forgotPasswordLink": "Forgot your password?",
      "signIn": {
        "title": "Sign in",
        "cta": "Sign in",
        "description": "Enter your email below to sign in to your organization"
      },
      "forgotPassword": {
        "title": "Reset your password",
        "description": "Enter your account email and we'll send you a link to choose a new password.",
        "cta": "Send reset link",
        "confirmation": "If an account exists for that email, a reset link is on its way. Check your inbox.",
        "backToSignIn": "Back to sign in"
      },
      "invitation": {
        "title": "Organization invitation",
        "accept": "Accept invitation",
        "signInFirst": "Sign in to accept this invitation."
      },
      "resetPassword": {
        "title": "Set your password",
        "description": "Choose a password to finish setting up your account.",
        "passwordLabel": "New password",
        "cta": "Set password",
        "missingToken": "This link is invalid or has expired. Ask an administrator to resend your invitation.",
        "error": "Something went wrong. Try again."
      },
      "error": "Something went wrong. Please try again."
    },
```

- [ ] **Step 3: Mirror into `sv.json`** — add the same two keys to its `dashboard.auth` block (Edit tool):

```json
      "forgotPasswordLink": "Glömt lösenordet?",
```
(after `password`), and after its `signIn` object:
```json
      "forgotPassword": {
        "title": "Återställ ditt lösenord",
        "description": "Ange din konto-e-post så skickar vi en länk för att välja ett nytt lösenord.",
        "cta": "Skicka återställningslänk",
        "confirmation": "Om ett konto finns för den e-postadressen är en återställningslänk på väg. Kolla din inkorg.",
        "backToSignIn": "Tillbaka till inloggning"
      },
```

- [ ] **Step 4: Mirror into `nb.json`:**

```json
      "forgotPasswordLink": "Glemt passordet?",
```
and:
```json
      "forgotPassword": {
        "title": "Tilbakestill passordet ditt",
        "description": "Skriv inn e-posten til kontoen din, så sender vi deg en lenke for å velge et nytt passord.",
        "cta": "Send tilbakestillingslenke",
        "confirmation": "Hvis det finnes en konto for den e-posten, er en tilbakestillingslenke på vei. Sjekk innboksen din.",
        "backToSignIn": "Tilbake til innlogging"
      },
```

- [ ] **Step 5: Mirror into `da.json`:**

```json
      "forgotPasswordLink": "Glemt din adgangskode?",
```
and:
```json
      "forgotPassword": {
        "title": "Nulstil din adgangskode",
        "description": "Indtast e-mailen til din konto, så sender vi dig et link til at vælge en ny adgangskode.",
        "cta": "Send nulstillingslink",
        "confirmation": "Hvis der findes en konto for den e-mail, er et nulstillingslink på vej. Tjek din indbakke.",
        "backToSignIn": "Tilbage til login"
      },
```

- [ ] **Step 6: Mirror into `fi.json`:**

```json
      "forgotPasswordLink": "Unohditko salasanasi?",
```
and:
```json
      "forgotPassword": {
        "title": "Nollaa salasanasi",
        "description": "Anna tilisi sähköpostiosoite, niin lähetämme linkin uuden salasanan valitsemiseen.",
        "cta": "Lähetä palautuslinkki",
        "confirmation": "Jos kyseiselle sähköpostille on tili, palautuslinkki on tulossa. Tarkista postilaatikkosi.",
        "backToSignIn": "Takaisin kirjautumiseen"
      },
```

- [ ] **Step 7: Verify parity holds.**

Run: `bun run --filter @workspace/i18n test`
Expected: PASS (all five locales now share the new key set). Do not commit (Global Constraints).

---

### Task 2: The `/forgot-password` page and its tests

**Files:**
- Create: `apps/dashboard/app/forgot-password/page.tsx`
- Test: `apps/dashboard/app/forgot-password/forgot-password.test.tsx`

**Interfaces:**
- Consumes (Task 1): `dashboard.auth.forgotPassword.*`, `dashboard.auth.email`. Consumes existing `authClient.requestPasswordReset`, `Logo`, `usePageTitle`.
- Produces: a default-exported `ForgotPasswordPage` route component at `/forgot-password`.

- [ ] **Step 1: Write the failing test** `apps/dashboard/app/forgot-password/forgot-password.test.tsx`:

```tsx
import { fireEvent, render, waitFor, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import en from "@workspace/i18n/messages/en.json"

// next/link needs the Next router context; render it as a plain anchor.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

// vi.mock is hoisted above imports; create the spy via vi.hoisted.
const { requestPasswordReset } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(async () => ({ error: null })),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { requestPasswordReset },
}))

import ForgotPasswordPage from "./page"

const emailLabel = en.dashboard.auth.email
const confirmation = en.dashboard.auth.forgotPassword.confirmation

function renderPage() {
  const { container, unmount } = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ForgotPasswordPage />
    </NextIntlClientProvider>
  )
  return { scope: within(container), unmount }
}

describe("ForgotPasswordPage", () => {
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    requestPasswordReset.mockClear()
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it("requests a reset with the email and redirectTo, then shows the neutral confirmation", async () => {
    const { scope, unmount } = renderPage()
    cleanup = unmount
    const input = scope.getByLabelText(emailLabel) as HTMLInputElement
    fireEvent.change(input, { target: { value: "user@example.com" } })
    fireEvent.submit(input.closest("form") as HTMLFormElement)

    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "user@example.com",
      redirectTo: "/reset-password",
    })
    await waitFor(() => {
      expect(scope.getByText(confirmation)).toBeTruthy()
    })
  })

  it("still shows the confirmation when the request throws (enumeration-safe)", async () => {
    requestPasswordReset.mockRejectedValueOnce(new Error("boom"))
    const { scope, unmount } = renderPage()
    cleanup = unmount
    const input = scope.getByLabelText(emailLabel) as HTMLInputElement
    fireEvent.change(input, { target: { value: "ghost@example.com" } })
    fireEvent.submit(input.closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(scope.getByText(confirmation)).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `bun run --filter dashboard test -- forgot-password`
Expected: FAIL (cannot resolve `./page`).

- [ ] **Step 3: Write `apps/dashboard/app/forgot-password/page.tsx`:**

```tsx
"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { type FormEvent, useState } from "react"
import { Logo } from "@/components/logo"
import { usePageTitle } from "@/hooks/use-page-title"
import { authClient } from "@/lib/auth-client"

export default function ForgotPasswordPage() {
  const t = useTranslations("dashboard.auth.forgotPassword")
  const tApp = useTranslations("dashboard")
  usePageTitle(t("title"))
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const email = String(data.get("email") ?? "")
    setPending(true)
    // Enumeration-safe: show the same confirmation whether the request
    // succeeds, the email is unknown, or it is rate-limited. We never reveal
    // which addresses are registered, so a thrown error is swallowed here.
    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      })
    } catch {
      // intentionally ignored (enumeration-safe)
    } finally {
      setSubmitted(true)
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo label={tApp("title")} className="h-10 self-center text-brand" />
        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <FieldGroup>
                <p className="text-muted-foreground text-sm" role="status">
                  {t("confirmation")}
                </p>
                <Link
                  href="/"
                  className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                >
                  {t("backToSignIn")}
                </Link>
              </FieldGroup>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">{tApp("auth.email")}</FieldLabel>
                    <Input id="email" name="email" type="email" required />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={pending}>
                      {t("cta")}
                    </Button>
                  </Field>
                  <Link
                    href="/"
                    className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                  >
                    {t("backToSignIn")}
                  </Link>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `bun run --filter dashboard test -- forgot-password`
Expected: PASS (both cases: success and thrown-request both reach the confirmation; `requestPasswordReset` called with the email + `redirectTo`).

- [ ] **Step 5: Typecheck the app.**

Run: `bun run --filter dashboard typecheck`
Expected: PASS. Do not commit (Global Constraints).

---

### Task 3: The "Forgot your password?" link on the sign-in form

**Files:**
- Modify: `apps/dashboard/components/auth/email-password-form.tsx`
- Test: `apps/dashboard/components/auth/email-password-form.test.tsx`

**Interfaces:**
- Consumes (Task 1): `dashboard.auth.forgotPasswordLink`.
- Produces: a `/forgot-password` link rendered inside the sign-in card.

- [ ] **Step 1: Write the failing test** `apps/dashboard/components/auth/email-password-form.test.tsx`:

```tsx
import { render, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"
import en from "@workspace/i18n/messages/en.json"

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

import { EmailPasswordForm } from "./email-password-form"

describe("EmailPasswordForm", () => {
  it("renders a forgot-password link pointing to /forgot-password", () => {
    const { container, unmount } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <EmailPasswordForm onSubmit={async () => {}} />
      </NextIntlClientProvider>
    )
    const scope = within(container)
    const link = scope.getByRole("link", {
      name: en.dashboard.auth.forgotPasswordLink,
    }) as HTMLAnchorElement
    expect(link.getAttribute("href")).toBe("/forgot-password")
    unmount()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `bun run --filter dashboard test -- email-password-form`
Expected: FAIL (no link with that name).

- [ ] **Step 3: Edit `apps/dashboard/components/auth/email-password-form.tsx`.** Add the `next/link` import at the top with the other imports:

```tsx
import Link from "next/link"
```

Then add the link as a row in the `FieldGroup`, immediately after the password `Field` and before the `{error ? ... }` block:

```tsx
            <Link
              href="/forgot-password"
              className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            >
              {t("forgotPasswordLink")}
            </Link>
```

(For reference, the password `Field` it follows is:
```tsx
            <Field>
              <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
              <Input id="password" name="password" type="password" required />
            </Field>
```
and `t` is `useTranslations("dashboard.auth")`, so `t("forgotPasswordLink")` resolves to the Task 1 key.)

- [ ] **Step 4: Run the test to verify it passes.**

Run: `bun run --filter dashboard test -- email-password-form`
Expected: PASS.

- [ ] **Step 5: Verify the full app suite + typecheck (no regressions).**

Run: `bun run --filter dashboard test` then `bun run --filter dashboard typecheck`
Expected: both PASS. Do not commit (Global Constraints).

---

### Final: review and commit

- [ ] **Run the full monorepo gate** (mirrors the pre-commit hook):

Run: `bun run typecheck && bun run test`
Expected: all packages PASS (especially `@workspace/i18n` parity and `dashboard`).

- [ ] **Manual smoke (optional but recommended):** with `bun dev` running, open `/`, confirm the "Forgot your password?" link appears, click it to reach `/forgot-password`, submit an email, and confirm the neutral confirmation renders and "Back to sign in" returns to `/`.

- [ ] **Present the full diff for review, then commit after approval** as one focused commit, e.g. `feat(auth): add a user-facing forgot-password flow`, body noting it reuses the existing reset client/hook/page and that sv/nb/da/fi copy is a draft pending native review. Do NOT commit before the review (Global Constraints), and never `--no-verify`.

## Self-Review

**1. Spec coverage:**
- "Forgot your password?" link on sign-in -> Task 3. ✓
- `/forgot-password` page (root-level, unauthenticated, mirrors reset page) -> Task 2. ✓
- Enumeration-safe confirmation (same message on success/unknown/rate-limit/throw) -> Task 2 page (`finally { setSubmitted(true) }`, swallowed catch) + Task 2 test (the throw case). ✓
- Reuse `requestPasswordReset({ email, redirectTo: "/reset-password" })` -> Task 2 page + test assertion. ✓
- i18n keys, en-first, all 5 locales, drafts flagged -> Task 1. ✓
- Tests for page and link -> Tasks 2 and 3. ✓
- Out of scope (no backend/email/reset-page/rate-limit/locale changes) -> respected; only the 5 files in File Structure are touched. ✓
- No-commit-per-task / leave uncommitted for review -> Global Constraints + each task ends at "tests pass" + Final section. ✓

**2. Placeholder scan:** No TBD/TODO/"handle errors"/"similar to". Every code step shows complete content; all copy strings are literal. ✓

**3. Type consistency:** `dashboard.auth.forgotPassword.{title,description,cta,confirmation,backToSignIn}` and `dashboard.auth.forgotPasswordLink` defined in Task 1 are the exact keys read in Task 2 (`t(...)` scoped to `dashboard.auth.forgotPassword`, `tApp("auth.email")`) and Task 3 (`t("forgotPasswordLink")` scoped to `dashboard.auth`). The email field reuses the existing `dashboard.auth.email`. `authClient.requestPasswordReset({ email, redirectTo })` matches the signature already used in `components/admin/*`. ✓

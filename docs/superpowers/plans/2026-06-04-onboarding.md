# Onboarding Implementation Plan: First Login to Working Evaluation Model

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-time admin signs in, creates the workspace, fills the company profile, and sets up the evaluation model (standardmall template or from scratch) with embedded AI assistance, then lands in the dashboard.

**Architecture:** A reactive onboarding gate inside the existing `<Authenticated>` swap reads one status query and renders the wizard until workspace + profile + model exist. Model seeding is one org-scoped admin mutation per path. AI runs as background Convex actions (mutation inserts a `generating` suggestion, `ctx.scheduler.runAfter(0, ...)` runs the action, an internal mutation persists the result); the reactive suggestions query updates the UI. EU model (Mistral) called directly via AI SDK v6; never Vercel AI Gateway (no EU pinning, ADR-0001).

**Tech Stack:** Convex `^1.40` (existing wrappers in `convex/lib/functions.ts`), Better Auth org plugin (already configured, `creatorRole: "admin"`), AI SDK `ai@^6.0.35` + `@ai-sdk/mistral@^3` + `zod@^4`, Next.js 16 dashboard (client components + `convex/react`), Vitest 4 + convex-test (edge-runtime), `@workspace/i18n` (en base + sv/nb/da/fi mirrors).

**Spec:** `docs/superpowers/specs/2026-06-04-onboarding-design.md`. Read it before starting.

**Conventions for every task:**
- Code style matches Biome config: no semicolons (`asNeeded`), double quotes, 2-space indent. All code and comments in English. Never an em dash in any text.
- All commands run from the repo root unless stated. Use `bun run test`, never `bun test`.
- Commit messages use conventional prefixes. The pre-commit hook must pass; never `--no-verify`.
- Backend never returns display text: errors are `ConvexError({ code })` with an `errors.*` i18n key (see `convex/lib/errors.ts`).
- New i18n strings: add to `packages/i18n/messages/en.json` FIRST, then mirror the same keys to `sv`, then to `nb/da/fi` as machine drafts (translate the sv value; flag "machine-translated drafts for native review" in the commit message). The parity test fails on any key-set mismatch.
- UI never shows a weight as a number; only `model.importance.*` labels. UI text about bands states explicitly that Band 1 is highest.
- If a verbatim API in this plan disagrees with current official docs at implementation time, the docs win; note the deviation in the commit message. Key links: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data , https://ai-sdk.dev/docs/reference/ai-sdk-core/output , https://docs.convex.dev/scheduling/scheduled-functions , https://www.better-auth.com/docs/plugins/organization

---

## Task 1: Component query `listMembershipsForUser`

The onboarding status query must find the signed-in user's workspace before any org-scoped call is possible. The auth component's `member` table has a `userId` index (`convex/betterAuth/generatedSchema.ts`).

**Files:**
- Modify: `packages/backend/convex/betterAuth/membership.ts`
- Test: `packages/backend/convex/betterAuth/membership.test.ts`

- [ ] **Step 1: Write the failing test** (add a second `describe` block as a sibling of the existing `describe("membership.getMembership", ...)` block; the file already imports `describe/expect/it`, `components`, and `initConvexTest`)

```ts
describe("membership.listMembershipsForUser", () => {
  it("lists the user's memberships with org names and is empty for strangers", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role: "admin" }
    )

    const memberships = await t.query(
      components.betterAuth.membership.listMembershipsForUser,
      { userId }
    )
    expect(memberships).toEqual([
      { organizationId: orgId, organizationName: "Acme", role: "admin" },
    ])

    const none = await t.query(
      components.betterAuth.membership.listMembershipsForUser,
      { userId: "someone-else" }
    )
    expect(none).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/backend && bun run test -- membership`
Expected: FAIL ("Could not find function" for listMembershipsForUser)

- [ ] **Step 3: Implement the component query** (append to `membership.ts`)

```ts
// Lists every workspace the user belongs to, with the org display name.
// Component function: never internet-exposed; called from the app via
// ctx.runQuery(components.betterAuth.membership.listMembershipsForUser, ...).
export const listMembershipsForUser = query({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      organizationId: v.string(),
      organizationName: v.string(),
      role: v.string(),
    })
  ),
  handler: async (ctx, { userId }) => {
    const members = await ctx.db
      .query("member")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect()
    const result: {
      organizationId: string
      organizationName: string
      role: string
    }[] = []
    for (const member of members) {
      const orgDocId = ctx.db.normalizeId(
        "organization",
        member.organizationId
      )
      if (orgDocId === null) continue
      const org = await ctx.db.get(orgDocId)
      if (org === null) continue
      result.push({
        organizationId: member.organizationId,
        organizationName: org.name,
        role: member.role,
      })
    }
    return result
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/backend && bun run test -- membership`
Expected: PASS (both membership tests)

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/betterAuth/membership.ts packages/backend/convex/betterAuth/membership.test.ts
git commit -m "feat(accounts): list a user's workspace memberships from the auth component"
```

---

## Task 2: `getOnboardingStatus` query

One authed (NOT org-scoped) query the dashboard gate subscribes to. Returns `null` when signed out so the gate can no-op during the auth swap.

**Files:**
- Create: `packages/backend/convex/accounts/onboarding.ts`
- Test: `packages/backend/convex/accounts/onboarding.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedAdmin(t: ReturnType<typeof initConvexTest>) {
  return await t.mutation(components.betterAuth.testing.seedMembership, {
    email: "hr@acme.se",
    name: "HR Person",
    role: "admin",
  })
}

describe("getOnboardingStatus", () => {
  it("returns null when unauthenticated", async () => {
    const t = initConvexTest()
    expect(
      await t.query(api.accounts.onboarding.getOnboardingStatus, {})
    ).toBeNull()
  })

  it("reports no workspace for a member-less user", async () => {
    const t = initConvexTest()
    const status = await t
      .withIdentity({ subject: "user-without-org" })
      .query(api.accounts.onboarding.getOnboardingStatus, {})
    expect(status).toEqual({
      workspace: null,
      profileComplete: false,
      hasModel: false,
    })
  })

  it("walks workspace -> profile -> model as data is filled in", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedAdmin(t)
    const asUser = t.withIdentity({ subject: userId })

    // Workspace exists, no profile row yet (trigger does not run in tests).
    let status = await asUser.query(
      api.accounts.onboarding.getOnboardingStatus,
      {}
    )
    expect(status?.workspace).toEqual({
      orgId,
      name: "Acme",
      role: "admin",
    })
    expect(status?.profileComplete).toBe(false)
    expect(status?.hasModel).toBe(false)

    // Incomplete profile row: still not complete.
    await t.run(async (ctx) => {
      await ctx.db.insert("workspaceProfiles", { orgId, country: "se" })
    })
    status = await asUser.query(
      api.accounts.onboarding.getOnboardingStatus,
      {}
    )
    expect(status?.profileComplete).toBe(false)

    // Complete the profile.
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("workspaceProfiles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (profile === null) throw new Error("profile row missing")
      await ctx.db.patch(profile._id, {
        currency: "SEK",
        language: "sv",
        employeeCount: 25,
        businessType: "saasTech",
      })
    })
    status = await asUser.query(
      api.accounts.onboarding.getOnboardingStatus,
      {}
    )
    expect(status?.profileComplete).toBe(true)
    expect(status?.hasModel).toBe(false)

    // Model exists: onboarding is done.
    await t.run(async (ctx) => {
      await ctx.db.insert("models", { orgId, name: "Standard" })
    })
    status = await asUser.query(
      api.accounts.onboarding.getOnboardingStatus,
      {}
    )
    expect(status?.hasModel).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/backend && bun run test -- onboarding`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the query**

```ts
import { v } from "convex/values"
import { components } from "../_generated/api"
import { query } from "../_generated/server"

// First-run gate for the dashboard. NOT org-scoped: it exists precisely to
// find the user's workspace (or its absence) before any org-scoped call is
// possible. Returns null when signed out so the client gate can no-op.
// V1 assumption: one workspace per user; the first membership wins.
export const getOnboardingStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      workspace: v.union(
        v.null(),
        v.object({
          orgId: v.string(),
          name: v.string(),
          role: v.string(),
        })
      ),
      profileComplete: v.boolean(),
      hasModel: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) return null
    const memberships = await ctx.runQuery(
      components.betterAuth.membership.listMembershipsForUser,
      { userId: identity.subject }
    )
    const first = memberships[0]
    if (first === undefined) {
      return { workspace: null, profileComplete: false, hasModel: false }
    }
    const orgId = first.organizationId
    const profile = await ctx.db
      .query("workspaceProfiles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    const profileComplete =
      profile !== null &&
      typeof profile.country === "string" &&
      typeof profile.currency === "string" &&
      typeof profile.language === "string" &&
      typeof profile.employeeCount === "number" &&
      typeof profile.businessType === "string"
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first()
    return {
      workspace: {
        orgId,
        name: first.organizationName,
        role: first.role,
      },
      profileComplete,
      hasModel: model !== null,
    }
  },
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && bun run test -- onboarding`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/accounts/onboarding.ts packages/backend/convex/accounts/onboarding.test.ts
git commit -m "feat(accounts): onboarding status query for the first-run gate"
```

---

## Task 3: New error codes, audit events, and `errors.*` i18n keys

**Files:**
- Modify: `packages/backend/convex/lib/errors.ts`
- Modify: `packages/backend/convex/lib/audit.ts`
- Modify: `packages/i18n/messages/en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json`

- [ ] **Step 1: Extend ERROR_CODES** (in `errors.ts`, inside the existing object)

```ts
export const ERROR_CODES = {
  notAuthenticated: "errors.notAuthenticated",
  notAMember: "errors.notAMember",
  adminRequired: "errors.adminRequired",
  membershipConflict: "errors.membershipConflict",
  notFound: "errors.notFound",
  invalidInput: "errors.invalidInput",
  modelExists: "errors.modelExists",
  profileIncomplete: "errors.profileIncomplete",
  aiUnavailable: "errors.aiUnavailable",
  aiGenerationFailed: "errors.aiGenerationFailed",
} as const
```

- [ ] **Step 2: Extend AUDIT_EVENTS** (in `audit.ts`, inside the existing object)

```ts
  modelCreated: "model.created",
  modelUpdated: "model.updated",
  aiSuggestionConfirmed: "ai.suggestionConfirmed",
```

- [ ] **Step 3: Add the error label keys to all five message files**

In `en.json` `errors` object (after `notFound`):

```json
    "invalidInput": "Invalid input.",
    "modelExists": "This workspace already has an evaluation model.",
    "profileIncomplete": "Complete the company profile first.",
    "aiUnavailable": "AI is not configured for this environment.",
    "aiGenerationFailed": "The AI suggestion could not be generated."
```

`sv.json`:

```json
    "invalidInput": "Ogiltig indata.",
    "modelExists": "Arbetsytan har redan en värderingsmodell.",
    "profileIncomplete": "Fyll i företagsprofilen först.",
    "aiUnavailable": "AI är inte konfigurerat i den här miljön.",
    "aiGenerationFailed": "AI-förslaget kunde inte genereras."
```

Mirror the same five keys to `nb.json`, `da.json`, `fi.json` as machine drafts translated from the sv values.

- [ ] **Step 4: Run the parity test and typecheck**

Run: `bun run test && bun run typecheck`
Expected: PASS (i18n parity green across all five locales)

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/lib/errors.ts packages/backend/convex/lib/audit.ts packages/i18n/messages/*.json
git commit -m "feat(backend): error codes and audit events for onboarding and AI suggestions"
```

---

## Task 4: Onboarding gate, wizard shell, and chrome i18n keys

**Files:**
- Create: `apps/dashboard/components/onboarding/onboarding-gate.tsx`
- Create: `apps/dashboard/components/onboarding/onboarding-wizard.tsx`
- Modify: `apps/dashboard/app/page.tsx`
- Modify: `packages/i18n/messages/en.json` + mirrors (new `dashboard.onboarding` keys)
- Test: `apps/dashboard/components/onboarding/onboarding-gate.test.tsx`

- [ ] **Step 1: Add the chrome i18n keys**

In `en.json` under `dashboard` (sibling of `nav`), add:

```json
    "onboarding": {
      "title": "Set up your workspace",
      "step": "Step {current} of {total}",
      "loading": "Loading your workspace",
      "waitingForAdmin": "Your workspace is still being set up by an administrator.",
      "steps": {
        "workspace": "Workspace",
        "profile": "Company profile",
        "model": "Evaluation model"
      }
    }
```

`sv.json`:

```json
    "onboarding": {
      "title": "Kom igång med din arbetsyta",
      "step": "Steg {current} av {total}",
      "loading": "Laddar din arbetsyta",
      "waitingForAdmin": "Din arbetsyta håller fortfarande på att sättas upp av en administratör.",
      "steps": {
        "workspace": "Arbetsyta",
        "profile": "Företagsprofil",
        "model": "Värderingsmodell"
      }
    }
```

Mirror to `nb/da/fi` as machine drafts. Run `bun run test` (parity must pass).

- [ ] **Step 2: Write the failing gate test**

```tsx
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const useQueryMock = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))
vi.mock("@/components/dashboard-shell", () => ({
  DashboardShell: () => <div data-testid="shell" />,
}))
vi.mock("@/components/onboarding/onboarding-wizard", () => ({
  OnboardingWizard: () => <div data-testid="wizard" />,
}))

import { OnboardingGate } from "@/components/onboarding/onboarding-gate"

function renderGate() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OnboardingGate />
    </NextIntlClientProvider>
  )
}

describe("OnboardingGate", () => {
  it("shows the wizard while setup is incomplete", () => {
    useQueryMock.mockReturnValue({
      workspace: null,
      profileComplete: false,
      hasModel: false,
    })
    renderGate()
    expect(screen.getByTestId("wizard")).toBeDefined()
  })

  it("shows the dashboard when setup is complete", () => {
    useQueryMock.mockReturnValue({
      workspace: { orgId: "o1", name: "Acme", role: "admin" },
      profileComplete: true,
      hasModel: true,
    })
    renderGate()
    expect(screen.getByTestId("shell")).toBeDefined()
  })
})
```

Run: `cd apps/dashboard && bun run test`
Expected: FAIL (OnboardingGate not found)

- [ ] **Step 3: Implement the gate**

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { DashboardShell } from "@/components/dashboard-shell"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

// First-run gate: holds the user in the onboarding wizard until the
// workspace, company profile, and evaluation model all exist. Reactive:
// each completed step flips the status query and advances the UI.
//
// IMPORTANT: hasModel flips reactively the moment the model row is created,
// which would unmount the wizard mid-flow and skip the model review screen
// and the AI panels. The wizard therefore OWNS the session once it has
// started: it stays mounted (even after hasModel turns true) until it calls
// onFinished. On a later sign-in the session never starts and the dashboard
// renders directly.
export function OnboardingGate() {
  const t = useTranslations("dashboard.onboarding")
  const status = useQuery(api.accounts.onboarding.getOnboardingStatus)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionFinished, setSessionFinished] = useState(false)
  const incomplete =
    status !== undefined &&
    status !== null &&
    (status.workspace === null ||
      !status.profileComplete ||
      !status.hasModel)
  useEffect(() => {
    if (incomplete) setSessionStarted(true)
  }, [incomplete])

  if (status === undefined || status === null) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner aria-label={t("loading")} />
      </main>
    )
  }
  const showWizard = incomplete || (sessionStarted && !sessionFinished)
  if (!showWizard) return <DashboardShell />
  return (
    <OnboardingWizard
      status={status}
      onFinished={() => setSessionFinished(true)}
    />
  )
}
```

- [ ] **Step 4: Implement the wizard shell**

```tsx
"use client"

import { useTranslations } from "next-intl"
import { CompanyProfileStep } from "@/components/onboarding/company-profile-step"
import { CreateWorkspaceStep } from "@/components/onboarding/create-workspace-step"
import { ModelSetupStep } from "@/components/onboarding/model-setup-step"

export interface OnboardingStatus {
  workspace: { orgId: string; name: string; role: string } | null
  profileComplete: boolean
  hasModel: boolean
}

// Typed i18n keys are active (i18n-env.d.ts): the translator only accepts
// literal key unions, so step labels go through a literal-keyed map instead
// of a template string.
const STEP_LABEL_KEYS = [
  "steps.workspace",
  "steps.profile",
  "steps.model",
] as const

export function OnboardingWizard({
  status,
  onFinished,
}: {
  status: OnboardingStatus
  onFinished: () => void
}) {
  const t = useTranslations("dashboard.onboarding")
  const current =
    status.workspace === null ? 1 : !status.profileComplete ? 2 : 3

  // Members who are not admins cannot run setup mutations; tell them to wait.
  if (status.workspace !== null && status.workspace.role !== "admin") {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p className="text-muted-foreground">{t("waitingForAdmin")}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-8 p-6 md:p-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("step", { current, total: STEP_LABEL_KEYS.length })}{" "}
          {t(STEP_LABEL_KEYS[(current - 1) as 0 | 1 | 2])}
        </p>
      </header>
      {current === 1 && <CreateWorkspaceStep />}
      {current === 2 && status.workspace !== null && (
        <CompanyProfileStep orgId={status.workspace.orgId} />
      )}
      {current === 3 && status.workspace !== null && (
        <ModelSetupStep
          orgId={status.workspace.orgId}
          onFinished={onFinished}
        />
      )}
    </main>
  )
}
```

Note: `CreateWorkspaceStep`, `CompanyProfileStep`, `ModelSetupStep` are built in Tasks 5, 6, 10. To keep this task green on its own, create the three files now with their real names, REAL prop signatures, and minimal bodies (full implementations replace the bodies in their tasks). All three placeholder bodies, exactly:

```tsx
"use client"

import { useTranslations } from "next-intl"

export function CreateWorkspaceStep() {
  const t = useTranslations("dashboard.onboarding")
  return <p>{t("steps.workspace")}</p>
}
```

```tsx
"use client"

import { useTranslations } from "next-intl"

export function CompanyProfileStep(_props: { orgId: string }) {
  const t = useTranslations("dashboard.onboarding")
  return <p>{t("steps.profile")}</p>
}
```

```tsx
"use client"

import { useTranslations } from "next-intl"

export function ModelSetupStep(_props: {
  orgId: string
  onFinished: () => void
}) {
  const t = useTranslations("dashboard.onboarding")
  return <p>{t("steps.model")}</p>
}
```

The prop signatures match the final implementations so the wizard compiles unchanged in Tasks 5, 6, and 10.

- [ ] **Step 5: Swap the gate into `page.tsx`**

Replace `<DashboardShell />` inside `<Authenticated>` with `<OnboardingGate />` (and swap the import of `DashboardShell` for `OnboardingGate`).

- [ ] **Step 6: Run tests and typecheck**

Run: `bun run test && bun run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard packages/i18n/messages
git commit -m "feat(dashboard): first-run onboarding gate and wizard shell"
```

---

## Task 5: Create-workspace step

**Files:**
- Modify: `apps/dashboard/components/onboarding/create-workspace-step.tsx`
- Create: `apps/dashboard/lib/slug.ts`
- Modify: `packages/i18n/messages/*.json` (new keys)

- [ ] **Step 1: Add i18n keys** (en, then sv, then mirrors; under `dashboard.onboarding`)

```json
      "workspace": {
        "heading": "Create your workspace",
        "description": "The workspace holds your roles, your evaluation model, and your team.",
        "nameLabel": "Workspace name",
        "namePlaceholder": "e.g. your company name",
        "cta": "Create workspace",
        "error": "The workspace could not be created. Try again."
      }
```

sv:

```json
      "workspace": {
        "heading": "Skapa din arbetsyta",
        "description": "Arbetsytan samlar era roller, er värderingsmodell och ert team.",
        "nameLabel": "Arbetsytans namn",
        "namePlaceholder": "t.ex. ert företagsnamn",
        "cta": "Skapa arbetsyta",
        "error": "Arbetsytan kunde inte skapas. Försök igen."
      }
```

- [ ] **Step 2: Implement the slug helper**

```ts
// Better Auth organizations require a slug; derive one from the name and
// add a random suffix so retries and duplicate names never collide.
export function workspaceSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base.length > 0 ? base : "workspace"}-${suffix}`
}
```

- [ ] **Step 3: Implement the step**

```tsx
"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { authClient } from "@/lib/auth-client"
import { workspaceSlug } from "@/lib/slug"

// Step 1: create the Better Auth organization. The creator becomes admin
// (creatorRole in auth.ts) and the onOrganizationCreate trigger seeds the
// empty workspace profile; the reactive status query then advances the wizard.
export function CreateWorkspaceStep() {
  const t = useTranslations("dashboard.onboarding.workspace")
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        setFailed(false)
        const { error } = await authClient.organization.create({
          name: name.trim(),
          slug: workspaceSlug(name),
        })
        if (error) {
          setFailed(true)
          setPending(false)
        }
        // On success the status query flips reactively; no navigation needed.
      }}
    >
      <div className="space-y-2">
        <h2 className="text-lg font-medium">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="workspace-name">{t("nameLabel")}</Label>
        <Input
          id="workspace-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("namePlaceholder")}
          required
          minLength={2}
        />
      </div>
      {failed && <p className="text-sm text-destructive">{t("error")}</p>}
      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {t("cta")}
      </Button>
    </form>
  )
}
```

(If `@workspace/ui` lacks `label`/`input`, add them with `bunx shadcn@latest add label input` from `packages/ui`, per the repo's shadcn vendor policy.)

- [ ] **Step 4: Verify manually and typecheck**

Run: `bun run typecheck && bun run test`
Expected: PASS. Then with `bun dev` + a seeded user without a workspace (`removeDevUser`/`seedDevUser` only, skip `seedDevWorkspace`), sign in and create a workspace; the wizard should advance to step 2.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard packages/i18n/messages
git commit -m "feat(dashboard): create-workspace onboarding step"
```

---

## Task 6: Company-profile step

Backend exists (`updateWorkspaceProfile`, admin-only, audited). Pure frontend + keys.

**Files:**
- Modify: `apps/dashboard/components/onboarding/company-profile-step.tsx`
- Modify: `packages/i18n/messages/*.json`

- [ ] **Step 1: Add i18n keys** (under `dashboard.onboarding`; en then sv then mirrors)

```json
      "profile": {
        "heading": "Tell us about the company",
        "description": "This shapes the defaults of your evaluation model.",
        "country": "Country",
        "currency": "Currency",
        "language": "Language",
        "employeeCount": "Number of employees",
        "businessType": "Type of business",
        "cta": "Save and continue",
        "countries": { "se": "Sweden", "no": "Norway", "dk": "Denmark", "fi": "Finland", "other": "Other" },
        "languages": { "en": "English", "sv": "Swedish", "nb": "Norwegian", "da": "Danish", "fi": "Finnish" },
        "businessTypes": { "saasTech": "SaaS/tech", "commercial": "Commercial", "ga": "G&A", "operations": "Operations", "other": "Other" }
      }
```

sv (values: "Berätta om företaget", "Det här styr förvalen i er värderingsmodell.", "Land", "Valuta", "Språk", "Antal anställda", "Verksamhetstyp", "Spara och fortsätt", countries: Sverige/Norge/Danmark/Finland/Annat, languages: Engelska/Svenska/Norska/Danska/Finska, businessTypes: SaaS/tech, Kommersiell, G&A, Operations, Annat).

Canonical casing decision: stored country codes are lowercase ISO-3166 alpha-2 ("se", "no", ...), matching the UI values and the test seeds. Never store mixed casing.

- [ ] **Step 2: Implement the step** (selects use the shadcn `select` component; currency options are ISO codes shown as-is: SEK, NOK, DKK, EUR)

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation } from "convex/react"
import { useState } from "react"
import { useTranslations } from "next-intl"

const COUNTRIES = ["se", "no", "dk", "fi", "other"] as const
const CURRENCIES = ["SEK", "NOK", "DKK", "EUR"] as const
const LANGUAGES = ["sv", "en", "nb", "da", "fi"] as const
const BUSINESS_TYPES = [
  "saasTech",
  "commercial",
  "ga",
  "operations",
  "other",
] as const

export function CompanyProfileStep({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.onboarding.profile")
  const update = useMutation(api.accounts.workspace.updateWorkspaceProfile)
  const [country, setCountry] = useState<string>("se")
  const [currency, setCurrency] = useState<string>("SEK")
  const [language, setLanguage] = useState<string>("sv")
  const [employeeCount, setEmployeeCount] = useState("")
  const [businessType, setBusinessType] = useState<string>("saasTech")
  const [pending, setPending] = useState(false)

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        try {
          await update({
            orgId,
            country,
            currency,
            language,
            employeeCount: Number(employeeCount),
            businessType,
          })
        } finally {
          setPending(false)
        }
      }}
    >
      <div className="space-y-2">
        <h2 className="text-lg font-medium">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("country")}</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t(`countries.${code}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("currency")}</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("language")}</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t(`languages.${code}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="employee-count">{t("employeeCount")}</Label>
          <Input
            id="employee-count"
            type="number"
            min={1}
            max={100000}
            value={employeeCount}
            onChange={(event) => setEmployeeCount(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t("businessType")}</Label>
          <Select value={businessType} onValueChange={setBusinessType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t(`businessTypes.${code}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={pending || employeeCount === ""}>
        {t("cta")}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Verify, typecheck, commit**

Run: `bun run typecheck && bun run test`, then manual flow check (step 2 saves and the wizard advances to step 3).

```bash
git add apps/dashboard packages/i18n/messages
git commit -m "feat(dashboard): company-profile onboarding step"
```

---

## Task 7: Standardmall template data module (Excel content)

**EXTERNAL INPUT GATE:** the criterion descriptions, help texts, 54 anchor texts, level definitions, and most guardrail intervals exist only in the founder's Excel prototype. The founder places it in `~/Downloads`. **If no `.xlsx` matching the prototype is present, STOP and ask the founder before continuing this task.** Everything except the prose is known and encoded below regardless.

**Files:**
- Create: `packages/backend/convex/evaluationModel/standardmall.ts` (structure)
- Create: `packages/backend/convex/evaluationModel/standardmall.content.sv.ts`
- Create: `packages/backend/convex/evaluationModel/standardmall.content.en.ts`
- Create: `scripts/extract-standardmall.ts` (one-off extraction helper)
- Test: `packages/backend/convex/evaluationModel/standardmall.test.ts`

- [ ] **Step 1: Extract the Excel content**

```ts
// scripts/extract-standardmall.ts
// One-off: dump the standardmall source tabs to JSON for hand-curation.
// Usage: bun add -d xlsx && bun scripts/extract-standardmall.ts <path-to-xlsx>
import { readFile } from "node:fs/promises"
import * as XLSX from "xlsx"

const path = process.argv[2]
if (!path) throw new Error("usage: bun scripts/extract-standardmall.ts <xlsx>")
const wb = XLSX.read(await readFile(path), { type: "buffer" })
for (const name of ["Vikter & faktorer", "Track"]) {
  const sheet = wb.Sheets[name]
  if (!sheet) {
    console.error(`missing sheet: ${name} (found: ${wb.SheetNames.join(", ")})`)
    continue
  }
  console.log(`=== ${name} ===`)
  console.log(JSON.stringify(XLSX.utils.sheet_to_json(sheet, { header: 1 }), null, 2))
}
```

Run it, then hand-curate the output into the content modules in Step 3. Per standardmall.md: the canonical anchors come from "Vikter & faktorer"; the alternative Kunskapsdjup anchors in "Arbetsblad_enbart" are NOT used; the "Helper" tab is never seeded. Remove `xlsx` from devDependencies again after extraction (`bun remove xlsx`) and keep the script for provenance.

- [ ] **Step 2: Write the structure module** (`standardmall.ts`)

```ts
import type { ImportanceLevel } from "@workspace/core"
import {
  standardmallContentEn,
  type StandardmallContent,
} from "./standardmall.content.en"
import { standardmallContentSv } from "./standardmall.content.sv"

// Structure of the standardmall (the Excel prototype's evaluation model).
// Prose lives in the per-locale content modules; this module owns every
// numeric/structural decision so they cannot drift between locales.
// Source of record: docs/contexts/evaluation-model/standardmall.md.

export const STANDARDMALL_TEMPLATE_KEY = "standardmall-v1"

export const CRITERION_KEYS = [
  "scope",
  "risk",
  "complexity",
  "autonomy",
  "stakeholders",
  "knowledge",
  "financial",
  "people",
  "formal",
] as const
export type CriterionKey = (typeof CRITERION_KEYS)[number]

// Default importance per criterion (standardmall.md table; weights are NEVER
// stored or shown, they resolve via @workspace/core at compute time).
export const DEFAULT_IMPORTANCE: Record<CriterionKey, ImportanceLevel> = {
  scope: 7,
  risk: 6,
  complexity: 5,
  autonomy: 4,
  stakeholders: 3,
  knowledge: 3,
  financial: 3,
  people: 2,
  formal: 1,
}

export const TRACK_DEFS = [
  { key: "IC", levels: ["IC1", "IC2", "IC3", "IC4", "IC5"] },
  { key: "Lead", levels: ["Lead1", "Lead2", "Lead3"] },
  { key: "M", levels: ["M1", "M2", "M3"] },
] as const
export type LevelKey =
  (typeof TRACK_DEFS)[number]["levels"][number]

// Advisory guardrails per (level, criterion): [min, max] on the 0-5 scale.
// Lead3 from standardmall.md (8 rows; "formal" deliberately absent there);
// the rest from the Excel "Track" tab (filled in during Task 7 Step 1).
// COMPLETENESS GATE: Task 8 must NOT be closed while only Lead3 is present;
// the template is incomplete until every level curated from the Excel
// "Track" tab has its rows here.
export const GUARDRAILS: Record<
  LevelKey,
  Partial<Record<CriterionKey, [number, number]>>
> = {
  // ... IC1..IC5, Lead1, Lead2, M1..M3 curated from the Excel "Track" tab ...
  Lead3: {
    scope: [4, 5],
    complexity: [4, 5],
    autonomy: [4, 5],
    stakeholders: [4, 5],
    knowledge: [3, 4],
    risk: [4, 5],
    financial: [1, 2],
    people: [1, 1],
  },
}

// 7 bands, Band 1 = highest; minScore is the lowest inclusive score.
// Used by BOTH template and scratch models (thresholds are editable in E2).
export const DEFAULT_BAND_THRESHOLDS = [
  { band: 1, minScore: 530 },
  { band: 2, minScore: 450 },
  { band: 3, minScore: 400 },
  { band: 4, minScore: 340 },
  { band: 5, minScore: 285 },
  { band: 6, minScore: 220 },
  { band: 7, minScore: 0 },
] as const

export type TemplateLocale = "sv" | "en"

export function templateContent(locale: TemplateLocale): StandardmallContent {
  return locale === "sv" ? standardmallContentSv : standardmallContentEn
}
```

- [ ] **Step 3: Write the content modules** from the extracted Excel data. Shared shape (define in `standardmall.content.en.ts`, import the type in the sv file):

```ts
import type { CriterionKey, LevelKey } from "./standardmall"

export interface CriterionContent {
  name: string
  description: string
  helpText: string
  // Anchor texts for scores 0..5, in order.
  anchors: [string, string, string, string, string, string]
}

export interface StandardmallContent {
  modelName: string
  criteria: Record<CriterionKey, CriterionContent>
  trackNames: Record<"IC" | "Lead" | "M", string>
  levelNames: Record<LevelKey, string>
  levelDefinitions: Partial<Record<LevelKey, string>>
}

export const standardmallContentEn: StandardmallContent = {
  modelName: "Standard model",
  // ... full curated content; English is translated from the Swedish source
  // and flagged as a draft for native review in the commit message ...
}
```

The Swedish module is the source-faithful one. Known fixed values regardless of Excel: the nine `name` values are Scope & Påverkan, Risk & Konsekvens, Komplexitet & Otydlighet, Autonomi & Beslutsmandat, Intressentbredd, Kunskapsdjup/Bredd, Finansiellt ansvar, Personal-/Ledningsansvar, Formell kompetens (sv); track names Individual Contributor / Lead / Manager; level names = their keys; the Lead3 definition is seeded verbatim from standardmall.md ("Lead-3 - Strategisk koordinerande roll (utan fullt personalansvar) ...", full paragraph, with the em dash from the source replaced per the writing rule).

- [ ] **Step 4: Write the structure test**

```ts
import { IMPORTANCE_LEVELS } from "@workspace/core"
import { describe, expect, it } from "vitest"
import {
  CRITERION_KEYS,
  DEFAULT_BAND_THRESHOLDS,
  DEFAULT_IMPORTANCE,
  GUARDRAILS,
  TRACK_DEFS,
  templateContent,
} from "./standardmall"

describe("standardmall structure", () => {
  it("has 9 criteria, 3 tracks, 11 levels, 7 descending thresholds", () => {
    expect(CRITERION_KEYS).toHaveLength(9)
    expect(TRACK_DEFS).toHaveLength(3)
    expect(TRACK_DEFS.flatMap((t) => t.levels)).toHaveLength(11)
    expect(DEFAULT_BAND_THRESHOLDS).toHaveLength(7)
    const scores = DEFAULT_BAND_THRESHOLDS.map((t) => t.minScore)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    expect(DEFAULT_BAND_THRESHOLDS[0]).toEqual({ band: 1, minScore: 530 })
  })

  it("keeps importances on the fixed scale and guardrails in 0-5", () => {
    for (const key of CRITERION_KEYS) {
      expect(IMPORTANCE_LEVELS).toContain(DEFAULT_IMPORTANCE[key])
    }
    for (const ranges of Object.values(GUARDRAILS)) {
      for (const [min, max] of Object.values(ranges)) {
        expect(min).toBeGreaterThanOrEqual(0)
        expect(max).toBeLessThanOrEqual(5)
        expect(min).toBeLessThanOrEqual(max)
      }
    }
  })

  it("ships complete content in both locales", () => {
    for (const locale of ["sv", "en"] as const) {
      const content = templateContent(locale)
      for (const key of CRITERION_KEYS) {
        const criterion = content.criteria[key]
        expect(criterion.name.length).toBeGreaterThan(0)
        expect(criterion.description.length).toBeGreaterThan(0)
        expect(criterion.helpText.length).toBeGreaterThan(0)
        expect(criterion.anchors).toHaveLength(6)
        for (const anchor of criterion.anchors) {
          expect(anchor.length).toBeGreaterThan(0)
        }
      }
    }
  })
})
```

- [ ] **Step 5: Run tests, then commit**

Run: `cd packages/backend && bun run test -- standardmall`
Expected: PASS

```bash
git add packages/backend/convex/evaluationModel scripts/extract-standardmall.ts
git commit -m "feat(model): encode the standardmall template as data (sv source, en draft)"
```

---

## Task 8: Model creation mutations and readout query

**Files:**
- Create: `packages/backend/convex/evaluationModel/model.ts`
- Test: `packages/backend/convex/evaluationModel/model.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedReadyWorkspace(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@acme.se", name: "HR Person", role: "admin" }
  )
  await t.run(async (ctx) => {
    await ctx.db.insert("workspaceProfiles", {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      employeeCount: 25,
      businessType: "saasTech",
    })
  })
  return { orgId, asAdmin: t.withIdentity({ subject: userId }) }
}

describe("createModelFromTemplate", () => {
  it("seeds the full standardmall in one transaction and audits it", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyWorkspace(t)

    const modelId = await asAdmin.mutation(
      api.evaluationModel.model.createModelFromTemplate,
      { orgId }
    )
    expect(modelId).toBeDefined()

    await t.run(async (ctx) => {
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(criteria).toHaveLength(9)
      expect(criteria.every((c) => c.isCustom === false)).toBe(true)

      let anchorCount = 0
      for (const criterion of criteria) {
        const anchors = await ctx.db
          .query("criterionAnchors")
          .withIndex("by_criterion", (q) => q.eq("criterionId", criterion._id))
          .collect()
        expect(anchors.map((a) => a.level).sort()).toEqual([0, 1, 2, 3, 4, 5])
        anchorCount += anchors.length
      }
      expect(anchorCount).toBe(54)

      const tracks = await ctx.db
        .query("tracks")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(tracks.map((track) => track.key).sort()).toEqual([
        "IC",
        "Lead",
        "M",
      ])

      let levelCount = 0
      for (const track of tracks) {
        levelCount += (
          await ctx.db
            .query("levels")
            .withIndex("by_track", (q) => q.eq("trackId", track._id))
            .collect()
        ).length
      }
      expect(levelCount).toBe(11)

      const thresholds = await ctx.db
        .query("bandThresholds")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(thresholds).toHaveLength(7)
      expect(
        thresholds.find((threshold) => threshold.band === 1)?.minScore
      ).toBe(530)

      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "model.created")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })
  })

  it("rejects a second model with errors.modelExists", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyWorkspace(t)
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })
    await expect(
      asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
        orgId,
      })
    ).rejects.toThrow(/errors.modelExists/)
  })
})

describe("createEmptyModel", () => {
  it("creates a model with fixed tracks and thresholds but no criteria", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyWorkspace(t)
    const modelId = await asAdmin.mutation(
      api.evaluationModel.model.createEmptyModel,
      { orgId, name: "Vår modell" }
    )
    await t.run(async (ctx) => {
      const model = await ctx.db.get(modelId)
      expect(model?.templateKey).toBeUndefined()
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(criteria).toHaveLength(0)
      const tracks = await ctx.db
        .query("tracks")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(tracks).toHaveLength(3)
      const thresholds = await ctx.db
        .query("bandThresholds")
        .withIndex("by_model", (q) => q.eq("modelId", modelId))
        .collect()
      expect(thresholds).toHaveLength(7)
    })
  })
})

describe("getModel", () => {
  it("returns the full model with importance levels and never weights", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyWorkspace(t)
    await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
      orgId,
    })
    const result = await asAdmin.query(api.evaluationModel.model.getModel, {
      orgId,
    })
    expect(result).not.toBeNull()
    expect(result?.criteria).toHaveLength(9)
    expect(result?.criteria[0]?.anchors).toHaveLength(6)
    expect(JSON.stringify(result)).not.toMatch(/"weight"/)
    const importanceLevels = result?.criteria.map(
      (criterion) => criterion.importanceLevel
    )
    expect(importanceLevels?.every((level) => level >= 1 && level <= 7)).toBe(
      true
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/backend && bun run test -- evaluationModel/model`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `model.ts`**

```ts
import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgQuery } from "../lib/functions"
import {
  DEFAULT_BAND_THRESHOLDS,
  DEFAULT_IMPORTANCE,
  CRITERION_KEYS,
  GUARDRAILS,
  STANDARDMALL_TEMPLATE_KEY,
  TRACK_DEFS,
  type TemplateLocale,
  templateContent,
} from "./standardmall"

async function assertNoModel(ctx: MutationCtx, orgId: string) {
  const existing = await ctx.db
    .query("models")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first()
  if (existing !== null) throw appError(ERROR_CODES.modelExists)
}

async function contentLocale(
  ctx: MutationCtx,
  orgId: string
): Promise<TemplateLocale> {
  const profile = await ctx.db
    .query("workspaceProfiles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  return profile?.language === "sv" ? "sv" : "en"
}

// Seeds the fixed track schema (IC/Lead/M is fixed in V1) and the default
// band thresholds; shared by the template and scratch paths. Returns the
// level ids keyed by level key so the template path can attach guardrails.
async function seedTracksAndThresholds(
  ctx: MutationCtx,
  orgId: string,
  modelId: Id<"models">,
  locale: TemplateLocale
) {
  const content = templateContent(locale)
  const levelIdByKey = new Map<string, Id<"levels">>()
  for (const [trackIndex, trackDef] of TRACK_DEFS.entries()) {
    const trackId = await ctx.db.insert("tracks", {
      orgId,
      modelId,
      key: trackDef.key,
      name: content.trackNames[trackDef.key],
      order: trackIndex + 1,
    })
    for (const [levelIndex, levelKey] of trackDef.levels.entries()) {
      const levelId = await ctx.db.insert("levels", {
        trackId,
        key: levelKey,
        name: content.levelNames[levelKey],
        definition: content.levelDefinitions[levelKey],
        order: levelIndex + 1,
      })
      levelIdByKey.set(levelKey, levelId)
    }
  }
  for (const threshold of DEFAULT_BAND_THRESHOLDS) {
    await ctx.db.insert("bandThresholds", {
      orgId,
      modelId,
      band: threshold.band,
      minScore: threshold.minScore,
    })
  }
  return levelIdByKey
}

export const createModelFromTemplate = adminMutation({
  args: {},
  returns: v.id("models"),
  handler: async (ctx) => {
    await assertNoModel(ctx, ctx.orgId)
    const locale = await contentLocale(ctx, ctx.orgId)
    const content = templateContent(locale)

    const modelId = await ctx.db.insert("models", {
      orgId: ctx.orgId,
      name: content.modelName,
      templateKey: STANDARDMALL_TEMPLATE_KEY,
    })

    const criterionIdByKey = new Map<string, Id<"criteria">>()
    for (const [index, key] of CRITERION_KEYS.entries()) {
      const criterion = content.criteria[key]
      const criterionId = await ctx.db.insert("criteria", {
        orgId: ctx.orgId,
        modelId,
        name: criterion.name,
        description: criterion.description,
        helpText: criterion.helpText,
        importanceLevel: DEFAULT_IMPORTANCE[key],
        order: index + 1,
        isCustom: false,
      })
      criterionIdByKey.set(key, criterionId)
      for (const [level, text] of criterion.anchors.entries()) {
        await ctx.db.insert("criterionAnchors", { criterionId, level, text })
      }
    }

    const levelIdByKey = await seedTracksAndThresholds(
      ctx,
      ctx.orgId,
      modelId,
      locale
    )
    for (const [levelKey, ranges] of Object.entries(GUARDRAILS)) {
      const levelId = levelIdByKey.get(levelKey)
      if (levelId === undefined) continue
      for (const [criterionKey, range] of Object.entries(ranges)) {
        const criterionId = criterionIdByKey.get(criterionKey)
        if (criterionId === undefined || range === undefined) continue
        await ctx.db.insert("trackGuardrails", {
          orgId: ctx.orgId,
          levelId,
          criterionId,
          min: range[0],
          max: range[1],
        })
      }
    }

    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelCreated,
      actorId: ctx.authUserId,
      payload: { modelId, templateKey: STANDARDMALL_TEMPLATE_KEY },
    })
    return modelId
  },
})

export const createEmptyModel = adminMutation({
  args: { name: v.string() },
  returns: v.id("models"),
  handler: async (ctx, { name }) => {
    if (name.trim().length === 0) throw appError(ERROR_CODES.invalidInput)
    await assertNoModel(ctx, ctx.orgId)
    const locale = await contentLocale(ctx, ctx.orgId)
    const modelId = await ctx.db.insert("models", {
      orgId: ctx.orgId,
      name: name.trim(),
    })
    await seedTracksAndThresholds(ctx, ctx.orgId, modelId, locale)
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelCreated,
      actorId: ctx.authUserId,
      payload: { modelId, templateKey: null },
    })
    return modelId
  },
})

const anchorShape = v.object({ level: v.number(), text: v.string() })

export const getModel = orgQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      modelId: v.id("models"),
      name: v.string(),
      templateKey: v.union(v.string(), v.null()),
      criteria: v.array(
        v.object({
          criterionId: v.id("criteria"),
          name: v.string(),
          description: v.string(),
          helpText: v.string(),
          importanceLevel: v.number(),
          order: v.number(),
          isCustom: v.boolean(),
          anchors: v.array(anchorShape),
        })
      ),
      tracks: v.array(
        v.object({
          trackId: v.id("tracks"),
          key: v.string(),
          name: v.string(),
          order: v.number(),
          levels: v.array(
            v.object({
              levelId: v.id("levels"),
              key: v.string(),
              name: v.string(),
              order: v.number(),
            })
          ),
        })
      ),
      bandThresholds: v.array(
        v.object({ band: v.number(), minScore: v.number() })
      ),
    })
  ),
  handler: async (ctx) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null

    const criteriaRows = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    criteriaRows.sort((a, b) => a.order - b.order)
    const criteria = []
    for (const row of criteriaRows) {
      const anchors = await ctx.db
        .query("criterionAnchors")
        .withIndex("by_criterion", (q) => q.eq("criterionId", row._id))
        .collect()
      anchors.sort((a, b) => a.level - b.level)
      criteria.push({
        criterionId: row._id,
        name: row.name,
        description: row.description,
        helpText: row.helpText,
        importanceLevel: row.importanceLevel,
        order: row.order,
        isCustom: row.isCustom,
        anchors: anchors.map((a) => ({ level: a.level, text: a.text })),
      })
    }

    const trackRows = await ctx.db
      .query("tracks")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    trackRows.sort((a, b) => a.order - b.order)
    const tracks = []
    for (const row of trackRows) {
      const levels = await ctx.db
        .query("levels")
        .withIndex("by_track", (q) => q.eq("trackId", row._id))
        .collect()
      levels.sort((a, b) => a.order - b.order)
      tracks.push({
        trackId: row._id,
        key: row.key,
        name: row.name,
        order: row.order,
        levels: levels.map((level) => ({
          levelId: level._id,
          key: level.key,
          name: level.name,
          order: level.order,
        })),
      })
    }

    const thresholdRows = await ctx.db
      .query("bandThresholds")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    thresholdRows.sort((a, b) => a.band - b.band)

    return {
      modelId: model._id,
      name: model.name,
      templateKey: model.templateKey ?? null,
      criteria,
      tracks,
      bandThresholds: thresholdRows.map((threshold) => ({
        band: threshold.band,
        minScore: threshold.minScore,
      })),
    }
  },
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && bun run test -- evaluationModel/model`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/evaluationModel
git commit -m "feat(model): template and scratch model creation plus full model readout"
```

---

## Task 9: Criterion editor mutations

**Files:**
- Create: `packages/backend/convex/evaluationModel/criteria.ts`
- Test: `packages/backend/convex/evaluationModel/criteria.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

const VALID_ANCHORS = ["a0", "a1", "a2", "a3", "a4", "a5"]

async function seedScratchModel(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@acme.se", name: "HR Person", role: "admin" }
  )
  await t.run(async (ctx) => {
    await ctx.db.insert("workspaceProfiles", {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      employeeCount: 25,
      businessType: "saasTech",
    })
  })
  const asAdmin = t.withIdentity({ subject: userId })
  await asAdmin.mutation(api.evaluationModel.model.createEmptyModel, {
    orgId,
    name: "Scratch",
  })
  return { orgId, asAdmin }
}

describe("criterion editor", () => {
  it("adds a criterion with six anchors and increments order", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const first = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Komplexitet",
        description: "Hur svåra problem rollen hanterar.",
        helpText: "Bedöm mot ankartexterna.",
        importanceLevel: 5,
        anchors: VALID_ANCHORS,
      }
    )
    const second = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Scope",
        description: "Rollens omfång.",
        helpText: "Bedöm mot ankartexterna.",
        importanceLevel: 7,
        anchors: VALID_ANCHORS,
      }
    )
    await t.run(async (ctx) => {
      const a = await ctx.db.get(first)
      const b = await ctx.db.get(second)
      expect(a?.order).toBe(1)
      expect(b?.order).toBe(2)
      expect(a?.isCustom).toBe(true)
      const anchors = await ctx.db
        .query("criterionAnchors")
        .withIndex("by_criterion", (q) => q.eq("criterionId", first))
        .collect()
      expect(anchors).toHaveLength(6)
    })
  })

  it("rejects an importance outside the fixed scale and wrong anchor counts", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.addCriterion, {
        orgId,
        name: "X",
        description: "d",
        helpText: "h",
        importanceLevel: 8,
        anchors: VALID_ANCHORS,
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asAdmin.mutation(api.evaluationModel.criteria.addCriterion, {
        orgId,
        name: "X",
        description: "d",
        helpText: "h",
        importanceLevel: 5,
        anchors: ["only", "five", "anchor", "texts", "here"],
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("removes a criterion together with its anchors", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchModel(t)
    const criterionId = await asAdmin.mutation(
      api.evaluationModel.criteria.addCriterion,
      {
        orgId,
        name: "Tillfällig",
        description: "d",
        helpText: "h",
        importanceLevel: 3,
        anchors: VALID_ANCHORS,
      }
    )
    await asAdmin.mutation(api.evaluationModel.criteria.removeCriterion, {
      orgId,
      criterionId,
    })
    await t.run(async (ctx) => {
      expect(await ctx.db.get(criterionId)).toBeNull()
      const anchors = await ctx.db
        .query("criterionAnchors")
        .withIndex("by_criterion", (q) => q.eq("criterionId", criterionId))
        .collect()
      expect(anchors).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/backend && bun run test -- criteria`
Expected: FAIL

- [ ] **Step 3: Implement `criteria.ts`**

```ts
import { IMPORTANCE_LEVELS, type ImportanceLevel } from "@workspace/core"
import { v } from "convex/values"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation } from "../lib/functions"

function assertImportance(level: number): asserts level is ImportanceLevel {
  if (
    !Number.isInteger(level) ||
    !IMPORTANCE_LEVELS.includes(level as ImportanceLevel)
  ) {
    throw appError(ERROR_CODES.invalidInput)
  }
}

// Minimal criterion editor for the onboarding scratch path; E2 reuses and
// extends this surface (update, rationale, bias review).
export const addCriterion = adminMutation({
  args: {
    name: v.string(),
    description: v.string(),
    helpText: v.string(),
    importanceLevel: v.number(),
    anchors: v.array(v.string()),
  },
  returns: v.id("criteria"),
  handler: async (ctx, args) => {
    assertImportance(args.importanceLevel)
    if (args.name.trim().length === 0 || args.anchors.length !== 6) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const existing = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    const criterionId = await ctx.db.insert("criteria", {
      orgId: ctx.orgId,
      modelId: model._id,
      name: args.name.trim(),
      description: args.description,
      helpText: args.helpText,
      importanceLevel: args.importanceLevel,
      order: existing.length + 1,
      isCustom: true,
    })
    for (const [level, text] of args.anchors.entries()) {
      await ctx.db.insert("criterionAnchors", { criterionId, level, text })
    }
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelUpdated,
      actorId: ctx.authUserId,
      payload: { change: "criterion.added", criterionId },
    })
    return criterionId
  },
})

// Onboarding-phase removal: no ratings can exist yet (roles arrive in E3).
// E2 must add a ratings guard before exposing removal post-onboarding.
export const removeCriterion = adminMutation({
  args: { criterionId: v.id("criteria") },
  returns: v.null(),
  handler: async (ctx, { criterionId }) => {
    const criterion = await ctx.db.get(criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    const anchors = await ctx.db
      .query("criterionAnchors")
      .withIndex("by_criterion", (q) => q.eq("criterionId", criterionId))
      .collect()
    for (const anchor of anchors) {
      await ctx.db.delete(anchor._id)
    }
    await ctx.db.delete(criterionId)
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelUpdated,
      actorId: ctx.authUserId,
      payload: { change: "criterion.removed", criterionId },
    })
    return null
  },
})
```

- [ ] **Step 4: Run tests to verify they pass, then commit**

Run: `cd packages/backend && bun run test -- criteria`
Expected: PASS (3 tests)

```bash
git add packages/backend/convex/evaluationModel
git commit -m "feat(model): minimal criterion editor mutations for the scratch path"
```

---

## Task 10: Model setup step UI

**Files:**
- Modify: `apps/dashboard/components/onboarding/model-setup-step.tsx`
- Create: `apps/dashboard/components/onboarding/model-review.tsx`
- Create: `apps/dashboard/components/onboarding/criterion-editor.tsx`
- Create: `apps/dashboard/lib/importance.ts`
- Create (typed stubs replaced in Task 12): `apps/dashboard/components/onboarding/importance-review-panel.tsx`, `apps/dashboard/components/onboarding/model-draft-panel.tsx`
- Modify: `packages/i18n/messages/*.json`

- [ ] **Step 1: Add i18n keys** (under `dashboard.onboarding`; en then sv then mirrors)

```json
      "model": {
        "heading": "Choose your evaluation model",
        "description": "The model defines the criteria roles are rated against. Importance is always a label, never a number.",
        "template": {
          "title": "Start from the standard template",
          "description": "9 criteria with anchor scales, default importances, the track schema, and band thresholds. Recommended.",
          "cta": "Use the template"
        },
        "scratch": {
          "title": "Build from scratch",
          "description": "Start empty and define your own criteria, with AI drafts to help.",
          "nameLabel": "Model name",
          "cta": "Start from scratch"
        },
        "review": {
          "heading": "Your model",
          "bandNote": "Band 1 is the highest band. A higher band number means lower weight.",
          "cta": "Open the dashboard"
        },
        "editor": {
          "heading": "Criteria",
          "empty": "No criteria yet. Add your first criterion or generate AI drafts.",
          "name": "Name",
          "description": "Description",
          "helpText": "Help text for the assessor",
          "importance": "Importance",
          "anchors": "Anchor scale (0 to 5)",
          "anchorLevel": "Anchor {level}",
          "addCta": "Add criterion",
          "removeCta": "Remove",
          "doneCta": "Finish setup"
        }
      }
```

sv: heading "Välj er värderingsmodell"; description "Modellen definierar kriterierna som roller värderas mot. Betydelse är alltid en etikett, aldrig en siffra."; template: "Utgå från standardmallen" / "9 kriterier med ankarskalor, förvalda betydelser, track-schema och bandtrösklar. Rekommenderas." / "Använd mallen"; scratch: "Bygg från grunden" / "Börja tomt och definiera egna kriterier, med AI-utkast som hjälp." / "Modellens namn" / "Börja från grunden"; review: "Er modell" / "Band 1 är högsta bandet. Högre bandnummer betyder lägre tyngd." / "Öppna dashboarden"; editor: "Kriterier" / "Inga kriterier ännu. Lägg till ert första kriterium eller generera AI-utkast." / "Namn" / "Beskrivning" / "Hjälptext till bedömaren" / "Betydelse" / "Ankarskala (0 till 5)" / "Ankare {level}" / "Lägg till kriterium" / "Ta bort" / "Slutför".

- [ ] **Step 2: Create `apps/dashboard/lib/importance.ts`** (single source for the importance-label map; typed so the values are literal `model.importance.*` sub-keys, which the typed translator requires)

```ts
import type { ImportanceLevel } from "@workspace/core"

// Maps the stored importance level (1-7) to its model.importance.* label
// sub-key. The numeric WEIGHT behind a level is internal to @workspace/core
// and never reaches the client.
export const IMPORTANCE_LABEL_KEYS = {
  7: "critical",
  6: "veryHigh",
  5: "high",
  4: "fair",
  3: "moderate",
  2: "slight",
  1: "least",
} as const satisfies Record<ImportanceLevel, string>

export function importanceLabelKey(level: number) {
  return IMPORTANCE_LABEL_KEYS[level as ImportanceLevel]
}
```

- [ ] **Step 3: Implement `model-setup-step.tsx`**

The gate keeps the wizard mounted for the whole onboarding session (Task 4), so the choice screen, review screen, and editor live in LOCAL state after the create call, and "Finish setup" calls the `onFinished` prop, which hands control back to the gate.

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useMutation } from "convex/react"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { CriterionEditor } from "@/components/onboarding/criterion-editor"
import { ModelReview } from "@/components/onboarding/model-review"

type Mode = "choice" | "template-review" | "scratch-editor"

export function ModelSetupStep({
  orgId,
  onFinished,
}: {
  orgId: string
  onFinished: () => void
}) {
  const t = useTranslations("dashboard.onboarding.model")
  const createFromTemplate = useMutation(
    api.evaluationModel.model.createModelFromTemplate
  )
  const createEmpty = useMutation(api.evaluationModel.model.createEmptyModel)
  const [mode, setMode] = useState<Mode>("choice")
  const [scratchName, setScratchName] = useState("")
  const [pending, setPending] = useState(false)

  if (mode === "template-review") {
    return <ModelReview orgId={orgId} onFinished={onFinished} />
  }
  if (mode === "scratch-editor") {
    return <CriterionEditor orgId={orgId} onFinished={onFinished} />
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-medium">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("template.title")}</CardTitle>
            <CardDescription>{t("template.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={pending}
              onClick={async () => {
                setPending(true)
                try {
                  await createFromTemplate({ orgId })
                  setMode("template-review")
                } finally {
                  setPending(false)
                }
              }}
            >
              {t("template.cta")}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("scratch.title")}</CardTitle>
            <CardDescription>{t("scratch.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model-name">{t("scratch.nameLabel")}</Label>
              <Input
                id="model-name"
                value={scratchName}
                onChange={(event) => setScratchName(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              disabled={pending || scratchName.trim().length === 0}
              onClick={async () => {
                setPending(true)
                try {
                  await createEmpty({ orgId, name: scratchName.trim() })
                  setMode("scratch-editor")
                } finally {
                  setPending(false)
                }
              }}
            >
              {t("scratch.cta")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `model-review.tsx`** (template path landing: lists criteria with importance LABELS via `model.importance.*`, the band thresholds with the Band-1-highest note, hosts the AI importance review panel from Task 12, and a "Finish" button)

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { ImportanceReviewPanel } from "@/components/onboarding/importance-review-panel"
import { importanceLabelKey } from "@/lib/importance"

export function ModelReview({
  orgId,
  onFinished,
}: {
  orgId: string
  onFinished: () => void
}) {
  const t = useTranslations("dashboard.onboarding.model.review")
  const tImportance = useTranslations("model.importance")
  const model = useQuery(api.evaluationModel.model.getModel, { orgId })
  if (model === undefined || model === null) return null
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">{t("heading")}</h2>
      <ul className="space-y-2">
        {model.criteria.map((criterion) => (
          <li
            key={criterion.criterionId}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <span>{criterion.name}</span>
            <span className="text-sm text-muted-foreground">
              {tImportance(importanceLabelKey(criterion.importanceLevel))}
            </span>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <ul className="flex flex-wrap gap-2">
          {model.bandThresholds.map((threshold) => (
            <li
              key={threshold.band}
              className="rounded-md border px-2 py-1 text-sm text-muted-foreground"
            >
              {`${threshold.band}: ${threshold.minScore}+`}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t("bandNote")}</p>
      </div>
      <ImportanceReviewPanel orgId={orgId} model={model} />
      <Button onClick={onFinished}>{t("cta")}</Button>
    </div>
  )
}
```

(The threshold chips render the band number and its minimum score, which are figures, not copy, so no extra i18n key is needed beyond `bandNote`. `ImportanceReviewPanel` is created in Task 12; until then create the file with this exact typed stub so the props compile:

```tsx
"use client"

export function ImportanceReviewPanel(_props: {
  orgId: string
  model: { criteria: { criterionId: string; name: string; importanceLevel: number }[] }
}) {
  return null
}
```

Task 12 replaces the body and may widen the `model` prop type to the `getModel` return type.)

- [ ] **Step 5: Implement `criterion-editor.tsx`** (scratch path: reactive criteria list from `getModel`, add form with importance label select and six anchor inputs, remove buttons, AI draft panel slot from Task 12, finish button calling `onFinished`; disable finish until at least one criterion exists)

Component signature: `export function CriterionEditor({ orgId, onFinished }: { orgId: string; onFinished: () => void })`. Structure (full code follows the same component idioms as Steps 3-4):
- `useQuery(api.evaluationModel.model.getModel, { orgId })` drives the list.
- Add form state: name, description, helpText, importanceLevel (select over `[7, 6, 5, 4, 3, 2, 1]` rendered with `tImportance(importanceLabelKey(level))` from `@/lib/importance`), anchors as a 6-element string array rendered with `editor.anchorLevel`.
- Submit calls `api.evaluationModel.criteria.addCriterion`; remove calls `removeCriterion`.
- Renders `<ModelDraftPanel orgId={orgId} />` (Task 12; until then create the file with the typed stub `export function ModelDraftPanel(_props: { orgId: string }) { return null }` marked `"use client"`).
- Finish button (`editor.doneCta`): `disabled={model === null || model === undefined || model.criteria.length === 0}`, `onClick={onFinished}`.

- [ ] **Step 6: Typecheck, test, manual flow, commit**

Run: `bun run typecheck && bun run test`, then walk the full wizard manually on a fresh seeded user for BOTH paths.

```bash
git add apps/dashboard packages/i18n/messages
git commit -m "feat(dashboard): model setup step with template and scratch paths"
```

---

## Task 11: AI foundation (schema, provider, actions, suggestion lifecycle)

**Files:**
- Modify: `packages/backend/convex/shared/tables.ts` (suggestions table)
- Modify: `packages/backend/package.json` (add `ai`, `@ai-sdk/mistral`, `zod`)
- Create: `packages/backend/convex/ai/config.ts` (plain constants, default V8 runtime)
- Create: `packages/backend/convex/ai/provider.ts` ("use node")
- Create: `packages/backend/convex/ai/generate.ts` ("use node")
- Create: `packages/backend/convex/ai/persist.ts`
- Create: `packages/backend/convex/ai/suggest.ts`
- Test: `packages/backend/convex/ai/suggest.test.ts`

**Runtime split (critical):** `suggest.ts` and `persist.ts` export queries/mutations and run in the default V8 runtime; they must NEVER import (even transitively) a `"use node"` module. The shared constants therefore live in `ai/config.ts` (no directive), and the `@ai-sdk/mistral` import is isolated in `ai/provider.ts` ("use node"), imported only by `ai/generate.ts` ("use node"). Importing provider.ts from suggest.ts fails the `convex dev` push; convex-test will not catch it.

- [ ] **Step 1: Install AI dependencies**

Run from `packages/backend`: `bun add ai @ai-sdk/mistral zod`
Floor check: `ai` must resolve to `>=6.0.35` (the v6 line; `generateText` + `Output.object`). Verify with `bun pm ls | grep -E '^| (ai|@ai-sdk|zod)'`.
IMPORTANT: this install must complete before ANY backend test run in this task; `initConvexTest` globs every `convex/**/*.ts` including `ai/generate.ts`, so a missing dependency breaks the whole backend suite, not just the AI tests.
Also verify the structured-output API against the installed package before writing Step 5 (the docs-win rule): confirm `import { generateText, Output } from "ai"`, the `output: Output.object({ schema })` option, and the `result.output` accessor at https://ai-sdk.dev/docs/reference/ai-sdk-core/output (cross-checked correct as of 2026-06-04).

- [ ] **Step 2: Extend the suggestions table** (replace the `status`/`target` parts of the existing definition; the table is empty in all deployments so this widening is safe)

```ts
// AI suggestion layer (ADR-0003): suggestions with provenance, separate from
// confirmed values. status lifecycle: generating -> suggested -> confirmed |
// rejected; failed carries an errors.* code the frontend translates.
export const suggestions = defineTable({
  orgId: v.string(),
  target: v.object({
    kind: v.string(), // "model.draft" | "model.importanceReview" | "role.field" | "criterion.anchor"
    roleId: v.optional(v.id("roles")),
    criterionId: v.optional(v.id("criteria")),
    modelId: v.optional(v.id("models")),
    field: v.optional(v.string()),
  }),
  suggestedValue: v.any(),
  motivation: v.optional(v.string()),
  source: v.literal("ai"),
  status: v.union(
    v.literal("generating"),
    v.literal("suggested"),
    v.literal("confirmed"),
    v.literal("rejected"),
    v.literal("failed")
  ),
  errorCode: v.optional(v.string()),
  model: v.optional(v.object({ provider: v.string(), model: v.string() })),
  confirmedBy: v.optional(v.string()),
})
  .index("by_org", ["orgId"])
  .index("by_org_status", ["orgId", "status"])
```

- [ ] **Step 3: Implement the config and provider modules**

`ai/config.ts` (NO "use node"; importable from the default runtime):

```ts
// Provider identity for suggestion provenance. Plain constants so the
// default-runtime mutation surface (suggest.ts) can import them without
// pulling the Node-only AI SDK into the V8 bundle.
export const AI_PROVIDER = "mistral"
export const AI_MODEL_ID = process.env.MISTRAL_MODEL ?? "mistral-large-latest"
```

`ai/provider.ts`:

```ts
"use node"

import { createMistral } from "@ai-sdk/mistral"
import { AI_MODEL_ID } from "./config"

// ADR-0003: AI calls happen only in Convex actions against an EU-hosted
// model. This module is the single provider swap point (Mistral La
// Plateforme EU default; Azure OpenAI EU Data Zone is the documented
// fallback). NEVER route through Vercel AI Gateway: it cannot pin EU
// residency (ADR-0001).
export function aiModel() {
  const apiKey = process.env.MISTRAL_API_KEY
  if (apiKey === undefined || apiKey === "") return null
  return createMistral({ apiKey })(AI_MODEL_ID)
}
```

- [ ] **Step 4: Implement the internal persistence mutations** (`ai/persist.ts`)

```ts
import { v } from "convex/values"
import { internalMutation } from "../_generated/server"

export const saveDraft = internalMutation({
  args: {
    suggestionId: v.id("suggestions"),
    criteria: v.array(
      v.object({
        name: v.string(),
        description: v.string(),
        helpText: v.string(),
        importanceLevel: v.number(),
        anchors: v.array(v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, criteria }) => {
    await ctx.db.patch(suggestionId, {
      suggestedValue: { criteria },
      status: "suggested",
    })
    return null
  },
})

export const saveImportanceReview = internalMutation({
  args: {
    suggestionId: v.id("suggestions"),
    // criterionId stays a string here: it is an LLM-echoed value, and the
    // confirm path re-validates it with ctx.db.normalizeId + an org check
    // before anything is patched.
    adjustments: v.array(
      v.object({
        criterionId: v.string(),
        suggestedImportanceLevel: v.number(),
        motivation: v.string(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, adjustments }) => {
    await ctx.db.patch(suggestionId, {
      suggestedValue: { adjustments },
      status: "suggested",
    })
    return null
  },
})

// Failures persist a machine-readable errors.* code; the frontend translates.
export const markFailed = internalMutation({
  args: { suggestionId: v.id("suggestions"), errorCode: v.string() },
  returns: v.null(),
  handler: async (ctx, { suggestionId, errorCode }) => {
    await ctx.db.patch(suggestionId, { status: "failed", errorCode })
    return null
  },
})
```

- [ ] **Step 5: Implement the generation actions** (`ai/generate.ts`)

```ts
"use node"

import { generateText, Output } from "ai"
import { v } from "convex/values"
import { z } from "zod"
import { internal } from "../_generated/api"
import { internalAction } from "../_generated/server"
import { ERROR_CODES } from "../lib/errors"
import { aiModel } from "./provider"

const draftSchema = z.object({
  criteria: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        helpText: z.string(),
        importanceLevel: z.number().int().min(1).max(7),
        anchors: z.array(z.string()).length(6),
      })
    )
    .min(3)
    .max(9),
})

const reviewSchema = z.object({
  adjustments: z.array(
    z.object({
      criterionId: z.string(),
      suggestedImportanceLevel: z.number().int().min(1).max(7),
      motivation: z.string(),
    })
  ),
})

interface CompanyContext {
  locale: string
  businessType: string
  employeeCount: number
  country: string
}

function companyLines(args: CompanyContext): string[] {
  const language = args.locale === "sv" ? "Swedish" : "English"
  return [
    "You are assisting an HR specialist who is configuring a job evaluation model for role evaluation under the EU pay transparency directive.",
    `Company profile: business type "${args.businessType}", about ${args.employeeCount} employees, country code "${args.country}".`,
    "Hard rules: evaluate ROLES, never persons; wording must be gender-neutral and bias-reduced (say bias-reduced, never bias-free); never reference person traits, tenure, performance, or salary.",
    `Write all user-facing text in ${language}.`,
  ]
}

export const generateModelDraft = internalAction({
  args: {
    suggestionId: v.id("suggestions"),
    locale: v.string(),
    businessType: v.string(),
    employeeCount: v.number(),
    country: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const model = aiModel()
    if (model === null) {
      await ctx.runMutation(internal.ai.persist.markFailed, {
        suggestionId: args.suggestionId,
        errorCode: ERROR_CODES.aiUnavailable,
      })
      return null
    }
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: draftSchema }),
        abortSignal: AbortSignal.timeout(60_000),
        prompt: [
          ...companyLines(args),
          args.description !== undefined && args.description !== ""
            ? `The HR specialist describes the business as: ${args.description}`
            : "",
          "Propose 5 to 9 evaluation criteria for comparing the weight of roles across the company.",
          "For each criterion return: name (short), description (one sentence), helpText (guidance for the assessor), importanceLevel (integer 1-7 where 7 is most important), and anchors (exactly 6 texts describing what the scores 0,1,2,3,4,5 mean for the criterion).",
        ]
          .filter((line) => line !== "")
          .join("\n"),
      })
      await ctx.runMutation(internal.ai.persist.saveDraft, {
        suggestionId: args.suggestionId,
        criteria: result.output.criteria,
      })
    } catch (error) {
      console.error("model draft generation failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      await ctx.runMutation(internal.ai.persist.markFailed, {
        suggestionId: args.suggestionId,
        errorCode: ERROR_CODES.aiGenerationFailed,
      })
    }
    return null
  },
})

export const reviewImportances = internalAction({
  args: {
    suggestionId: v.id("suggestions"),
    locale: v.string(),
    businessType: v.string(),
    employeeCount: v.number(),
    country: v.string(),
    criteria: v.array(
      v.object({
        criterionId: v.string(),
        name: v.string(),
        importanceLevel: v.number(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const model = aiModel()
    if (model === null) {
      await ctx.runMutation(internal.ai.persist.markFailed, {
        suggestionId: args.suggestionId,
        errorCode: ERROR_CODES.aiUnavailable,
      })
      return null
    }
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: reviewSchema }),
        abortSignal: AbortSignal.timeout(60_000),
        prompt: [
          ...companyLines(args),
          "The workspace started from the standard template. Review the importance level (1-7, 7 highest) of each criterion given the company profile.",
          "Only propose adjustments you can motivate from the company profile; return an empty list if the defaults fit. Echo criterionId verbatim for each adjustment.",
          `Criteria: ${JSON.stringify(args.criteria)}`,
        ].join("\n"),
      })
      const valid = result.output.adjustments.filter((adjustment) =>
        args.criteria.some(
          (criterion) => criterion.criterionId === adjustment.criterionId
        )
      )
      await ctx.runMutation(internal.ai.persist.saveImportanceReview, {
        suggestionId: args.suggestionId,
        adjustments: valid,
      })
    } catch (error) {
      console.error("importance review failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      await ctx.runMutation(internal.ai.persist.markFailed, {
        suggestionId: args.suggestionId,
        errorCode: ERROR_CODES.aiGenerationFailed,
      })
    }
    return null
  },
})
```

- [ ] **Step 6: Implement the public suggestion surface** (`ai/suggest.ts`)

```ts
import { IMPORTANCE_LEVELS, type ImportanceLevel } from "@workspace/core"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import type { MutationCtx } from "../_generated/server"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgQuery } from "../lib/functions"
import { AI_MODEL_ID, AI_PROVIDER } from "./config"

interface ProfileContext {
  locale: string
  businessType: string
  employeeCount: number
  country: string
}

async function requireCompleteProfile(
  ctx: MutationCtx,
  orgId: string
): Promise<ProfileContext> {
  const profile = await ctx.db
    .query("workspaceProfiles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  if (
    profile === null ||
    typeof profile.country !== "string" ||
    typeof profile.language !== "string" ||
    typeof profile.employeeCount !== "number" ||
    typeof profile.businessType !== "string"
  ) {
    throw appError(ERROR_CODES.profileIncomplete)
  }
  return {
    locale: profile.language,
    businessType: profile.businessType,
    employeeCount: profile.employeeCount,
    country: profile.country,
  }
}

export const requestModelDraft = adminMutation({
  args: { description: v.optional(v.string()) },
  returns: v.id("suggestions"),
  handler: async (ctx, { description }) => {
    const profile = await requireCompleteProfile(ctx, ctx.orgId)
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: "model.draft", modelId: model._id },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
    })
    // Spread description only when present: an explicit undefined is not a
    // valid Convex value and would fail scheduler arg serialization.
    await ctx.scheduler.runAfter(0, internal.ai.generate.generateModelDraft, {
      suggestionId,
      ...profile,
      ...(description !== undefined ? { description } : {}),
    })
    return suggestionId
  },
})

export const requestImportanceReview = adminMutation({
  args: {},
  returns: v.id("suggestions"),
  handler: async (ctx) => {
    const profile = await requireCompleteProfile(ctx, ctx.orgId)
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const criteria = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    if (criteria.length === 0) throw appError(ERROR_CODES.invalidInput)
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: "model.importanceReview", modelId: model._id },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
    })
    await ctx.scheduler.runAfter(0, internal.ai.generate.reviewImportances, {
      suggestionId,
      ...profile,
      criteria: criteria.map((criterion) => ({
        criterionId: criterion._id as string,
        name: criterion.name,
        importanceLevel: criterion.importanceLevel,
      })),
    })
    return suggestionId
  },
})

interface DraftCriterion {
  name: string
  description: string
  helpText: string
  importanceLevel: number
  anchors: string[]
}

export const confirmModelDraft = adminMutation({
  args: {
    suggestionId: v.id("suggestions"),
    acceptedIndexes: v.array(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, acceptedIndexes }) => {
    const suggestion = await ctx.db.get(suggestionId)
    if (
      suggestion === null ||
      suggestion.orgId !== ctx.orgId ||
      suggestion.target.kind !== "model.draft" ||
      suggestion.status !== "suggested"
    ) {
      throw appError(ERROR_CODES.notFound)
    }
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const draft = suggestion.suggestedValue as { criteria: DraftCriterion[] }
    const existing = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    let order = existing.length
    const accepted = [...new Set(acceptedIndexes)].filter(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < draft.criteria.length
    )
    for (const index of accepted) {
      const criterion = draft.criteria[index]
      if (
        !IMPORTANCE_LEVELS.includes(
          criterion.importanceLevel as ImportanceLevel
        ) ||
        criterion.anchors.length !== 6
      ) {
        continue
      }
      order += 1
      const criterionId = await ctx.db.insert("criteria", {
        orgId: ctx.orgId,
        modelId: model._id,
        name: criterion.name,
        description: criterion.description,
        helpText: criterion.helpText,
        importanceLevel: criterion.importanceLevel,
        order,
        isCustom: true,
      })
      for (const [level, text] of criterion.anchors.entries()) {
        await ctx.db.insert("criterionAnchors", { criterionId, level, text })
      }
    }
    await ctx.db.patch(suggestionId, {
      status: accepted.length > 0 ? "confirmed" : "rejected",
      confirmedBy: ctx.authUserId,
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.aiSuggestionConfirmed,
      actorId: ctx.authUserId,
      payload: {
        suggestionId,
        kind: "model.draft",
        acceptedCount: accepted.length,
      },
    })
    return null
  },
})

export const confirmImportanceReview = adminMutation({
  args: {
    suggestionId: v.id("suggestions"),
    acceptedCriterionIds: v.array(v.id("criteria")),
  },
  returns: v.null(),
  handler: async (ctx, { suggestionId, acceptedCriterionIds }) => {
    const suggestion = await ctx.db.get(suggestionId)
    if (
      suggestion === null ||
      suggestion.orgId !== ctx.orgId ||
      suggestion.target.kind !== "model.importanceReview" ||
      suggestion.status !== "suggested"
    ) {
      throw appError(ERROR_CODES.notFound)
    }
    const value = suggestion.suggestedValue as {
      adjustments: {
        criterionId: string
        suggestedImportanceLevel: number
        motivation: string
      }[]
    }
    const acceptedSet = new Set<string>(acceptedCriterionIds)
    let appliedCount = 0
    for (const adjustment of value.adjustments) {
      if (!acceptedSet.has(adjustment.criterionId)) continue
      if (
        !IMPORTANCE_LEVELS.includes(
          adjustment.suggestedImportanceLevel as ImportanceLevel
        )
      ) {
        continue
      }
      const criterionDocId = ctx.db.normalizeId(
        "criteria",
        adjustment.criterionId
      )
      if (criterionDocId === null) continue
      const criterion = await ctx.db.get(criterionDocId)
      if (criterion === null || criterion.orgId !== ctx.orgId) continue
      await ctx.db.patch(criterionDocId, {
        importanceLevel: adjustment.suggestedImportanceLevel,
      })
      appliedCount += 1
    }
    await ctx.db.patch(suggestionId, {
      status: appliedCount > 0 ? "confirmed" : "rejected",
      confirmedBy: ctx.authUserId,
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.aiSuggestionConfirmed,
      actorId: ctx.authUserId,
      payload: {
        suggestionId,
        kind: "model.importanceReview",
        appliedCount,
      },
    })
    return null
  },
})

export const rejectSuggestion = adminMutation({
  args: { suggestionId: v.id("suggestions") },
  returns: v.null(),
  handler: async (ctx, { suggestionId }) => {
    const suggestion = await ctx.db.get(suggestionId)
    if (suggestion === null || suggestion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    await ctx.db.patch(suggestionId, {
      status: "rejected",
      confirmedBy: ctx.authUserId,
    })
    return null
  },
})

// Open suggestions drive the reactive AI panels (spinner on "generating",
// review list on "suggested", translated error on "failed").
export const getOpenSuggestions = orgQuery({
  args: {},
  returns: v.array(
    v.object({
      suggestionId: v.id("suggestions"),
      kind: v.string(),
      status: v.string(),
      suggestedValue: v.any(),
      errorCode: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx) => {
    const open = []
    for (const status of ["generating", "suggested", "failed"] as const) {
      const rows = await ctx.db
        .query("suggestions")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", ctx.orgId).eq("status", status)
        )
        .collect()
      open.push(...rows)
    }
    return open.map((row) => ({
      suggestionId: row._id,
      kind: row.target.kind,
      status: row.status,
      suggestedValue: row.suggestedValue ?? null,
      errorCode: row.errorCode ?? null,
    }))
  },
})
```

- [ ] **Step 7: Write the tests** (the AI action itself is not executed in tests; the network boundary is covered by the persist/confirm mutations plus the request mutation's row + scheduling)

```ts
import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

const DRAFT = {
  criteria: [
    {
      name: "Komplexitet",
      description: "Hur svåra problem rollen hanterar.",
      helpText: "Bedöm mot ankartexterna.",
      importanceLevel: 5,
      anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
    },
    {
      name: "Ogiltig",
      description: "d",
      helpText: "h",
      importanceLevel: 9,
      anchors: ["a0", "a1", "a2", "a3", "a4", "a5"],
    },
  ],
}

async function seedScratchWorkspace(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@acme.se", name: "HR Person", role: "admin" }
  )
  await t.run(async (ctx) => {
    await ctx.db.insert("workspaceProfiles", {
      orgId,
      country: "se",
      currency: "SEK",
      language: "sv",
      employeeCount: 25,
      businessType: "saasTech",
    })
  })
  const asAdmin = t.withIdentity({ subject: userId })
  await asAdmin.mutation(api.evaluationModel.model.createEmptyModel, {
    orgId,
    name: "Scratch",
  })
  return { orgId, asAdmin }
}

describe("AI suggestion lifecycle", () => {
  it("requestModelDraft inserts a generating row with provenance", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchWorkspace(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId, description: "Vi bygger HR-mjukvara." }
    )
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("generating")
      expect(suggestion?.source).toBe("ai")
      expect(suggestion?.target.kind).toBe("model.draft")
      expect(suggestion?.model?.provider).toBe("mistral")
    })
  })

  it("requires a complete profile", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role: "admin" }
    )
    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.ai.suggest.requestModelDraft, { orgId })
    ).rejects.toThrow(/errors.profileIncomplete/)
  })

  it("confirmModelDraft inserts only valid accepted criteria and audits", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchWorkspace(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await t.mutation(internal.ai.persist.saveDraft, {
      suggestionId,
      criteria: DRAFT.criteria,
    })
    await asAdmin.mutation(api.ai.suggest.confirmModelDraft, {
      orgId,
      suggestionId,
      acceptedIndexes: [0, 1, 7],
    })
    await t.run(async (ctx) => {
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      // index 1 has importanceLevel 9 (off scale) and is skipped; index 7 is out of range.
      expect(criteria).toHaveLength(1)
      expect(criteria[0]?.name).toBe("Komplexitet")
      expect(criteria[0]?.isCustom).toBe(true)
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("confirmed")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionConfirmed")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })
  })

  it("markFailed stores a translatable error code", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchWorkspace(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestModelDraft,
      { orgId }
    )
    await t.mutation(internal.ai.persist.markFailed, {
      suggestionId,
      errorCode: "errors.aiGenerationFailed",
    })
    const open = await asAdmin.query(api.ai.suggest.getOpenSuggestions, {
      orgId,
    })
    expect(open).toHaveLength(1)
    expect(open[0]?.status).toBe("failed")
    expect(open[0]?.errorCode).toBe("errors.aiGenerationFailed")
  })
})
```

Note: scheduled actions are NOT run by these tests (they would hit the network). convex-test does not run scheduled functions automatically and does not warn about pending ones at test end (verified against convex-test 0.0.53), so the node action is never executed and no network call occurs. Do not add fake timers.

- [ ] **Step 8: Set the deployment env vars** (manual, once per deployment)

```bash
cd packages/backend && bunx convex env set MISTRAL_API_KEY <key>
```

Document in `packages/backend/README.md` (Task 13). Without the key the action degrades to `errors.aiUnavailable`, which the UI translates; onboarding is never blocked by AI.

- [ ] **Step 9: Run the full backend suite, typecheck, commit**

Run: `bun run test && bun run typecheck`
Expected: PASS

```bash
git add packages/backend
git commit -m "feat(ai): EU-direct suggestion pipeline for model setup (ADR-0003 pattern)"
```

---

## Task 12: AI panels in the onboarding UI

**Files:**
- Replace stub: `apps/dashboard/components/onboarding/model-draft-panel.tsx`
- Replace stub: `apps/dashboard/components/onboarding/importance-review-panel.tsx`
- Modify: `apps/dashboard/components/onboarding/criterion-editor.tsx` (the draft panel is already mounted; verify)
- Create: `apps/dashboard/lib/error-label.ts` (typed AI error-code translation helper)
- Modify: `packages/i18n/messages/*.json`

- [ ] **Step 1: Add i18n keys** (under `dashboard.onboarding`; en then sv then mirrors)

```json
      "ai": {
        "heading": "AI assistance",
        "provenance": "AI-generated suggestion. Review and confirm; nothing is applied automatically.",
        "draftDescriptionLabel": "Describe your business (optional)",
        "draftCta": "Generate criteria drafts",
        "reviewCta": "Let AI review the importance levels",
        "generating": "Generating suggestions",
        "confirmCta": "Add selected",
        "applyCta": "Apply selected",
        "rejectCta": "Dismiss",
        "noAdjustments": "The AI found no adjustments to suggest.",
        "motivation": "Motivation"
      }
```

sv: "AI-assistans" / "AI-genererat förslag. Granska och bekräfta; inget tillämpas automatiskt." / "Beskriv er verksamhet (frivilligt)" / "Generera kriterieutkast" / "Låt AI gå igenom betydelserna" / "Genererar förslag" / "Lägg till valda" / "Tillämpa valda" / "Avfärda" / "AI:n hittade inga justeringar att föreslå." / "Motivering".

- [ ] **Step 2: Implement `model-draft-panel.tsx`**

First create `apps/dashboard/lib/error-label.ts`. Typed keys mean the translator rejects a runtime `string`, so the two AI error codes are narrowed explicitly (they are the only codes the AI actions persist; both keys exist from Task 3):

```ts
const AI_ERROR_KEYS = {
  "errors.aiUnavailable": "aiUnavailable",
  "errors.aiGenerationFailed": "aiGenerationFailed",
} as const

// Maps a persisted AI errorCode to its sub-key under the errors namespace;
// unknown codes fall back to the generic generation failure.
export function aiErrorSubKey(
  errorCode: string
): "aiUnavailable" | "aiGenerationFailed" {
  return (
    AI_ERROR_KEYS[errorCode as keyof typeof AI_ERROR_KEYS] ??
    "aiGenerationFailed"
  )
}
```

Behavior contract for `model-draft-panel.tsx` (full component, same idioms as Task 10):
- Renders a card with `ai.heading`, the provenance line `ai.provenance`, a textarea bound to a `description` state with label `ai.draftDescriptionLabel`, and a button `ai.draftCta` calling `api.ai.suggest.requestModelDraft({ orgId, ...(description.trim() !== "" ? { description: description.trim() } : {}) })`.
- Subscribes to `api.ai.suggest.getOpenSuggestions({ orgId })` and filters `kind === "model.draft"`.
- `status === "generating"`: spinner + `ai.generating`.
- `status === "failed"`: translate the persisted code with `const tErrors = useTranslations("errors")` and `tErrors(aiErrorSubKey(suggestion.errorCode ?? ""))`, plus the `ai.draftCta` button to retry.
- `status === "suggested"`: list `suggestedValue.criteria` with a checkbox each (default checked), showing name, description, and the importance LABEL via `tImportance(importanceLabelKey(criterion.importanceLevel))` from `@/lib/importance` (created in Task 10). Buttons: `ai.confirmCta` calls `confirmModelDraft({ orgId, suggestionId, acceptedIndexes })`; `ai.rejectCta` calls `rejectSuggestion({ orgId, suggestionId })`.

- [ ] **Step 3: Implement `importance-review-panel.tsx`** (replacing the Task 10 stub)

Same shape: button `ai.reviewCta` calling `requestImportanceReview({ orgId })`; renders open suggestions of `kind === "model.importanceReview"`; the suggested state lists `suggestedValue.adjustments` with checkboxes showing criterion name (resolve via the `model` prop passed from `ModelReview`), current importance label, suggested importance label (both via `importanceLabelKey`), and `motivation`. BOTH suggested states render the `ai.rejectCta` button calling `rejectSuggestion({ orgId, suggestionId })`: with adjustments it sits next to `ai.applyCta` (which calls `confirmImportanceReview({ orgId, suggestionId, acceptedCriterionIds })`); with an empty adjustments list the panel renders `ai.noAdjustments` and the dismiss button alone. Failed state translates via `aiErrorSubKey` exactly like the draft panel.

- [ ] **Step 4: Mount, verify end to end, commit**

The draft panel is already mounted in `criterion-editor.tsx` (Task 10); replace the stub bodies and verify both panels render. Run `bun run typecheck && bun run test`. Manual: with `MISTRAL_API_KEY` set on the dev deployment, run both AI flows; without it, confirm the translated `errors.aiUnavailable` failure state renders.

```bash
git add apps/dashboard packages/i18n/messages
git commit -m "feat(dashboard): embedded AI panels for criteria drafts and importance review"
```

---

## Task 13: ADR-0003 amendment, README, glossary touch-up

**Files:**
- Modify: `docs/adr/0003-ai-embedded-assistant.md`
- Modify: `packages/backend/README.md`
- Modify: `docs/contexts/assessment/CONTEXT.md` (AI-förslag entry already covers suggestions; verify no change needed, else note the new statuses)

- [ ] **Step 1: Amend ADR-0003** (Swedish, no em dashes; append a dated section)

```markdown
## Tillägg 2026-06-04: modellassistans i onboardingen och leverantörsval

**Scopeutökning (V1):** utöver jobbprofilgenerering omfattar V1 även
AI-assistans i onboardingens modellsteg: utkast på kriterier (namn,
beskrivning, hjälptext, betydelseetikett, ankartexter) i från
scratch-vägen, samt förslag på betydelsejusteringar i mallvägen. Samma
regler gäller: förslag med proveniens och status, HR bekräftar per post,
inget tillämpas automatiskt, och bekräftelser revisionsloggas
(ai.suggestionConfirmed). Statuslivscykeln utökas med "generating" och
"failed" (felkod som i18n-nyckel, aldrig display-text).

**Leverantörsbeslut:** Mistral La Plateforme anropas direkt från Convex
actions via AI SDK v6 (generateText + Output.object). EU-processing,
ingen träning på betald API enligt DPA; Zero Data Retention begärs i
DPA:t (godkännandepliktigt, inte självbetjäning). Dokumenterad fallback:
Azure OpenAI EU Data Zone (Sweden Central). **Vercel AI Gateway används
aldrig i datavägen:** den kan inte pinna EU-routing och bryter därmed
EU-datahemvisten (ADR-0001).
```

- [ ] **Step 2: Document env vars in `packages/backend/README.md`**

Add a section: `MISTRAL_API_KEY` (required for AI suggestions; absent key degrades to errors.aiUnavailable) and `MISTRAL_MODEL` (optional override, default mistral-large-latest), set via `bunx convex env set`.

- [ ] **Step 3: Commit**

```bash
git add docs/adr/0003-ai-embedded-assistant.md packages/backend/README.md docs/contexts
git commit -m "docs(adr): extend ADR-0003 V1 scope with onboarding model assistance and the EU provider decision"
```

---

## Task 14: Final verification sweep

- [ ] **Step 1: Full gates**

Run: `bun run typecheck && bun run test && bunx biome check .`
Expected: all green.

- [ ] **Step 2: Manual end-to-end walkthrough** (dev deployment)

1. `removeDevUser` + `seedDevUser` (NO `seedDevWorkspace`): sign in as hej@blueprnt.se.
2. Wizard step 1: create workspace; step 2: fill the profile (sv).
3. Path A: template; review shows 9 criteria with Swedish importance labels, no numeric weights anywhere, the Band-1-highest note; run the AI importance review; confirm one adjustment; finish; dashboard renders.
4. Reset (wipe org via dashboard data or re-seed) and walk Path B: scratch + manual criterion + AI drafts; confirm a subset; finish.
5. Verify audit rows exist for model.created and ai.suggestionConfirmed, and that signing in again lands directly in the dashboard.

- [ ] **Step 3: Self-review against the spec**

Walk `docs/superpowers/specs/2026-06-04-onboarding-design.md` requirement by requirement and check each maps to shipped behavior. Confirm: no hardcoded UI text, parity test green, no `<a>` for internal nav, no weight numbers in any payload or UI, backend throws only `errors.*` codes.

- [ ] **Step 4: Update the plan checkboxes and close out**

Mark all tasks done, note deviations inline, and commit any final fixes with conventional prefixes.

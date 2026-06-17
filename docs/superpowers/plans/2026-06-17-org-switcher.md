# Organisation switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a switch-only company picker at the top of the dashboard sidebar so a user who belongs to several companies can switch the active one, re-scoping the whole app.

**Architecture:** The active company is Better Auth's `session.activeOrganizationId`, set with `authClient.organization.setActive()` and read with the `useActiveOrganization()` / `useListOrganizations()` client hooks. blueprnt already passes `orgId` into every Convex call from `useOrganization()` context, so changing the active company re-runs every org-scoped query reactively, with no reload. `getOnboardingStatus` (the bootstrap query) becomes active-company aware; the onboarding gate resolves the active company client-side and passes it down.

**Tech Stack:** Convex (backend, convex-test + Vitest 4), Next.js 16 App Router, Better Auth 1.6.17 organization plugin, shadcn sidebar/dropdown, next-intl (5 locales), Biome.

**Spec:** `docs/superpowers/specs/2026-06-17-org-switcher-design.md`. **Decision record:** ADR-0007.

**Execution note:** This is larger work spanning `packages/backend` and `apps/dashboard`. Begin by creating an isolated worktree (superpowers:using-git-worktrees), e.g. `git worktree add ../org-switcher -b feat/org-switcher`, then `bun install` inside it and copy `packages/backend/.env.local` + `apps/dashboard/.env.local` from the main checkout. Land the result on main as one squash commit at the end (superpowers:finishing-a-development-branch). The pre-commit hook runs Biome + full typecheck + full `turbo run test` (cache-backed); never bypass it.

**Better Auth API caveat:** The hook names below (`authClient.useListOrganizations()`, `authClient.useActiveOrganization()`, `authClient.organization.setActive()`) are the standard organization-client API. Confirm them against the installed `better-auth@1.6.17` before relying on them (their return shape is `{ data, error, isPending }`); adapt names if 1.6.17 differs. The tests mock these, so test behaviour is independent of the exact runtime names.

---

## File structure

- `packages/backend/convex/betterAuth/testing.ts` (modify) — add `seedOrgForUser` test helper (attach an existing user to a second org).
- `packages/backend/convex/accounts/onboarding.ts` (modify) — `getOnboardingStatus` gains an optional `orgId` and selects that company (fallback: first membership).
- `packages/backend/convex/accounts/onboarding.test.ts` (modify) — multi-company selection + fallback tests.
- `apps/dashboard/lib/active-org.ts` (create) — `resolveActiveOrgId` pure helper.
- `apps/dashboard/lib/active-org.test.ts` (create) — its unit tests.
- `packages/i18n/messages/{en,sv,nb,da,fi}.json` (modify) — `dashboard.orgSwitcher.*` strings.
- `apps/dashboard/components/nav-organization.tsx` (create) — the switcher.
- `apps/dashboard/components/nav-organization.test.tsx` (create) — its component tests.
- `apps/dashboard/components/app-sidebar.tsx` (modify) — mount `<NavOrganization />` in a `<SidebarHeader>`.
- `apps/dashboard/components/onboarding/onboarding-gate.tsx` (modify) — resolve the active company and scope the gate to it.

---

## Task 1: Backend — active-company-aware onboarding status

**Files:**
- Modify: `packages/backend/convex/betterAuth/testing.ts`
- Modify: `packages/backend/convex/accounts/onboarding.ts:15-82`
- Test: `packages/backend/convex/accounts/onboarding.test.ts`

- [ ] **Step 1: Add the `seedOrgForUser` test helper**

Append to `packages/backend/convex/betterAuth/testing.ts` (after `seedDuplicateMember`):

```ts
// Test-only: attach an EXISTING user to a SECOND organisation, so multi-company
// switching can be exercised. Mirrors seedMembership but reuses the userId
// instead of creating a new user.
export const seedOrgForUser = mutation({
  args: { userId: v.string(), orgName: v.string(), role: v.string() },
  returns: v.object({ orgId: v.string() }),
  handler: async (ctx, { userId, orgName, role }) => {
    assertTestEnv()
    const now = Date.now()
    const orgId = await ctx.db.insert("organization", {
      name: orgName,
      slug: `${orgName.toLowerCase()}-${now}`,
      createdAt: now,
    })
    await ctx.db.insert("member", {
      organizationId: orgId,
      userId,
      role,
      createdAt: now,
    })
    return { orgId }
  },
})
```

- [ ] **Step 2: Regenerate Convex types so the app sees the new component function**

Run (from `packages/backend`): `bunx convex codegen`
Expected: succeeds; `components.betterAuth.testing.seedOrgForUser` becomes available and typed.

- [ ] **Step 3: Write the failing tests**

Add these two cases inside the `describe("getOnboardingStatus", ...)` block in `packages/backend/convex/accounts/onboarding.test.ts` (the `seedAdmin` helper and `components` import already exist):

```ts
it("selects the requested company when the caller belongs to several", async () => {
  const t = initConvexTest()
  const { orgId: orgA, userId } = await seedAdmin(t) // org "Acme"
  const { orgId: orgB } = await t.mutation(
    components.betterAuth.testing.seedOrgForUser,
    { userId, orgName: "Beta", role: "editor" }
  )
  const asUser = t.withIdentity({ subject: userId })

  const statusB = await asUser.query(
    api.accounts.onboarding.getOnboardingStatus,
    { orgId: orgB }
  )
  expect(statusB?.organization).toEqual({
    orgId: orgB,
    name: "Beta",
    role: "editor",
  })
  // Beta has no settings/model: it reads as not yet onboarded.
  expect(statusB?.settingsComplete).toBe(false)
  expect(statusB?.hasModel).toBe(false)

  const statusA = await asUser.query(
    api.accounts.onboarding.getOnboardingStatus,
    { orgId: orgA }
  )
  expect(statusA?.organization).toEqual({
    orgId: orgA,
    name: "Acme",
    role: "admin",
  })
})

it("falls back to the first membership for a stale or absent orgId", async () => {
  const t = initConvexTest()
  const { orgId: orgA, userId } = await seedAdmin(t)
  await t.mutation(components.betterAuth.testing.seedOrgForUser, {
    userId,
    orgName: "Beta",
    role: "editor",
  })
  const asUser = t.withIdentity({ subject: userId })

  // No arg: first membership (Acme).
  const noArg = await asUser.query(
    api.accounts.onboarding.getOnboardingStatus,
    {}
  )
  expect(noArg?.organization?.orgId).toBe(orgA)

  // Unknown orgId (not a membership): same fallback, never a foreign company.
  const stale = await asUser.query(
    api.accounts.onboarding.getOnboardingStatus,
    { orgId: "nonexistent" }
  )
  expect(stale?.organization?.orgId).toBe(orgA)
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run (from `packages/backend`): `bun run test -- onboarding`
Expected: the two new cases FAIL with an argument-validation error (`getOnboardingStatus` does not accept `orgId` yet). The existing `{}`-arg cases still pass.

- [ ] **Step 5: Implement the `orgId` selection in `getOnboardingStatus`**

In `packages/backend/convex/accounts/onboarding.ts`, change the header comment line `// V1 assumption: one organization per user; the first membership wins.` to `// Active company aware: uses the requested orgId when the caller is a member,` + `// else the first membership (covers no-arg callers and a stale active org).`, then replace `args: {}` and the membership-selection block. The full handler becomes:

```ts
export const getOnboardingStatus = query({
  args: { orgId: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      organization: v.union(
        v.null(),
        v.object({
          orgId: v.string(),
          name: v.string(),
          role: v.string(),
        })
      ),
      settingsComplete: v.boolean(),
      hasModel: v.boolean(),
      hasRoles: v.boolean(),
      completed: v.boolean(),
    })
  ),
  handler: async (ctx, { orgId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) return null
    const memberships = await ctx.runQuery(
      components.betterAuth.membership.listMembershipsForUser,
      { userId: identity.subject }
    )
    const selected =
      (orgId !== undefined
        ? memberships.find((m) => m.organizationId === orgId)
        : undefined) ?? memberships[0]
    if (selected === undefined) {
      return {
        organization: null,
        settingsComplete: false,
        hasModel: false,
        hasRoles: false,
        completed: false,
      }
    }
    const resolvedOrgId = selected.organizationId
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", resolvedOrgId))
      .unique()
    const settingsComplete =
      settings !== null &&
      !!settings.country &&
      !!settings.currency &&
      !!settings.language &&
      !!settings.industry
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", resolvedOrgId))
      .first()
    const firstRole = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", resolvedOrgId))
      .first()
    return {
      organization: {
        orgId: resolvedOrgId,
        name: selected.organizationName,
        role: selected.role,
      },
      settingsComplete,
      hasModel: model !== null,
      hasRoles: firstRole !== null,
      completed: typeof settings?.onboardingCompletedAt === "number",
    }
  },
})
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `packages/backend`): `bun run test -- onboarding`
Expected: all `getOnboardingStatus` cases PASS (new + existing).

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/betterAuth/testing.ts \
  packages/backend/convex/betterAuth/_generated \
  packages/backend/convex/_generated \
  packages/backend/convex/accounts/onboarding.ts \
  packages/backend/convex/accounts/onboarding.test.ts
git commit -m "feat(accounts): make onboarding status active-company aware

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Active-company resolver helper

**Files:**
- Create: `apps/dashboard/lib/active-org.ts`
- Test: `apps/dashboard/lib/active-org.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/lib/active-org.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { resolveActiveOrgId } from "./active-org"

const orgs = [
  { id: "a", name: "Acme" },
  { id: "b", name: "Beta" },
]

describe("resolveActiveOrgId", () => {
  it("returns null while the company list is loading", () => {
    expect(resolveActiveOrgId(undefined, undefined)).toBeNull()
    expect(resolveActiveOrgId(null, null)).toBeNull()
  })

  it("returns null when the user has no companies", () => {
    expect(resolveActiveOrgId(null, [])).toBeNull()
  })

  it("uses the active company when it is one of the memberships", () => {
    expect(resolveActiveOrgId("b", orgs)).toBe("b")
  })

  it("falls back to the first company when no active is set", () => {
    expect(resolveActiveOrgId(null, orgs)).toBe("a")
  })

  it("falls back to the first company when the active id is stale", () => {
    expect(resolveActiveOrgId("gone", orgs)).toBe("a")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/dashboard`): `bun run test -- active-org`
Expected: FAIL with "resolveActiveOrgId is not a function" / module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/dashboard/lib/active-org.ts`:

```ts
export interface OrgSummary {
  id: string
  name: string
}

// The active company is Better Auth's session.activeOrganizationId. Resolve the
// orgId the app should scope to: the active one when it is still a membership,
// else the first membership, else null (loading, or provisioned into none yet).
export function resolveActiveOrgId(
  activeId: string | null | undefined,
  orgs: OrgSummary[] | null | undefined
): string | null {
  if (activeId != null && orgs?.some((o) => o.id === activeId)) {
    return activeId
  }
  return orgs && orgs.length > 0 ? orgs[0].id : null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `apps/dashboard`): `bun run test -- active-org`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/lib/active-org.ts apps/dashboard/lib/active-org.test.ts
git commit -m "feat(dashboard): add active-company resolver helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: i18n strings for the switcher

**Files:**
- Modify: `packages/i18n/messages/en.json` (source/type base)
- Modify: `packages/i18n/messages/sv.json`, `nb.json`, `da.json`, `fi.json`

Add the keys with the editor (Edit/Write), never via shell `perl`/`sed` (that double-encodes non-ASCII; see the i18n note in CLAUDE.md). Insert an `"orgSwitcher"` object inside the existing top-level `"dashboard"` object of each file (e.g. directly after the `"nav"` block).

- [ ] **Step 1: Add to `en.json` (source) first**

```json
    "orgSwitcher": {
      "label": "Company",
      "switch": "Switch company"
    },
```

- [ ] **Step 2: Mirror to the other four locales**

`sv.json`:
```json
    "orgSwitcher": {
      "label": "Företag",
      "switch": "Byt företag"
    },
```
`nb.json` (machine-draft, flag for native review):
```json
    "orgSwitcher": {
      "label": "Selskap",
      "switch": "Bytt selskap"
    },
```
`da.json` (machine-draft, flag for native review):
```json
    "orgSwitcher": {
      "label": "Virksomhed",
      "switch": "Skift virksomhed"
    },
```
`fi.json` (machine-draft, flag for native review):
```json
    "orgSwitcher": {
      "label": "Yritys",
      "switch": "Vaihda yritystä"
    },
```

- [ ] **Step 3: Run the i18n parity test + typecheck**

Run (from `packages/i18n`): `bun run test`
Expected: parity test PASS (all five locales carry the same key set). Then run (from repo root) `bunx turbo run typecheck --filter=@workspace/i18n` and confirm the generated `Messages` type now includes `dashboard.orgSwitcher.label` / `.switch`.

Verify no mojibake (the non-ASCII `ö`, `ä` rendered correctly): `grep -n "orgSwitcher" -A2 packages/i18n/messages/sv.json packages/i18n/messages/fi.json` and eyeball that "Företag" / "yritystä" read correctly.

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages/en.json packages/i18n/messages/sv.json \
  packages/i18n/messages/nb.json packages/i18n/messages/da.json \
  packages/i18n/messages/fi.json
git commit -m "feat(i18n): add org switcher strings (nb/da/fi machine-draft)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: The switcher component

**Files:**
- Create: `apps/dashboard/components/nav-organization.tsx`
- Test: `apps/dashboard/components/nav-organization.test.tsx`

- [ ] **Step 1: Confirm the check-icon export name**

The trigger reuses `MoreVerticalCircle01Icon` (already imported by `nav-user.tsx`, confirmed to exist). The active-company check needs a tick icon. Confirm an export exists:

Run: `grep -roE "Tick[A-Za-z0-9]+Icon|CheckmarkCircle[A-Za-z0-9]*Icon" node_modules/@hugeicons/core-free-icons/*.d.ts | sort -u | head`
Use a confirmed name (candidates in order: `Tick02Icon`, `Tick01Icon`, `CheckmarkCircle02Icon`). Substitute it for `Tick02Icon` in the component below if that exact name is absent. The tests assert `aria-current`, not the icon, so they are unaffected by the choice.

- [ ] **Step 2: Write the failing test**

Create `apps/dashboard/components/nav-organization.test.tsx`:

```tsx
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const setActiveMock = vi.fn()
let orgsData: { id: string; name: string }[] = []
let activeData: { id: string; name: string } | null = null

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useListOrganizations: () => ({ data: orgsData }),
    useActiveOrganization: () => ({ data: activeData }),
    organization: { setActive: (...a: unknown[]) => setActiveMock(...a) },
  },
}))

vi.mock("@workspace/ui/components/sidebar", () => ({
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    ...props
  }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  useSidebar: () => ({ isMobile: false }),
}))

import { NavOrganization } from "@/components/nav-organization"

function renderSwitcher() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NavOrganization />
    </NextIntlClientProvider>
  )
}

// Radix menus open on pointerdown + click (idiom from nav-user.test.tsx).
function openMenu(triggerText: string) {
  const trigger = screen.getByText(triggerText).closest("button")
  if (!trigger) throw new Error("trigger not found")
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
  fireEvent.click(trigger)
}

describe("NavOrganization", () => {
  beforeEach(() => {
    setActiveMock.mockReset()
    setActiveMock.mockResolvedValue(undefined)
    orgsData = [
      { id: "a", name: "Acme" },
      { id: "b", name: "Beta" },
    ]
    activeData = { id: "a", name: "Acme" }
  })
  afterEach(() => cleanup())

  it("shows the active company on the trigger", () => {
    renderSwitcher()
    expect(screen.getByText("Acme")).toBeDefined()
  })

  it("lists the companies and marks the active one", async () => {
    renderSwitcher()
    openMenu("Acme")
    const acme = await screen.findByRole("menuitem", { name: /Acme/ })
    const beta = await screen.findByRole("menuitem", { name: /Beta/ })
    expect(acme.getAttribute("aria-current")).toBe("true")
    expect(beta.getAttribute("aria-current")).toBeNull()
  })

  it("switches to another company on click and never offers create", async () => {
    renderSwitcher()
    openMenu("Acme")
    const beta = await screen.findByRole("menuitem", { name: /Beta/ })
    fireEvent.click(beta)
    await waitFor(() => {
      expect(setActiveMock).toHaveBeenCalledWith({ organizationId: "b" })
    })
    expect(screen.queryByText(/add/i)).toBeNull()
  })

  it("does not switch when the active company is reselected", async () => {
    renderSwitcher()
    openMenu("Acme")
    const acme = await screen.findByRole("menuitem", { name: /Acme/ })
    fireEvent.click(acme)
    expect(setActiveMock).not.toHaveBeenCalled()
  })

  it("renders a single company with no other targets", async () => {
    orgsData = [{ id: "a", name: "Acme" }]
    activeData = { id: "a", name: "Acme" }
    renderSwitcher()
    openMenu("Acme")
    expect(await screen.findByRole("menuitem", { name: /Acme/ })).toBeDefined()
    expect(screen.queryByRole("menuitem", { name: /Beta/ })).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `apps/dashboard`): `bun run test -- nav-organization`
Expected: FAIL with module not found (`@/components/nav-organization`).

- [ ] **Step 4: Write the component**

Create `apps/dashboard/components/nav-organization.tsx` (mirrors `nav-user.tsx`; substitute the confirmed tick icon from Step 1 if `Tick02Icon` is absent):

```tsx
"use client"

import {
  MoreVerticalCircle01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
}

// Switch-only company picker. Companies and memberships are provisioned by a
// back-office admin interface (ADR-0007), so there is deliberately no create
// or add affordance here.
export function NavOrganization() {
  const { isMobile } = useSidebar()
  const t = useTranslations("dashboard")
  const orgs = authClient.useListOrganizations()
  const active = authClient.useActiveOrganization()

  const list = orgs.data ?? []
  const current = list.find((o) => o.id === active.data?.id) ?? list[0] ?? null
  if (current === null) return null

  async function handleSelect(orgId: string) {
    if (orgId === current?.id) return
    await authClient.organization.setActive({ organizationId: orgId })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={t("orgSwitcher.switch")}
              // Collapsed icon rail: only the avatar remains (mirrors NavUser).
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:-mx-px group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center"
            >
              <Avatar className="shrink-0 group-data-[collapsible=icon]:size-9">
                <AvatarFallback>{initialsOf(current.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{current.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {t("orgSwitcher.label")}
                </span>
              </div>
              <HugeiconsIcon
                icon={MoreVerticalCircle01Icon}
                strokeWidth={2}
                className="ml-auto size-4 group-data-[collapsible=icon]:hidden"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("orgSwitcher.label")}
            </DropdownMenuLabel>
            {list.map((org) => {
              const isActive = org.id === current?.id
              return (
                <DropdownMenuItem
                  key={org.id}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => handleSelect(org.id)}
                >
                  <Avatar className="size-6 shrink-0">
                    <AvatarFallback>{initialsOf(org.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{org.name}</span>
                  {isActive ? (
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      strokeWidth={2}
                      className="ml-auto size-4"
                    />
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run (from `apps/dashboard`): `bun run test -- nav-organization`
Expected: PASS (5 cases).

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/nav-organization.tsx \
  apps/dashboard/components/nav-organization.test.tsx
git commit -m "feat(dashboard): switch-only org switcher component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Mount the switcher and scope the app to the active company

**Files:**
- Modify: `apps/dashboard/components/app-sidebar.tsx:9-14,46-58`
- Modify: `apps/dashboard/components/onboarding/onboarding-gate.tsx` (full body)

- [ ] **Step 1: Confirm `getOnboardingStatus` has no other no-arg callers**

Run: `grep -rn "getOnboardingStatus" apps/dashboard packages/backend --include=*.ts --include=*.tsx`
Expected: only `onboarding-gate.tsx` (the call site we change next) and `onboarding.ts`/`onboarding.test.ts`. If another caller exists, it keeps working (the arg is optional) but note it.

- [ ] **Step 2: Mount the switcher in the sidebar header**

In `apps/dashboard/components/app-sidebar.tsx`, add `SidebarHeader` to the sidebar import and `NavOrganization` to the component imports, then render the header. The import block and JSX become:

```tsx
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"
import type * as React from "react"
import { type NavItem, NavMain } from "@/components/nav-main"
import { NavOrganization } from "@/components/nav-organization"
import { NavUser } from "@/components/nav-user"
```

```tsx
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavOrganization />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
```

- [ ] **Step 3: Rewrite the onboarding gate to resolve the active company**

Replace the whole body of `apps/dashboard/components/onboarding/onboarding-gate.tsx` with (keeping the existing explanatory comments at the top of the file for the wizard-ownership rationale, now moved onto `OnboardingSession`):

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import type { FunctionReturnType } from "convex/server"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { authClient } from "@/lib/auth-client"
import { resolveActiveOrgId } from "@/lib/active-org"

type Status = NonNullable<
  FunctionReturnType<typeof api.accounts.onboarding.getOnboardingStatus>
>

function GateSpinner(props: { label: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <Spinner aria-label={props.label} />
    </main>
  )
}

// Resolves the active company (Better Auth's session.activeOrganizationId) and
// scopes the gate to it. Switching companies re-runs getOnboardingStatus and,
// through OrganizationProvider, re-scopes every org query reactively.
export function OnboardingGate(props: { children: ReactNode }) {
  const t = useTranslations("dashboard.onboarding")
  const orgs = authClient.useListOrganizations()
  const active = authClient.useActiveOrganization()

  const orgList = orgs.data ?? null
  const activeId = resolveActiveOrgId(active.data?.id, orgList)

  // Persist a default active company when none is set, so
  // session.activeOrganizationId is always populated on the next load.
  useEffect(() => {
    if (active.data == null && orgList && orgList.length > 0) {
      void authClient.organization.setActive({
        organizationId: orgList[0].id,
      })
    }
  }, [active.data, orgList])

  const status = useQuery(
    api.accounts.onboarding.getOnboardingStatus,
    activeId !== null ? { orgId: activeId } : "skip"
  )

  // Memberships still loading.
  if (orgList === null) return <GateSpinner label={t("loading")} />
  // Signed in but provisioned into no company yet (rare: provisioning is
  // back-office and signup is disabled). Nothing to render.
  if (orgList.length === 0) return null
  // Active company resolved, its status query still loading.
  if (status === undefined || status === null) {
    return <GateSpinner label={t("loading")} />
  }

  // Keyed by the active company so switching resets the wizard-ownership state.
  return (
    <OnboardingSession key={activeId ?? "none"} status={status}>
      {props.children}
    </OnboardingSession>
  )
}

// First-run gate for one company: holds the user in the wizard until the
// organization, its settings, and model exist AND setup was explicitly
// finished. The wizard OWNS the session once started (it stays mounted even
// after hasModel flips, so the model review and AI panels are not skipped)
// until it calls onFinished. Completion is explicit server state
// (status.completed), never inferred from hasModel.
function OnboardingSession(props: { status: Status; children: ReactNode }) {
  const { status } = props
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionFinished, setSessionFinished] = useState(false)
  const incomplete =
    status.organization === null ||
    !status.settingsComplete ||
    !status.hasModel ||
    !status.completed
  useEffect(() => {
    if (incomplete) setSessionStarted(true)
  }, [incomplete])

  const showWizard = incomplete || (sessionStarted && !sessionFinished)
  if (!showWizard) {
    // completed implies the organization exists; null here would be a server
    // bug, so degrade to nothing rather than crash the shell.
    if (status.organization === null) return null
    return (
      <AppShell
        organization={{
          orgId: status.organization.orgId,
          name: status.organization.name,
          role: status.organization.role,
        }}
      >
        {props.children}
      </AppShell>
    )
  }
  return (
    <OnboardingWizard
      status={status}
      onFinished={() => setSessionFinished(true)}
    />
  )
}
```

- [ ] **Step 4: Typecheck**

Run (from repo root): `bunx turbo run typecheck --filter=@workspace/dashboard`
Expected: PASS. If `OnboardingWizard`'s `status` prop type does not accept `Status`, align it (it received the same object shape before; the type is structurally identical).

- [ ] **Step 5: Run the full dashboard test suite**

Run (from `apps/dashboard`): `bun run test`
Expected: PASS, including the unchanged `nav-main`, `site-header`, `page` tests (the gate refactor must not regress them).

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/app-sidebar.tsx \
  apps/dashboard/components/onboarding/onboarding-gate.tsx
git commit -m "feat(dashboard): mount org switcher and scope app to active company

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Whole-suite check and manual verification

- [ ] **Step 1: Run the full cache-backed suite**

Run (from repo root): `bunx turbo run test typecheck`
Expected: all packages PASS.

- [ ] **Step 2: Seed a second company for the dev user and verify by hand**

With the dev backend running, seed a second company for the existing dev user (the existing seed is idempotent by slug; a different slug makes a second org):

```bash
cd packages/backend
bunx convex run seed:seedDevOrganization '{"name":"Acme Norge","slug":"acme-norge"}'
```

Then in the dashboard (signed in as `hej@blueprnt.se`): confirm the switcher appears at the top of the sidebar showing the current company; open it and confirm both companies are listed with a check on the active one and no "add"/create action; switch to the other company and confirm the band/role/model views re-scope (the roles list changes) without a full page reload; collapse the sidebar (cmd+b) and confirm the switcher shows avatar-only.

- [ ] **Step 3: Finish the branch**

Use superpowers:finishing-a-development-branch: squash-merge `feat/org-switcher` onto main from the main checkout (`git merge --squash`), verify containment (`git diff feat/org-switcher main --stat` is empty), then remove the worktree and delete the branch. Do not push without explicit approval.

---

## Self-review

**Spec coverage:** Active company = Better Auth session field (Task 5 gate + Task 4 component). Switch-only, no create/invite (Task 4 component + its test asserting no add). `getOnboardingStatus` active-company aware (Task 1). Switcher in `SidebarHeader` mirroring `nav-user` (Task 4 + Task 5 mount). Single-company shows identity (Task 4 component + test). Stale active fallback (Task 1 backend + Task 2 helper). Switch into not-onboarded company routes to onboarding (Task 5 gate keyed by activeId + Task 1 returning that company's flags). i18n in 5 locales (Task 3). Tests: backend (Task 1), helper (Task 2), component (Task 4); manual multi-company via seed (Task 6). Collapsed-rail behaviour (Task 4 classes + Task 6 manual). Non-goals (create/invite/members, onboarding first-org path, org-scoping internals, billing label, URL/cookie store) are untouched.

**Placeholder scan:** No TBD/TODO. The only "verify during implementation" items are genuine library-API confirmations (Better Auth hook names; the hugeicons tick export), each with concrete candidates and a fallback, and neither blocks the tested logic.

**Type consistency:** `getOnboardingStatus` returns the same object shape (only `args` gained optional `orgId`); the gate consumes it via `FunctionReturnType`. `resolveActiveOrgId(activeId, orgs)` is called with `active.data?.id` and `orgList` in the gate, matching its `(string | null | undefined, OrgSummary[] | null | undefined)` signature. `setActive({ organizationId })` shape is identical in the component, the gate, and the component test mock. The switcher reads `useListOrganizations().data` / `useActiveOrganization().data`, matching the test mock shapes.

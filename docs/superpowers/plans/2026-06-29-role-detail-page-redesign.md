# Role detail page redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the role detail page coherent: merge the Rating and Result cards into one stateful Evaluation card, and move the Edit trigger back onto the profile card (reverting this session's "Edit in the menu" change).

**Architecture:** A new `RoleEvaluationCard` replaces `RoleRatingCard` + `RoleResultCard`, switching between a progress/CTA view and a weighting/band/breakdown view from the role's props (and `getRoleResult` for the result data). `RoleProfileCard` returns to owning its own `editing` state with an in-header Edit/Save button, so the `...` actions menu reverts to Archive-only. The page keeps its two-column grid; the right rail goes from three cards to two (Evaluation + Anchor).

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Convex, next-intl, shadcn/ui, Motion, Vitest 4 + Testing Library.

## Global Constraints

- All user-facing text via i18n (`next-intl`). New strings land in `packages/i18n/messages/en.json` first, mirrored to `sv`, `nb`, `da`, `fi`; the parity test fails if any locale's key set differs from `en`. New Nordic strings are drafts to flag for native review.
- Never use em dashes in copy, comments, or commit messages.
- Add non-ASCII locale strings with the Write/Edit tools, never via shell `perl`/`sed` (it double-encodes). Grep for mojibake after editing locale files.
- No legacy before launch: when a component is replaced, delete it (and its tests and now-orphaned i18n keys) in the same change.
- Domain terminology: the act is Evaluate/Evaluated; the 0-100 number is the Weighting; the computed weight is the Band. Never "Score".
- Entity/row actions use a `DropdownMenu` (ghost-or-outline icon trigger + aria-label); a destructive item uses `variant="destructive"` and opens an `AlertDialog`.
- Guidance: never stack more than one help popover on the same heading/row; state preconditions in words rather than silently hiding controls.
- shadcn vendor code (`packages/ui/src/*`) is not edited.
- Tests run with Vitest 4 via `bun run test` (never `bun test`). New code ships with tests in the same commit. The pre-commit hook runs Biome, a full typecheck, and the full `turbo run test`; all must pass; never `--no-verify`.
- Minimize layout shift; respect reduced motion (the global `MotionConfig`).

---

### Task 1: Add the `evaluationHeading` i18n key

**Files:**
- Modify: `packages/i18n/messages/en.json` (under `dashboard.roles.detail`)
- Modify: `packages/i18n/messages/sv.json`, `nb.json`, `da.json`, `fi.json`
- Test: `packages/i18n` parity test (existing)

**Interfaces:**
- Produces: `dashboard.roles.detail.evaluationHeading`, consumed by `RoleEvaluationCard` (Task 2).

- [ ] **Step 1: Add the key to `en.json`**

In `dashboard.roles.detail`, add directly after the `"profileHeading"` line:

```json
        "evaluationHeading": "Evaluation",
```

- [ ] **Step 2: Mirror to the other locales**

Add the same key at the same path (after `profileHeading`) in each file, with these draft values (flag for native review):

| locale | value |
|---|---|
| sv | Utvärdering |
| nb | Evaluering |
| da | Evaluering |
| fi | Arviointi |

Use the Edit tool, not shell. Find `"profileHeading"` within `dashboard.roles.detail` in each file as the anchor.

- [ ] **Step 3: Run the parity test and grep for mojibake**

Run: `cd packages/i18n && bun run test`
Expected: PASS (all locales share the same key set).
Run: `rg -n "Ã|Â|�" packages/i18n/messages` and expect no matches.

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages
git commit -m "feat(i18n): add the role evaluation card heading"
```

---

### Task 2: `RoleEvaluationCard` (merges Rating + Result)

**Files:**
- Create: `apps/dashboard/components/roles/role-evaluation-card.tsx`
- Test: `apps/dashboard/components/roles/role-evaluation-card.test.tsx`

**Interfaces:**
- Consumes: `dashboard.roles.detail.evaluationHeading` (Task 1); the existing `getRoleResult` query and `RoleCriterionBreakdown` (`@/components/roles/role-criterion-breakdown`), both unchanged.
- Produces: `RoleEvaluationCard({ orgId, roleId, slug, archived, profileComplete, ratedCount, totalCriteria })`. Consumed by the role page (Task 3).

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/roles/role-evaluation-card.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { RoleEvaluationCard } from "@/components/roles/role-evaluation-card"

const detail = messages.dashboard.roles.detail
const roles = messages.dashboard.roles

type Result = {
  roleId: string
  title: string
  complete: boolean
  ratedCount: number
  totalCriteria: number
  score: number | null
  band: number | null
  criteria: {
    criterionId: string
    name: string
    weightPoints: number
    value: number | null
    motivation: string | null
  }[]
}

function setResult(next: Result | null) {
  onQuery((ref) =>
    ref === "assessment.results.getRoleResult" ? next : undefined
  )
}

function renderCard(
  props: {
    archived?: boolean
    profileComplete?: boolean
    ratedCount?: number
    totalCriteria?: number
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleEvaluationCard
        orgId="org_1"
        roleId="role_1"
        slug="r1"
        archived={props.archived ?? false}
        profileComplete={props.profileComplete ?? true}
        ratedCount={props.ratedCount ?? 0}
        totalCriteria={props.totalCriteria ?? 5}
      />
    </NextIntlClientProvider>
  )
}

describe("RoleEvaluationCard", () => {
  beforeEach(() => setResult(null))
  afterEach(() => cleanup())

  it("states the precondition and offers no rate action when the profile is incomplete", () => {
    renderCard({ profileComplete: false, ratedCount: 0, totalCriteria: 5 })
    expect(screen.getByText(detail.profileIncomplete)).toBeDefined()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("offers Rate role when complete and nothing is rated", () => {
    renderCard({ ratedCount: 0, totalCriteria: 5 })
    const link = screen.getByRole("link", { name: detail.rateCta })
    expect(link.getAttribute("href")).toBe("/roles/r1/rate")
  })

  it("offers Continue while partially rated", () => {
    renderCard({ ratedCount: 2, totalCriteria: 5 })
    expect(
      screen.getByRole("link", { name: detail.resumeRateCta })
    ).toBeDefined()
  })

  it("shows the weighting, band, breakdown, and Adjust once complete", () => {
    setResult({
      roleId: "role_1",
      title: "Engineer",
      complete: true,
      ratedCount: 3,
      totalCriteria: 3,
      score: 71,
      band: 3,
      criteria: [
        { criterionId: "scope", name: "Scope", weightPoints: 5, value: 3, motivation: null },
        { criterionId: "complexity", name: "Complexity", weightPoints: 4, value: 5, motivation: null },
        { criterionId: "people", name: "People", weightPoints: 2, value: 1, motivation: null },
      ],
    })
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(screen.getByText("71 / 100")).toBeDefined()
    expect(screen.getByText("Band 3")).toBeDefined()
    expect(screen.getByText("Complexity")).toBeDefined()
    expect(
      screen.getByRole("link", { name: detail.adjustRateCta })
    ).toBeDefined()
  })

  it("stays read-only for an archived role (no rate action)", () => {
    renderCard({ archived: true, ratedCount: 5, totalCriteria: 5 })
    expect(screen.getByText(roles.evaluated)).toBeDefined()
    expect(screen.queryByRole("link")).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- role-evaluation-card`
Expected: FAIL with module-not-found for `@/components/roles/role-evaluation-card`.

- [ ] **Step 3: Implement the component**

Create `apps/dashboard/components/roles/role-evaluation-card.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { HelpMorphButton } from "@/components/help-morph-button"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"

// One card for the whole evaluation lifecycle. While incomplete it shows the
// progress and the entry into the blind stepper; once complete it shows the
// weighting, band, and per-criterion breakdown. Replaces the separate Rating
// and Result cards. The result view applies only to a live, fully-evaluated
// role: an archived role has left the results set, so it stays read-only.
export function RoleEvaluationCard({
  orgId,
  roleId,
  slug,
  archived,
  profileComplete,
  ratedCount,
  totalCriteria,
}: {
  orgId: string
  roleId: string
  slug: string
  archived: boolean
  profileComplete: boolean
  ratedCount: number
  totalCriteria: number
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tRoles = useTranslations("dashboard.roles")
  const tHelp = useTranslations("dashboard.help")
  const tResult = useTranslations("dashboard.rating.result")
  const tAssessment = useTranslations("assessment")
  const locale = useLocale()

  const evaluated = totalCriteria > 0 && ratedCount === totalCriteria
  // The view is chosen from the props so it never flashes; the query only
  // fills the result data.
  const showResult = evaluated && !archived

  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })

  const ctaLabel =
    ratedCount === 0
      ? t("rateCta")
      : ratedCount < totalCriteria
        ? t("resumeRateCta")
        : t("adjustRateCta")

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {t("evaluationHeading")}
          {showResult ? (
            <HelpMorphButton label={tHelp("scoreLabel")}>
              {tHelp("scoreBody")}
            </HelpMorphButton>
          ) : (
            <HelpMorphButton label={tHelp("blindRatingLabel")}>
              {tHelp("blindRatingBody")}
            </HelpMorphButton>
          )}
        </CardTitle>
        {showResult && result != null && result.complete && (
          <div className="flex items-center gap-4">
            <span className="font-semibold text-2xl tabular-nums">
              {tResult("scoreOutOf", { score: result.score ?? 0 })}
            </span>
            <Badge>{`${tAssessment("band")} ${result.band}`}</Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showResult ? (
          result != null && result.complete ? (
            <>
              <p className="text-muted-foreground text-sm">
                {tResult("bandHighest")}
              </p>
              <RoleCriterionBreakdown criteria={result.criteria} />
              <Button asChild variant="outline" size="sm">
                <Link href={`/roles/${slug}/rate`}>{t("adjustRateCta")}</Link>
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {tResult("computing")}
            </p>
          )
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {evaluated ? tRoles("evaluated") : tRoles("notEvaluated")}
            </p>
            {!archived &&
              (profileComplete ? (
                <Button asChild>
                  <Link href={`/roles/${slug}/rate`}>{ctaLabel}</Link>
                </Button>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("profileIncomplete")}
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test -- role-evaluation-card`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/roles/role-evaluation-card.tsx apps/dashboard/components/roles/role-evaluation-card.test.tsx
git commit -m "feat(roles): add the merged role evaluation card"
```

---

### Task 3: Swap the page to the Evaluation card; delete the old cards

**Files:**
- Modify: `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`
- Delete: `apps/dashboard/components/roles/role-rating-card.tsx`, `role-rating-card.test.tsx`, `role-result-card.tsx`, `role-result-card.test.tsx`
- Modify: `packages/i18n/messages/*.json` (remove orphaned keys)

**Interfaces:**
- Consumes: `RoleEvaluationCard` (Task 2).

- [ ] **Step 1: Confirm the old cards have no other consumers**

Run: `rg -n "RoleRatingCard|RoleResultCard" apps`
Expected: matches only in `app/(app)/roles/[roleSlug]/page.tsx` (the imports and the two render sites) and in the two card files plus their tests. If anything else imports them, stop and report.

- [ ] **Step 2: Rewire the page to render `RoleEvaluationCard`**

In `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`, replace the two import lines:

```tsx
import { RoleProfileCard } from "@/components/roles/role-profile-card"
import { RoleRatingCard } from "@/components/roles/role-rating-card"
import { RoleResultCard } from "@/components/roles/role-result-card"
```

with:

```tsx
import { RoleEvaluationCard } from "@/components/roles/role-evaluation-card"
import { RoleProfileCard } from "@/components/roles/role-profile-card"
```

Then replace the rating + result render block (inside the right column `div`):

```tsx
          <RoleRatingCard
            slug={role.slug}
            archived={role.archived}
            profileComplete={role.profileComplete}
            ratedCount={role.ratedCount}
            totalCriteria={role.totalCriteria}
          />
          <RoleResultCard orgId={orgId} roleId={role.roleId} />
```

with:

```tsx
          <RoleEvaluationCard
            orgId={orgId}
            roleId={role.roleId}
            slug={role.slug}
            archived={role.archived}
            profileComplete={role.profileComplete}
            ratedCount={role.ratedCount}
            totalCriteria={role.totalCriteria}
          />
```

(Leave the `AnchorRoleCard` after it unchanged.)

- [ ] **Step 3: Delete the old cards and their tests**

```bash
git rm apps/dashboard/components/roles/role-rating-card.tsx \
       apps/dashboard/components/roles/role-rating-card.test.tsx \
       apps/dashboard/components/roles/role-result-card.tsx \
       apps/dashboard/components/roles/role-result-card.test.tsx
```

- [ ] **Step 4: Remove the now-orphaned i18n keys**

The deleted cards were the only users of `dashboard.roles.detail.ratingHeading` and `dashboard.roles.detail.resultHeading`. Confirm:

Run: `rg -n "ratingHeading|resultHeading" apps packages/i18n/messages`
Expected: matches only the key definitions in the five message files (no code usage). If code still references either, stop and report.

Then remove the `"ratingHeading": ...` and `"resultHeading": ...` lines from `dashboard.roles.detail` in all five message files (`en`, `sv`, `nb`, `da`, `fi`). Keep `dashboard.rating.result.heading` (a different key, used by the rate flow).

- [ ] **Step 5: Run typecheck, the role tests, and the parity test**

Run: `cd apps/dashboard && bun run typecheck`
Expected: clean (no dangling imports; the page no longer references the deleted cards).
Run: `cd apps/dashboard && bun run test -- role-evaluation-card`
Expected: PASS.
Run: `cd packages/i18n && bun run test`
Expected: PASS (parity holds after the key removals).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(roles): replace the rating and result cards with the evaluation card"
```

---

### Task 4: Return Edit to the profile card (revert the menu-edit)

**Files:**
- Restore (to commit `5e7511b`, the state before the "Edit in the menu" change): `apps/dashboard/components/roles/role-profile-card.tsx`, `role-profile-card.test.tsx`, `role-actions-menu.tsx`, `role-actions-menu.test.tsx`
- Modify: `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`

**Interfaces:**
- After this task: `RoleProfileCard({ orgId, role })` (owns its own `editing` state, Edit/Save button in its header). `RoleActionsMenu({ orgId, roleId, archived, isAdmin })` (Archive-only, admin, hidden when archived). The page no longer holds an `editing` state.

- [ ] **Step 1: Restore the four files to their pre-menu-edit state**

Commit `5e7511b` is the commit immediately before `e25e9fe` ("move profile editing into the role actions menu"). Its versions of these files are exactly the target: `RoleProfileCard` with an internal `editing` state and an Edit/Save button in its header; `RoleActionsMenu` with the top-right outline trigger and an Archive-only menu; and their matching tests.

```bash
git checkout 5e7511b -- \
  apps/dashboard/components/roles/role-profile-card.tsx \
  apps/dashboard/components/roles/role-profile-card.test.tsx \
  apps/dashboard/components/roles/role-actions-menu.tsx \
  apps/dashboard/components/roles/role-actions-menu.test.tsx
```

Verify after restore: `role-profile-card.tsx` has `const [editing, setEditing] = useState(false)` and a header Button toggling `editCta`/`saveCta`; `role-actions-menu.tsx` has props `{ orgId, roleId, archived, isAdmin }`, `if (!isAdmin || archived) return null`, and a single Archive `DropdownMenuItem`. If a restored file does not match this, stop and report (the base commit may be wrong).

- [ ] **Step 2: Drop the lifted edit state and props from the page**

In `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`:

Remove the editing state and its comment:

```tsx
  // Edit mode for the profile card, lifted here so the role actions menu can
  // open it (the menu owns the Edit item; the card owns Save).
  const [editing, setEditing] = useState(false)
```

Change the React import back (no other `useState` use remains in this file):

```tsx
import { use } from "react"
```

Remove the menu's editing props so it matches the restored `RoleActionsMenu`:

```tsx
        <RoleActionsMenu
          orgId={orgId}
          roleId={role.roleId}
          archived={role.archived}
          isAdmin={orgRole === "admin"}
          editing={editing}
          onEdit={() => setEditing(true)}
        />
```

becomes:

```tsx
        <RoleActionsMenu
          orgId={orgId}
          roleId={role.roleId}
          archived={role.archived}
          isAdmin={orgRole === "admin"}
        />
```

Remove the profile card's editing props so it matches the restored `RoleProfileCard`:

```tsx
          <RoleProfileCard
            orgId={orgId}
            role={role}
            editing={editing}
            onEditingChange={setEditing}
          />
```

becomes:

```tsx
          <RoleProfileCard orgId={orgId} role={role} />
```

- [ ] **Step 3: Run typecheck and the affected tests**

Run: `cd apps/dashboard && bun run typecheck`
Expected: clean (the page, the restored card, and the restored menu agree on props; no unused `useState` import).
Run: `cd apps/dashboard && bun run test -- role-profile-card role-actions-menu`
Expected: PASS (the restored tests: the card's Edit button toggles to inputs and Save patches; the menu shows no trigger for a non-admin or an archived role, and an admin archives via the confirm dialog).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(roles): return profile editing to the card and revert the menu Edit item"
```

---

### Task 5: Verification

**Files:** none (verification).

- [ ] **Step 1: Run the full suite and typecheck**

Run (repo root): `bun run test` and `bun run typecheck`
Expected: all packages PASS; typecheck clean.

- [ ] **Step 2: Confirm the old cards are gone and unreferenced**

Run: `rg -n "RoleRatingCard|RoleResultCard|role-rating-card|role-result-card" apps`
Expected: no matches.

- [ ] **Step 3: Manual smoke (dev server)**

Verify by hand on a role page:
- Unrated role: the Evaluation card shows "Not yet evaluated" + a Rate role button (or the "complete the profile" precondition when purpose/responsibilities are empty); the `...` menu shows Archive for an admin only.
- Partly rated: Continue rating.
- Fully rated: the Evaluation card shows the Weighting, Band, breakdown, and Adjust ratings; the Anchor card shows for an admin.
- Archived role: read-only Evaluation card, no Rate CTA, no `...` menu.
- Edit: the Edit button sits on the profile card header (next to AI draft); clicking it turns the fields into inputs in place, and Save persists.

- [ ] **Step 4: No commit** (verification only). Fix any issue under the relevant task and re-run.

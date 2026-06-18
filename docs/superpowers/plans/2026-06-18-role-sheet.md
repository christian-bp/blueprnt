# RoleSheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a role in the Overview opens a right-side Sheet with a read-only summary of that role, instead of navigating. The sheet is an app-wide-reusable primitive.

**Architecture:** A `RoleSheetProvider` (mounted once in the app shell) holds the open `roleId` and renders one `<Sheet>`. `useRoleSheet()` exposes `openRole(roleId)`. `RoleChip` reads the context and becomes a button that opens the sheet when a provider is present, falling back to today's link otherwise. The per-criterion contribution list is extracted from `RoleResultCard` into a shared `RoleCriterionBreakdown` so the page and the sheet render the same animated breakdown.

**Tech Stack:** Next.js 16, React, `convex/react` reactive queries, shadcn `Sheet` (radix Dialog), `motion/react`, `next-intl`, Vitest 4 + Testing Library.

Spec: `docs/superpowers/specs/2026-06-18-role-sheet-design.md`.

Run all tests from `apps/dashboard` with `bunx vitest run <file>`. Never `bun test`.

---

### Task 1: Extract `RoleCriterionBreakdown`

Move the contribution-list logic out of `RoleResultCard` so the sheet can reuse it. No behavior change to the page.

**Files:**
- Create: `apps/dashboard/components/roles/role-criterion-breakdown.tsx`
- Create: `apps/dashboard/components/roles/role-criterion-breakdown.test.tsx`
- Modify: `apps/dashboard/components/roles/role-result-card.tsx`
- Modify: `apps/dashboard/components/roles/role-result-card.test.tsx`

- [ ] **Step 1: Write the breakdown component**

`apps/dashboard/components/roles/role-criterion-breakdown.tsx`:

```tsx
"use client"

import {
  criterionShares,
  type RatingValue,
  type WeightPoints,
} from "@workspace/core"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SPRING } from "@/lib/motion"

// One criterion as it arrives from getRoleResult.criteria.
export interface BreakdownCriterion {
  criterionId: string
  name: string
  value: number | null
  weightPoints: number
  motivation: string | null
}

// The per-criterion contribution list: each criterion's assessed value plus its
// share of the role's weighting (rating x weight, normalized to the total),
// sorted biggest-driver-first and animated on reweight. Shared by RoleResultCard
// (role page) and RoleSheet (overview quick-look) so the animation-sensitive
// logic lives in exactly one place (docs/ui-animation.md).
export function RoleCriterionBreakdown({
  criteria,
}: {
  criteria: BreakdownCriterion[]
}) {
  const tHelp = useTranslations("dashboard.help")
  const tResult = useTranslations("dashboard.rating.result")

  // Shares are derived live by the engine (ADR-0002), never stored.
  const shares = criterionShares(
    criteria.map((c) => ({
      criterionId: c.criterionId,
      value: (c.value ?? 0) as RatingValue,
    })),
    criteria.map((c) => ({
      criterionId: c.criterionId,
      weightPoints: c.weightPoints as WeightPoints,
    }))
  )
  const shareById = new Map(shares.map((s) => [s.criterionId, s.share]))
  // Sort by contribution desc; ties keep the model's canonical order (the
  // payload arrives in criterion order, so the array index is canonical).
  const rows = criteria
    .map((c, index) => ({
      ...c,
      share: shareById.get(c.criterionId) ?? 0,
      order: index,
    }))
    .sort((a, b) => b.share - a.share || a.order - b.order)
  // Bars normalize to the top driver; the printed percentage is the true share.
  const maxShare = rows.reduce((max, row) => Math.max(max, row.share), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
        {tResult("breakdownLabel")}
        <HelpMorphButton label={tHelp("contributionLabel")}>
          {tHelp("contributionBody")}
        </HelpMorphButton>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <motion.div
            key={row.criterionId}
            layout="position"
            transition={SPRING}
            className="space-y-1"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm">{row.name}</span>
              <span className="shrink-0 text-muted-foreground text-sm tabular-nums">
                {tResult("ratingOutOf", { value: row.value ?? 0 })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={false}
                  animate={{
                    width: `${maxShare > 0 ? (row.share / maxShare) * 100 : 0}%`,
                  }}
                  transition={SPRING}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
                {tResult("contributionShare", {
                  share: Math.round(row.share * 100),
                })}
              </span>
            </div>
            {row.motivation !== null && (
              <p className="text-muted-foreground text-xs">{row.motivation}</p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the breakdown test** (props-only, no convex mock needed)

`apps/dashboard/components/roles/role-criterion-breakdown.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import {
  type BreakdownCriterion,
  RoleCriterionBreakdown,
} from "@/components/roles/role-criterion-breakdown"

// contributions: Scope 15, Complexity 20, People 2 -> total 37
const CRITERIA: BreakdownCriterion[] = [
  { criterionId: "scope", name: "Scope", weightPoints: 5, value: 3, motivation: null },
  { criterionId: "complexity", name: "Complexity", weightPoints: 4, value: 5, motivation: null },
  { criterionId: "people", name: "People", weightPoints: 2, value: 1, motivation: null },
]

function renderBreakdown(criteria: BreakdownCriterion[] = CRITERIA) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleCriterionBreakdown criteria={criteria} />
    </NextIntlClientProvider>
  )
}

describe("RoleCriterionBreakdown", () => {
  afterEach(() => cleanup())

  it("sorts criteria by contribution, biggest driver first", () => {
    renderBreakdown()
    const names = screen
      .getAllByText(/^(Scope|Complexity|People)$/)
      .map((el) => el.textContent)
    expect(names).toEqual(["Complexity", "Scope", "People"])
  })

  it("shows the true contribution share per criterion (total 37)", () => {
    renderBreakdown()
    expect(screen.getByText("54%")).toBeTruthy()
    expect(screen.getByText("41%")).toBeTruthy()
    expect(screen.getByText("5%")).toBeTruthy()
  })

  it("shows each criterion's assessed value", () => {
    renderBreakdown()
    expect(screen.getByText("rated 5 / 5")).toBeTruthy()
  })

  it("gives a single criterion a 100% share", () => {
    renderBreakdown([CRITERIA[0] as BreakdownCriterion])
    expect(screen.getByText("100%")).toBeTruthy()
  })

  it("shows 0% for every criterion when all ratings are 0", () => {
    renderBreakdown(CRITERIA.map((c) => ({ ...c, value: 0 })))
    expect(screen.getAllByText("0%")).toHaveLength(3)
  })

  it("renders a criterion's motivation when present", () => {
    renderBreakdown([
      { ...(CRITERIA[0] as BreakdownCriterion), motivation: "Owns the whole platform." },
    ])
    expect(screen.getByText("Owns the whole platform.")).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run the breakdown test, expect PASS**

Run: `cd apps/dashboard && bunx vitest run components/roles/role-criterion-breakdown.test.tsx`
Expected: 6 passed.

- [ ] **Step 4: Rewrite `RoleResultCard` to use the breakdown**

Replace the body of `apps/dashboard/components/roles/role-result-card.tsx` with (keeps the query, Card chrome, score/band header, bandHighest line; delegates the rows):

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"

// Per-role result breakdown: weighting, band, and each criterion's contribution
// share. The contribution is the only per-criterion number that is both
// role-specific and weight-dependent, so it answers "how was this role weighted
// across the criteria" and is what reacts when the model is reweighted.
export function RoleResultCard({
  orgId,
  roleId,
}: {
  orgId: string
  roleId: string
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tHelp = useTranslations("dashboard.help")
  const tResult = useTranslations("dashboard.rating.result")
  const tAssessment = useTranslations("assessment")
  const locale = useLocale()
  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })

  if (result === undefined || result === null || !result.complete) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {t("resultHeading")}
          <HelpMorphButton label={tHelp("scoreLabel")}>
            {tHelp("scoreBody")}
          </HelpMorphButton>
        </CardTitle>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-2xl tabular-nums">
            {tResult("scoreOutOf", { score: result.score ?? 0 })}
          </span>
          <Badge>{`${tAssessment("band")} ${result.band}`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">{tResult("bandHighest")}</p>
        <RoleCriterionBreakdown criteria={result.criteria} />
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: Trim `role-result-card.test.tsx`** to what the card still owns (the breakdown specifics moved to Task 1 Step 2). Replace the `describe` body's `it` blocks with:

```tsx
  it("shows the weighting and band when complete", () => {
    renderCard()
    expect(screen.getByText("71 / 100")).toBeTruthy()
    expect(screen.getByText("Band 3")).toBeTruthy()
  })

  it("renders the criterion breakdown when complete", () => {
    renderCard()
    expect(screen.getByText("Complexity")).toBeTruthy()
    expect(screen.getByText("54%")).toBeTruthy()
  })

  it("renders nothing until the assessment is complete", () => {
    setResult({ ...result, complete: false })
    const { container } = renderCard()
    expect(container.textContent).toBe("")
  })
```

Keep the file's imports, mocks, `Result` type, `setResult`, `renderCard`, and `beforeEach` fixture unchanged.

- [ ] **Step 6: Run both test files, expect PASS**

Run: `cd apps/dashboard && bunx vitest run components/roles/role-criterion-breakdown.test.tsx components/roles/role-result-card.test.tsx`
Expected: all passed.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/components/roles/role-criterion-breakdown.tsx apps/dashboard/components/roles/role-criterion-breakdown.test.tsx apps/dashboard/components/roles/role-result-card.tsx apps/dashboard/components/roles/role-result-card.test.tsx
git commit -m "refactor(roles): extract RoleCriterionBreakdown from RoleResultCard"
```

---

### Task 2: Add the three i18n keys

Add `dashboard.roleSheet.{openRole,loading,progress}` to every locale. English first (the `Messages` type is generated from it), then sv, nb, da, fi. Use the Edit tool, never shell `perl`/`sed` (avoids double-encoding non-ASCII).

**Files:** `packages/i18n/messages/{en,sv,nb,da,fi}.json`

- [ ] **Step 1: Add to `en.json`** a new `roleSheet` block inside the `dashboard` object:

```json
"roleSheet": {
  "openRole": "Open role",
  "loading": "Loading role",
  "progress": "{rated} / {total} criteria assessed"
},
```

- [ ] **Step 2: Mirror to the other four locales** with the same key set:

`sv.json`:
```json
"roleSheet": {
  "openRole": "Öppna rollen",
  "loading": "Laddar rollen",
  "progress": "{rated} / {total} kriterier bedömda"
},
```
`nb.json`:
```json
"roleSheet": {
  "openRole": "Åpne rollen",
  "loading": "Laster rollen",
  "progress": "{rated} / {total} kriterier vurdert"
},
```
`da.json`:
```json
"roleSheet": {
  "openRole": "Åbn rollen",
  "loading": "Indlæser rollen",
  "progress": "{rated} / {total} kriterier vurderet"
},
```
`fi.json`:
```json
"roleSheet": {
  "openRole": "Avaa rooli",
  "loading": "Ladataan roolia",
  "progress": "{rated} / {total} kriteeriä arvioitu"
},
```

The sv/nb/da/fi strings are machine drafts: flag for native review.

- [ ] **Step 3: Verify parity and no mojibake**

Run: `cd packages/i18n && bunx vitest run`
Expected: parity test passes (every locale's key set equals en.json).
Run: `rg -n "Ã| Â|â€" packages/i18n/messages` from repo root.
Expected: no matches (clean non-ASCII, no double-encoding).

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages
git commit -m "feat(i18n): add roleSheet strings (open role, loading, progress)"
```

---

### Task 3: `RoleSheet` provider, hook, and content

**Files:**
- Create: `apps/dashboard/components/role-sheet.tsx`
- Create: `apps/dashboard/components/role-sheet.test.tsx`

- [ ] **Step 1: Write `role-sheet.tsx`**

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { AnchorIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react"
import { useOrganization } from "@/components/org-context"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"
import { ResponsibilitiesList } from "@/components/roles/responsibilities-list"
import { TrackBadge } from "@/components/track-badge"
import { statusBadgeVariant } from "@/lib/role-status"

interface RoleSheetContextValue {
  openRole: (roleId: string) => void
}

const RoleSheetContext = createContext<RoleSheetContextValue | null>(null)

// Required reader: any surface that must open the sheet.
export function useRoleSheet(): RoleSheetContextValue {
  const value = useContext(RoleSheetContext)
  if (value === null) {
    throw new Error("useRoleSheet must be used inside RoleSheetProvider")
  }
  return value
}

// Optional reader: lets a component (RoleChip) work with or without a provider.
export function useRoleSheetOptional(): RoleSheetContextValue | null {
  return useContext(RoleSheetContext)
}

// Holds the open role and renders the single Sheet. `roleId` persists while the
// sheet animates closed (and after), so the body never blanks mid-slide and
// reopening the same role is instant; `open` alone drives visibility.
export function RoleSheetProvider({ children }: { children: ReactNode }) {
  const [roleId, setRoleId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const openRole = useCallback((id: string) => {
    setRoleId(id)
    setOpen(true)
  }, [])

  return (
    <RoleSheetContext value={{ openRole }}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        {roleId !== null && (
          <RoleSheetContent roleId={roleId} onClose={() => setOpen(false)} />
        )}
      </Sheet>
    </RoleSheetContext>
  )
}

function RoleSheetContent({
  roleId,
  onClose,
}: {
  roleId: string
  onClose: () => void
}) {
  const t = useTranslations("dashboard.roleSheet")
  const tBands = useTranslations("dashboard.bands")
  const tRoles = useTranslations("dashboard.roles")
  const tDetail = useTranslations("dashboard.roles.detail")
  const tRole = useTranslations("assessment.role")
  const tStatus = useTranslations("assessment.status")
  const tAssessment = useTranslations("assessment")
  const tResult = useTranslations("dashboard.rating.result")
  const tFamily = useTranslations("dashboard.roles.family")
  const tModel = useTranslations("model")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const role = useQuery(api.assessment.roles.getRole, { orgId, roleId, locale })
  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })

  return (
    <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
      {role === undefined ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <Spinner aria-label={t("loading")} />
        </div>
      ) : role === null ? (
        <>
          <SheetHeader>
            <SheetTitle>{tDetail("notFound")}</SheetTitle>
          </SheetHeader>
        </>
      ) : (
        <>
          <SheetHeader>
            <SheetTitle>{role.title}</SheetTitle>
            <SheetDescription>{`${role.function} · ${role.team}`}</SheetDescription>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={statusBadgeVariant(role.status)}>
                {tStatus(role.status as "draft" | "inReview" | "approved")}
              </Badge>
              <TrackBadge trackKey={role.trackKey} name={role.trackName} short />
              {role.anchorRole !== null && (
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <HugeiconsIcon
                    icon={AnchorIcon}
                    size={12}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {tBands("anchorLabel")}
                </span>
              )}
              {role.anchorRole !== null &&
                result !== undefined &&
                result !== null &&
                result.band !== null &&
                result.band !== role.anchorRole.expectedBand && (
                  <Badge
                    variant="destructive"
                    title={tBands("deviationLabel", {
                      band: role.anchorRole.expectedBand,
                    })}
                  >
                    {tBands("deviation", { band: role.anchorRole.expectedBand })}
                  </Badge>
                )}
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 pb-4">
            {/* Result: weighting + band + breakdown when complete, else progress. */}
            <section className="space-y-3">
              {result !== undefined && result !== null && result.complete ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-2xl tabular-nums">
                      {tResult("scoreOutOf", { score: result.score ?? 0 })}
                    </span>
                    <Badge>{`${tAssessment("band")} ${result.band}`}</Badge>
                  </div>
                  <RoleCriterionBreakdown criteria={result.criteria} />
                </>
              ) : (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">
                    {tRoles("notEvaluated")}
                  </p>
                  <p className="text-muted-foreground text-sm tabular-nums">
                    {t("progress", {
                      rated: role.ratedCount,
                      total: role.totalCriteria,
                    })}
                  </p>
                </div>
              )}
            </section>

            {/* Profile (read-only). */}
            <section className="space-y-4">
              <h3 className="font-medium text-sm">{tDetail("profileHeading")}</h3>
              {role.purpose.trim().length > 0 && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">
                    {tRole("purpose")}
                  </p>
                  <p className="whitespace-pre-line text-sm">{role.purpose}</p>
                </div>
              )}
              {role.responsibilities.trim().length > 0 && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">
                    {tRole("responsibilities")}
                  </p>
                  <ResponsibilitiesList value={role.responsibilities} />
                </div>
              )}
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  {tModel("roleFamily")}
                </p>
                <p className="text-sm">{role.familyName ?? tFamily("none")}</p>
              </div>
            </section>
          </div>

          <SheetFooter>
            <Button asChild onClick={onClose}>
              <Link href={`/roles/${roleId}`}>{t("openRole")}</Link>
            </Button>
          </SheetFooter>
        </>
      )}
    </SheetContent>
  )
}
```

- [ ] **Step 2: Write `role-sheet.test.tsx`**

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

import { OrganizationProvider } from "@/components/org-context"
import { RoleSheetProvider, useRoleSheet } from "@/components/role-sheet"

type Role = ReturnType<typeof baseRole>
function baseRole() {
  return {
    roleId: "role_1",
    title: "Engineer",
    function: "Backend",
    team: "Platform",
    trackKey: "IC",
    trackName: "Individual contributor",
    purpose: "Builds the platform.",
    responsibilities: "Ship features\nReview code",
    status: "inReview",
    archived: false,
    profileComplete: true,
    ratedCount: 2,
    totalCriteria: 3,
    familyId: null,
    familyName: null,
    anchorRole: null,
    ratings: [],
  }
}
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

let role: Role | null | undefined
let result: Result | null | undefined

function install() {
  onQuery((ref) =>
    ref === "assessment.roles.getRole"
      ? role
      : ref === "assessment.results.getRoleResult"
        ? result
        : undefined
  )
}

function Trigger() {
  const { openRole } = useRoleSheet()
  return (
    <button type="button" onClick={() => openRole("role_1")}>
      trigger
    </button>
  )
}

function renderSheet() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrganizationProvider value={{ orgId: "org_1", name: "Acme", role: "admin" }}>
        <RoleSheetProvider>
          <Trigger />
        </RoleSheetProvider>
      </OrganizationProvider>
    </NextIntlClientProvider>
  )
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "trigger" }))
}

describe("RoleSheet", () => {
  beforeEach(() => {
    role = baseRole()
    result = {
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
      ],
    }
    install()
  })
  afterEach(() => cleanup())

  it("shows the role title, result, and breakdown for a complete role", () => {
    renderSheet()
    open()
    expect(screen.getByText("Engineer")).toBeTruthy()
    expect(screen.getByText("71 / 100")).toBeTruthy()
    expect(screen.getByText("Band 3")).toBeTruthy()
    expect(screen.getByText("Complexity")).toBeTruthy()
  })

  it("shows progress and no per-criterion values for an incomplete role", () => {
    result = { ...(result as Result), complete: false, score: null, band: null }
    install()
    renderSheet()
    open()
    expect(screen.getByText("Not yet evaluated")).toBeTruthy()
    expect(screen.getByText("2 / 3 criteria assessed")).toBeTruthy()
    expect(screen.queryByText("Scope")).toBeNull()
  })

  it("links to the full role page", () => {
    renderSheet()
    open()
    const link = screen.getByRole("link", { name: "Open role" })
    expect(link.getAttribute("href")).toBe("/roles/role_1")
  })

  it("shows a not-found message when the role is null", () => {
    role = null
    install()
    renderSheet()
    open()
    expect(screen.getByText("This role does not exist.")).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run the sheet test, expect PASS**

Run: `cd apps/dashboard && bunx vitest run components/role-sheet.test.tsx`
Expected: 4 passed. If radix Dialog content does not appear in jsdom, confirm `SheetTitle` is present (it is) and that the click opens it; no extra setup is expected.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/components/role-sheet.tsx apps/dashboard/components/role-sheet.test.tsx
git commit -m "feat(roles): add reusable RoleSheet quick-look panel"
```

---

### Task 4: Wire `RoleChip` to the sheet

**Files:**
- Modify: `apps/dashboard/components/bands/role-chip.tsx`
- Modify: `apps/dashboard/components/bands/role-chip.test.tsx`

- [ ] **Step 1: Update `role-chip.tsx`** to render a button when a provider is present, else the link. Extract the shared content and className so the two branches cannot drift:

```tsx
"use client"

import { AnchorIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRoleSheetOptional } from "@/components/role-sheet"
import { TrackBadge } from "@/components/track-badge"
import type { BandRoleRow } from "@/lib/bands"

const CHIP_CLASS =
  "inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left text-sm hover:bg-accent"

// One role rendered as a chip in the band ladder or matrix. Data is neutral
// ink, never brand. Anchor roles carry the anchor marker; a computed band that
// deviates from the agreed band shows a destructive flag (an alert to act on,
// not a judgement). When a RoleSheetProvider is present the chip opens the
// role's quick-look sheet; otherwise it links to the full role page.
export function RoleChip({ role }: { role: BandRoleRow }) {
  const t = useTranslations("dashboard.bands")
  const sheet = useRoleSheetOptional()
  const deviates =
    role.anchor !== null &&
    role.band !== null &&
    role.band !== role.anchor.expectedBand

  const inner = (
    <>
      {role.anchor !== null && (
        <HugeiconsIcon
          icon={AnchorIcon}
          size={14}
          strokeWidth={2}
          className="shrink-0 text-muted-foreground"
          aria-label={t("anchorLabel")}
        />
      )}
      <span className="truncate font-medium">{role.title}</span>
      <TrackBadge trackKey={role.trackKey} name={role.trackName} short />
      {deviates && role.anchor !== null && (
        <Badge
          variant="destructive"
          aria-label={t("deviationLabel", { band: role.anchor.expectedBand })}
          title={t("deviationLabel", { band: role.anchor.expectedBand })}
        >
          {t("deviation", { band: role.anchor.expectedBand })}
        </Badge>
      )}
    </>
  )

  if (sheet !== null) {
    return (
      <button
        type="button"
        className={CHIP_CLASS}
        onClick={() => sheet.openRole(role.roleId)}
      >
        {inner}
      </button>
    )
  }

  return (
    <Link href={`/roles/${role.roleId}`} className={CHIP_CLASS}>
      {inner}
    </Link>
  )
}
```

- [ ] **Step 2: Update `role-chip.test.tsx`** (read the current file first; keep its existing role fixture). Add two cases:

```tsx
  it("links to the full role page when no sheet provider is present", () => {
    renderChip()
    const link = screen.getByRole("link", { name: /CTO/ })
    expect(link.getAttribute("href")).toBe("/roles/r1")
  })

  it("opens the sheet (renders a button, not a link) inside a provider", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RoleSheetProvider>
          <RoleChip role={role({ roleId: "r1", title: "CTO" })} />
        </RoleSheetProvider>
      </NextIntlClientProvider>
    )
    expect(screen.getByRole("button", { name: /CTO/ })).toBeTruthy()
    expect(screen.queryByRole("link", { name: /CTO/ })).toBeNull()
  })
```

Add the import `import { RoleSheetProvider } from "@/components/role-sheet"` and ensure `renderChip()` wraps `RoleChip` in `NextIntlClientProvider` (no provider) so the first case sees the link. If `role-chip.test.tsx` does not exist, create it following `band-ladder.test.tsx`'s `role()` fixture and `NextIntlClientProvider` setup.

- [ ] **Step 3: Run the chip + bands tests, expect PASS**

Run: `cd apps/dashboard && bunx vitest run components/bands/role-chip.test.tsx components/bands/band-ladder.test.tsx components/bands/band-matrix.test.tsx`
Expected: all passed (the ladder/matrix tests still see links because they render no provider).

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/components/bands/role-chip.tsx apps/dashboard/components/bands/role-chip.test.tsx
git commit -m "feat(roles): open RoleSheet from role chips when a provider is present"
```

---

### Task 5: Mount the provider in the app shell

**Files:**
- Modify: `apps/dashboard/components/app-shell.tsx`

- [ ] **Step 1: Wrap the page content** with `RoleSheetProvider` (inside `OrganizationProvider`, where `orgId` and `locale` resolve). Add the import and wrap `{props.children}`:

```tsx
import { RoleSheetProvider } from "@/components/role-sheet"
```

```tsx
                <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
                  <RoleSheetProvider>{props.children}</RoleSheetProvider>
                </div>
```

- [ ] **Step 2: Typecheck the app**

Run: `cd apps/dashboard && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/components/app-shell.tsx
git commit -m "feat(roles): mount RoleSheetProvider in the app shell"
```

---

### Final verification

- [ ] **Full suite + typecheck + lint** (the pre-commit hook runs these, but confirm before merge):

Run: `cd /Volumes/development/blueprnt/role-sheet && bunx turbo run test typecheck` then `bunx biome check apps/dashboard/components`
Expected: all green.

- [ ] **Manual check:** run the dashboard, open Work > Overview, click a role chip in the ladder and the matrix. The sheet slides in from the right with the title, status, track, result/progress, breakdown, and profile. "Open role" navigates to the full page and the sheet closes. Esc and the overlay close it. Toggle the theme: the sheet and hatch read correctly in both.

## Self-review notes

- Spec coverage: read-only content (Task 3), context provider + hook + app-shell mount (Tasks 3, 5), RoleChip link/button (Task 4), breakdown extraction (Task 1), i18n (Task 2), tests (every task), incomplete-state progress (Task 3). All spec sections map to a task.
- Types are consistent: `BreakdownCriterion` (Task 1) is the prop type used by `RoleResultCard` and `RoleSheet`; `getRoleResult.criteria` matches it. `useRoleSheetOptional` (Task 3) is consumed by `RoleChip` (Task 4). `openRole(roleId: string)` signature is identical across provider, hook, and chip.

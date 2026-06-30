# Role page evaluation-first layout and card actions menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the role detail page lead with the evaluation (full-width on top, profile below), and move the evaluation card's two actions (Adjust ratings, Manage/Designate anchor) into a card-header `...` menu while keeping the anchor status visible inline.

**Architecture:** Three independent UI changes plus an enabling refactor, in the Next.js dashboard app. First add one i18n key. Then a non-breaking extraction in the anchor module (`RoleAnchorStatus` presentational component + export the existing `AnchorDialog`, with `RoleAnchorControl` recomposed from them so nothing breaks). Then the evaluation card adopts those pieces, grows a header actions menu, and the old `RoleAnchorControl` wrapper is deleted. Finally the page swaps its 3-column grid for a vertical stack. No backend, engine, lifecycle, mutation, or permission changes.

**Tech Stack:** Next.js 16 App Router, React, next-intl, shadcn/ui (DropdownMenu, Dialog, Badge, Button), Hugeicons, Convex (`useQuery`/`useMutation`, mocked in tests), Vitest 4 + Testing Library (happy-dom), Bun, Turborepo.

## Global Constraints

- No change to the evaluation, the deterministic engine, the score/band, `getRoleResult`, the anchor lifecycle, the `designateAnchorRole`/`updateAnchorRole` mutations, the backend, or who may designate (admin-only stays admin-only; the backend stays the authority). Adjust ratings stays available to everyone who can rate (not admin-gated).
- All user-facing text goes through next-intl i18n. The new key is added to `packages/i18n/messages/en.json` first, then mirrored to `sv`, `nb`, `da`, `fi` (the parity test fails otherwise). Nordic values are machine drafts: flag for native review.
- Never use em dashes in copy or comments. Use a period, comma, colon, or parentheses.
- Internal navigation uses the `Link` component (`next/link`), never a plain `<a>`.
- shadcn conventions: the actions menu trigger is a ghost icon `Button` (`size="icon"`) with `MoreHorizontalIcon` and an `aria-label`; `DropdownMenuContent align="end"`. The card menu has no destructive item.
- No legacy: when `RoleAnchorControl` is replaced, delete it and its wrapper-specific tests in the same change (Task 3).
- New code ships with tests in the same commit. The pre-commit hook runs Biome on staged files, a full typecheck, and the full suite (`turbo run test`, cache-backed); all three must pass. Never `--no-verify`. Never `bun test` (Bun hijacks it); always `bun run test`.
- Tests live in `apps/dashboard` and run on Vitest 4 / happy-dom. Open a radix `DropdownMenu` in tests with `fireEvent.pointerDown(trigger)` then `fireEvent.click(trigger)`; menu entries have role `menuitem`.
- Commit messages use conventional prefixes; no AI/Claude attribution.
- Work on `main` in the working tree; commit per task. Do not push.

---

### Task 1: i18n key for the evaluation actions menu

**Files:**
- Modify: `packages/i18n/messages/en.json` (add one key in `dashboard.roles.detail`, after `"actionsMenu"`)
- Modify: `packages/i18n/messages/sv.json`, `nb.json`, `da.json`, `fi.json` (mirror the key)
- Test: the existing parity test in `packages/i18n` and the typed-keys check (no new test file)

**Interfaces:**
- Produces: the translation key `dashboard.roles.detail.evaluationActionsMenu`, consumed by the evaluation card's menu `aria-label` in Task 3.

Each locale's `dashboard.roles.detail` block currently has `"actionsMenu"` on its own line (line 358 in every locale). Add `evaluationActionsMenu` immediately after it. The value uses each locale's existing word for "Evaluation" (matching `evaluationHeading`) plus its existing "actions" suffix (matching `actionsMenu`).

- [ ] **Step 1: Add the key to en.json (source locale)**

In `packages/i18n/messages/en.json`, inside `dashboard.roles.detail`, change:

```json
        "actionsMenu": "Role actions",
```

to:

```json
        "actionsMenu": "Role actions",
        "evaluationActionsMenu": "Evaluation actions",
```

- [ ] **Step 2: Mirror the key to the four other locales**

`packages/i18n/messages/sv.json` — after `"actionsMenu": "Rollåtgärder",`:

```json
        "evaluationActionsMenu": "Utvärderingsåtgärder",
```

`packages/i18n/messages/nb.json` — after `"actionsMenu": "Rollehandlinger",`:

```json
        "evaluationActionsMenu": "Evalueringshandlinger",
```

`packages/i18n/messages/da.json` — after `"actionsMenu": "Rollehandlinger",`:

```json
        "evaluationActionsMenu": "Evalueringshandlinger",
```

`packages/i18n/messages/fi.json` — after `"actionsMenu": "Roolin toiminnot",`:

```json
        "evaluationActionsMenu": "Arvioinnin toiminnot",
```

- [ ] **Step 3: Run the i18n parity test and verify no mojibake**

Run: `cd packages/i18n && bun run test`
Expected: PASS (every locale's key set matches `en.json`).

Then verify the non-ASCII Nordic values were written correctly (not double-encoded):

Run: `cd /Volumes/development/blueprnt/frontend && rg -n "evaluationActionsMenu" packages/i18n/messages`
Expected: five lines, the sv/nb/da/fi values showing `å`/`ä` correctly (e.g. `Utvärderingsåtgärder`), no `Ã¥`/`Ã¤` mojibake.

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "feat(i18n): add evaluation actions menu label"
```

---

### Task 2: extract `RoleAnchorStatus` and export `AnchorDialog` (non-breaking)

**Files:**
- Modify: `apps/dashboard/components/roles/role-anchor-control.tsx`
- Test: `apps/dashboard/components/roles/role-anchor-control.test.tsx`

**Interfaces:**
- Produces:
  - `RoleAnchorStatus({ anchorRole: AnchorRoleInfo })` — exported presentational component rendering the read-only anchor status (heading + one help morph + status badge + band badge + motivation).
  - `AnchorDialog({ open, onOpenChange, orgId, roleId, anchorRole })` — the existing dialog, now exported. `open: boolean`, `onOpenChange: (open: boolean) => void`, `orgId: string`, `roleId: Id<"roles">`, `anchorRole: AnchorRoleInfo | null`.
  - `AnchorRoleInfo` (unchanged, already exported).
- Consumes: nothing new.
- After this task `RoleAnchorControl` still exists and behaves identically (now composed from `RoleAnchorStatus` + `AnchorDialog`), so the evaluation card keeps compiling.

This is a pure extraction. The status markup currently lives inline in `RoleAnchorControl` (the `<div className="space-y-2">` block: heading + help morph + status badge, then band badge + motivation). Move it verbatim into a new exported `RoleAnchorStatus`, export `AnchorDialog`, and rewrite `RoleAnchorControl` to use both.

- [ ] **Step 1: Update the test file to the new public surface**

Replace the entire contents of `apps/dashboard/components/roles/role-anchor-control.test.tsx` with the following. It keeps two thin `RoleAnchorControl` composition tests (the wrapper still exists this task), adds a `RoleAnchorStatus` render test, and drives the two dialog-submit/close cases against `AnchorDialog` directly (so they survive Task 3's deletion of the wrapper). The file-scoped `Select` mock and the convex mocks are unchanged from today.

```tsx
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const designateMock = vi.fn()
const updateMock = vi.fn()

// Radix Select renders its hidden native <select> only when the trigger is
// inside a <form>. Because the dialog content is portaled to document.body
// (outside any <form>), the hidden-select pattern is unavailable for the band
// field. Mock the Select primitives with simple native elements so
// fireEvent.change works directly in the dialog tests.
import * as React from "react"

type SelectCtx = {
  value: string
  onChange: (v: string) => void
  disabled: boolean
}
const SelectContext = React.createContext<SelectCtx>({
  value: "",
  onChange: () => {},
  disabled: false,
})

function MockSelect({
  value = "",
  onValueChange = () => {},
  disabled = false,
  children,
}: {
  value?: string
  onValueChange?: (v: string) => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <SelectContext.Provider value={{ value, onChange: onValueChange, disabled }}>
      {children}
    </SelectContext.Provider>
  )
}
function MockSelectTrigger({
  id,
  children,
}: {
  id?: string
  children?: React.ReactNode
}) {
  const ctx = React.useContext(SelectContext)
  return (
    <button
      type="button"
      id={id}
      role="combobox"
      aria-expanded={false}
      disabled={ctx.disabled}
    >
      {children}
    </button>
  )
}
function MockSelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = React.useContext(SelectContext)
  return <span>{ctx.value || placeholder}</span>
}
function MockSelectContent({ children }: { children?: React.ReactNode }) {
  const ctx = React.useContext(SelectContext)
  return (
    <select
      value={ctx.value}
      disabled={ctx.disabled}
      onChange={(e) => ctx.onChange(e.target.value)}
      aria-hidden
    >
      {children}
    </select>
  )
}
function MockSelectItem({
  value,
  children,
}: {
  value: string
  children?: React.ReactNode
}) {
  return <option value={value}>{children}</option>
}

vi.mock("@workspace/ui/components/select", () => ({
  Select: MockSelect,
  SelectTrigger: MockSelectTrigger,
  SelectValue: MockSelectValue,
  SelectContent: MockSelectContent,
  SelectItem: MockSelectItem,
}))

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) =>
    ref === "assessment.anchorRoles.designateAnchorRole"
      ? designateMock
      : ref === "assessment.anchorRoles.updateAnchorRole"
        ? updateMock
        : vi.fn(),
  useQuery: (ref: unknown) =>
    ref === "evaluationModel.model.getModel"
      ? { bandThresholds: [80, 60, 40, 20] }
      : ref === "assessment.anchorRoles.listAnchorRoles"
        ? []
        : undefined,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    evaluationModel: { model: { getModel: "evaluationModel.model.getModel" } },
    assessment: {
      anchorRoles: {
        designateAnchorRole: "assessment.anchorRoles.designateAnchorRole",
        updateAnchorRole: "assessment.anchorRoles.updateAnchorRole",
        listAnchorRoles: "assessment.anchorRoles.listAnchorRoles",
      },
    },
  },
}))

import {
  AnchorDialog,
  type AnchorRoleInfo,
  RoleAnchorControl,
  RoleAnchorStatus,
} from "@/components/roles/role-anchor-control"

const anchor = messages.dashboard.roles.anchor

const designated: AnchorRoleInfo = {
  expectedBand: 2,
  motivation: "Reference role for the platform track",
  status: "active",
  reviewedAt: 1_700_000_000_000,
}

function wrap(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>
  )
}

// A stateful host so AnchorDialog actually unmounts its form when it closes on
// success (open flips to false via onOpenChange).
function HostedDialog({ anchorRole }: { anchorRole: AnchorRoleInfo | null }) {
  const [open, setOpen] = useState(true)
  return (
    <AnchorDialog
      open={open}
      onOpenChange={setOpen}
      orgId="org-1"
      roleId={"role-1" as never}
      anchorRole={anchorRole}
    />
  )
}

describe("RoleAnchorStatus", () => {
  afterEach(() => cleanup())

  it("renders the status badge, band, and motivation", () => {
    wrap(<RoleAnchorStatus anchorRole={designated} />)
    expect(screen.getByText(anchor.statusActive)).toBeDefined()
    expect(
      screen.getByText("Reference role for the platform track")
    ).toBeDefined()
  })
})

describe("RoleAnchorControl (composition)", () => {
  afterEach(() => cleanup())

  it("renders nothing for a non-admin on a role that is not an anchor", () => {
    const { container } = wrap(
      <RoleAnchorControl
        orgId="org-1"
        roleId={"role-1" as never}
        anchorRole={null}
        isAdmin={false}
      />
    )
    expect(container.textContent).toBe("")
  })

  it("shows the designate action for an admin on a non-anchor role", () => {
    wrap(
      <RoleAnchorControl
        orgId="org-1"
        roleId={"role-1" as never}
        anchorRole={null}
        isAdmin={true}
      />
    )
    expect(
      screen.getByRole("button", { name: anchor.designateCta })
    ).toBeDefined()
  })
})

describe("AnchorDialog", () => {
  beforeEach(() => {
    designateMock.mockReset()
    updateMock.mockReset()
  })
  afterEach(() => cleanup())

  it("submits the designate form and closes on success", async () => {
    designateMock.mockResolvedValue(null)
    wrap(<HostedDialog anchorRole={null} />)

    const bandSelect = [
      ...document.querySelectorAll("select"),
    ][0] as HTMLSelectElement
    if (bandSelect === undefined) throw new Error("band select not found")
    fireEvent.change(bandSelect, { target: { value: "2" } })
    fireEvent.change(screen.getByLabelText(anchor.motivationLabel), {
      target: { value: "  Stable reference role.  " },
    })
    fireEvent.click(screen.getByRole("button", { name: anchor.designateCta }))

    await waitFor(() => {
      expect(designateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        expectedBand: 2,
        motivation: "Stable reference role.",
      })
    })
    await waitFor(() =>
      expect(screen.queryByLabelText(anchor.motivationLabel)).toBeNull()
    )
  })

  it("submits the edit form and closes on success", async () => {
    updateMock.mockResolvedValue(null)
    wrap(<HostedDialog anchorRole={designated} />)

    fireEvent.change(screen.getByLabelText(anchor.motivationLabel), {
      target: { value: "Updated rationale" },
    })
    fireEvent.click(screen.getByRole("button", { name: anchor.updateCta }))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        motivation: "Updated rationale",
      })
    })
    await waitFor(() =>
      expect(screen.queryByLabelText(anchor.motivationLabel)).toBeNull()
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/dashboard && bun run test 2>&1 | tail -30`
Expected: FAIL — `RoleAnchorStatus` and `AnchorDialog` are not exported from `@/components/roles/role-anchor-control` yet (import/type errors or "is not a function").

- [ ] **Step 3: Add `RoleAnchorStatus`, export `AnchorDialog`, recompose `RoleAnchorControl`**

In `apps/dashboard/components/roles/role-anchor-control.tsx`:

(a) Export the dialog. Change the line:

```tsx
function AnchorDialog({
```

to:

```tsx
export function AnchorDialog({
```

(b) Replace the entire `RoleAnchorControl` function (the `export function RoleAnchorControl(...) { ... }` block at the end of the file) with the new `RoleAnchorStatus` plus a recomposed `RoleAnchorControl`:

```tsx
// The read-only anchor status, shown to everyone once the role is an anchor.
// Exactly one help morph (it labels the concept); the designate/manage action
// lives elsewhere (the Evaluation card's actions menu).
export function RoleAnchorStatus({
  anchorRole,
}: {
  anchorRole: AnchorRoleInfo
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const tHelp = useTranslations("dashboard.help")
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{t("heading")}</span>
        <HelpMorphButton label={tHelp("anchorRoleLabel")}>
          {tHelp("anchorRoleBody")}
        </HelpMorphButton>
        <Badge variant={STATUS_BADGE_VARIANTS[anchorRole.status]}>
          {t(STATUS_KEYS[anchorRole.status])}
        </Badge>
      </div>
      <Badge variant="outline">
        {t("bandOption", { band: anchorRole.expectedBand })}
      </Badge>
      <p className="text-sm">{anchorRole.motivation}</p>
    </div>
  )
}

export function RoleAnchorControl({
  orgId,
  roleId,
  anchorRole,
  isAdmin,
}: {
  orgId: string
  roleId: Id<"roles">
  anchorRole: AnchorRoleInfo | null
  isAdmin: boolean
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const [open, setOpen] = useState(false)

  // The concept only appears once it is real: a non-anchor role shows nothing
  // to a non-admin.
  if (anchorRole === null && !isAdmin) return null

  return (
    <div className="space-y-2">
      {anchorRole !== null && <RoleAnchorStatus anchorRole={anchorRole} />}
      {isAdmin && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {anchorRole === null ? t("designateCta") : t("manageCta")}
        </Button>
      )}
      {isAdmin && (
        <AnchorDialog
          open={open}
          onOpenChange={setOpen}
          orgId={orgId}
          roleId={roleId}
          anchorRole={anchorRole}
        />
      )}
    </div>
  )
}
```

Note: `RoleAnchorControl` no longer references `tHelp`, `HelpMorphButton`, `Badge`, `STATUS_KEYS`, or `STATUS_BADGE_VARIANTS` directly, but `RoleAnchorStatus` (same file) and the forms still do, so all existing imports remain used. Do not remove any import.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/dashboard && bun run test 2>&1 | tail -30`
Expected: PASS — `RoleAnchorStatus`, `RoleAnchorControl (composition)`, and `AnchorDialog` describes all green; the rest of the dashboard suite unaffected.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/roles/role-anchor-control.tsx apps/dashboard/components/roles/role-anchor-control.test.tsx
git commit -m "refactor(roles): split anchor status from the anchor dialog"
```

---

### Task 3: evaluation card header actions menu + inline anchor status

**Files:**
- Modify: `apps/dashboard/components/roles/role-evaluation-card.tsx`
- Modify: `apps/dashboard/components/roles/role-anchor-control.tsx` (delete the now-unused `RoleAnchorControl`)
- Test: `apps/dashboard/components/roles/role-evaluation-card.test.tsx`
- Test: `apps/dashboard/components/roles/role-anchor-control.test.tsx` (drop the wrapper composition tests)

**Interfaces:**
- Consumes: `RoleAnchorStatus`, `AnchorDialog`, `AnchorRoleInfo` from `@/components/roles/role-anchor-control` (Task 2); `dashboard.roles.detail.evaluationActionsMenu` (Task 1); existing `detail.adjustRateCta`, `anchor.designateCta`, `anchor.manageCta`.
- Produces: nothing new for later tasks.

The evaluation card's complete (result) state grows a `...` actions menu in the header (Adjust ratings for everyone; Manage/Designate anchor for admins, opening `AnchorDialog`), renders the anchor status inline at the bottom via `RoleAnchorStatus`, and drops the inline Adjust button. After this task `RoleAnchorControl` has no consumers and is deleted.

- [ ] **Step 1: Rewrite the evaluation-card test**

Replace the entire contents of `apps/dashboard/components/roles/role-evaluation-card.test.tsx` with:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AnchorRoleInfo } from "@/components/roles/role-anchor-control"
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
const anchor = messages.dashboard.roles.anchor

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

const completeResult: Result = {
  roleId: "role_1",
  title: "Engineer",
  complete: true,
  ratedCount: 3,
  totalCriteria: 3,
  score: 71,
  band: 3,
  criteria: [
    {
      criterionId: "scope",
      name: "Scope",
      weightPoints: 5,
      value: 3,
      motivation: null,
    },
    {
      criterionId: "complexity",
      name: "Complexity",
      weightPoints: 4,
      value: 5,
      motivation: null,
    },
    {
      criterionId: "people",
      name: "People",
      weightPoints: 2,
      value: 1,
      motivation: null,
    },
  ],
}

const designated: AnchorRoleInfo = {
  expectedBand: 2,
  motivation: "Reference role for the platform track",
  status: "active",
  reviewedAt: 1_700_000_000_000,
}

// getRoleResult drives the view; getModel/listAnchorRoles back the dialog when
// an admin opens it.
function setResult(next: Result | null) {
  onQuery((ref) => {
    if (ref === "assessment.results.getRoleResult") return next
    if (ref === "evaluationModel.model.getModel")
      return { bandThresholds: [80, 60, 40, 20] }
    if (ref === "assessment.anchorRoles.listAnchorRoles") return []
    return undefined
  })
}

function renderCard(
  props: {
    archived?: boolean
    profileComplete?: boolean
    ratedCount?: number
    totalCriteria?: number
    anchorRole?: AnchorRoleInfo | null
    isAdmin?: boolean
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleEvaluationCard
        orgId="org_1"
        roleId={"role_1" as never}
        slug="r1"
        archived={props.archived ?? false}
        profileComplete={props.profileComplete ?? true}
        ratedCount={props.ratedCount ?? 0}
        totalCriteria={props.totalCriteria ?? 5}
        anchorRole={props.anchorRole ?? null}
        isAdmin={props.isAdmin ?? false}
      />
    </NextIntlClientProvider>
  )
}

function openMenu() {
  const trigger = screen.getByRole("button", {
    name: detail.evaluationActionsMenu,
  })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
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

  it("shows the weighting, band, and breakdown once complete", () => {
    setResult(completeResult)
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(screen.getByText("71 / 100")).toBeDefined()
    expect(screen.getByText("Band 3")).toBeDefined()
    expect(screen.getByText("Complexity")).toBeDefined()
  })

  it("puts Adjust ratings in the actions menu, not as a body button", () => {
    setResult(completeResult)
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    // No standalone Adjust link in the card body.
    expect(screen.queryByRole("link", { name: detail.adjustRateCta })).toBeNull()
    openMenu()
    const adjust = screen.getByRole("menuitem", { name: detail.adjustRateCta })
    expect(adjust.getAttribute("href")).toBe("/roles/r1/rate")
  })

  it("offers Designate in the menu for an admin with no anchor, and shows no status row", () => {
    setResult(completeResult)
    renderCard({ ratedCount: 3, totalCriteria: 3, isAdmin: true, anchorRole: null })
    expect(screen.queryByText(anchor.heading)).toBeNull()
    openMenu()
    expect(
      screen.getByRole("menuitem", { name: anchor.designateCta })
    ).toBeDefined()
  })

  it("shows the anchor status inline and Manage in the menu for an admin on a designated role", () => {
    setResult(completeResult)
    renderCard({
      ratedCount: 3,
      totalCriteria: 3,
      isAdmin: true,
      anchorRole: designated,
    })
    expect(screen.getByText(anchor.statusActive)).toBeDefined()
    expect(
      screen.getByText("Reference role for the platform track")
    ).toBeDefined()
    openMenu()
    expect(
      screen.getByRole("menuitem", { name: anchor.manageCta })
    ).toBeDefined()
  })

  it("gives a non-admin only Adjust in the menu but still shows a designated anchor's status", () => {
    setResult(completeResult)
    renderCard({
      ratedCount: 3,
      totalCriteria: 3,
      isAdmin: false,
      anchorRole: designated,
    })
    expect(screen.getByText(anchor.statusActive)).toBeDefined()
    openMenu()
    expect(
      screen.getByRole("menuitem", { name: detail.adjustRateCta })
    ).toBeDefined()
    expect(
      screen.queryByRole("menuitem", { name: anchor.manageCta })
    ).toBeNull()
  })

  it("stays read-only for an archived role (no rate action, no menu)", () => {
    renderCard({ archived: true, ratedCount: 5, totalCriteria: 5 })
    expect(screen.getByText(roles.evaluated)).toBeDefined()
    expect(screen.queryByRole("link")).toBeNull()
    expect(
      screen.queryByRole("button", { name: detail.evaluationActionsMenu })
    ).toBeNull()
  })

  it("shows the computing placeholder while a fully-rated result is still loading", () => {
    renderCard({ ratedCount: 3, totalCriteria: 3 })
    expect(
      screen.getByText(messages.dashboard.rating.result.computing)
    ).toBeDefined()
  })

  it("renders no actions menu in the progress state", () => {
    renderCard({ ratedCount: 2, totalCriteria: 5 })
    expect(
      screen.queryByRole("button", { name: detail.evaluationActionsMenu })
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run the evaluation-card test to verify it fails**

Run: `cd apps/dashboard && bun run test -- role-evaluation-card 2>&1 | tail -30`
Expected: FAIL — there is no button with the `evaluationActionsMenu` name yet, and Adjust is still a body link.

- [ ] **Step 3: Redesign the evaluation card**

Replace the entire contents of `apps/dashboard/components/roles/role-evaluation-card.tsx` with:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import {
  type AnchorRoleInfo,
  AnchorDialog,
  RoleAnchorStatus,
} from "@/components/roles/role-anchor-control"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"

// One card for the whole evaluation lifecycle. While incomplete it shows the
// progress and the entry into the blind stepper; once complete it shows the
// weighting, band, and per-criterion breakdown, with the anchor status inline
// and the two actions (adjust, manage anchor) in a header menu. The result view
// applies only to a live, fully-evaluated role: an archived role has left the
// results set, so it stays read-only.
export function RoleEvaluationCard({
  orgId,
  roleId,
  slug,
  archived,
  profileComplete,
  ratedCount,
  totalCriteria,
  anchorRole,
  isAdmin,
}: {
  orgId: string
  roleId: Id<"roles">
  slug: string
  archived: boolean
  profileComplete: boolean
  ratedCount: number
  totalCriteria: number
  anchorRole: AnchorRoleInfo | null
  isAdmin: boolean
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tRoles = useTranslations("dashboard.roles")
  const tAnchor = useTranslations("dashboard.roles.anchor")
  const tHelp = useTranslations("dashboard.help")
  const tResult = useTranslations("dashboard.rating.result")
  const tAssessment = useTranslations("assessment")
  const locale = useLocale()

  const [anchorOpen, setAnchorOpen] = useState(false)

  const evaluated = totalCriteria > 0 && ratedCount === totalCriteria
  // The view is chosen from the props so it never flashes; the query only
  // fills the result data.
  const showResult = evaluated && !archived

  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })

  const ctaLabel = ratedCount === 0 ? t("rateCta") : t("resumeRateCta")

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
        {showResult && result?.complete && (
          <div className="flex items-center gap-4">
            <span className="font-semibold text-2xl tabular-nums">
              {tResult("scoreOutOf", { score: result.score ?? 0 })}
            </span>
            {result.band != null && (
              <Badge>{`${tAssessment("band")} ${result.band}`}</Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("evaluationActionsMenu")}
                  className="shrink-0"
                >
                  <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/roles/${slug}/rate`}>
                    {t("adjustRateCta")}
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onSelect={() => setAnchorOpen(true)}>
                    {anchorRole === null
                      ? tAnchor("designateCta")
                      : tAnchor("manageCta")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showResult ? (
          result?.complete ? (
            <>
              <p className="text-muted-foreground text-sm">
                {tResult("bandHighest")}
              </p>
              <RoleCriterionBreakdown criteria={result.criteria} />
              {anchorRole !== null && (
                <div className="border-t pt-4">
                  <RoleAnchorStatus anchorRole={anchorRole} />
                </div>
              )}
              {isAdmin && (
                <AnchorDialog
                  open={anchorOpen}
                  onOpenChange={setAnchorOpen}
                  orgId={orgId}
                  roleId={roleId}
                  anchorRole={anchorRole}
                />
              )}
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

- [ ] **Step 4: Delete the now-unused `RoleAnchorControl` and its composition tests**

In `apps/dashboard/components/roles/role-anchor-control.tsx`, delete the entire `export function RoleAnchorControl(...) { ... }` block (added/kept in Task 2). Keep `RoleAnchorStatus`, `AnchorDialog`, the forms, the field sub-components, `STATUS_KEYS`, `STATUS_BADGE_VARIANTS`, and `AnchorRoleInfo`.

After deleting it, `useState` and `Button` may become unused in that file. Check and remove any import that is now unused (the forms still use `Button` in their `DialogFooter`, and the forms use `useState`, so both imports very likely remain). Confirm by typecheck in Step 6; remove only genuinely unused imports.

In `apps/dashboard/components/roles/role-anchor-control.test.tsx`, remove the `RoleAnchorControl` import from the `@/components/roles/role-anchor-control` import statement, and delete the entire `describe("RoleAnchorControl (composition)", ...)` block. Keep the `RoleAnchorStatus` and `AnchorDialog` describes.

- [ ] **Step 5: Run the affected tests to verify they pass**

Run: `cd apps/dashboard && bun run test -- role-evaluation-card role-anchor-control 2>&1 | tail -40`
Expected: PASS — both files green; no reference to `RoleAnchorControl` remains.

- [ ] **Step 6: Typecheck and confirm no orphans**

Run: `cd /Volumes/development/blueprnt/frontend && bun run typecheck 2>&1 | tail -20`
Expected: PASS (no unused-import or missing-export errors).

Run: `rg -n "RoleAnchorControl" apps packages || echo "(none)"`
Expected: `(none)`.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/components/roles/role-evaluation-card.tsx apps/dashboard/components/roles/role-evaluation-card.test.tsx apps/dashboard/components/roles/role-anchor-control.tsx apps/dashboard/components/roles/role-anchor-control.test.tsx
git commit -m "feat(roles): move evaluation actions into a card menu, anchor status inline"
```

---

### Task 4: stack the role page, evaluation first

**Files:**
- Modify: `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`

**Interfaces:**
- Consumes: `RoleEvaluationCard` and `RoleProfileCard` (both unchanged signatures).
- Produces: nothing.

There is no unit test for this page (it is a client component wired to Convex queries; page coverage is e2e scope, not unit scope in this repo). The change is verified by typecheck, Biome, and the full suite staying green. The page's outer wrapper is already `<div className="space-y-6">`; we remove the inner grid and render the two cards directly in the stack, evaluation first.

- [ ] **Step 1: Replace the grid with a stack**

In `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`, replace this block:

```tsx
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* The AI draft assistant lives in the profile card's header (a
              MorphPopover next to Edit), not as a separate card. */}
          <RoleProfileCard orgId={orgId} role={role} />
        </div>
        <div className="space-y-6">
          <RoleEvaluationCard
            orgId={orgId}
            roleId={role.roleId}
            slug={role.slug}
            archived={role.archived}
            profileComplete={role.profileComplete}
            ratedCount={role.ratedCount}
            totalCriteria={role.totalCriteria}
            anchorRole={role.anchorRole}
            isAdmin={orgRole === "admin"}
          />
        </div>
      </div>
```

with this (evaluation full-width on top, profile full-width below; both are direct children of the existing `space-y-6` wrapper):

```tsx
      <RoleEvaluationCard
        orgId={orgId}
        roleId={role.roleId}
        slug={role.slug}
        archived={role.archived}
        profileComplete={role.profileComplete}
        ratedCount={role.ratedCount}
        totalCriteria={role.totalCriteria}
        anchorRole={role.anchorRole}
        isAdmin={orgRole === "admin"}
      />
      {/* The AI draft assistant lives in the profile card's header (a
          MorphPopover next to Edit), not as a separate card. */}
      <RoleProfileCard orgId={orgId} role={role} />
```

- [ ] **Step 2: Typecheck**

Run: `cd /Volumes/development/blueprnt/frontend && bun run typecheck 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 3: Run the full suite (cache-backed) to confirm nothing regressed**

Run: `bun run test 2>&1 | tail -8`
Expected: all packages pass.

- [ ] **Step 4: Commit**

```bash
git add "apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx"
git commit -m "feat(roles): lead the role page with the evaluation card"
```

---

## Self-review

**Spec coverage:**
- Page stacks, evaluation first, grid removed → Task 4. ✅
- Single-column card, score/band + `...` menu in header → Task 3. ✅
- Menu items: Adjust (everyone), Manage/Designate (admins) opening the existing dialog; inline Adjust button removed → Task 3. ✅
- Anchor status inline (everyone, only when designated), one help morph → Task 2 (`RoleAnchorStatus`) + Task 3 (rendered inline with a `border-t pt-4` divider). ✅
- Two menus, page-header Archive untouched → not modified by any task (confirmed); card menu is separate. ✅
- Designate in the menu only, status row only when an anchor → Task 3 (menu item; `anchorRole !== null` gate on the status row). ✅
- Anchor refactor: split status vs dialog, delete the wrapper → Task 2 (extract, non-breaking) + Task 3 (delete). ✅
- i18n: one new key in all 5 locales, parity-guarded, Nordic drafts → Task 1. ✅
- Tests for the new surface; archived shows no menu; progress shows no menu → Task 3 test. ✅
- Non-goals (no backend/engine/lifecycle/mutation/permission change; profile internals unchanged; archived unchanged) → honored; only layout/composition changes. ✅

**Placeholder scan:** No TBD/TODO; every code step contains complete code; commands have expected output. ✅

**Type consistency:** `AnchorRoleInfo` shape, `AnchorDialog` props (`open`, `onOpenChange`, `orgId`, `roleId`, `anchorRole`), and `RoleAnchorStatus` prop (`anchorRole`) are identical across Tasks 2 and 3 and match the existing dialog signature. The new i18n key `dashboard.roles.detail.evaluationActionsMenu` is produced in Task 1 and consumed by the same string in Task 3. `RoleEvaluationCard` props are unchanged, so Task 4's call site needs no edit beyond relocation. ✅

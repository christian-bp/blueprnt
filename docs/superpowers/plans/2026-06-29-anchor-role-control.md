# Anchor role as an action on the Evaluation card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone Anchor card with a compact status + a button on the Evaluation card that opens the designate/manage form in a dialog, so the rail is one card and the anchor is never a buried panel.

**Architecture:** A new `RoleAnchorControl` (status line + admin trigger + dialog) holds the relocated designate/edit forms and the `getModel`/`listAnchorRoles` queries. The `RoleEvaluationCard` renders it in its result (complete) state. The old `AnchorRoleCard` is deleted, and the "requires a completed assessment" message is dropped (the control only renders when complete).

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Convex, next-intl, shadcn/ui, Vitest 4 + Testing Library.

## Global Constraints

- All user-facing text via i18n (`next-intl`). New strings land in `packages/i18n/messages/en.json` first, mirrored to `sv`, `nb`, `da`, `fi`; the parity test fails if any locale's key set differs from `en`. New Nordic strings are drafts to flag for native review; add non-ASCII via the Edit tool, never shell.
- No em dashes in copy/comments/commits. No-legacy: a replaced component is deleted (with its tests + orphaned keys) in the same change.
- Domain terminology: Band; the anchor is the calibration reference role. Never "Score".
- Dialogs follow shadcn anatomy: `DialogHeader` (`DialogTitle`, plus `DialogDescription` when there is copy), body, `DialogFooter` with Cancel (outline) first and the primary action last. Entity actions use buttons/dialogs; destructive confirms use `AlertDialog` (not relevant here).
- Forms: the submit is disabled while pending and while invalid. Internal nav via the `Link` component. shadcn vendor code (`packages/ui/src/*`) is not edited.
- Guidance: at most one help popover per row; minimize layout shift.
- Anchor writes stay admin-only; the backend (`designateAnchorRole`/`updateAnchorRole`) is the authority and is unchanged.
- Tests run with Vitest 4 via `bun run test` (never `bun test`). New code ships with tests in the same commit. The pre-commit hook runs Biome, a full typecheck, and the full `turbo run test`; all must pass; never `--no-verify`.

---

### Task 1: Add `manageCta` and `cancel` anchor i18n keys

**Files:**
- Modify: `packages/i18n/messages/en.json` (under `dashboard.roles.anchor`)
- Modify: `sv.json`, `nb.json`, `da.json`, `fi.json`
- Test: `packages/i18n` parity test

**Interfaces:**
- Produces: `dashboard.roles.anchor.manageCta` and `dashboard.roles.anchor.cancel`, consumed by `RoleAnchorControl` (Task 2).

- [ ] **Step 1: Add the keys to `en.json`**

In `dashboard.roles.anchor`, add after `"designateCta"`:

```json
        "manageCta": "Manage anchor role",
        "cancel": "Cancel",
```

- [ ] **Step 2: Mirror to the other locales**

Add the same two keys at the same path in each file, using these draft values (flag for native review). Use the Edit tool. Anchor on the `"designateCta"` line within `dashboard.roles.anchor` in each file.

| locale | manageCta | cancel |
|---|---|---|
| sv | Hantera ankarroll | Avbryt |
| nb | Administrer ankarrolle | Avbryt |
| da | Administrer ankerrolle | Annuller |
| fi | Hallitse ankkuriroolia | Peruuta |

- [ ] **Step 3: Run the parity test and grep for mojibake**

Run: `cd packages/i18n && bun run test` (PASS).
Run: `rg -n "Ã|Â|�" packages/i18n/messages` (no matches).

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages
git commit -m "feat(i18n): add anchor-role manage and cancel actions"
```

---

### Task 2: `RoleAnchorControl` (status + dialog)

**Files:**
- Create: `apps/dashboard/components/roles/role-anchor-control.tsx`
- Test: `apps/dashboard/components/roles/role-anchor-control.test.tsx`

**Interfaces:**
- Consumes: `dashboard.roles.anchor.*` (incl. `manageCta`/`cancel` from Task 1), `dashboard.help.anchorRoleLabel`/`anchorRoleBody`; the existing `designateAnchorRole`/`updateAnchorRole` mutations and `getModel`/`listAnchorRoles` queries (unchanged).
- Produces: `export interface AnchorRoleInfo` and `export function RoleAnchorControl({ orgId, roleId, anchorRole, isAdmin })`. Consumed by `RoleEvaluationCard` (Task 3).

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/roles/role-anchor-control.test.tsx`:

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

const designateMock = vi.fn()
const updateMock = vi.fn()

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
  type AnchorRoleInfo,
  RoleAnchorControl,
} from "@/components/roles/role-anchor-control"

const anchor = messages.dashboard.roles.anchor

const designated: AnchorRoleInfo = {
  expectedBand: 2,
  motivation: "Reference role for the platform track",
  status: "active",
  reviewedAt: 1_700_000_000_000,
}

function renderControl(props: {
  anchorRole?: AnchorRoleInfo | null
  isAdmin?: boolean
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleAnchorControl
        orgId="org-1"
        roleId={"role-1" as never}
        anchorRole={props.anchorRole ?? null}
        isAdmin={props.isAdmin ?? true}
      />
    </NextIntlClientProvider>
  )
}

describe("RoleAnchorControl", () => {
  beforeEach(() => {
    designateMock.mockReset()
    updateMock.mockReset()
  })
  afterEach(() => cleanup())

  it("renders nothing for a non-admin on a role that is not an anchor", () => {
    const { container } = renderControl({ anchorRole: null, isAdmin: false })
    expect(container.textContent).toBe("")
  })

  it("shows the designate action for an admin on a non-anchor role", () => {
    renderControl({ anchorRole: null, isAdmin: true })
    expect(
      screen.getByRole("button", { name: anchor.designateCta })
    ).toBeDefined()
  })

  it("shows the read-only status for a non-admin on an anchor role", () => {
    renderControl({ anchorRole: designated, isAdmin: false })
    expect(screen.getByText(anchor.statusActive)).toBeDefined()
    expect(
      screen.getByText("Reference role for the platform track")
    ).toBeDefined()
    expect(
      screen.queryByRole("button", { name: anchor.manageCta })
    ).toBeNull()
  })

  it("opens the manage dialog and updates on save for an admin on an anchor role", async () => {
    updateMock.mockResolvedValue(null)
    renderControl({ anchorRole: designated, isAdmin: true })
    fireEvent.click(screen.getByRole("button", { name: anchor.manageCta }))
    // The dialog shows the editable form (motivation pre-filled).
    const motivation = screen.getByLabelText(anchor.motivationLabel)
    fireEvent.change(motivation, { target: { value: "Updated rationale" } })
    fireEvent.click(screen.getByRole("button", { name: anchor.updateCta }))
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        motivation: "Updated rationale",
      })
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- role-anchor-control`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

Create `apps/dashboard/components/roles/role-anchor-control.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"

// Anchor roles (ankarroller) are the org's 2-5 designated reference roles used
// to calibrate other assessments; designating/reviewing them is model
// governance, so all write controls are admin-only. The designation lives as an
// aggregate on the role. This control lives inside the Evaluation card's result
// state: a compact status plus (for admins) a button that opens the form in a
// dialog.
export interface AnchorRoleInfo {
  expectedBand: number
  motivation: string
  status: "active" | "underReview" | "replaced"
  reviewedAt: number
}

const STATUS_KEYS = {
  active: "statusActive",
  underReview: "statusUnderReview",
  replaced: "statusReplaced",
} as const

const STATUS_BADGE_VARIANTS = {
  active: "default",
  underReview: "secondary",
  replaced: "outline",
} as const

function BandField({
  band,
  bandOptions,
  disabled,
  onChange,
}: {
  band: string
  bandOptions: number[]
  disabled: boolean
  onChange: (value: string) => void
}) {
  const t = useTranslations("dashboard.roles.anchor")
  return (
    <div className="space-y-2">
      <Label htmlFor="anchor-band" className="text-muted-foreground">
        {t("expectedBandLabel")}
      </Label>
      <Select value={band} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="anchor-band" className="w-full">
          <SelectValue placeholder={t("expectedBandLabel")} />
        </SelectTrigger>
        <SelectContent>
          {bandOptions.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {t("bandOption", { band: option })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function MotivationField({
  motivation,
  disabled,
  onChange,
}: {
  motivation: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const t = useTranslations("dashboard.roles.anchor")
  return (
    <div className="space-y-2">
      <Label htmlFor="anchor-motivation" className="text-muted-foreground">
        {t("motivationLabel")}
      </Label>
      <Textarea
        id="anchor-motivation"
        value={motivation}
        placeholder={t("motivationPlaceholder")}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function ReviewedLine({ reviewedAt }: { reviewedAt: number }) {
  const t = useTranslations("dashboard.roles.anchor")
  const locale = useLocale()
  return (
    <p className="text-muted-foreground text-xs">
      {t("reviewedAt", {
        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
          reviewedAt
        ),
      })}
    </p>
  )
}

// Footer error: a simple inline alert above the dialog footer (the dialog can
// grow without reflowing the page, so no reserved-height slot is needed).
function FormError({ failed }: { failed: boolean }) {
  const t = useTranslations("dashboard.roles.anchor")
  return failed ? (
    <p role="alert" className="text-destructive text-sm">
      {t("error")}
    </p>
  ) : null
}

function DesignateForm({
  orgId,
  roleId,
  bandOptions,
  onClose,
}: {
  orgId: string
  roleId: Id<"roles">
  bandOptions: number[]
  onClose: () => void
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const designate = useMutation(api.assessment.anchorRoles.designateAnchorRole)
  const anchors = useQuery(api.assessment.anchorRoles.listAnchorRoles, { orgId })
  const activeCount = (anchors ?? []).filter(
    (a) => a.status === "active"
  ).length
  const [band, setBand] = useState("")
  const [motivation, setMotivation] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const trimmedMotivation = motivation.trim()

  async function handleDesignate() {
    setPending(true)
    setFailed(false)
    try {
      await designate({
        orgId,
        roleId,
        expectedBand: Number(band),
        motivation: trimmedMotivation,
      })
      onClose()
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <BandField
        band={band}
        bandOptions={bandOptions}
        disabled={pending}
        onChange={setBand}
      />
      <MotivationField
        motivation={motivation}
        disabled={pending}
        onChange={setMotivation}
      />
      <p className="text-muted-foreground text-xs">
        {activeCount >= 5 ? t("tooMany", { count: activeCount }) : t("countHint")}
      </p>
      <FormError failed={failed} />
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
        <Button
          onClick={handleDesignate}
          disabled={pending || band === "" || trimmedMotivation === ""}
        >
          {t("designateCta")}
        </Button>
      </DialogFooter>
    </div>
  )
}

function EditForm({
  orgId,
  roleId,
  anchorRole,
  bandOptions,
  onClose,
}: {
  orgId: string
  roleId: Id<"roles">
  anchorRole: AnchorRoleInfo
  bandOptions: number[]
  onClose: () => void
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const update = useMutation(api.assessment.anchorRoles.updateAnchorRole)
  const [band, setBand] = useState(String(anchorRole.expectedBand))
  const [motivation, setMotivation] = useState(anchorRole.motivation)
  const [status, setStatus] = useState<AnchorRoleInfo["status"]>(
    anchorRole.status
  )
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const trimmedMotivation = motivation.trim()
  const dirty =
    Number(band) !== anchorRole.expectedBand ||
    trimmedMotivation !== anchorRole.motivation ||
    status !== anchorRole.status

  async function handleUpdate() {
    setPending(true)
    setFailed(false)
    try {
      await update({
        orgId,
        roleId,
        ...(Number(band) !== anchorRole.expectedBand
          ? { expectedBand: Number(band) }
          : {}),
        ...(trimmedMotivation !== anchorRole.motivation
          ? { motivation: trimmedMotivation }
          : {}),
        ...(status !== anchorRole.status ? { status } : {}),
      })
      onClose()
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <BandField
        band={band}
        bandOptions={bandOptions}
        disabled={pending}
        onChange={setBand}
      />
      <MotivationField
        motivation={motivation}
        disabled={pending}
        onChange={setMotivation}
      />
      <div className="space-y-2">
        <Label htmlFor="anchor-status" className="text-muted-foreground">
          {t("statusLabel")}
        </Label>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as AnchorRoleInfo["status"])}
          disabled={pending}
        >
          <SelectTrigger id="anchor-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_KEYS) as AnchorRoleInfo["status"][]).map(
              (option) => (
                <SelectItem key={option} value={option}>
                  {t(STATUS_KEYS[option])}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>
      <ReviewedLine reviewedAt={anchorRole.reviewedAt} />
      <FormError failed={failed} />
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
        <Button
          onClick={handleUpdate}
          disabled={pending || !dirty || trimmedMotivation === ""}
        >
          {t("updateCta")}
        </Button>
      </DialogFooter>
    </div>
  )
}

// Loads the band options when open; renders the designate or edit form. The
// edit form is keyed by reviewedAt so a concurrent admin's update remounts it
// with fresh values instead of overwriting silently.
function AnchorDialog({
  open,
  onOpenChange,
  orgId,
  roleId,
  anchorRole,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  roleId: Id<"roles">
  anchorRole: AnchorRoleInfo | null
}) {
  const t = useTranslations("dashboard.roles.anchor")
  const model = useQuery(
    api.evaluationModel.model.getModel,
    open ? { orgId } : "skip"
  )
  const bandOptions = Array.from(
    { length: model?.bandThresholds.length ?? 0 },
    (_, index) => index + 1
  )
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("heading")}</DialogTitle>
        </DialogHeader>
        {model === undefined ? (
          <div className="flex justify-center py-6">
            <Spinner aria-label={t("heading")} />
          </div>
        ) : anchorRole === null ? (
          <DesignateForm
            orgId={orgId}
            roleId={roleId}
            bandOptions={bandOptions}
            onClose={close}
          />
        ) : (
          <EditForm
            key={anchorRole.reviewedAt}
            orgId={orgId}
            roleId={roleId}
            anchorRole={anchorRole}
            bandOptions={bandOptions}
            onClose={close}
          />
        )}
      </DialogContent>
    </Dialog>
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
  const tHelp = useTranslations("dashboard.help")
  const [open, setOpen] = useState(false)

  // The concept only appears once it is real: a non-anchor role shows nothing
  // to a non-admin.
  if (anchorRole === null && !isAdmin) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{t("heading")}</span>
        <HelpMorphButton label={tHelp("anchorRoleLabel")}>
          {tHelp("anchorRoleBody")}
        </HelpMorphButton>
        {anchorRole !== null && (
          <Badge variant={STATUS_BADGE_VARIANTS[anchorRole.status]}>
            {t(STATUS_KEYS[anchorRole.status])}
          </Badge>
        )}
      </div>
      {anchorRole !== null && (
        <>
          <Badge variant="outline">
            {t("bandOption", { band: anchorRole.expectedBand })}
          </Badge>
          <p className="text-sm">{anchorRole.motivation}</p>
        </>
      )}
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test -- role-anchor-control`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/roles/role-anchor-control.tsx apps/dashboard/components/roles/role-anchor-control.test.tsx
git commit -m "feat(roles): add the anchor role control with its dialog form"
```

---

### Task 3: Render the control in the Evaluation card; delete the old card

**Files:**
- Modify: `apps/dashboard/components/roles/role-evaluation-card.tsx` (+ its test)
- Modify: `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`
- Delete: `apps/dashboard/components/roles/anchor-role-card.tsx`, `anchor-role-card.test.tsx`
- Modify: `packages/i18n/messages/*.json` (remove orphaned `requiresAssessment`)

**Interfaces:**
- Consumes: `RoleAnchorControl` + `AnchorRoleInfo` (Task 2).

- [ ] **Step 1: Confirm the old card's only consumer is the page**

Run: `rg -n "AnchorRoleCard" apps`
Expected: matches only `app/(app)/roles/[roleSlug]/page.tsx` (import + render) and the card file + its test. If anything else imports it, stop and report.

- [ ] **Step 2: Add the anchor props to the Evaluation card and render the control**

In `apps/dashboard/components/roles/role-evaluation-card.tsx`:

Add imports near the top:

```tsx
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  type AnchorRoleInfo,
  RoleAnchorControl,
} from "@/components/roles/role-anchor-control"
```

Change the props: `roleId` becomes `Id<"roles">`, and add `anchorRole` + `isAdmin`. The full prop block becomes:

```tsx
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
```

In the result view, after the Adjust ratings `<Button>...</Button>`, add the control as the last child of that `<>` fragment:

```tsx
              <RoleAnchorControl
                orgId={orgId}
                roleId={roleId}
                anchorRole={anchorRole}
                isAdmin={isAdmin}
              />
```

(The progress/computing/archived branches are unchanged.)

- [ ] **Step 3: Update the Evaluation card test**

In `apps/dashboard/components/roles/role-evaluation-card.test.tsx`:

The card now imports `RoleAnchorControl`, which calls `useQuery`/`useMutation` for the anchor; the test already mocks `convex/react` via `@/test/convex-mocks` and the api via `apiModule`, so those calls resolve through the existing mock (the anchor control is admin-gated and only opens its queries when its dialog is open). Add `anchorRole` and `isAdmin` to the `renderCard` helper's `<RoleEvaluationCard>` props (default `anchorRole: null`, `isAdmin: false`), and change the `roleId` it passes to `"role_1" as never` (the prop is now `Id<"roles">`). Then add this test inside the `describe`:

```tsx
  it("shows the anchor control for an admin once complete, not in the progress state", () => {
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
      ],
    })
    renderCard({ ratedCount: 3, totalCriteria: 3, isAdmin: true })
    expect(
      screen.getByRole("button", {
        name: messages.dashboard.roles.anchor.designateCta,
      })
    ).toBeDefined()
  })
```

(Update the `renderCard` signature/types to accept `isAdmin` and `anchorRole`; pass `anchorRole ?? null` and `isAdmin ?? false`.)

- [ ] **Step 4: Wire the page and remove the old card**

In `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`:

Remove the `AnchorRoleCard` import. Pass the two new props to `RoleEvaluationCard`:

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
```

Remove the entire `<AnchorRoleCard ... />` render block that follows it.

- [ ] **Step 5: Delete the old card + test**

```bash
git rm apps/dashboard/components/roles/anchor-role-card.tsx \
       apps/dashboard/components/roles/anchor-role-card.test.tsx
```

- [ ] **Step 6: Remove the orphaned `requiresAssessment` key**

Run: `rg -n "requiresAssessment" apps packages/i18n/messages`
Expected: matches only the key definitions in the 5 message files (no code, since the deleted card was its only user). If code still references it, stop and report.

Remove the `"requiresAssessment": ...` line from `dashboard.roles.anchor` in all 5 locale files (find it with `rg -n '"requiresAssessment"' packages/i18n/messages`).

- [ ] **Step 7: Run typecheck, the card tests, and parity**

Run: `cd apps/dashboard && bun run typecheck` (clean: `roleId` is now `Id<"roles">` end to end; `role.roleId` and `role.anchorRole` match; no dangling `AnchorRoleCard` import).
Run: `cd apps/dashboard && bun run test -- role-evaluation-card role-anchor-control` (PASS).
Run: `cd packages/i18n && bun run test` (parity PASS after the key removal).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(roles): move the anchor designation onto the evaluation card"
```

---

### Task 4: Verification

**Files:** none (verification).

- [ ] **Step 1: Full suite + typecheck**

Run (repo root): `bun run test` and `bun run typecheck`
Expected: all PASS; typecheck clean.

- [ ] **Step 2: Confirm the old card is gone and unreferenced**

Run: `rg -n "AnchorRoleCard|anchor-role-card|requiresAssessment" apps packages/i18n/messages`
Expected: no matches.

- [ ] **Step 3: Manual smoke (dev server)**

On a role page, as an admin:
- Fully evaluated, not yet an anchor: the Evaluation card shows the result, and below it a "Designate as anchor role" button that opens a dialog (band + motivation + the 2-5 hint); designating closes it and the status appears.
- Fully evaluated anchor: the Evaluation card shows the anchor status (band + status badge + motivation) and a "Manage anchor role" button opening the edit dialog (band + motivation + status + reviewed date); saving closes it.
- As a non-admin on an anchor role: the read-only status shows, no button.
- Not yet evaluated, or a non-anchor non-admin: no anchor control at all; the rail is just the Evaluation card.

- [ ] **Step 4: No commit** (verification only). Fix any issue under the relevant task and re-run.

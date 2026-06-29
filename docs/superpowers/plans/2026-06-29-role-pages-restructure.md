# Role and family page header restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scattered header buttons on the role and family pages with a single top-left `...` lifecycle menu, and add a breadcrumb that doubles as the page title so the family is one click from a role.

**Architecture:** A shared `PageBreadcrumb` renders `Roles > Family > Role` (family crumb dropped for unfiled roles) using the existing shadcn `Breadcrumb`. A shared `ConfirmDeleteDialog` wraps the destructive `AlertDialog`. Per-surface actions menus (`RoleActionsMenu`, `FamilyActionsMenu`) compose a `DropdownMenu` of lifecycle items; the family menu also owns a `RenameFamilyDialog`. One backend field (`familySlug`) is added to the role detail to power the family crumb's link. Role stays a soft Archive; family stays a hard Delete that unfiles its roles into the existing "No family" group.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Convex, next-intl, react-hook-form + Zod, shadcn/ui, Motion, Vitest 4 + Testing Library, convex-test.

## Global Constraints

- All user-facing text goes through i18n (`next-intl`). New strings are added to `packages/i18n/messages/en.json` first, then mirrored to every other locale (`sv`, `nb`, `da`, `fi`); the parity test fails if any locale's key set differs from `en`. Machine translations are drafts: flag for native review.
- Never use em dashes in any copy, comment, or commit message. Use a period, comma, colon, or parentheses.
- Add non-ASCII locale strings with the Write/Edit tools directly, never via shell `perl`/`sed` (it double-encodes). After editing locale files, grep for mojibake.
- Forms use react-hook-form + `zodResolver` + the shadcn `Form` components, `mode: "onTouched"`. Schema factories are `makeXSchema(t)` where `t` is `useTranslations("dashboard.validation")` typed as `ValidationT` (`@/lib/validation`). A create form gates submit on `disabled={!form.formState.isValid}`; a pre-filled edit form gates on `disabled={!form.formState.isValid || !form.formState.isDirty}`. Use `SubmitButton` (`@/components/submit-button`) for the submit control (it adds `isSubmitting`).
- Entity and row actions use a `DropdownMenu`: a ghost icon `Button` with `MoreVerticalIcon` and an aria-label is the trigger; a destructive item uses `variant="destructive"` and opens an `AlertDialog` (outline Cancel first, destructive confirm last).
- Dialogs follow shadcn anatomy: `DialogHeader` (`DialogTitle`, plus `DialogDescription` when there is copy), the body, and a `DialogFooter` with Cancel (outline) first and the primary action last.
- Internal navigation uses the `Link` component (`next/link`), never plain `<a>`.
- Tests run with Vitest 4 via `bun run test` (never `bun test`). New code ships with tests in the same commit. The pre-commit hook runs Biome on staged files, a full typecheck, and `turbo run test`; all three must pass. Never use `--no-verify`.
- shadcn vendor code (`packages/ui/src/*`) is not edited or reformatted.
- Route-exposed entities use a slug; routes resolve by `(orgId, slug)`. Role ids are permanent (archive is soft, never a hard delete). Family delete is a hard delete that unfiles roles.
- Minimize layout shift; respect reduced motion (do not bypass the global `MotionConfig`).
- Commits are focused and single-concern, made after the task's review checkpoint. Do not push without explicit approval.

---

### Task 1: Expose `familySlug` on the role detail (backend)

**Files:**
- Modify: `packages/backend/convex/assessment/roles.ts` (`roleDetailShape` near line 249; `buildRoleDetail` return near line 321)
- Test: `packages/backend/convex/assessment/roles.test.ts` (add to the `role slugs` describe near line 492)

**Interfaces:**
- Produces: `getRole` and `getRoleBySlug` now return `familySlug: string | null` on the role detail object (string for a filed role, `null` for a family-less role). The role page (Task 7) consumes `role.familySlug`.

- [ ] **Step 1: Write the failing test**

Add inside the `describe("role slugs", ...)` block in `packages/backend/convex/assessment/roles.test.ts`:

```ts
it("getRoleBySlug returns the family slug, or null when unfiled", async () => {
  const t = initConvexTest()
  const { orgId, asAdmin, track } = await seedTemplateOrganization(t)
  const techId = await asAdmin.mutation(
    api.assessment.families.createRoleFamily,
    { orgId, name: "Tech" }
  )
  const filed = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Platform Engineer",
    function: "Eng",
    team: "Core",
    trackKey: track.key,
    familyId: techId,
  })
  const unfiled = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Office Coordinator",
    function: "Ops",
    team: "Ops",
    trackKey: track.key,
  })

  const filedDetail = await asAdmin.query(
    api.assessment.roles.getRoleBySlug,
    { orgId, slug: filed.slug }
  )
  expect(filedDetail?.familyName).toBe("Tech")
  expect(filedDetail?.familySlug).toBe("tech")

  const unfiledDetail = await asAdmin.query(
    api.assessment.roles.getRoleBySlug,
    { orgId, slug: unfiled.slug }
  )
  expect(unfiledDetail?.familyName).toBeNull()
  expect(unfiledDetail?.familySlug).toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/backend && bun run test -- roles.test`
Expected: FAIL. The query result has no `familySlug` (validator error from the returns object, or `familySlug` is `undefined`).

- [ ] **Step 3: Add the field to the validator**

In `roleDetailShape` (the `v.object({ ... })` near line 249), add the line directly after `familyName`:

```ts
  familyName: v.union(v.string(), v.null()),
  familySlug: v.union(v.string(), v.null()),
```

- [ ] **Step 4: Return the field from `buildRoleDetail`**

In the object returned by `buildRoleDetail` (near line 335), add directly after the `familyName` property:

```ts
    familyName:
      role.familyId !== undefined
        ? (fNames.get(role.familyId as string)?.name ?? null)
        : null,
    familySlug:
      role.familyId !== undefined
        ? (fNames.get(role.familyId as string)?.slug ?? null)
        : null,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/backend && bun run test -- roles.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/assessment/roles.ts packages/backend/convex/assessment/roles.test.ts
git commit -m "feat(roles): expose familySlug on the role detail for breadcrumb links"
```

---

### Task 2: Add the new i18n keys to every locale

**Files:**
- Modify: `packages/i18n/messages/en.json`
- Modify: `packages/i18n/messages/sv.json`, `nb.json`, `da.json`, `fi.json`
- Test: `packages/i18n` parity test (existing)

**Interfaces:**
- Produces: these keys, consumed by Tasks 5-7:
  - `dashboard.roles.detail.actionsMenu`
  - `dashboard.roles.archive.dialogTitle`, `dashboard.roles.archive.dialogBody`
  - `dashboard.roles.family.actionsMenu`, `.removeDialogTitle`, `.removeListLabel`, `.renameDialogTitle`, `.renameDialogDescription`

- [ ] **Step 1: Add the keys to `en.json`**

In `dashboard.roles.detail`, add after `"profileHeading": "Job profile",`:

```json
        "actionsMenu": "Role actions",
```

In `dashboard.roles.archive`, change the block to:

```json
      "archive": {
        "cta": "Archive role",
        "confirm": "Yes, archive",
        "cancel": "Cancel",
        "dialogTitle": "Archive this role?",
        "dialogBody": "Archiving removes this role from the active list and all results. Its data and history are kept.",
        "error": "The role could not be archived. Try again."
      },
```

In `dashboard.roles.family`, add these keys (after `"renameCta": "Rename",` and near the remove keys):

```json
        "actionsMenu": "Family actions",
        "renameDialogTitle": "Rename family",
        "renameDialogDescription": "Give the family a new name.",
        "removeDialogTitle": "Delete this family?",
        "removeListLabel": "Roles that will be unfiled:",
```

- [ ] **Step 2: Mirror the keys to `sv`, `nb`, `da`, `fi`**

Add the same keys at the same paths in each locale file, using these draft translations (flag for native review). Use the Edit tool, not shell.

| Key | sv | nb | da | fi |
|---|---|---|---|---|
| detail.actionsMenu | Rollåtgärder | Rollehandlinger | Rollehandlinger | Roolin toiminnot |
| archive.dialogTitle | Arkivera rollen? | Arkivere rollen? | Arkivér rollen? | Arkistoidaanko rooli? |
| archive.dialogBody | Att arkivera tar bort rollen från den aktiva listan och alla resultat. Dess data och historik sparas. | Arkivering fjerner rollen fra den aktive listen og alle resultater. Dataene og historikken beholdes. | Arkivering fjerner rollen fra den aktive liste og alle resultater. Dens data og historik bevares. | Arkistointi poistaa roolin aktiivisesta luettelosta ja kaikista tuloksista. Sen tiedot ja historia säilyvät. |
| family.actionsMenu | Familjeåtgärder | Familiehandlinger | Familiehandlinger | Perheen toiminnot |
| family.renameDialogTitle | Byt namn på familjen | Gi familien nytt navn | Omdøb familien | Nimeä perhe uudelleen |
| family.renameDialogDescription | Ge familjen ett nytt namn. | Gi familien et nytt navn. | Giv familien et nyt navn. | Anna perheelle uusi nimi. |
| family.removeDialogTitle | Ta bort familjen? | Slette familien? | Slet familien? | Poistetaanko perhe? |
| family.removeListLabel | Roller som lämnar familjen: | Roller som forlater familien: | Roller, der forlader familien: | Roolit, jotka poistuvat perheestä: |

- [ ] **Step 3: Run the parity test and grep for mojibake**

Run: `cd packages/i18n && bun run test`
Expected: PASS (all locales share the same key set).
Run: `rg -n "Ã|Â|�" packages/i18n/messages` and expect no matches (no double-encoding).

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages
git commit -m "feat(i18n): add role/family actions-menu and dialog strings"
```

---

### Task 3: Shared `PageBreadcrumb` component

**Files:**
- Create: `apps/dashboard/components/page-breadcrumb.tsx`
- Test: `apps/dashboard/components/page-breadcrumb.test.tsx`

**Interfaces:**
- Produces: `export interface Crumb { label: string; href?: string }` and `export function PageBreadcrumb({ segments }: { segments: Crumb[] })`. Renders each non-last segment with an `href` as a `BreadcrumbLink` wrapping a `next/link` `Link`; the last segment (and any without an `href`) renders as a title-styled `BreadcrumbPage`.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/page-breadcrumb.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { PageBreadcrumb } from "@/components/page-breadcrumb"

describe("PageBreadcrumb", () => {
  afterEach(() => cleanup())

  it("links ancestors and renders the last segment as the current page", () => {
    render(
      <PageBreadcrumb
        segments={[
          { label: "Roles", href: "/roles" },
          { label: "Engineering", href: "/roles/families/engineering" },
          { label: "Senior Engineer" },
        ]}
      />
    )
    const roles = screen.getByRole("link", { name: "Roles" })
    expect(roles.getAttribute("href")).toBe("/roles")
    const family = screen.getByRole("link", { name: "Engineering" })
    expect(family.getAttribute("href")).toBe("/roles/families/engineering")
    // The current page is not a link.
    expect(screen.queryByRole("link", { name: "Senior Engineer" })).toBeNull()
    expect(screen.getByText("Senior Engineer")).toBeDefined()
  })

  it("omits a segment that has no href as a non-link", () => {
    render(
      <PageBreadcrumb
        segments={[{ label: "Roles", href: "/roles" }, { label: "Tech" }]}
      />
    )
    expect(screen.queryByRole("link", { name: "Tech" })).toBeNull()
    expect(screen.getByText("Tech")).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- page-breadcrumb`
Expected: FAIL with module-not-found for `@/components/page-breadcrumb`.

- [ ] **Step 3: Implement the component**

Create `apps/dashboard/components/page-breadcrumb.tsx`:

```tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import Link from "next/link"
import { Fragment } from "react"

// One breadcrumb segment. A segment with an href links to that route; the
// last segment (and any without an href) renders as the current page.
export interface Crumb {
  label: string
  href?: string
}

// Shared page breadcrumb that doubles as the page title: the final crumb is
// the current entity, styled with extra weight so it reads as the title even
// without a large heading. Used by the role and family pages.
export function PageBreadcrumb({ segments }: { segments: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1
          const isLink = !isLast && segment.href !== undefined
          return (
            <Fragment key={`${index}-${segment.label}`}>
              <BreadcrumbItem>
                {isLink ? (
                  <BreadcrumbLink asChild>
                    <Link href={segment.href as string}>{segment.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="font-medium">
                    {segment.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test -- page-breadcrumb`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/page-breadcrumb.tsx apps/dashboard/components/page-breadcrumb.test.tsx
git commit -m "feat(roles): add shared PageBreadcrumb component"
```

---

### Task 4: Shared `ConfirmDeleteDialog` component

**Files:**
- Create: `apps/dashboard/components/confirm-delete-dialog.tsx`
- Test: `apps/dashboard/components/confirm-delete-dialog.test.tsx`

**Interfaces:**
- Produces: `export function ConfirmDeleteDialog(props)` where props are `{ open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; confirmLabel: string; cancelLabel: string; onConfirm: () => Promise<void> | void; pending?: boolean; children?: ReactNode }`. It is a controlled `AlertDialog`; the destructive action calls `onConfirm` then closes. `children` render between the description and footer (used for the affected-roles list).

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/confirm-delete-dialog.test.tsx`:

```tsx
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"

function renderDialog(onConfirm = vi.fn()) {
  const onOpenChange = vi.fn()
  render(
    <ConfirmDeleteDialog
      open
      onOpenChange={onOpenChange}
      title="Delete this family?"
      description="Its roles will be unfiled."
      confirmLabel="Yes, remove"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
    >
      <p>Senior Engineer</p>
    </ConfirmDeleteDialog>
  )
  return { onConfirm, onOpenChange }
}

describe("ConfirmDeleteDialog", () => {
  afterEach(() => cleanup())

  it("renders the title, description, and children", () => {
    renderDialog()
    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(screen.getByText("Delete this family?")).toBeDefined()
    expect(screen.getByText("Senior Engineer")).toBeDefined()
  })

  it("calls onConfirm and closes on confirm", async () => {
    const { onConfirm, onOpenChange } = renderDialog(
      vi.fn().mockResolvedValue(undefined)
    )
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("does not call onConfirm on cancel", () => {
    const { onConfirm } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- confirm-delete-dialog`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

Create `apps/dashboard/components/confirm-delete-dialog.tsx`:

```tsx
"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import type { ReactNode } from "react"

// Controlled destructive-confirmation dialog. The menu item that opens it sets
// `open`; on confirm it runs `onConfirm` then closes. `children` render between
// the description and the footer (for example, the list of affected roles).
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  pending,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => Promise<void> | void
  pending?: boolean
  children?: ReactNode
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              await onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test -- confirm-delete-dialog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/confirm-delete-dialog.tsx apps/dashboard/components/confirm-delete-dialog.test.tsx
git commit -m "feat(roles): add shared ConfirmDeleteDialog component"
```

---

### Task 5: `makeRenameFamilySchema` and `RenameFamilyDialog`

**Files:**
- Modify: `apps/dashboard/lib/role-schemas.ts` (append the factory)
- Create: `apps/dashboard/components/roles/rename-family-dialog.tsx`
- Test: `apps/dashboard/components/roles/rename-family-dialog.test.tsx`

**Interfaces:**
- Consumes: `makeCreateRoleSchema` style and `ValidationT` from `@/lib/validation`; `isDuplicateFamilyError` from `@/lib/family-error`; `SubmitButton`.
- Produces: `makeRenameFamilySchema(t: ValidationT)` and `type RenameFamilyValues`. `RenameFamilyDialog({ open, onOpenChange, orgId, familyId, currentName })`, a controlled dialog that calls `renameRoleFamily` and surfaces a duplicate-name error inline. Consumed by Task 6.

- [ ] **Step 1: Write the failing schema test**

Create `apps/dashboard/lib/role-schemas.test.ts` (or add to it if it exists):

```ts
import { describe, expect, it } from "vitest"
import { makeRenameFamilySchema } from "@/lib/role-schemas"

const t = ((key: string) => key) as never

describe("makeRenameFamilySchema", () => {
  it("rejects an empty name and trims a valid one", () => {
    const schema = makeRenameFamilySchema(t)
    expect(schema.safeParse({ name: "   " }).success).toBe(false)
    const ok = schema.safeParse({ name: "  Tech  " })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.name).toBe("Tech")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- role-schemas`
Expected: FAIL (`makeRenameFamilySchema` is not exported).

- [ ] **Step 3: Implement the factory**

Append to `apps/dashboard/lib/role-schemas.ts`:

```ts
// Client gate for renaming a family: a trimmed, non-empty name. The backend
// re-validates length and case-insensitive uniqueness (the authority).
export function makeRenameFamilySchema(t: ValidationT) {
  return z.object({
    name: z.string().trim().min(1, t("required")),
  })
}
export type RenameFamilyValues = z.infer<
  ReturnType<typeof makeRenameFamilySchema>
>
```

- [ ] **Step 4: Run the schema test to verify it passes**

Run: `cd apps/dashboard && bun run test -- role-schemas`
Expected: PASS.

- [ ] **Step 5: Write the failing dialog test**

Create `apps/dashboard/components/roles/rename-family-dialog.test.tsx`:

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

const renameFamilyMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) =>
    ref === "assessment.families.renameRoleFamily"
      ? renameFamilyMock
      : vi.fn(),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      families: { renameRoleFamily: "assessment.families.renameRoleFamily" },
    },
  },
}))

import { RenameFamilyDialog } from "@/components/roles/rename-family-dialog"

const labels = messages.dashboard.roles.family

function renderDialog() {
  const onOpenChange = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RenameFamilyDialog
        open
        onOpenChange={onOpenChange}
        orgId="org-1"
        familyId="fam-1"
        currentName="Tech"
      />
    </NextIntlClientProvider>
  )
  return { onOpenChange }
}

describe("RenameFamilyDialog", () => {
  beforeEach(() => renameFamilyMock.mockReset())
  afterEach(() => cleanup())

  it("save is disabled until the name changes, then renames with a trimmed name", async () => {
    renameFamilyMock.mockResolvedValue(null)
    const { onOpenChange } = renderDialog()

    // Pre-filled and unchanged: the save button is disabled (no no-op write).
    const save = screen.getByRole("button", { name: labels.saveCta })
    expect(save.hasAttribute("disabled")).toBe(true)

    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "  Teknik  " } })
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false))
    fireEvent.click(save)

    await waitFor(() => {
      expect(renameFamilyMock).toHaveBeenCalledWith({
        orgId: "org-1",
        familyId: "fam-1",
        name: "Teknik",
      })
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("shows the duplicate-name error and stays open", async () => {
    renameFamilyMock.mockRejectedValue(
      new Error("ConvexError: errors.roleFamilyExists")
    )
    renderDialog()
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Sales" },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.saveCta }))
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined())
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- rename-family-dialog`
Expected: FAIL with module-not-found.

- [ ] **Step 7: Implement the dialog**

Create `apps/dashboard/components/roles/rename-family-dialog.tsx`:

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { SubmitButton } from "@/components/submit-button"
import { isDuplicateFamilyError } from "@/lib/family-error"
import { type RenameFamilyValues, makeRenameFamilySchema } from "@/lib/role-schemas"

// Rename dialog for a family. Pre-filled and gated on dirty + valid so an
// unchanged name cannot fire a no-op rename (which would still write an audit
// row). The backend stays the authority for length and uniqueness.
export function RenameFamilyDialog({
  open,
  onOpenChange,
  orgId,
  familyId,
  currentName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  familyId: string
  currentName: string
}) {
  const tFamily = useTranslations("dashboard.roles.family")
  const tv = useTranslations("dashboard.validation")
  const tErrors = useTranslations("errors")
  const renameFamily = useMutation(api.assessment.families.renameRoleFamily)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)

  const schema = useMemo(() => makeRenameFamilySchema(tv), [tv])
  const form = useForm<RenameFamilyValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: currentName },
  })

  // Re-seed when (re)opened, in case the name changed since last open.
  useEffect(() => {
    if (open) {
      form.reset({ name: currentName })
      setFailure(null)
    }
  }, [open, currentName, form])

  async function onSubmit(values: RenameFamilyValues) {
    setFailure(null)
    try {
      await renameFamily({
        orgId,
        familyId: familyId as never,
        name: values.name,
      })
      onOpenChange(false)
    } catch (error) {
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tFamily("renameDialogTitle")}</DialogTitle>
          <DialogDescription>
            {tFamily("renameDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tFamily("nameLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {failure !== null && (
              <p role="alert" className="text-destructive text-sm">
                {failure === "duplicate"
                  ? tErrors("roleFamilyExists")
                  : tFamily("error")}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {tFamily("cancel")}
              </Button>
              <SubmitButton
                type="submit"
                isSubmitting={form.formState.isSubmitting}
                disabled={!form.formState.isValid || !form.formState.isDirty}
              >
                {tFamily("saveCta")}
              </SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 8: Run the dialog test to verify it passes**

Run: `cd apps/dashboard && bun run test -- rename-family-dialog`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/lib/role-schemas.ts apps/dashboard/lib/role-schemas.test.ts apps/dashboard/components/roles/rename-family-dialog.tsx apps/dashboard/components/roles/rename-family-dialog.test.tsx
git commit -m "feat(roles): add family rename dialog and schema"
```

---

### Task 6: `FamilyActionsMenu` and the rewritten family header

**Files:**
- Create: `apps/dashboard/components/roles/family-actions-menu.tsx`
- Create: `apps/dashboard/components/roles/family-actions-menu.test.tsx`
- Rewrite: `apps/dashboard/components/roles/family-header.tsx`
- Rewrite: `apps/dashboard/components/roles/family-header.test.tsx`
- Modify: `apps/dashboard/app/(app)/roles/families/[familySlug]/page.tsx` (pass `roleTitles` to `FamilyHeader`)

**Interfaces:**
- Consumes: `ConfirmDeleteDialog` (Task 4), `RenameFamilyDialog` (Task 5), `PageBreadcrumb` + `Crumb` (Task 3), `dashboard.roles.family.*` and `dashboard.nav.roles` (Task 2).
- Produces: `FamilyActionsMenu({ orgId, familyId, name, roleTitles })`. `FamilyHeader({ orgId, familyId, name, roleTitles })` now renders the breadcrumb row plus the menu.

- [ ] **Step 1: Write the failing menu test**

Create `apps/dashboard/components/roles/family-actions-menu.test.tsx`:

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

const renameFamilyMock = vi.fn()
const removeFamilyMock = vi.fn()
const pushMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "assessment.families.renameRoleFamily") return renameFamilyMock
    if (ref === "assessment.families.removeRoleFamily") return removeFamilyMock
    return vi.fn()
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      families: {
        renameRoleFamily: "assessment.families.renameRoleFamily",
        removeRoleFamily: "assessment.families.removeRoleFamily",
      },
    },
  },
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }))

import { FamilyActionsMenu } from "@/components/roles/family-actions-menu"

const labels = messages.dashboard.roles.family

function renderMenu(roleTitles = ["Senior Engineer", "Staff Engineer"]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamilyActionsMenu
        orgId="org-1"
        familyId="fam-1"
        name="Tech"
        roleTitles={roleTitles}
      />
    </NextIntlClientProvider>
  )
}

function openMenu() {
  const trigger = screen.getByRole("button", { name: labels.actionsMenu })
  fireEvent.pointerDown(trigger)
  fireEvent.click(trigger)
}

describe("FamilyActionsMenu", () => {
  beforeEach(() => {
    renameFamilyMock.mockReset()
    removeFamilyMock.mockReset()
    pushMock.mockReset()
  })
  afterEach(() => cleanup())

  it("opens the rename dialog from the menu", () => {
    renderMenu()
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.renameCta }))
    expect(screen.getByRole("dialog")).toBeDefined()
    expect(screen.getByText(labels.renameDialogTitle)).toBeDefined()
  })

  it("delete lists the affected roles and removes on confirm, then navigates", async () => {
    removeFamilyMock.mockResolvedValue(null)
    renderMenu(["Senior Engineer", "Staff Engineer"])
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.removeCta }))

    // The affected roles are listed; nothing removed yet.
    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(screen.getByText(labels.removeListLabel)).toBeDefined()
    expect(screen.getByText("Senior Engineer")).toBeDefined()
    expect(screen.getByText("Staff Engineer")).toBeDefined()
    expect(removeFamilyMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: labels.removeConfirm }))
    await waitFor(() => {
      expect(removeFamilyMock).toHaveBeenCalledWith({
        orgId: "org-1",
        familyId: "fam-1",
      })
    })
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/roles"))
  })

  it("omits the affected-roles list for an empty family", () => {
    renderMenu([])
    openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.removeCta }))
    expect(screen.queryByText(labels.removeListLabel)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- family-actions-menu`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `FamilyActionsMenu`**

Create `apps/dashboard/components/roles/family-actions-menu.tsx`:

```tsx
"use client"

import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { RenameFamilyDialog } from "@/components/roles/rename-family-dialog"

// The family lifecycle menu: Rename (a dialog) and Delete (a confirmed hard
// delete that unfiles the family's roles into the "No family" group). The
// delete dialog lists the affected roles so the impact is explicit.
export function FamilyActionsMenu({
  orgId,
  familyId,
  name,
  roleTitles,
}: {
  orgId: string
  familyId: string
  name: string
  roleTitles: string[]
}) {
  const tFamily = useTranslations("dashboard.roles.family")
  const removeFamily = useMutation(api.assessment.families.removeRoleFamily)
  const router = useRouter()
  const [renameOpen, setRenameOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tFamily("actionsMenu")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            {tFamily("renameCta")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmDelete(true)}
          >
            {tFamily("removeCta")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameFamilyDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        orgId={orgId}
        familyId={familyId}
        currentName={name}
      />

      <ConfirmDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={tFamily("removeDialogTitle")}
        description={tFamily("removeHint")}
        confirmLabel={tFamily("removeConfirm")}
        cancelLabel={tFamily("cancel")}
        pending={pending}
        onConfirm={async () => {
          setPending(true)
          try {
            await removeFamily({ orgId, familyId: familyId as never })
            router.push("/roles")
          } finally {
            setPending(false)
          }
        }}
      >
        {roleTitles.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="mb-2 font-medium text-sm">
              {tFamily("removeListLabel")}
            </p>
            <ul className="max-h-[200px] space-y-1 overflow-y-auto">
              {roleTitles.map((title) => (
                <li
                  key={title}
                  className="flex items-center gap-2 text-muted-foreground text-sm"
                >
                  <span className="inline-block size-1 rounded-full bg-muted-foreground" />
                  {title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </ConfirmDeleteDialog>
    </>
  )
}
```

- [ ] **Step 4: Run the menu test to verify it passes**

Run: `cd apps/dashboard && bun run test -- family-actions-menu`
Expected: PASS.

- [ ] **Step 5: Rewrite `FamilyHeader`**

Replace the entire contents of `apps/dashboard/components/roles/family-header.tsx` with:

```tsx
"use client"

import { useTranslations } from "next-intl"
import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { FamilyActionsMenu } from "@/components/roles/family-actions-menu"

// Family page header: a top-left actions menu (rename, delete) and the
// breadcrumb (Roles > family) whose last crumb doubles as the page title.
export function FamilyHeader({
  orgId,
  familyId,
  name,
  roleTitles,
}: {
  orgId: string
  familyId: string
  name: string
  roleTitles: string[]
}) {
  const tNav = useTranslations("dashboard.nav")
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FamilyActionsMenu
        orgId={orgId}
        familyId={familyId}
        name={name}
        roleTitles={roleTitles}
      />
      <PageBreadcrumb
        segments={[{ label: tNav("roles"), href: "/roles" }, { label: name }]}
      />
    </div>
  )
}
```

- [ ] **Step 6: Rewrite the family-header test**

Replace the entire contents of `apps/dashboard/components/roles/family-header.test.tsx` with a composition test (behavior now lives in `family-actions-menu.test.tsx`):

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }))
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      families: {
        renameRoleFamily: "assessment.families.renameRoleFamily",
        removeRoleFamily: "assessment.families.removeRoleFamily",
      },
    },
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { FamilyHeader } from "@/components/roles/family-header"

const family = messages.dashboard.roles.family

describe("FamilyHeader", () => {
  afterEach(() => cleanup())

  it("renders the family name as the current page and the actions trigger", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <FamilyHeader
          orgId="org-1"
          familyId="fam-1"
          name="Tech"
          roleTitles={["Senior Engineer"]}
        />
      </NextIntlClientProvider>
    )
    expect(screen.getByText("Tech")).toBeDefined()
    expect(screen.getByRole("link", { name: messages.dashboard.nav.roles }))
      .toBeDefined()
    expect(
      screen.getByRole("button", { name: family.actionsMenu })
    ).toBeDefined()
  })
})
```

- [ ] **Step 7: Pass `roleTitles` from the family page**

In `apps/dashboard/app/(app)/roles/families/[familySlug]/page.tsx`, change the `FamilyHeader` usage (near line 81) to:

```tsx
      <FamilyHeader
        familyId={family.familyId}
        name={family.name}
        orgId={orgId}
        roleTitles={familyRoles.map((role) => role.title)}
      />
```

(`familyRoles` is already computed above the return.)

- [ ] **Step 8: Run the family tests and typecheck**

Run: `cd apps/dashboard && bun run test -- family-actions-menu family-header`
Expected: PASS.
Run: `bun run typecheck` (from repo root, or `cd apps/dashboard && bun run typecheck`)
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/components/roles/family-actions-menu.tsx apps/dashboard/components/roles/family-actions-menu.test.tsx apps/dashboard/components/roles/family-header.tsx apps/dashboard/components/roles/family-header.test.tsx "apps/dashboard/app/(app)/roles/families/[familySlug]/page.tsx"
git commit -m "feat(roles): consolidate family header into a breadcrumb and actions menu"
```

---

### Task 7: `RoleActionsMenu` and the rewritten role header

**Files:**
- Create: `apps/dashboard/components/roles/role-actions-menu.tsx`
- Create: `apps/dashboard/components/roles/role-actions-menu.test.tsx`
- Modify: `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx` (replace the header block)

**Interfaces:**
- Consumes: `ConfirmDeleteDialog` (Task 4), `PageBreadcrumb` + `Crumb` (Task 3), `role.familyName`/`role.familySlug` (Task 1), `dashboard.roles.detail.actionsMenu`, `dashboard.roles.archive.*`, `dashboard.nav.roles` (Task 2).
- Produces: `RoleActionsMenu({ orgId, roleId, archived, isAdmin })`, which renders nothing when the viewer has no available action (non-admin, or the role is already archived).

- [ ] **Step 1: Write the failing menu test**

Create `apps/dashboard/components/roles/role-actions-menu.test.tsx`:

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

const archiveRoleMock = vi.fn()
const pushMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) =>
    ref === "assessment.roles.archiveRole" ? archiveRoleMock : vi.fn(),
}))
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: { assessment: { roles: { archiveRole: "assessment.roles.archiveRole" } } },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }))

import { RoleActionsMenu } from "@/components/roles/role-actions-menu"

const detail = messages.dashboard.roles.detail
const archive = messages.dashboard.roles.archive

function renderMenu(props: { archived?: boolean; isAdmin?: boolean } = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleActionsMenu
        orgId="org-1"
        roleId={"role-1" as never}
        archived={props.archived ?? false}
        isAdmin={props.isAdmin ?? true}
      />
    </NextIntlClientProvider>
  )
}

describe("RoleActionsMenu", () => {
  beforeEach(() => {
    archiveRoleMock.mockReset()
    pushMock.mockReset()
  })
  afterEach(() => cleanup())

  it("renders no trigger for a non-admin", () => {
    renderMenu({ isAdmin: false })
    expect(
      screen.queryByRole("button", { name: detail.actionsMenu })
    ).toBeNull()
  })

  it("renders no trigger for an archived role", () => {
    renderMenu({ archived: true })
    expect(
      screen.queryByRole("button", { name: detail.actionsMenu })
    ).toBeNull()
  })

  it("archives through the confirm dialog, then navigates to /roles", async () => {
    archiveRoleMock.mockResolvedValue(null)
    renderMenu()
    const trigger = screen.getByRole("button", { name: detail.actionsMenu })
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("menuitem", { name: archive.cta }))

    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(archiveRoleMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: archive.confirm }))
    await waitFor(() => {
      expect(archiveRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
      })
    })
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/roles"))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test -- role-actions-menu`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `RoleActionsMenu`**

Create `apps/dashboard/components/roles/role-actions-menu.tsx`:

```tsx
"use client"

import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"

// The role lifecycle menu. Archive is the only action today and it is admin
// only; an archived role has no further lifecycle action (there is no
// unarchive). When no action is available the menu renders nothing, so the
// header is just the breadcrumb (empty-menu rule).
export function RoleActionsMenu({
  orgId,
  roleId,
  archived,
  isAdmin,
}: {
  orgId: string
  roleId: Id<"roles">
  archived: boolean
  isAdmin: boolean
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tArchive = useTranslations("dashboard.roles.archive")
  const archiveRole = useMutation(api.assessment.roles.archiveRole)
  const router = useRouter()
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [pending, setPending] = useState(false)

  if (!isAdmin || archived) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("actionsMenu")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmArchive(true)}
          >
            {tArchive("cta")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={tArchive("dialogTitle")}
        description={tArchive("dialogBody")}
        confirmLabel={tArchive("confirm")}
        cancelLabel={tArchive("cancel")}
        pending={pending}
        onConfirm={async () => {
          setPending(true)
          try {
            await archiveRole({ orgId, roleId })
            router.push("/roles")
          } finally {
            setPending(false)
          }
        }}
      />
    </>
  )
}
```

- [ ] **Step 4: Run the menu test to verify it passes**

Run: `cd apps/dashboard && bun run test -- role-actions-menu`
Expected: PASS.

- [ ] **Step 5: Replace the role page header block**

In `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`:

First, fix the imports. Remove these imports:

```tsx
import { MorphConfirmButton } from "@/components/morph-confirm-button"
import { PageHeading } from "@/components/page-heading"
import { useMutation, useQuery } from "convex/react"
import { useRouter } from "next/navigation"
```

Add these imports (and keep `useQuery`):

```tsx
import { useQuery } from "convex/react"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import { RoleActionsMenu } from "@/components/roles/role-actions-menu"
```

Remove the now-unused hooks inside the component (the `archiveRole` mutation, the `router`, and the `tArchive` translator):

```tsx
  const tArchive = useTranslations("dashboard.roles.archive")
  const router = useRouter()
  const archiveRole = useMutation(api.assessment.roles.archiveRole)
```

Add the nav translator near the other `useTranslations` calls:

```tsx
  const tNav = useTranslations("dashboard.nav")
```

Then replace the header `div` (the `<div className="flex flex-wrap items-center gap-3"> ... </div>` block that currently holds `PageHeading`, the badges, and the `MorphConfirmButton`) with:

```tsx
      <div className="flex flex-wrap items-center gap-3">
        <RoleActionsMenu
          orgId={orgId}
          roleId={role.roleId}
          archived={role.archived}
          isAdmin={orgRole === "admin"}
        />
        <PageBreadcrumb segments={roleCrumbs} />
        {role.archived && (
          <Badge variant="outline">{t("archivedBadge")}</Badge>
        )}
        <TrackBadge trackKey={role.trackKey} name={role.trackName} />
        <span className="text-muted-foreground text-sm">
          {role.function} · {role.team}
        </span>
      </div>
```

Build `roleCrumbs` just above the `return` (after the `role === null` guard), so the family crumb is dropped for an unfiled role:

```tsx
  const roleCrumbs: Crumb[] = [{ label: tNav("roles"), href: "/roles" }]
  if (role.familyName !== null && role.familySlug !== null) {
    roleCrumbs.push({
      label: role.familyName,
      href: `/roles/families/${role.familySlug}`,
    })
  }
  roleCrumbs.push({ label: role.title })
```

- [ ] **Step 6: Run the full dashboard test suite and typecheck**

Run: `cd apps/dashboard && bun run test`
Expected: PASS (including the existing role page tests, if any reference the header).
Run: `bun run typecheck` (repo root)
Expected: no errors (confirms no dangling imports such as `MorphConfirmButton`, `PageHeading`, `useRouter`, `useMutation`, `tArchive`).

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/components/roles/role-actions-menu.tsx apps/dashboard/components/roles/role-actions-menu.test.tsx "apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx"
git commit -m "feat(roles): consolidate role header into a breadcrumb and actions menu"
```

---

### Task 8: Manual verification and cleanup pass

**Files:** none (verification).

- [ ] **Step 1: Run the full suite once more**

Run (repo root): `bun run test`
Expected: all packages PASS.

- [ ] **Step 2: Check for orphaned references**

Run: `rg -n "MorphConfirmButton" apps/dashboard/components/roles apps/dashboard/app`
Expected: no matches in the role/family pages (the role and family headers no longer use it). It may still be used elsewhere; that is fine.
Run: `rg -n "PageHeading" "apps/dashboard/app/(app)/roles"`
Expected: no matches under the role routes (both headers now use `PageBreadcrumb`).

- [ ] **Step 3: Manual smoke (dev server)**

Start the app and verify by hand:
- Role page: breadcrumb reads `Roles > {Family} > {Role}`; clicking the family crumb opens the family page; an unfiled role reads `Roles > {Role}`; the `...` menu shows Archive for an admin only; archiving navigates to `/roles`; a non-admin and an archived role show no `...`.
- Family page: breadcrumb reads `Roles > {Family}`; `...` menu shows Rename and Delete; Rename opens the dialog (Save disabled until the name changes); Delete lists the family's roles and, on confirm, navigates to `/roles` with those roles now under "No family" in the register.

- [ ] **Step 4: No commit** (verification only). If issues are found, fix them under the relevant task and re-run.

# People Register Bulk Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a row-selection checkbox column and a bulk "delete selected" action to the people register at `/people`.

**Architecture:** Pure frontend. The register keeps a local `Set<personId>`; the header checkbox toggles the current page only, and the effective selection is derived every render as the intersection with the filtered rows. The bulk action opens an `AlertDialog` with a type-`DELETE` gate that runs a client-driven loop calling the existing `erasePersonAsOrg` mutation once per person, with `NumberFlow` progress in the confirm button. No backend, schema, or audit change.

**Tech Stack:** Next.js 16 (App Router), React 19, TanStack Table v9, Convex, next-intl, react-hook-form + Zod, Base UI (shadcn), Motion, `@number-flow/react`, Vitest 4 + Testing Library.

## Global Constraints

- **All user-facing text goes through i18n.** New strings land in `packages/i18n/messages/en.json` FIRST, then mirror into `sv.json`, `nb.json`, `da.json`, `fi.json`. The parity test fails on any key set that differs from `en`.
- **Never use em dashes (" — ")** in UI copy, comments, or commit messages.
- **All code, comments, and commit messages are in English.**
- **Tests ship in the same commit as the code.** Run with `bun run test`, NEVER `bun test`.
- **Biome ends at zero:** no errors, no warnings, no info. `packages/ui/src/**` is vendor code and must not be touched or reformatted.
- **Commit messages use Conventional Commits** (`type(scope): summary`, lowercase, imperative, no trailing period). No AI/Claude attribution anywhere.
- **Do NOT commit unless the plan step says to.** Per repo rules, finished work is left uncommitted for review; the commit steps in this plan run only after the reviewer approves.
- **Minimize layout shift:** the bulk toolbar row renders in the loading branch too, with a reserved `min-h-8`.
- **Inline-flex controls inside a `TableCell` sit in a block flex wrapper** (`<div className="flex items-center">`), never directly on the text baseline, or skeleton and data rows measure differently.
- **Do not add an admin-role gate** to the new button. The person page's erase has none; the backend `adminMutation` enforces permission.

---

### Task 1: Move `selectionState` into a shared lib module

The classify surface's `selectionState` is exactly the math the register needs. It gains a consumer outside `components/people/classify/`, so per the repo's file-ownership rule it moves to `apps/dashboard/lib/`. `packAssignmentChunks` is classify-specific and stays.

**Files:**
- Create: `apps/dashboard/lib/selection.ts`
- Create: `apps/dashboard/lib/selection.test.ts`
- Modify: `apps/dashboard/components/people/classify/classify-bulk.ts` (remove `selectionState` and its comment block)
- Modify: `apps/dashboard/components/people/classify/classify-bulk.test.ts` (remove the `selectionState` describe and the import)
- Modify: `apps/dashboard/components/people/classify/classify-title-table.tsx:57-62` (import `selectionState` from `@/lib/selection`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `selectionState(selected: ReadonlySet<string>, selectable: readonly string[]): { effective: Set<string>; all: boolean; some: boolean }`, exported from `@/lib/selection`. Task 4 calls it twice.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/lib/selection.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { selectionState } from "./selection"

describe("selectionState", () => {
  it("prunes selected keys that are no longer selectable", () => {
    const state = selectionState(new Set(["a", "b", "gone"]), ["a", "b", "c"])
    expect([...state.effective].sort()).toEqual(["a", "b"])
  })

  it("is all when every selectable key is selected, some when partial", () => {
    expect(selectionState(new Set(["a", "b"]), ["a", "b"]).all).toBe(true)
    const partial = selectionState(new Set(["a"]), ["a", "b"])
    expect(partial.all).toBe(false)
    expect(partial.some).toBe(true)
  })

  it("is neither all nor some when nothing is selected or nothing is selectable", () => {
    expect(selectionState(new Set(), ["a"]).some).toBe(false)
    const empty = selectionState(new Set(["a"]), [])
    expect(empty.all).toBe(false)
    expect(empty.some).toBe(false)
    expect(empty.effective.size).toBe(0)
  })

  // The people register asks the helper two different questions about ONE
  // selection: the header checkbox reads the current page, and the bulk action
  // reads the whole filtered set. A selection spanning both pages is "all" for
  // a fully selected page while still only "some" of the filtered rows.
  it("answers page-scoped and filtered-scoped questions from the same selection", () => {
    const selected = new Set(["p1", "p2", "p5"])
    const page = ["p1", "p2"]
    const filtered = ["p1", "p2", "p3", "p4", "p5"]

    const pageState = selectionState(selected, page)
    expect(pageState.all).toBe(true)
    expect(pageState.some).toBe(false)

    const filteredState = selectionState(selected, filtered)
    expect(filteredState.all).toBe(false)
    expect(filteredState.some).toBe(true)
    expect([...filteredState.effective].sort()).toEqual(["p1", "p2", "p5"])
  })

  // Order follows the selectable list, not the insertion order of the Set, so
  // the ids handed to a bulk action are deterministic.
  it("orders the effective set by the selectable list", () => {
    const state = selectionState(new Set(["c", "a", "b"]), ["a", "b", "c"])
    expect([...state.effective]).toEqual(["a", "b", "c"])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/dashboard && bun run vitest run lib/selection.test.ts
```

Expected: FAIL, `Failed to resolve import "./selection"`.

- [ ] **Step 3: Create the module**

Create `apps/dashboard/lib/selection.ts`:

```ts
// Shared selection math for table surfaces with row checkboxes (the classify
// title table, the people register). Pure, so the rules are unit-tested
// without a DOM.

// The effective selection given what is currently selectable: stale keys drop
// out (a row filtered away, a group confirmed meanwhile, a person erased), and
// a header checkbox derives its checked/indeterminate state from the result.
// A surface calls this once per question it asks: the people register runs it
// against the current page's ids for its header checkbox, and against the
// whole filtered set for the count its bulk action will act on. `effective`
// follows the order of `selectable`, so the ids a bulk action receives are
// deterministic rather than insertion-ordered.
export function selectionState(
  selected: ReadonlySet<string>,
  selectable: readonly string[]
): { effective: Set<string>; all: boolean; some: boolean } {
  const effective = new Set(selectable.filter((key) => selected.has(key)))
  const all = selectable.length > 0 && effective.size === selectable.length
  return { effective, all, some: effective.size > 0 && !all }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/dashboard && bun run vitest run lib/selection.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Delete the old copy**

In `apps/dashboard/components/people/classify/classify-bulk.ts`, delete the `selectionState` function together with the comment block above it (the block starting `// The effective selection given what is currently actionable:` and ending at the closing brace of the function). Keep the file header comment, `BulkAssignment`, and `packAssignmentChunks`. Update the file header comment to:

```ts
// Pure chunk-packing math for the classify surface's bulk confirm, extracted
// so it is unit-testable without the table component. The selection math it
// used to hold moved to @/lib/selection when the people register became its
// second consumer.
```

- [ ] **Step 6: Update the classify imports**

In `apps/dashboard/components/people/classify/classify-title-table.tsx`, replace the import block at lines 57-62:

```ts
import {
  type BulkAssignment,
  packAssignmentChunks,
  selectionState,
} from "./classify-bulk"
```

with:

```ts
import { selectionState } from "@/lib/selection"
import { type BulkAssignment, packAssignmentChunks } from "./classify-bulk"
```

Place the `@/lib/selection` import next to the other `@/lib/*` imports (`@/lib/motion`, `@/lib/select`) so Biome's import ordering stays clean.

- [ ] **Step 7: Update the classify test**

In `apps/dashboard/components/people/classify/classify-bulk.test.ts`, delete the whole `describe("selectionState", ...)` block and change the import to:

```ts
import { type BulkAssignment, packAssignmentChunks } from "./classify-bulk"
```

- [ ] **Step 8: Run the dashboard suite and Biome**

```bash
cd apps/dashboard && bun run vitest run lib/selection.test.ts components/people/classify
bun run --cwd /Volumes/development/blueprnt/frontend biome check --error-on-warnings apps/dashboard/lib/selection.ts apps/dashboard/lib/selection.test.ts apps/dashboard/components/people/classify
```

Expected: all tests PASS, Biome reports no diagnostics.

- [ ] **Step 9: Commit (only after reviewer approval)**

```bash
git add apps/dashboard/lib/selection.ts apps/dashboard/lib/selection.test.ts apps/dashboard/components/people/classify
git commit -m "refactor(dashboard): share the table selection math across surfaces"
```

---

### Task 2: Add the bulk i18n keys in every locale

**Files:**
- Modify: `packages/i18n/messages/en.json`
- Modify: `packages/i18n/messages/sv.json`
- Modify: `packages/i18n/messages/nb.json`
- Modify: `packages/i18n/messages/da.json`
- Modify: `packages/i18n/messages/fi.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the `dashboard.people.bulk.*` namespace and `dashboard.toast.peopleErased`, consumed by Tasks 3 and 4. The dialog's cancel label is NOT a new key: reuse the existing `dashboard.people.erase.cancel`.

- [ ] **Step 1: Add the `bulk` block to `en.json`**

In `packages/i18n/messages/en.json`, inside `dashboard.people`, add a `"bulk"` object immediately after the existing `"erase"` object (it is the last key of `people`, so add a comma after `erase`'s closing brace):

```json
"bulk": {
  "selectAll": "Select all employees on this page",
  "selectRow": "Select {name}",
  "selectedCount": "{count, plural, one {# employee selected} other {# employees selected}}",
  "cta": "Delete selected",
  "dialogTitle": "Delete selected employees?",
  "dialogDescription": "{count, plural, one {# employee} other {# employees}} will be permanently deleted, together with all their assignments and salary records. This cannot be undone.",
  "confirmLabel": "Type DELETE to confirm",
  "confirm": "Delete permanently",
  "progress": "<done></done> / <total></total>",
  "error": "The employees could not be deleted. Try again."
}
```

- [ ] **Step 2: Add the toast key to `en.json`**

In `dashboard.toast`, immediately after `"personErased"`, add:

```json
"peopleErased": "{count, plural, one {# employee deleted} other {# employees deleted}}",
```

- [ ] **Step 3: Mirror into `sv.json`**

Same two positions. `dashboard.people.bulk`:

```json
"bulk": {
  "selectAll": "Markera alla anställda på den här sidan",
  "selectRow": "Markera {name}",
  "selectedCount": "{count, plural, one {# anställd markerad} other {# anställda markerade}}",
  "cta": "Radera markerade",
  "dialogTitle": "Radera markerade anställda?",
  "dialogDescription": "{count, plural, one {# anställd} other {# anställda}} raderas permanent tillsammans med alla tilldelningar och löneuppgifter. Det kan inte ångras.",
  "confirmLabel": "Skriv DELETE för att bekräfta",
  "confirm": "Radera permanent",
  "progress": "<done></done> / <total></total>",
  "error": "De anställda kunde inte raderas. Försök igen."
}
```

`dashboard.toast.peopleErased`:

```json
"peopleErased": "{count, plural, one {# anställd raderad} other {# anställda raderade}}",
```

- [ ] **Step 4: Mirror into `nb.json`**

```json
"bulk": {
  "selectAll": "Velg alle ansatte på denne siden",
  "selectRow": "Velg {name}",
  "selectedCount": "{count, plural, one {# ansatt valgt} other {# ansatte valgt}}",
  "cta": "Slett valgte",
  "dialogTitle": "Slett valgte ansatte?",
  "dialogDescription": "{count, plural, one {# ansatt} other {# ansatte}} slettes permanent sammen med alle tildelinger og lønnsoppføringer. Dette kan ikke angres.",
  "confirmLabel": "Skriv DELETE for å bekrefte",
  "confirm": "Slett permanent",
  "progress": "<done></done> / <total></total>",
  "error": "De ansatte kunne ikke slettes. Prøv igjen."
}
```

```json
"peopleErased": "{count, plural, one {# ansatt slettet} other {# ansatte slettet}}",
```

- [ ] **Step 5: Mirror into `da.json`**

```json
"bulk": {
  "selectAll": "Vælg alle medarbejdere på denne side",
  "selectRow": "Vælg {name}",
  "selectedCount": "{count, plural, one {# medarbejder valgt} other {# medarbejdere valgt}}",
  "cta": "Slet valgte",
  "dialogTitle": "Slet valgte medarbejdere?",
  "dialogDescription": "{count, plural, one {# medarbejder} other {# medarbejdere}} slettes permanent sammen med alle tildelinger og lønposter. Dette kan ikke fortrydes.",
  "confirmLabel": "Skriv DELETE for at bekræfte",
  "confirm": "Slet permanent",
  "progress": "<done></done> / <total></total>",
  "error": "Medarbejderne kunne ikke slettes. Prøv igen."
}
```

```json
"peopleErased": "{count, plural, one {# medarbejder slettet} other {# medarbejdere slettet}}",
```

- [ ] **Step 6: Mirror into `fi.json`**

```json
"bulk": {
  "selectAll": "Valitse kaikki tämän sivun työntekijät",
  "selectRow": "Valitse {name}",
  "selectedCount": "{count, plural, one {# työntekijä valittu} other {# työntekijää valittu}}",
  "cta": "Poista valitut",
  "dialogTitle": "Poistetaanko valitut työntekijät?",
  "dialogDescription": "{count, plural, one {# työntekijä} other {# työntekijää}} poistetaan pysyvästi kaikkine tehtävineen ja palkkatietoineen. Toimintoa ei voi kumota.",
  "confirmLabel": "Kirjoita DELETE vahvistaaksesi",
  "confirm": "Poista pysyvästi",
  "progress": "<done></done> / <total></total>",
  "error": "Työntekijöitä ei voitu poistaa. Yritä uudelleen."
}
```

```json
"peopleErased": "{count, plural, one {# työntekijä poistettu} other {# työntekijää poistettu}}",
```

- [ ] **Step 7: Verify parity and that no mojibake crept in**

```bash
cd packages/i18n && bun run test
cd /Volumes/development/blueprnt/frontend && grep -n "Ã¥\|Ã¤\|Ã¶\|Ã¦\|Ã¸\|Ã…\|Ã„\|Ã–" packages/i18n/messages/*.json
```

Expected: the i18n suite PASSES (key sets identical across all five files); the grep prints NOTHING. If the grep matches, the file was double-encoded: revert it and re-edit with the Write/Edit tool, never with a shell `perl`/`sed` one-liner.

- [ ] **Step 8: Commit (only after reviewer approval)**

```bash
git add packages/i18n/messages
git commit -m "feat(i18n): add bulk delete copy for the people register"
```

---

### Task 3: The bulk delete dialog

A standalone component so `people-section.tsx` (already ~600 lines) does not absorb a second dialog. It owns the type-to-confirm gate, the sequential erase loop, the progress readout, and the toasts; the register owns only the selection.

**Files:**
- Create: `apps/dashboard/components/people/bulk-delete-people-dialog.tsx`
- Create: `apps/dashboard/components/people/bulk-delete-people-dialog.test.tsx`

**Interfaces:**
- Consumes: `dashboard.people.bulk.*` and `dashboard.toast.peopleErased` from Task 2; `api.people.erase.erasePersonAsOrg` (existing, args `{ orgId: string; personId: Id<"people"> }`, returns `null`); `useOrganization()` from `@/components/org-context` returning `{ orgId, name, role }`; `toast` from `@/lib/toast`.
- Produces:

```ts
export function BulkDeletePeopleDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personIds: readonly string[]
  onDeleted: () => void
}): React.JSX.Element
```

Task 4 renders it and passes `personIds` as the effective selection and `onDeleted` as the selection reset.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/people/bulk-delete-people-dialog.test.tsx`:

```tsx
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: "admin" }),
}))

import { toast } from "@/lib/toast"
import { mockMutation } from "@/test/convex-mocks"
import { BulkDeletePeopleDialog } from "@/components/people/bulk-delete-people-dialog"

const eraseMock = mockMutation("people.erase.erasePersonAsOrg")
const m = messages.dashboard.people

function renderDialog(
  personIds: string[] = ["p1", "p2"],
  onDeleted = vi.fn(),
  onOpenChange = vi.fn()
) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BulkDeletePeopleDialog
        open={true}
        onOpenChange={onOpenChange}
        personIds={personIds}
        onDeleted={onDeleted}
      />
    </NextIntlClientProvider>
  )
  return { onDeleted, onOpenChange }
}

// Types DELETE into the confirm field, which is what arms the destructive
// action.
function typeToken(token = "DELETE") {
  const input = screen.getByLabelText(m.bulk.confirmLabel)
  fireEvent.change(input, { target: { value: token } })
}

describe("BulkDeletePeopleDialog", () => {
  beforeEach(() => {
    eraseMock.mockReset()
    eraseMock.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("keeps the destructive action disabled until DELETE is typed", async () => {
    renderDialog()
    const confirm = screen.getByRole("button", { name: m.bulk.confirm })
    expect(confirm).toHaveProperty("disabled", true)

    typeToken("DELET")
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: m.bulk.confirm })
      ).toHaveProperty("disabled", true)
    )

    typeToken("DELETE")
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: m.bulk.confirm })
      ).toHaveProperty("disabled", false)
    )
  })

  it("erases one person per call, in order, then toasts the count and closes", async () => {
    const { onDeleted, onOpenChange } = renderDialog(["p1", "p2", "p3"])
    typeToken()
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: m.bulk.confirm })
      ).toHaveProperty("disabled", false)
    )
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(eraseMock).toHaveBeenCalledTimes(3)
    expect(eraseMock.mock.calls.map((c) => c[0])).toEqual([
      { orgId: "org1", personId: "p1" },
      { orgId: "org1", personId: "p2" },
      { orgId: "org1", personId: "p3" },
    ])
    expect(onDeleted).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("stops at the failing person, keeps the dialog open, and does not report success", async () => {
    eraseMock
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("boom"))
    const { onDeleted, onOpenChange } = renderDialog(["p1", "p2", "p3"])
    typeToken()
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: m.bulk.confirm })
      ).toHaveProperty("disabled", false)
    )
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    // The third person is never attempted: the loop stops at the failure.
    expect(eraseMock).toHaveBeenCalledTimes(2)
    expect(toast.success).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    // The dialog stays mounted with an inline error, so a retry finishes the rest.
    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(screen.getByRole("alert").textContent).toBe(m.bulk.error)
  })

  it("closes without writing anything when the selection pruned to empty", async () => {
    const { onDeleted, onOpenChange } = renderDialog([])
    typeToken()
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: m.bulk.confirm })
      ).toHaveProperty("disabled", false)
    )
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(eraseMock).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/dashboard && bun run vitest run components/people/bulk-delete-people-dialog.test.tsx
```

Expected: FAIL, cannot resolve `@/components/people/bulk-delete-people-dialog`.

- [ ] **Step 3: Write the component**

Create `apps/dashboard/components/people/bulk-delete-people-dialog.tsx`:

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useOrganization } from "@/components/org-context"
import { toast } from "@/lib/toast"

// The register's batch erasure gate. The per-person dialog asks for the
// employee number, which cannot address several people at once, so the batch
// asks for the literal token the per-person dialog already falls back to when
// a person has no employee number.
const ERASE_TOKEN = "DELETE"

// No message on the refine: the gate shows no inline field error, it only
// arms the destructive action (same shape as ErasePersonControl).
const schema = z.object({
  confirmText: z.string().refine((v) => v.trim() === ERASE_TOKEN),
})

// Deletes every selected person, one erasePersonAsOrg call at a time.
//
// One person per transaction is the honest bound: erasing a person already
// deletes their whole salary history and assignments, pseudonymizes them
// inside every frozen pay-mapping snapshot, and rewrites every audit row
// carrying them as subject, so the work per person is itself unbounded. A
// client-driven loop with visible progress is the pattern the scalability rule
// asks for, and it needs no new backend surface: each iteration writes its own
// person.erased audit row, exactly as deleting them one by one would.
//
// Controlled: the trigger lives in the register's bulk toolbar, not here.
export function BulkDeletePeopleDialog({
  open,
  onOpenChange,
  personIds,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The register's EFFECTIVE selection (already pruned to rows it is showing).
  personIds: readonly string[]
  // Called once the whole selection landed, so the register can clear it.
  onDeleted: () => void
}) {
  const t = useTranslations("dashboard.people.bulk")
  const tErase = useTranslations("dashboard.people.erase")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const erasePerson = useMutation(api.people.erase.erasePersonAsOrg)
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [failed, setFailed] = useState(false)

  const form = useForm<{ confirmText: string }>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { confirmText: "" },
  })
  const confirmed = form.formState.isValid
  const busy = progress !== null

  // While the loop runs, people erased so far leave the register's reactive
  // query and prune out of `personIds`. The dialog's own copy must not tick
  // down under the user mid-delete, so the frozen total wins while busy.
  const count = progress?.total ?? personIds.length

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset({ confirmText: "" })
      setFailed(false)
    }
    onOpenChange(next)
  }

  async function handleDelete() {
    if (!confirmed || busy) return
    // Snapshot the ids: the prop prunes reactively as the loop lands.
    const ids = [...personIds]
    // The selection pruned to nothing while the dialog was open (everyone was
    // erased or filtered away elsewhere). Nothing to write, so close without
    // claiming a success that did not happen.
    if (ids.length === 0) {
      handleOpenChange(false)
      return
    }
    setProgress({ done: 0, total: ids.length })
    setFailed(false)
    try {
      let done = 0
      for (const personId of ids) {
        await erasePerson({ orgId, personId: personId as Id<"people"> })
        done += 1
        setProgress({ done, total: ids.length })
      }
      toast.success(tToast("peopleErased", { count: ids.length }))
      onDeleted()
      handleOpenChange(false)
    } catch {
      // Partial completion is honest and resumable: whoever landed is already
      // gone from the register and pruned out of the selection, so confirming
      // again finishes the remainder.
      setFailed(true)
      toast.error(tToast("error"))
    } finally {
      setProgress(null)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("dialogDescription", { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-bulk-erase">{t("confirmLabel")}</Label>
          <Input
            id="confirm-bulk-erase"
            autoComplete="off"
            disabled={busy}
            {...form.register("confirmText")}
          />
        </div>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}
        <AlertDialogFooter>
          {/* Cancel reuses the per-person dialog's already-translated label
              rather than adding a second "Cancel" key to this surface. */}
          <AlertDialogCancel disabled={busy}>
            {tErase("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!confirmed || busy}
            onClick={(event) => {
              // Keep the dialog mounted; we close it ourselves on success.
              event.preventDefault()
              void handleDelete()
            }}
          >
            {progress !== null ? (
              <>
                <Spinner />
                {/* The progress numbers render through NumberFlow (the
                    message's tags carry the layout) so the done count rolls
                    as each person lands instead of swapping. */}
                {t.rich("progress", {
                  done: () => <NumberFlow value={progress.done} />,
                  total: () => <NumberFlow value={progress.total} />,
                })}
              </>
            ) : (
              t("confirm")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/dashboard && bun run vitest run components/people/bulk-delete-people-dialog.test.tsx
```

Expected: PASS, 4 tests.

If the "disabled" assertions fail because `AlertDialogAction` renders a non-native element, inspect the rendered button with `screen.debug()` and switch the assertion to `expect(confirm.getAttribute("disabled")).not.toBeNull()`. Do NOT relax the assertion to something that would pass whether or not the gate works.

- [ ] **Step 5: Biome**

```bash
cd /Volumes/development/blueprnt/frontend && bun run biome check --error-on-warnings apps/dashboard/components/people/bulk-delete-people-dialog.tsx apps/dashboard/components/people/bulk-delete-people-dialog.test.tsx
```

Expected: no diagnostics.

- [ ] **Step 6: Commit (only after reviewer approval)**

```bash
git add apps/dashboard/components/people/bulk-delete-people-dialog.tsx apps/dashboard/components/people/bulk-delete-people-dialog.test.tsx
git commit -m "feat(people): add the register's batch erasure dialog"
```

---

### Task 4: Wire selection, the bulk toolbar, and the skeleton into the register

**Files:**
- Modify: `apps/dashboard/components/people/people-section.tsx`
- Modify: `apps/dashboard/components/people/people-section.test.tsx`

**Interfaces:**
- Consumes: `selectionState` from `@/lib/selection` (Task 1); `BulkDeletePeopleDialog` from `@/components/people/bulk-delete-people-dialog` (Task 3); `dashboard.people.bulk.*` (Task 2).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing tests**

Append to `apps/dashboard/components/people/people-section.test.tsx`, inside the existing `describe("PeopleSection", ...)` block (before its closing brace). The file already mocks `convex/react`, the generated api, `org-context`, `next/navigation` and `next/link`; add the toast mock and the mutation mock alongside the existing module mocks at the top of the file:

```tsx
// Add to the module-mock block at the top of the file, beside the other vi.mock calls:
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Add to the import block below the mocks:
import { mockMutation } from "@/test/convex-mocks"

// Add beside the other module-level constants:
const eraseMock = mockMutation("people.erase.erasePersonAsOrg")

// 30 people so the register paginates (PAGE_SIZE is 25): names sort as
// "Person 00".."Person 29", so page 1 holds 00..24 and page 2 holds 25..29.
const MANY_PEOPLE = Array.from({ length: 30 }, (_, i) => ({
  personId: `mp${i}`,
  publicId: `pub-mp${i}`,
  displayName: `Person ${String(i).padStart(2, "0")}`,
  gender: i % 2 === 0 ? "Kvinna" : "Man",
  department: i < 10 ? "Engineering" : "Product",
  ftePercent: 100,
  externalRef: null,
  birthDate: null,
  employmentStartDate: null,
  country: null,
  isManager: null,
  statisticalCode: null,
  archivedAt: null,
  roleId: null,
  senioritySource: null,
}))
```

Then the cases:

```tsx
  // -------------------------------------------------------------------------
  // Row selection and bulk delete
  // -------------------------------------------------------------------------

  describe("selection", () => {
    beforeEach(() => {
      eraseMock.mockReset()
      eraseMock.mockResolvedValue(null)
      vi.mocked(toast.success).mockReset()
      vi.mocked(toast.error).mockReset()
    })

    it("shows no count and a disabled CTA before anything is selected", () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      expect(screen.getByRole("button", { name: m.bulk.cta })).toHaveProperty(
        "disabled",
        true
      )
      expect(screen.queryByText(/selected/)).toBeNull()
    })

    it("selects a single row and counts it", () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: m.bulk.selectRow.replace("{name}", "Alice Svensson"),
        })
      )
      expect(screen.getByText("1 employee selected")).toBeDefined()
      expect(screen.getByRole("button", { name: m.bulk.cta })).toHaveProperty(
        "disabled",
        false
      )
    })

    it("select-all covers only the current page, not the whole filtered set", () => {
      onQuery((ref) => queryRouter(ref, MANY_PEOPLE))
      renderSection()
      fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
      // 30 people, page size 25: select-all takes the page, never all 30.
      expect(screen.getByText("25 employees selected")).toBeDefined()
    })

    it("puts the header checkbox in the mixed state on a partial page", () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: m.bulk.selectRow.replace("{name}", "Alice Svensson"),
        })
      )
      const headerBox = screen.getByRole("checkbox", { name: m.bulk.selectAll })
      expect(headerBox.getAttribute("aria-checked")).toBe("mixed")
      // Selecting the rest of the page flips it to fully checked.
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: m.bulk.selectRow.replace("{name}", "Bob Larsson"),
        })
      )
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: m.bulk.selectRow.replace("{name}", "Charlie Nilsson"),
        })
      )
      expect(headerBox.getAttribute("aria-checked")).toBe("true")
    })

    it("keeps the selection when paging, and select-all on page 2 adds to it", () => {
      onQuery((ref) => queryRouter(ref, MANY_PEOPLE))
      renderSection()
      fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
      fireEvent.click(screen.getByRole("button", { name: m.toolbar.next }))
      // The 25 from page 1 are still selected while page 2 is shown.
      expect(screen.getByText("25 employees selected")).toBeDefined()
      fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
      expect(screen.getByText("30 employees selected")).toBeDefined()
    })

    it("prunes the selection to what the filter still shows", () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
      expect(screen.getByText("3 employees selected")).toBeDefined()
      // Narrowing to Alice drops the other two from the effective selection.
      fireEvent.change(
        screen.getByPlaceholderText(m.toolbar.searchPlaceholder),
        { target: { value: "Alice" } }
      )
      expect(screen.getByText("1 employee selected")).toBeDefined()
    })

    it("deletes exactly the selected people, one call each, then clears the selection", async () => {
      onQuery((ref) => queryRouter(ref))
      renderSection()
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: m.bulk.selectRow.replace("{name}", "Alice Svensson"),
        })
      )
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: m.bulk.selectRow.replace("{name}", "Bob Larsson"),
        })
      )
      fireEvent.click(screen.getByRole("button", { name: m.bulk.cta }))
      fireEvent.change(screen.getByLabelText(m.bulk.confirmLabel), {
        target: { value: "DELETE" },
      })
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: m.bulk.confirm })
        ).toHaveProperty("disabled", false)
      )
      fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))

      await waitFor(() => expect(toast.success).toHaveBeenCalled())
      expect(eraseMock).toHaveBeenCalledTimes(2)
      expect(eraseMock.mock.calls.map((c) => c[0])).toEqual([
        { orgId: "org1", personId: "p1" },
        { orgId: "org1", personId: "p2" },
      ])
      // The dialog closed and the selection reset (the fixture query still
      // returns all three people, so a stale selection would still count).
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
      expect(screen.getByRole("button", { name: m.bulk.cta })).toHaveProperty(
        "disabled",
        true
      )
    })

    it("renders the checkbox column in the loading skeleton", () => {
      onQuery(() => undefined)
      renderSection()
      // The header checkbox is real chrome with a static label, so it renders
      // live during loading rather than as a gray bar.
      expect(
        screen.getByRole("checkbox", { name: m.bulk.selectAll })
      ).toBeDefined()
      // Skeleton rows carry a real, non-interactive checkbox in the same slot.
      // They are aria-hidden (decorative chrome standing in for nothing), so
      // they are absent from the role tree by design: query the DOM directly.
      expect(
        document.querySelectorAll('[data-slot="checkbox"][aria-hidden="true"]')
          .length
      ).toBeGreaterThan(0)
    })
  })
```

Add `beforeEach`, `waitFor` and `toast` to the file's imports:

```tsx
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "@/lib/toast"
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/dashboard && bun run vitest run components/people/people-section.test.tsx
```

Expected: the new cases FAIL (`Unable to find an accessible element with the role "checkbox"`); every pre-existing case still PASSES.

- [ ] **Step 3: Add the imports and selection state to the register**

In `apps/dashboard/components/people/people-section.tsx`, add to the imports:

```tsx
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { BulkDeletePeopleDialog } from "@/components/people/bulk-delete-people-dialog"
import { selectionState } from "@/lib/selection"
```

`buttonVariants` is already imported from `@workspace/ui/components/button`; extend that existing import rather than adding a second one:

```tsx
import { Button, buttonVariants } from "@workspace/ui/components/button"
```

Inside `PeopleSection`, beside the other `useTranslations` calls:

```tsx
  const tBulk = useTranslations("dashboard.people.bulk")
```

and beside the other `useState` calls:

```tsx
  // Selected people, keyed by personId. Survives paging and filtering; the
  // EFFECTIVE selection below is what any action reads.
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
```

- [ ] **Step 4: Derive the two selection views**

Directly after the existing `const roleFilterActive = roleFilter !== "all"` line, add:

```tsx
  // One selection, two questions. The header checkbox reads the CURRENT PAGE
  // (a select-all must never arm an irreversible delete over rows the user
  // cannot see), while the bulk action reads the whole FILTERED set, so a
  // selection built across pages stays actionable and rows hidden by a filter
  // or already erased drop out on their own.
  const pageIds = pageRows.map((row) => row.personId)
  const filteredIds = table
    .getFilteredRowModel()
    .rows.map((row) => row.original.personId)
  const pageSelection = selectionState(selected, pageIds)
  const selection = selectionState(selected, filteredIds)
  const selectedCount = selection.effective.size

  function toggleSelected(personId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(personId)
      } else {
        next.delete(personId)
      }
      return next
    })
  }

  // Adds or removes exactly the rows on screen, leaving a selection made on
  // another page untouched.
  function togglePage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const personId of pageIds) {
        if (checked) {
          next.add(personId)
        } else {
          next.delete(personId)
        }
      }
      return next
    })
  }
```

- [ ] **Step 5: Add the header checkbox cell**

In the `tableHeader` JSX, add a first cell before `sortableHead("name", ...)`:

```tsx
        {/* Fixed-width selection slot. The label is static i18n text, so this
            renders live (and enabled) during loading like the rest of the
            page chrome; with no rows on screen a click selects nothing. */}
        <TableHead className="w-10">
          <Checkbox
            aria-label={tBulk("selectAll")}
            checked={pageSelection.all}
            indeterminate={pageSelection.some}
            onCheckedChange={(checked) => togglePage(checked === true)}
          />
        </TableHead>
```

- [ ] **Step 6: Add the checkbox to the skeleton columns**

Replace the `PEOPLE_SKELETON_COLUMNS` constant with:

```tsx
// Skeleton shape per column, mirroring the real row content (selection
// checkbox, name link, short gender word, department, tiny FTE value) so the
// loading table has the same silhouette as the loaded one. The checkbox is
// per-row chrome that is identical on every row, not data, so it renders as
// its real control (muted, non-interactive) rather than a bar.
const PEOPLE_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  {
    content: (
      <span className="flex items-center">
        <Checkbox disabled aria-hidden="true" tabIndex={-1} />
      </span>
    ),
  },
  { className: "w-36 max-w-full" },
  { className: "w-16" },
  { className: "w-28 max-w-full" },
  { className: "w-10" },
]
```

- [ ] **Step 7: Add the row checkbox cell**

In the `pageRows.map(...)` body, add a first cell before the name `TableCell`:

```tsx
                        <TableCell className="w-10">
                          {/* Block flex wrapper: an inline-flex control sitting
                              directly on a cell's text baseline inflates the
                              line box, which would desync data rows from the
                              skeleton's row height. */}
                          <div className="flex items-center">
                            <Checkbox
                              aria-label={tBulk("selectRow", {
                                name: row.name,
                              })}
                              checked={selection.effective.has(row.personId)}
                              onCheckedChange={(checked) =>
                                toggleSelected(row.personId, checked === true)
                              }
                            />
                          </div>
                        </TableCell>
```

- [ ] **Step 8: Add the bulk toolbar**

Beside the existing `toolbar` and `headerActions` constants, add:

```tsx
  // Bulk action row, rendered in BOTH the loading and the loaded branch with a
  // reserved height, so neither the arrival of data nor a selection going from
  // 0 to n reflows the table below it. Delete is the only bulk action today,
  // so it is a plain button; a second one turns this into a DropdownMenu.
  const bulkToolbar = (
    <div className="flex min-h-8 items-center justify-between gap-2">
      {/* The only feedback for a selection change: announce it to screen
          readers too, since nothing else states the current selection. */}
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {selectedCount > 0
          ? tBulk("selectedCount", { count: selectedCount })
          : null}
      </p>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={selectedCount === 0}
        onClick={() => setBulkOpen(true)}
      >
        {tBulk("cta")}
      </Button>
    </div>
  )
```

- [ ] **Step 9: Render the toolbar and the dialog**

In the loading branch, insert `{bulkToolbar}` between `{toolbar}` and `<Table className="table-fixed">`.

In the loaded branch, insert `{bulkToolbar}` immediately before `<Table className="table-fixed">` (inside the `shown === 0 ? ... : (<>` else-arm, so it does not appear above the no-matches empty state, where the selection is always empty anyway).

Then, immediately before the closing `</div>` of the component's returned tree, add:

```tsx
      <BulkDeletePeopleDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        personIds={[...selection.effective]}
        onDeleted={() => setSelected(new Set())}
      />
```

- [ ] **Step 10: Run the register's tests**

```bash
cd apps/dashboard && bun run vitest run components/people/people-section.test.tsx
```

Expected: PASS, including every pre-existing case. If a pre-existing case broke because the row now has one more cell, fix the ASSERTION to account for the new column; do not remove the checkbox to make an old test pass.

- [ ] **Step 11: Run the whole suite, the typecheck, and Biome**

```bash
cd /Volumes/development/blueprnt/frontend
bun run test
bun run typecheck
bun run biome check --error-on-warnings apps/dashboard packages/i18n
```

Expected: all three green, with zero Biome diagnostics of any severity.

- [ ] **Step 12: Verify in the running app**

Start the dev server, open `/people`, and confirm by hand:

1. The checkbox column renders and the header checkbox goes indeterminate on a partial page.
2. Selecting rows shows the count; the delete button enables.
3. The dialog's confirm stays disabled until `DELETE` is typed.
4. Deleting a small selection removes those rows and toasts the count.
5. Switching the locale to `sv` shows the Swedish copy with no raw keys. (Raw keys after a message edit usually mean a stale dev bundle: restart `next dev` before debugging.)
6. The table does not shift when the page loads or when a selection appears.

- [ ] **Step 13: Commit (only after reviewer approval)**

```bash
git add apps/dashboard/components/people/people-section.tsx apps/dashboard/components/people/people-section.test.tsx
git commit -m "feat(people): select rows in the register and delete them in bulk"
```

---

## Notes for the reviewer

- **No backend diff is expected.** If a task produced one, that is a defect: the design deliberately reuses `erasePersonAsOrg` unchanged so the audit trail matches a per-person delete exactly.
- **Nordic copy is a machine draft** and is flagged for native review before launch.
- **The person page's erase is untouched** and keeps its employee-number token.

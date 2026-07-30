# Bulk Classify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add checkbox selection to the classify table and one chunked "Classify selected" action that confirms every selected title group's suggested assignments at once, behind a summary confirmation dialog.

**Architecture:** Selection and the dialog live in the existing `ClassifyTitleTable` component; the paging/packing math is a new pure module beside it. Writes reuse the existing `assignPeopleToRole` mutation, now bounded server-side by a shared max-batch constant; the client packs whole title groups into chunks under that bound and submits them sequentially with visible progress. Spec: `docs/superpowers/specs/2026-07-30-bulk-classify-design.md`.

**Tech Stack:** Next.js 16 app (`apps/dashboard`), Convex backend (`packages/backend`), Base UI-based shadcn components (`@workspace/ui`: `checkbox`, `alert-dialog`, `spinner` all exist), next-intl, Vitest 4.

## Global Constraints

- Tests run with `bun run test` from the repo root (never `bun test`); backend tests use convex-test on edge-runtime.
- Lint/format is Biome; run `bunx biome check --write <files>` before each commit. The pre-commit hook runs Biome + typecheck + the full turbo test suite; never `--no-verify`.
- No em dashes anywhere (code comments, UI copy, docs). Comments state constraints only, no decision provenance.
- Every user-facing string goes through i18n: add to `packages/i18n/messages/en.json` first, mirror the SAME keys to `sv.json`, `nb.json`, `da.json`, `fi.json` (a parity test fails otherwise). nb/da/fi values are drafts for native review.
- Base UI, not Radix: components use `render` props (not `asChild`); Checkbox is `CheckboxPrimitive.Root` (`checked`, `indeterminate`, `onCheckedChange`).
- `MAX_ASSIGNMENTS_PER_MUTATION = 50` (people per mutation) is the single shared bound, defined once in `@workspace/constants`.
- Commit messages: Conventional Commits, no AI/Claude attribution of any kind.
- Backend Convex functions always declare `args` and `returns` validators.

---

### Task 1: Shared max-batch constant and server-side bound

**Files:**
- Create: `packages/constants/src/assignments.ts`
- Modify: `packages/constants/src/index.ts`
- Modify: `packages/backend/convex/people/assignments.ts` (the `assignPeopleToRole` handler, ~line 224)
- Test: `packages/backend/convex/people/assignments.test.ts`

**Interfaces:**
- Consumes: existing `assignPeopleToRole` orgMutation; `appError`/`ERROR_CODES` already imported in `assignments.ts`.
- Produces: `MAX_ASSIGNMENTS_PER_MUTATION: number` exported from `@workspace/constants` (Tasks 2, 3, 5 import it); `assignPeopleToRole` throws `errors.invalidInput` for batches larger than the bound.

- [ ] **Step 1: Write the failing backend test**

Open `packages/backend/convex/people/assignments.test.ts` and check its existing seed helpers. If it already has a helper that creates an org + admin identity and a person + role, reuse those. Otherwise add this test using the same helpers style as `classification.test.ts` (seedMembership + api mutations). Append the describe:

```ts
describe("assignPeopleToRole batch bound", () => {
  it("rejects a batch larger than MAX_ASSIGNMENTS_PER_MUTATION", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role: "admin" }
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", {
        orgId,
        country: "se",
        currency: "SEK",
        language: "sv",
        industry: "itTelecom",
      })
    })
    const asAdmin = t.withIdentity({ subject: userId })
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Anna Svensson", gender: "Kvinna", country: "SE" }
    )
    // 51 valid entries: the length gate must fire before any per-item work.
    const assignments = Array.from(
      { length: MAX_ASSIGNMENTS_PER_MUTATION + 1 },
      () => ({ personId, roleId, level: "IC1" })
    )
    await expect(
      asAdmin.mutation(api.people.assignments.assignPeopleToRole, {
        orgId,
        assignments,
        levelSource: "confirmed",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("accepts a batch exactly at the bound", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr2@acme.se", name: "HR Person", role: "admin" }
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", {
        orgId,
        country: "se",
        currency: "SEK",
        language: "sv",
        industry: "itTelecom",
      })
    })
    const asAdmin = t.withIdentity({ subject: userId })
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Berg", gender: "Man", country: "SE" }
    )
    // Same person repeated: each write supersedes the previous open
    // assignment, which is valid; only the LENGTH is under test here.
    const assignments = Array.from(
      { length: MAX_ASSIGNMENTS_PER_MUTATION },
      () => ({ personId, roleId, level: "IC1" })
    )
    const ids = await asAdmin.mutation(
      api.people.assignments.assignPeopleToRole,
      { orgId, assignments, levelSource: "confirmed" }
    )
    expect(ids).toHaveLength(MAX_ASSIGNMENTS_PER_MUTATION)
  })
})
```

Add the imports the file is missing (match its existing import style):

```ts
import { MAX_ASSIGNMENTS_PER_MUTATION } from "@workspace/constants"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/backend && bunx vitest run convex/people/assignments.test.ts -t "batch bound"`
Expected: FAIL. The constant does not exist yet (import error), or once created, the oversized batch resolves instead of rejecting.

- [ ] **Step 3: Create the constant**

Create `packages/constants/src/assignments.ts`:

```ts
// The most assignment writes one mutation may carry (the classify surface's
// per-group and bulk confirms chunk to this bound). Each assignment costs
// roughly 8-12 document writes (close + insert + audit row + aggregate
// upkeep), so the bound keeps a chunk far under Convex's per-transaction
// limits while staying large enough that a typical title group fits in one.
export const MAX_ASSIGNMENTS_PER_MUTATION = 50
```

Add to `packages/constants/src/index.ts` (alphabetical position, after the countries export block):

```ts
export { MAX_ASSIGNMENTS_PER_MUTATION } from "./assignments"
```

- [ ] **Step 4: Add the server bound**

In `packages/backend/convex/people/assignments.ts`, import the constant:

```ts
import { isValidLevelForTrack, MAX_ASSIGNMENTS_PER_MUTATION } from "@workspace/constants"
```

At the top of the `assignPeopleToRole` handler (before the `effectiveAt` line):

```ts
    // Bounded transaction (CLAUDE.md scalability rule): callers chunk to this
    // limit; a larger batch would approach Convex's per-transaction document
    // limits (each assignment costs ~8-12 writes).
    if (args.assignments.length > MAX_ASSIGNMENTS_PER_MUTATION) {
      throw appError(ERROR_CODES.invalidInput)
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/backend && bunx vitest run convex/people/assignments.test.ts`
Expected: PASS (all tests in the file, not just the new ones).

- [ ] **Step 6: Lint and commit**

```bash
bunx biome check --write packages/constants/src/assignments.ts packages/constants/src/index.ts packages/backend/convex/people/assignments.ts packages/backend/convex/people/assignments.test.ts
git add packages/constants/src/assignments.ts packages/constants/src/index.ts packages/backend/convex/people/assignments.ts packages/backend/convex/people/assignments.test.ts
git commit -m "feat(backend): bound assignment batches to a shared per-mutation limit"
```

---

### Task 2: Pure selection and chunk-packing helpers

**Files:**
- Create: `apps/dashboard/components/people/classify/classify-bulk.ts`
- Test: `apps/dashboard/components/people/classify/classify-bulk.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure module).
- Produces (Tasks 3-5 import these exact names from `./classify-bulk`):
  - `type BulkAssignment = { personId: string; roleId: string; level: string }`
  - `selectionState(selected: ReadonlySet<string>, actionable: readonly string[]): { effective: Set<string>; all: boolean; some: boolean }`
  - `packAssignmentChunks(groups: ReadonlyArray<readonly BulkAssignment[]>, limit: number): BulkAssignment[][]`

- [ ] **Step 1: Write the failing tests**

Create `apps/dashboard/components/people/classify/classify-bulk.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  type BulkAssignment,
  packAssignmentChunks,
  selectionState,
} from "./classify-bulk"

const a = (n: number): BulkAssignment[] =>
  Array.from({ length: n }, (_, i) => ({
    personId: `p${i}`,
    roleId: "r1",
    level: "IC1",
  }))

describe("selectionState", () => {
  it("prunes selected keys that are no longer actionable", () => {
    const state = selectionState(new Set(["a", "b", "gone"]), ["a", "b", "c"])
    expect([...state.effective].sort()).toEqual(["a", "b"])
  })

  it("is all when every actionable key is selected, some when partial", () => {
    expect(selectionState(new Set(["a", "b"]), ["a", "b"]).all).toBe(true)
    const partial = selectionState(new Set(["a"]), ["a", "b"])
    expect(partial.all).toBe(false)
    expect(partial.some).toBe(true)
  })

  it("is neither all nor some when nothing is selected or nothing is actionable", () => {
    expect(selectionState(new Set(), ["a"]).some).toBe(false)
    const empty = selectionState(new Set(["a"]), [])
    expect(empty.all).toBe(false)
    expect(empty.some).toBe(false)
    expect(empty.effective.size).toBe(0)
  })
})

describe("packAssignmentChunks", () => {
  it("keeps whole groups together within the limit", () => {
    const chunks = packAssignmentChunks([a(20), a(20), a(20)], 50)
    expect(chunks.map((c) => c.length)).toEqual([40, 20])
  })

  it("splits a single group larger than the limit", () => {
    const chunks = packAssignmentChunks([a(120)], 50)
    expect(chunks.map((c) => c.length)).toEqual([50, 50, 20])
  })

  it("closes the running chunk before an oversized group", () => {
    const chunks = packAssignmentChunks([a(10), a(120), a(10)], 50)
    expect(chunks.map((c) => c.length)).toEqual([10, 50, 50, 20, 10])
  })

  it("returns no chunks for no assignments", () => {
    expect(packAssignmentChunks([], 50)).toEqual([])
    expect(packAssignmentChunks([[]], 50)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/dashboard && bunx vitest run components/people/classify/classify-bulk.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement the module**

Create `apps/dashboard/components/people/classify/classify-bulk.ts`:

```ts
// Pure selection and chunk-packing math for the classify surface's bulk
// confirm, extracted so it is unit-testable without the table component.

export type BulkAssignment = {
  personId: string
  roleId: string
  level: string
}

// The effective selection given what is currently actionable: stale keys
// (groups confirmed meanwhile, or whose role pick was cleared) drop out, and
// the header checkbox derives its checked/indeterminate state from the
// result.
export function selectionState(
  selected: ReadonlySet<string>,
  actionable: readonly string[]
): { effective: Set<string>; all: boolean; some: boolean } {
  const effective = new Set(actionable.filter((key) => selected.has(key)))
  const all = actionable.length > 0 && effective.size === actionable.length
  return { effective, all, some: effective.size > 0 && !all }
}

// Packs per-group assignment lists into chunks of at most `limit` people,
// keeping whole groups together when they fit (a partially confirmed group
// is a worse failure state than a partially confirmed selection). A single
// group larger than the limit closes the running chunk and splits into
// limit-sized slices. Empty groups contribute nothing.
export function packAssignmentChunks(
  groups: ReadonlyArray<readonly BulkAssignment[]>,
  limit: number
): BulkAssignment[][] {
  const chunks: BulkAssignment[][] = []
  let current: BulkAssignment[] = []
  for (const group of groups) {
    if (group.length === 0) continue
    if (group.length > limit) {
      if (current.length > 0) {
        chunks.push(current)
        current = []
      }
      for (let i = 0; i < group.length; i += limit) {
        chunks.push(group.slice(i, i + limit))
      }
      continue
    }
    if (current.length + group.length > limit) {
      chunks.push(current)
      current = []
    }
    current.push(...group)
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/dashboard && bunx vitest run components/people/classify/classify-bulk.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Lint and commit**

```bash
bunx biome check --write apps/dashboard/components/people/classify/classify-bulk.ts apps/dashboard/components/people/classify/classify-bulk.test.ts
git add apps/dashboard/components/people/classify/classify-bulk.ts apps/dashboard/components/people/classify/classify-bulk.test.ts
git commit -m "feat(dashboard): selection and chunk-packing helpers for bulk classify"
```

---

### Task 3: Chunk the existing per-group confirm

**Files:**
- Modify: `apps/dashboard/components/people/classify/classify-title-table.tsx` (the `submitAssignments` function, ~line 485)

**Interfaces:**
- Consumes: `packAssignmentChunks`, `type BulkAssignment` from `./classify-bulk` (Task 2); `MAX_ASSIGNMENTS_PER_MUTATION` from `@workspace/constants` (Task 1).
- Produces: `submitAssignments(assignments: BulkAssignment[]): Promise<void>` now submits in bounded chunks; Task 5 reuses the same mutation reference and packing.

- [ ] **Step 1: Update submitAssignments to chunk**

In `classify-title-table.tsx`, add imports:

```ts
import { MAX_ASSIGNMENTS_PER_MUTATION } from "@workspace/constants"
import { packAssignmentChunks } from "./classify-bulk"
```

(Note: `@workspace/constants` items are already imported at the top; extend that import instead of adding a duplicate line.)

Replace the body of `submitAssignments`:

```ts
  // Submits in bounded chunks (the server rejects batches over the shared
  // limit): a typical group is one chunk and one transaction; an oversized
  // group lands as consecutive chunks, each atomic on its own.
  async function submitAssignments(
    assignments: Array<{ personId: string; roleId: string; level: string }>
  ) {
    for (const chunk of packAssignmentChunks(
      [assignments],
      MAX_ASSIGNMENTS_PER_MUTATION
    )) {
      await assignPeople({
        orgId,
        assignments: chunk as Parameters<
          typeof assignPeople
        >[0]["assignments"],
        levelSource: "confirmed",
      })
    }
  }
```

- [ ] **Step 2: Run the existing component tests to verify nothing regressed**

Run: `cd apps/dashboard && bunx vitest run components/people/classify/classify-title-table.test.tsx`
Expected: PASS, including "fires assignPeopleToRole ONCE with every person on Confirm" (a two-person group is one chunk, so the call count is unchanged).

- [ ] **Step 3: Lint and commit**

```bash
bunx biome check --write apps/dashboard/components/people/classify/classify-title-table.tsx
git add apps/dashboard/components/people/classify/classify-title-table.tsx
git commit -m "refactor(dashboard): submit per-group classify confirms in bounded chunks"
```

---

### Task 4: Selection checkboxes and the bulk toolbar

**Files:**
- Modify: `apps/dashboard/components/people/classify/classify-title-table.tsx` (`ClassifyTableHeader`, `CLASSIFY_SKELETON_COLUMNS`, the row render, the component's return)
- Modify: `packages/i18n/messages/en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json` (`dashboard.classify.bulk.*`)
- Test: `apps/dashboard/components/people/classify/classify-title-table.test.tsx`

**Interfaces:**
- Consumes: `selectionState` from `./classify-bulk` (Task 2); `Checkbox` from `@workspace/ui/components/checkbox`.
- Produces: selection state (`selected: Set<string>`, `sel = selectionState(...)`, `actionableKeys: string[]`) and the toolbar button wired to `setBulkOpen(true)` (a `bulkOpen` boolean state Task 5 consumes; until Task 5 the button only flips the state).

- [ ] **Step 1: Write the failing component tests**

Append to `classify-title-table.test.tsx` (inside the existing render-test describe, reusing `renderTable`, `HIGH_GROUP`, `NO_TITLE_GROUP`, and `m`):

```ts
  it("renders a checkbox per row, disabled when the group is not actionable", () => {
    renderTable([HIGH_GROUP, NO_TITLE_GROUP])
    // Header select-all + one per row.
    const boxes = screen.getAllByRole("checkbox")
    expect(boxes).toHaveLength(3)
    const rowBox = screen.getByRole("checkbox", {
      name: m.bulk.selectRow.replace("{title}", "Senior Engineer"),
    })
    expect(rowBox).not.toBeDisabled()
    const unmatchedBox = screen.getByRole("checkbox", {
      name: m.bulk.selectRow.replace("{title}", m.noTitle),
    })
    expect(unmatchedBox).toBeDisabled()
  })

  it("select-all selects only actionable groups and enables the CTA with counts", async () => {
    renderTable([HIGH_GROUP, NO_TITLE_GROUP])
    const cta = screen.getByRole("button", { name: m.bulk.cta })
    expect(cta).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: m.bulk.cta })).toBeEnabled()
    })
    // 1 actionable title, 2 people (the unmatched group is not selectable).
    expect(
      screen.getByText(
        m.bulk.selectedCount
          .replace("{titles, plural, one {# title} other {# titles}}", "1 title")
          .replace(
            "{people, plural, one {# person} other {# people}}",
            "2 people"
          )
      )
    ).toBeInTheDocument()
  })
```

Note on the ICU assertion: if string-replacing the ICU source is brittle, assert via a regex on the rendered text instead:

```ts
    expect(screen.getByText(/1 title .* 2 people/)).toBeInTheDocument()
```

Use the regex form if the first form does not match next-intl's output exactly.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/dashboard && bunx vitest run components/people/classify/classify-title-table.test.tsx -t "checkbox"`
Expected: FAIL (no checkboxes rendered yet; `m.bulk` undefined).

- [ ] **Step 3: Add the i18n keys**

In `packages/i18n/messages/en.json`, inside `dashboard.classify`, add a `bulk` object (keep JSON valid; place after the existing `state` object):

```json
"bulk": {
  "selectAll": "Select all classifiable titles",
  "selectRow": "Select {title}",
  "selectedCount": "{titles, plural, one {# title} other {# titles}} selected, {people, plural, one {# person} other {# people}}",
  "cta": "Classify selected"
}
```

Mirror the SAME keys to `sv.json`, `nb.json`, `da.json`, `fi.json`:

- sv: `"selectAll": "Markera alla klassificerbara titlar"`, `"selectRow": "Markera {title}"`, `"selectedCount": "{titles, plural, one {# titel} other {# titlar}} markerade, {people, plural, one {# person} other {# personer}}"`, `"cta": "Klassificera valda"`
- nb: `"selectAll": "Velg alle klassifiserbare titler"`, `"selectRow": "Velg {title}"`, `"selectedCount": "{titles, plural, one {# tittel} other {# titler}} valgt, {people, plural, one {# person} other {# personer}}"`, `"cta": "Klassifiser valgte"`
- da: `"selectAll": "Vælg alle klassificerbare titler"`, `"selectRow": "Vælg {title}"`, `"selectedCount": "{titles, plural, one {# titel} other {# titler}} valgt, {people, plural, one {# person} other {# personer}}"`, `"cta": "Klassificer valgte"`
- fi: `"selectAll": "Valitse kaikki luokiteltavat nimikkeet"`, `"selectRow": "Valitse {title}"`, `"selectedCount": "{titles, plural, one {# nimike} other {# nimikettä}} valittu, {people, plural, one {# henkilö} other {# henkilöä}}"`, `"cta": "Luokittele valitut"`

- [ ] **Step 4: Add the checkbox column and toolbar**

In `classify-title-table.tsx`:

a) Imports:

```ts
import { Checkbox } from "@workspace/ui/components/checkbox"
import { selectionState } from "./classify-bulk"
```

b) `ClassifyTableHeader` gains an optional select-all slot. Add a `selectAll` prop and a leading `w-10` head cell. The skeleton path (no props) renders a disabled checkbox as static chrome:

```tsx
export function ClassifyTableHeader({
  sort,
  onSort,
  selectAll,
}: {
  sort?: ClassifySort
  onSort?: (key: ClassifySortKey) => void
  // Header select-all state; the loading skeleton omits it (disabled box).
  selectAll?: {
    checked: boolean
    indeterminate: boolean
    onChange: (checked: boolean) => void
  }
}) {
  const t = useTranslations("dashboard.classify")
  // ... existing `head` helper unchanged ...
  return (
    <TableHeader>
      <TableRow>
        {/* Fixed-width selection slot, before the expand chevron slot. */}
        <TableHead className="w-10">
          {selectAll !== undefined ? (
            <Checkbox
              aria-label={t("bulk.selectAll")}
              checked={selectAll.checked}
              indeterminate={selectAll.indeterminate}
              onCheckedChange={(checked) =>
                selectAll.onChange(checked === true)
              }
            />
          ) : (
            <Checkbox aria-label={t("bulk.selectAll")} disabled />
          )}
        </TableHead>
        <TableHead className="w-8" />
        {/* ... the four existing heads unchanged ... */}
      </TableRow>
    </TableHeader>
  )
}
```

c) `CLASSIFY_SKELETON_COLUMNS` gains a first entry so skeleton and data rows keep the same silhouette (per-row chrome renders as its real control):

```tsx
export const CLASSIFY_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  {
    content: (
      <span className="flex items-center">
        <Checkbox disabled aria-hidden="true" tabIndex={-1} />
      </span>
    ),
  },
  // ... the five existing entries unchanged ...
]
```

(`CLASSIFY_COLUMN_COUNT` derives from the array length, so the expansion row's colSpan follows automatically.)

d) Component state and derivations, next to the existing `selectedRole` state:

```ts
  // Bulk selection: raw picks by row key; the EFFECTIVE selection is derived
  // against what is currently actionable, so rows confirmed meanwhile drop
  // out on their own.
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
```

After `sortedGroups` is computed:

```ts
  const actionableKeys = sortedGroups
    .filter((group) => resolveGroup(group).actionable)
    .map(rowKey)
  const sel = selectionState(selected, actionableKeys)
  const selectedGroups = sortedGroups.filter((group) =>
    sel.effective.has(rowKey(group))
  )
  const selectedPeopleCount = selectedGroups.reduce(
    (sum, group) => sum + group.people.length,
    0
  )

  function toggleSelected(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
  }
```

e) In the row render, add the leading cell BEFORE the chevron cell (inside the existing `TableRow`). The Base UI checkbox renders a `button`, which the row's existing `closest("button,a")` click guard already exempts from toggling the expansion:

```tsx
                <TableCell className="w-10">
                  <div className="flex items-center">
                    <Checkbox
                      aria-label={t("bulk.selectRow", {
                        title: group.title ?? t("noTitle"),
                      })}
                      disabled={!actionable}
                      checked={sel.effective.has(key)}
                      onCheckedChange={(checked) =>
                        toggleSelected(key, checked === true)
                      }
                    />
                  </div>
                </TableCell>
```

f) The toolbar, always rendered, above the `<Table>` in the component's return (wrap table + toolbar in a fragment or the existing container):

```tsx
      {/* Bulk toolbar: stable slot (no layout shift); the CTA arms only when
          something is selected. */}
      <div className="flex min-h-8 items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {sel.effective.size > 0
            ? t("bulk.selectedCount", {
                titles: sel.effective.size,
                people: selectedPeopleCount,
              })
            : null}
        </p>
        <Button
          type="button"
          size="sm"
          disabled={sel.effective.size === 0}
          onClick={() => setBulkOpen(true)}
        >
          {t("bulk.cta")}
        </Button>
      </div>
```

g) Wire the header in the live table: `<ClassifyTableHeader sort={sort} onSort={toggleSort} selectAll={{ checked: sel.all, indeterminate: sel.some, onChange: (checked) => setSelected(checked ? new Set(actionableKeys) : new Set()) }} />`

h) `classify/page.tsx` renders `<ClassifyTableHeader />` for the skeleton; no change needed there (the prop is optional).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/dashboard && bunx vitest run components/people/classify/classify-title-table.test.tsx`
Expected: PASS, including all pre-existing tests (the new leading column must not break the auto-expand or confirm tests).

- [ ] **Step 6: Lint and commit**

```bash
bunx biome check --write apps/dashboard/components/people/classify/classify-title-table.tsx apps/dashboard/components/people/classify/classify-title-table.test.tsx
git add apps/dashboard/components/people/classify/classify-title-table.tsx apps/dashboard/components/people/classify/classify-title-table.test.tsx packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "feat(dashboard): checkbox selection and bulk toolbar on the classify table"
```

---

### Task 5: Summary dialog with chunked bulk confirm and progress

**Files:**
- Modify: `apps/dashboard/components/people/classify/classify-title-table.tsx`
- Modify: `packages/i18n/messages/en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json` (`dashboard.classify.bulk.*` additions)
- Test: `apps/dashboard/components/people/classify/classify-title-table.test.tsx`

**Interfaces:**
- Consumes: `bulkOpen`/`setBulkOpen`, `selectedGroups`, `selectedPeopleCount`, `sel` (Task 4); `packAssignmentChunks` + `MAX_ASSIGNMENTS_PER_MUTATION` (Tasks 1-2); `buildAssignments` (existing); `AlertDialog*` and `Spinner` from `@workspace/ui`.
- Produces: the complete feature; nothing downstream.

- [ ] **Step 1: Write the failing component tests**

Append to the render-test describe:

```ts
  it("bulk confirm goes through the summary dialog and merges groups into one chunked call", async () => {
    const SECOND_GROUP: ClassifyTitleGroup = {
      title: "Engineering Manager",
      personCount: 1,
      suggestedRoleId: "role2",
      people: [
        {
          personId: "p9",
          displayName: "Eva Holm",
          externalRef: null,
          employmentStartDate: null,
          isManager: true,
          suggestedLevel: "M1",
          currentAssignment: null,
        },
      ],
    }
    renderTable([HIGH_GROUP, SECOND_GROUP])
    fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
    fireEvent.click(screen.getByRole("button", { name: m.bulk.cta }))
    // The dialog gates the write: nothing has been submitted yet.
    expect(assignMock).not.toHaveBeenCalled()
    expect(
      screen.getByRole("alertdialog", { name: m.bulk.dialogTitle })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    // Three people across two groups fit one chunk: exactly one mutation
    // call whose payload carries all of them, confirmed.
    expect(assignMock).toHaveBeenCalledTimes(1)
    const call = assignMock.mock.calls[0][0]
    expect(call.levelSource).toBe("confirmed")
    expect(call.assignments.map((a: { personId: string }) => a.personId).sort()).toEqual(
      ["p1", "p2", "p9"]
    )
  })

  it("keeps the dialog open and shows an error toast when a chunk fails", async () => {
    assignMock.mockRejectedValueOnce(new Error("boom"))
    renderTable([HIGH_GROUP])
    fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
    fireEvent.click(screen.getByRole("button", { name: m.bulk.cta }))
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(
      screen.getByRole("alertdialog", { name: m.bulk.dialogTitle })
    ).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/dashboard && bunx vitest run components/people/classify/classify-title-table.test.tsx -t "bulk confirm"`
Expected: FAIL (no dialog exists; `m.bulk.dialogTitle` undefined).

- [ ] **Step 3: Add the i18n keys**

Extend the `bulk` object in all five locale files (same keys everywhere):

- en: `"dialogTitle": "Classify selected?"`, `"dialogDescription": "{titles, plural, one {# title} other {# titles}} and {people, plural, one {# person} other {# people}} will be classified with their suggested roles and levels. You can change any classification afterwards."`, `"confirm": "Classify"`, `"progress": "{done} / {total}"`
- sv: `"dialogTitle": "Klassificera valda?"`, `"dialogDescription": "{titles, plural, one {# titel} other {# titlar}} och {people, plural, one {# person} other {# personer}} klassificeras med sina föreslagna roller och nivåer. Du kan ändra varje klassificering efteråt."`, `"confirm": "Klassificera"`, `"progress": "{done} / {total}"`
- nb: `"dialogTitle": "Klassifiser valgte?"`, `"dialogDescription": "{titles, plural, one {# tittel} other {# titler}} og {people, plural, one {# person} other {# personer}} klassifiseres med sine foreslåtte roller og nivåer. Du kan endre hver klassifisering etterpå."`, `"confirm": "Klassifiser"`, `"progress": "{done} / {total}"`
- da: `"dialogTitle": "Klassificer valgte?"`, `"dialogDescription": "{titles, plural, one {# titel} other {# titler}} og {people, plural, one {# person} other {# personer}} klassificeres med deres foreslåede roller og niveauer. Du kan ændre hver klassificering bagefter."`, `"confirm": "Klassificer"`, `"progress": "{done} / {total}"`
- fi: `"dialogTitle": "Luokitellaanko valitut?"`, `"dialogDescription": "{titles, plural, one {# nimike} other {# nimikettä}} ja {people, plural, one {# henkilö} other {# henkilöä}} luokitellaan ehdotetuilla rooleilla ja tasoilla. Voit muuttaa jokaista luokittelua jälkikäteen."`, `"confirm": "Luokittele"`, `"progress": "{done} / {total}"`

- [ ] **Step 4: Implement the dialog and the chunked confirm**

In `classify-title-table.tsx`:

a) Imports:

```ts
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
import { Spinner } from "@workspace/ui/components/spinner"
```

b) Progress state next to `bulkOpen`:

```ts
  // Chunk progress while the bulk confirm runs, or null when idle. done and
  // total count PEOPLE, matching the dialog description's unit.
  const [bulkProgress, setBulkProgress] = useState<{
    done: number
    total: number
  } | null>(null)
```

c) The handler (place next to `onConfirm`):

```ts
  // Confirms every selected group, one bounded chunk at a time. On a failed
  // chunk the dialog stays open; the chunks that landed have already flipped
  // their groups to confirmed, the derived selection has pruned them, and
  // pressing confirm again finishes the remainder.
  async function onBulkConfirm() {
    if (bulkProgress !== null) return
    const groupAssignments = selectedGroups.map((group) =>
      buildAssignments(group)
    )
    const chunks = packAssignmentChunks(
      groupAssignments,
      MAX_ASSIGNMENTS_PER_MUTATION
    )
    const total = groupAssignments.reduce((sum, a) => sum + a.length, 0)
    setBulkProgress({ done: 0, total })
    try {
      let done = 0
      for (const chunk of chunks) {
        await assignPeople({
          orgId,
          assignments: chunk as Parameters<
            typeof assignPeople
          >[0]["assignments"],
          levelSource: "confirmed",
        })
        done += chunk.length
        setBulkProgress({ done, total })
      }
      toast.success(tToast("classificationConfirmed"))
      setSelected(new Set())
      setBulkOpen(false)
    } catch {
      toast.error(tToast("error"))
    } finally {
      setBulkProgress(null)
    }
  }
```

d) The dialog, rendered after the `<Table>` (sibling, standard anatomy; cancel first as outline, primary last):

```tsx
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bulk.dialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bulk.dialogDescription", {
                titles: sel.effective.size,
                people: selectedPeopleCount,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkProgress !== null}>
              {t("bulk.cancel", { default: undefined }) ?? tCommonCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkProgress !== null}
              onClick={(event) => {
                // Keep the dialog open across chunks; close explicitly on
                // success inside onBulkConfirm.
                event.preventDefault()
                void onBulkConfirm()
              }}
            >
              {bulkProgress !== null ? (
                <>
                  <Spinner />
                  {t("bulk.progress", {
                    done: bulkProgress.done,
                    total: bulkProgress.total,
                  })}
                </>
              ) : (
                t("bulk.confirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

Cancel label: check how `confirm-delete-dialog.tsx` labels its cancel button and use the same existing key (do NOT invent `bulk.cancel`; the snippet above must be replaced with that shared key, e.g. the app's existing cancel copy). If the shared cancel key lives under `dashboard.common.cancel` or similar, use it; the implementer verifies the exact key in `confirm-delete-dialog.tsx` and uses that.

e) `AlertDialogAction` default behavior closes the dialog on click; the `event.preventDefault()` above keeps it open so progress renders and the failure path can leave it open. Verify against `packages/ui/src/components/alert-dialog.tsx`: if `AlertDialogAction` does not auto-close in this vendored version, drop the `preventDefault`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/dashboard && bunx vitest run components/people/classify/classify-title-table.test.tsx`
Expected: PASS (all tests, old and new).

- [ ] **Step 6: Lint and commit**

```bash
bunx biome check --write apps/dashboard/components/people/classify/classify-title-table.tsx apps/dashboard/components/people/classify/classify-title-table.test.tsx
git add apps/dashboard/components/people/classify/classify-title-table.tsx apps/dashboard/components/people/classify/classify-title-table.test.tsx packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "feat(dashboard): bulk classify selected titles behind a summary dialog"
```

---

### Task 6: Full verification and dev pass

**Files:**
- No new files; runs verification and the dev deployment.

**Interfaces:**
- Consumes: everything above.
- Produces: a verified, deployed feature.

- [ ] **Step 1: Full suite and typecheck**

Run from the repo root:

```bash
bun run test
bunx turbo run typecheck
```

Expected: all packages pass (the i18n parity test proves the five locales carry identical `bulk.*` key sets).

- [ ] **Step 2: Deploy backend to dev**

```bash
cd packages/backend && bunx convex dev --once
```

Expected: "Convex functions ready".

- [ ] **Step 3: Browser pass**

With the dev server on http://localhost:3001: open `/people/classify`, verify the checkbox column renders, unmatched titles are disabled, select-all arms the CTA with correct counts, the dialog states the scope, confirm classifies everything selected (states flip to Confirmed reactively), and a success toast shows. Verify the loading skeleton shows the checkbox column.

- [ ] **Step 4: Report**

Leave nothing uncommitted; summarize per repo convention (file-by-file, grouped by area). Do not push without explicit approval.

---

## Self-Review

- **Spec coverage:** selection rules (Task 4d-e), tri-state header (4b/4g), always-rendered toolbar (4f), summary dialog (5d), chunked writes with shared constant (1, 2, 3, 5c), shared chunk path for per-group confirm (3), server bound (1), progress + failure retry semantics (5c), skeleton column (4c), i18n across five locales (4/5 step 3), tests for helpers/dialog gating/oversized rejection (1/2/4/5). Out-of-scope items untouched.
- **Placeholder scan:** the two deliberate verify-against-code notes (cancel-label key, AlertDialogAction auto-close) name the exact file to check and the fallback behavior; all other steps carry full code.
- **Type consistency:** `BulkAssignment`, `selectionState`, `packAssignmentChunks`, `MAX_ASSIGNMENTS_PER_MUTATION`, `selectedGroups`, `selectedPeopleCount`, `sel`, `bulkOpen`, `bulkProgress`, `onBulkConfirm` are used with the same names and shapes across Tasks 2-5.

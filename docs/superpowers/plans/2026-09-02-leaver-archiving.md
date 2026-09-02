# Leaver Archiving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing person archive reachable (import review, register bulk action, person page), reactivate returning people on import, and archive leavers missing from a payroll file when HR asks for it.

**Architecture:** No schema change: `people.archivedAt` already exists and is read by every consumer. The backend gains `unarchivePerson`, a bounded `archivePeople` batch, a `person.unarchived` audit event, and an `archiveMissing` flag on `importPayroll` that archives the absent active set in server-driven chunks with the import's own progress row. The pure `diffImport` learns two new outcomes (`returning`, `missingFromFile`) so the review preview and the import agree. The dashboard adds the review-step rows, done-step rows, a register status filter, a bulk-archive dialog, and archive/reactivate on the person page, with strings in all five locales and the guide updated.

**Tech Stack:** Convex (packages/backend, convex-test on edge-runtime), Next.js 16 dashboard (React, TanStack table, Base UI via @workspace/ui, next-intl), Vitest 4, Biome.

**Spec:** `docs/superpowers/specs/2026-09-02-leaver-archiving-design.md`

## Global Constraints

- All code, comments, commit messages and filenames in English. No em dashes anywhere (UI copy, docs, comments, commits).
- Every user-facing string goes through i18n: add to `packages/i18n/messages/en.json` first, then mirror to `sv.json`, `nb.json`, `da.json`, `fi.json` in the same task. The i18n parity test fails on any missing key. Edit the JSON files with the Edit tool (never perl/sed: non-ASCII double-encodes).
- Help bodies (`dashboard.help.*Body`) are at most two sentences, max 200 characters in en and 240 in the other locales (`packages/i18n/src/messages.test.ts` enforces it).
- Tests run with `bun run test` (Vitest 4). Never `bun test`. Backend tests: `cd packages/backend && bun run test`. Dashboard tests: `cd apps/dashboard && bun run test`. i18n tests: `cd packages/i18n && bun run test`.
- Biome ends every task at zero errors, warnings and infos: `bunx biome check <files>` from the repo root; fix, never ignore.
- Every state-changing mutation writes an audit row through `logAudit` / `ctx.audit.log` with an `AUDIT_EVENTS` key; a new event ships its `AuditPayloads` entry, its `AUDIT_SUBJECTS` deriver and its `dashboard.auditLog.events.*` label in all five locales; a new payload field ships its `dashboard.auditLog.fields.*` label in all five locales.
- Org-scaled writes run in bounded chunks: the archive bound is `PEOPLE_ARCHIVE_CHUNK_SIZE = 50` (Task 1), shared by the batch mutation, the import, and the register's client loop.
- Reversible actions get a plain confirm dialog (no type-to-confirm). Editor and admin may archive and reactivate; erasure stays admin-only.
- `archivedAt` is never an import field. A leaver keeps their open role assignment (archiving does not end it).
- A `HelpMorphButton` sits only after a title (an AlertDialogTitle, an AlertTitle, a CardTitle).
- Commit rule (owner instruction, overrides the per-task commit habit): stage each task's files and present the diff; commit only after the owner approves, with the conventional message given in the task. No AI attribution in commits.
- After the last task: `cd apps/dashboard && bun run docs:sync`, a push to the running dev deployment (`cd packages/backend && bunx convex dev --once`) and a browser pass on localhost:3001 before reporting done.

---

## File map

**Backend (`packages/backend/convex/`)**
- Modify `people/people.ts`: `unarchivePerson`, `archivePeople`, `archivePeopleCore`, reactivation in `upsertPersonByExternalRefCore`.
- Modify `people/people.test.ts`: tests for the above.
- Modify `people/importDiff.ts`: `BaselinePerson.archivedAt`, `people.returning`, `returningPeople`, `missingFromFile`.
- Modify `people/importDiff.test.ts`.
- Modify `people/importHelpers.ts`: baseline includes archived, `getActiveExternalRefs`, `archiveChunk`, `importChunk.peopleReactivated`, `logImportCompleted` stats.
- Modify `people/import.ts`: `archiveMissing`, result fields, preview validator fields, archive loop, progress total.
- Modify `people/import.test.ts`.
- Modify `lib/audit.ts`: `personUnarchived` event + subject deriver + flatness assertion.
- Modify `lib/auditPayloads.ts`: `person.unarchived`, `people.imported` stats.

**Shared constants (`packages/constants/src/`)**
- Create `people.ts`: `PEOPLE_ARCHIVE_CHUNK_SIZE`.
- Modify `index.ts`: export it.

**Dashboard (`apps/dashboard/`)**
- Modify `lib/audit-detail.tsx`: `FIELD_DISPLAY_ORDER` gains the two stats.
- Modify `lib/audit-labels.test.ts`: `OTHER_AUDIT_FIELDS` gains the two stats.
- Modify `components/people/import/review-step.tsx` + test: two rows, lists, checkbox, `archiveMissing`.
- Modify `components/people/import/import-wizard.tsx`: `ImportResultCounts` gains `reactivated`, `archived`.
- Modify `components/people/import/import-done-step.tsx` + test.
- Modify `components/people/people-section.tsx` + test: status filter, badge, bulk archive button.
- Create `components/people/bulk-archive-people-dialog.tsx` (tested through people-section.test.tsx).
- Create `components/people/archive-person-dialog.tsx`.
- Modify `components/people/person-actions-menu.tsx` + test.
- Modify `components/people/person-detail.tsx`: badge + help, `archivedAt` prop to the menu.

**i18n (`packages/i18n/messages/{en,sv,nb,da,fi}.json`)**: keys listed per task.

**Docs (`apps/dashboard/content/docs/{en,sv,nb,da,fi}/`)**: `people-register`, `importing-people`, `person-details-and-salary`, `erasing-a-person`, `gdpr-and-erasure`, `glossary`.

---

### Task 1: Backend: `unarchivePerson`, `archivePeople`, the `person.unarchived` event

**Files:**
- Create: `packages/constants/src/people.ts`
- Modify: `packages/constants/src/index.ts`
- Modify: `packages/backend/convex/lib/audit.ts` (AUDIT_EVENTS ~line 49-52, AUDIT_SUBJECTS ~line 218-221, flatness assertion ~line 1033-1037)
- Modify: `packages/backend/convex/lib/auditPayloads.ts` (~line 354)
- Modify: `packages/backend/convex/people/people.ts` (after `archivePerson`, ~line 489-510)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.auditLog.events`)
- Test: `packages/backend/convex/people/people.test.ts`

**Interfaces:**
- Produces `PEOPLE_ARCHIVE_CHUNK_SIZE` (`@workspace/constants`, value 50).
- Produces `AUDIT_EVENTS.personUnarchived = "person.unarchived"` with payload `{ personId: string; changes: Changes }`.
- Produces `api.people.people.unarchivePerson({ orgId, personId })` returning `null`.
- Produces `api.people.people.archivePeople({ orgId, personIds })` returning `{ archived: number }`; throws `errors.invalidInput` above the chunk size, `errors.notFound` for a foreign id.
- Produces `archivePeopleCore(ctx, { orgId, actorId, personIds, gestureId? })` in `people/people.ts`, used by Task 4's `archiveChunk`.

- [ ] **Step 1: Add the shared chunk bound**

Create `packages/constants/src/people.ts`:

```ts
// Upper bound on the people one archive write may touch: the register's
// bulk action and the payroll import both archive leavers in chunks of this
// size (one transaction per chunk), so a large org's leavers never ride one
// unbounded mutation. Shared here so the client loop and the backend bound
// can never drift apart.
export const PEOPLE_ARCHIVE_CHUNK_SIZE = 50
```

In `packages/constants/src/index.ts`, after the `MAX_ASSIGNMENTS_PER_MUTATION` export line add:

```ts
export { PEOPLE_ARCHIVE_CHUNK_SIZE } from "./people"
```

- [ ] **Step 2: Register the audit event**

In `packages/backend/convex/lib/audit.ts`, in `AUDIT_EVENTS` after `personArchived: "person.archived",` add:

```ts
  personUnarchived: "person.unarchived",
```

In `AUDIT_SUBJECTS` after the `"person.archived"` deriver add:

```ts
  "person.unarchived": (payload) => ({ kind: "person", id: payload.personId }),
```

In the flatness assertion, extend the tuple:

```ts
const _assertPersonPayloadsAreFlat: [
  FlatPersonPayload<AuditPayloads["person.created"]>,
  FlatPersonPayload<AuditPayloads["person.updated"]>,
  FlatPersonPayload<AuditPayloads["person.archived"]>,
  FlatPersonPayload<AuditPayloads["person.unarchived"]>,
  FlatPersonPayload<AuditPayloads["person.erased"]>,
] = [true, true, true, true, true]
```

In `packages/backend/convex/lib/auditPayloads.ts`, after the `"person.archived"` line add:

```ts
  "person.unarchived": { personId: string; changes: Changes }
```

Add the label in all five message files under `dashboard.auditLog.events`, after `"personArchived"`:

| locale | value |
|---|---|
| en | `"personUnarchived": "Person reactivated"` |
| sv | `"personUnarchived": "Person återaktiverad"` |
| nb | `"personUnarchived": "Person reaktivert"` |
| da | `"personUnarchived": "Person genaktiveret"` |
| fi | `"personUnarchived": "Henkilö palautettu aktiiviseksi"` |

- [ ] **Step 3: Write the failing tests**

Append to `packages/backend/convex/people/people.test.ts` (it already has `seedOrg`, `addEditorMember`, `api`, `initConvexTest`):

```ts
import { PEOPLE_ARCHIVE_CHUNK_SIZE } from "@workspace/constants"

describe("unarchivePerson", () => {
  it("clears archivedAt and writes a person.unarchived audit row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Karlsson", gender: "Man" }
    )
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId,
    })

    await asAdmin.mutation(api.people.people.unarchivePerson, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.archivedAt).toBeUndefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.unarchived")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as {
        personId: string
        changes: { archivedAt: { from: number | null; to: number | null } }
      }
      expect(payload.personId).toBe(personId)
      expect(typeof payload.changes.archivedAt.from).toBe("number")
      expect(payload.changes.archivedAt.to).toBeNull()
    })
  })

  it("is a no-op on an active person (no audit row)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Karlsson", gender: "Man" }
    )

    await asAdmin.mutation(api.people.people.unarchivePerson, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.unarchived")
        )
        .collect()
      expect(rows).toHaveLength(0)
    })
  })

  it("is performed by an editor", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { asEditor } = await addEditorMember(t, orgId, "editor@acme.se")
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Karlsson", gender: "Man" }
    )
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId,
    })

    await asEditor.mutation(api.people.people.unarchivePerson, {
      orgId,
      personId,
    })

    const list = await asAdmin.query(api.people.people.listPeople, { orgId })
    expect(list.map((p) => p.displayName)).toEqual(["Bo Karlsson"])
  })
})

describe("archivePeople", () => {
  async function createMany(
    asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
    orgId: string,
    count: number
  ) {
    const ids = []
    for (let i = 0; i < count; i++) {
      const { personId } = await asAdmin.mutation(
        api.people.people.createPerson,
        { orgId, displayName: `Person ${i}`, gender: "Man" }
      )
      ids.push(personId)
    }
    return ids
  }

  it("archives every active id, skips already-archived ones, one audit row each", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const ids = await createMany(asAdmin, orgId, 3)
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId: ids[0] as (typeof ids)[number],
    })

    const result = await asAdmin.mutation(api.people.people.archivePeople, {
      orgId,
      personIds: ids,
    })
    expect(result).toEqual({ archived: 2 })

    await t.run(async (ctx) => {
      for (const id of ids) {
        const person = await ctx.db.get(id)
        expect(typeof person?.archivedAt).toBe("number")
      }
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.archived")
        )
        .collect()
      // One from the single archive above, two from the batch.
      expect(rows).toHaveLength(3)
    })
  })

  it("rejects more ids than the chunk bound", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const ids = await createMany(asAdmin, orgId, PEOPLE_ARCHIVE_CHUNK_SIZE + 1)

    await expect(
      asAdmin.mutation(api.people.people.archivePeople, {
        orgId,
        personIds: ids,
      })
    ).rejects.toThrow()

    await t.run(async (ctx) => {
      const person = await ctx.db.get(ids[0] as (typeof ids)[number])
      expect(person?.archivedAt).toBeUndefined()
    })
  })

  it("throws notFound for a cross-org id and archives nothing", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")
    const [ownId] = await createMany(asAdminA, orgA, 1)
    const [foreignId] = await createMany(asAdminB, orgB, 1)

    await expect(
      asAdminA.mutation(api.people.people.archivePeople, {
        orgId: orgA,
        personIds: [
          foreignId as NonNullable<typeof foreignId>,
          ownId as NonNullable<typeof ownId>,
        ],
      })
    ).rejects.toThrow()

    await t.run(async (ctx) => {
      const own = await ctx.db.get(ownId as NonNullable<typeof ownId>)
      expect(own?.archivedAt).toBeUndefined()
    })
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd packages/backend && bun run test -- people/people.test.ts`
Expected: FAIL (the new functions do not exist; `api.people.people.unarchivePerson` is undefined).

- [ ] **Step 5: Implement the mutations and the core**

In `packages/backend/convex/people/people.ts`, add `PEOPLE_ARCHIVE_CHUNK_SIZE` to the imports:

```ts
import { PEOPLE_ARCHIVE_CHUNK_SIZE } from "@workspace/constants"
```

Directly after the `archivePerson` mutation add:

```ts
export const unarchivePerson = orgMutation({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, { personId }) => {
    const person = await requireOwnPerson(ctx, personId)
    // Already active: no-op.
    if (person.archivedAt === undefined) return null

    const from = person.archivedAt
    // Patching a field to undefined removes it, which is the "active" state
    // every consumer filters on (archivedAt === undefined).
    await ctx.db.patch(personId, { archivedAt: undefined })

    await ctx.audit.log({
      type: AUDIT_EVENTS.personUnarchived,
      payload: {
        personId,
        changes: { archivedAt: { from, to: null } },
      },
    })

    return null
  },
})

// Archives up to PEOPLE_ARCHIVE_CHUNK_SIZE people of the caller's org in ONE
// transaction. Shared by the register's batch mutation below and the payroll
// import's leaver chunk (importHelpers.archiveChunk), so both write the same
// per-person person.archived rows. Already-archived ids are skipped silently
// (a re-run finishes idempotently); an unknown or cross-org id fails the whole
// chunk closed, like requireOwnPerson does for a single person.
export async function archivePeopleCore(
  ctx: MutationCtx,
  args: {
    orgId: string
    actorId: string
    personIds: Id<"people">[]
    gestureId?: string
  }
): Promise<{ archived: number }> {
  if (args.personIds.length > PEOPLE_ARCHIVE_CHUNK_SIZE) {
    throw appError(ERROR_CODES.invalidInput)
  }
  const archivedAt = Date.now()
  let archived = 0
  for (const personId of args.personIds) {
    const person = await ctx.db.get(personId)
    if (person === null || person.orgId !== args.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    if (person.archivedAt !== undefined) continue
    await ctx.db.patch(personId, { archivedAt })
    await logAudit(ctx, {
      orgId: args.orgId,
      type: AUDIT_EVENTS.personArchived,
      actorId: args.actorId,
      payload: {
        personId,
        changes: { archivedAt: { from: null, to: archivedAt } },
      },
      ...(args.gestureId !== undefined ? { gestureId: args.gestureId } : {}),
    })
    archived += 1
  }
  return { archived }
}

export const archivePeople = orgMutation({
  args: { personIds: v.array(v.id("people")) },
  returns: v.object({ archived: v.number() }),
  handler: (ctx, { personIds }) =>
    archivePeopleCore(ctx, {
      orgId: ctx.orgId,
      actorId: ctx.authUserId,
      personIds,
      ...(ctx.gestureId !== undefined ? { gestureId: ctx.gestureId } : {}),
    }),
})
```

`orgMutation` (`lib/functions.ts`) builds its ctx as `{ ...org, audit, ...(gestureId !== undefined ? { gestureId } : {}) }`, so `ctx.authUserId` is a string and `ctx.gestureId` is an optional string; the spreads above typecheck as written.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd packages/backend && bun run test -- people/people.test.ts`
Expected: PASS, including the pre-existing `archivePerson` tests.

Run: `cd apps/dashboard && bun run test -- lib/audit-labels.test.ts`
Expected: PASS ("every org audit event has a readable label" now covers `person.unarchived`).

Run: `cd packages/i18n && bun run test`
Expected: PASS (parity across the five files).

- [ ] **Step 7: Biome and stage**

Run: `bunx biome check packages/constants/src packages/backend/convex/lib/audit.ts packages/backend/convex/lib/auditPayloads.ts packages/backend/convex/people/people.ts packages/backend/convex/people/people.test.ts`
Expected: no diagnostics.

Stage: `git add packages/constants/src/people.ts packages/constants/src/index.ts packages/backend/convex/lib/audit.ts packages/backend/convex/lib/auditPayloads.ts packages/backend/convex/people/people.ts packages/backend/convex/people/people.test.ts packages/i18n/messages/`
Commit message once approved: `feat(people): unarchive a person and archive people in bounded batches`

---

### Task 2: Import diff: returning and missing-from-file outcomes

**Files:**
- Modify: `packages/backend/convex/people/importDiff.ts` (`BaselinePerson` ~line 112, `ImportPreviewDiff` ~line 125, `diffImport` ~line 163)
- Modify: `packages/backend/convex/people/importHelpers.ts` (`getImportBaseline` ~line 31-120)
- Modify: `packages/backend/convex/people/import.ts` (`previewImport` baseline mapping ~line 725-733, `importDiffValidator` ~line 676-695)
- Test: `packages/backend/convex/people/importDiff.test.ts`

**Interfaces:**
- Consumes nothing from Task 1.
- Produces `BaselinePerson.archivedAt?: number`; `ImportPreviewDiff.people.returning: number`; `ImportPreviewDiff.returningPeople: Array<{ externalRef: string; displayName: string }>`; `ImportPreviewDiff.missingFromFile: Array<{ externalRef: string; displayName: string }>`. Task 5 renders them; Task 4 relies on the baseline including archived people.

- [ ] **Step 1: Write the failing tests**

Append to `packages/backend/convex/people/importDiff.test.ts`:

```ts
describe("diffImport leavers and returners", () => {
  const row = (externalRef: string, displayName: string): NormalizedImportRow => ({
    externalRef,
    person: { displayName, gender: "Kvinna" },
    salary: null,
  })
  const active = (displayName: string): BaselinePerson => ({
    stored: { displayName, gender: "Kvinna" },
    latestSalary: null,
  })
  const archived = (displayName: string): BaselinePerson => ({
    stored: { displayName, gender: "Kvinna" },
    latestSalary: null,
    archivedAt: 1_700_000_000_000,
  })

  it("counts and lists an archived baseline person present in the file as returning", () => {
    const diff = diffImport(
      [row("1", "Anna Svensson")],
      new Map([["1", archived("Anna Svensson")]])
    )
    expect(diff.people).toEqual({
      created: 0,
      updated: 0,
      unchanged: 1,
      returning: 1,
    })
    expect(diff.returningPeople).toEqual([
      { externalRef: "1", displayName: "Anna Svensson" },
    ])
    expect(diff.missingFromFile).toEqual([])
  })

  it("a returning person with changed fields is both returning and updated", () => {
    const diff = diffImport(
      [row("1", "Anna Berg")],
      new Map([["1", archived("Anna Svensson")]])
    )
    expect(diff.people).toEqual({
      created: 0,
      updated: 1,
      unchanged: 0,
      returning: 1,
    })
  })

  it("lists active baseline people absent from the file, in baseline order", () => {
    const diff = diffImport(
      [row("2", "Bo Karlsson")],
      new Map([
        ["1", active("Anna Svensson")],
        ["2", active("Bo Karlsson")],
        ["3", active("Cesar Lind")],
      ])
    )
    expect(diff.people).toEqual({
      created: 0,
      updated: 0,
      unchanged: 1,
      returning: 0,
    })
    expect(diff.missingFromFile).toEqual([
      { externalRef: "1", displayName: "Anna Svensson" },
      { externalRef: "3", displayName: "Cesar Lind" },
    ])
  })

  it("never lists an already-archived person as missing", () => {
    const diff = diffImport(
      [row("2", "Bo Karlsson")],
      new Map([
        ["1", archived("Anna Svensson")],
        ["2", active("Bo Karlsson")],
      ])
    )
    expect(diff.missingFromFile).toEqual([])
    expect(diff.people.returning).toBe(0)
  })

  it("keeps the existing counts when there are no leavers or returners", () => {
    const diff = diffImport(
      [row("1", "Anna Svensson"), row("9", "Ny Person")],
      new Map([["1", active("Anna Svensson")]])
    )
    expect(diff.people).toEqual({
      created: 1,
      updated: 0,
      unchanged: 1,
      returning: 0,
    })
    expect(diff.returningPeople).toEqual([])
    expect(diff.missingFromFile).toEqual([])
  })
})
```

Also update the existing assertion in "categorizes new person, first salary, identical, same-year change, and new year":

```ts
    expect(diff.people).toEqual({
      created: 1,
      updated: 0,
      unchanged: 4,
      returning: 0,
    })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/backend && bun run test -- people/importDiff.test.ts`
Expected: FAIL (`returning` and `missingFromFile` are undefined).

- [ ] **Step 3: Implement the diff**

In `packages/backend/convex/people/importDiff.ts`:

Replace the `BaselinePerson` interface with:

```ts
export interface BaselinePerson {
  stored: StoredPersonValues
  latestSalary: SalaryValues | null
  // Set when the stored person is archived (a leaver). A row matching them
  // returns them to the active register; they are never "missing".
  archivedAt?: number
}
```

Add after `FieldChange`:

```ts
// A person named by employee number and display name, for the review step's
// returning and missing-from-file lists.
export interface ImportPersonRef {
  externalRef: string
  displayName: string
}
```

Replace the `people` line and add the two arrays in `ImportPreviewDiff`:

```ts
export interface ImportPreviewDiff {
  people: {
    created: number
    updated: number
    unchanged: number
    // Rows whose stored person is archived: the import reactivates them.
    // Counted IN ADDITION to updated/unchanged (which describe their fields).
    returning: number
  }
  // Every person whose stored fields would change, with the per-field diff.
  updatedPeople: Array<{
    externalRef: string
    displayName: string
    changes: FieldChange[]
  }>
  // Archived people the file brings back.
  returningPeople: ImportPersonRef[]
  // Active people with an employee number that the file does not mention.
  // The import archives them only when the caller asks (archiveMissing).
  missingFromFile: ImportPersonRef[]
  // Same employee number, different name: likely a reused/typoed number.
  nameMismatches: Array<{
    externalRef: string
    storedName: string
    incomingName: string
  }>
  salary: {
    // Appended as new history entries (new person, first salary, or a new year).
    newEntries: number
    // Same pay year as the stored latest record but different values: either
    // a raise or a correction (phase 2 lets the user choose).
    changedSameYear: number
    identical: number
    changedDetails: Array<{
      externalRef: string
      displayName: string
      payYear: number
      from: number
      to: number
    }>
  }
}
```

In `diffImport`, initialise the new fields and track the incoming refs:

```ts
  const diff: ImportPreviewDiff = {
    people: { created: 0, updated: 0, unchanged: 0, returning: 0 },
    updatedPeople: [],
    returningPeople: [],
    missingFromFile: [],
    nameMismatches: [],
    salary: {
      newEntries: 0,
      changedSameYear: 0,
      identical: 0,
      changedDetails: [],
    },
  }
  const incomingRefs = new Set<string>()

  for (const row of rows) {
    incomingRefs.add(row.externalRef)
    const baseline = baselineByRef.get(row.externalRef)

    if (baseline === undefined) {
      diff.people.created += 1
      if (row.salary !== null) diff.salary.newEntries += 1
      continue
    }

    if (baseline.archivedAt !== undefined) {
      diff.people.returning += 1
      diff.returningPeople.push({
        externalRef: row.externalRef,
        displayName: row.person.displayName,
      })
    }

    const patch = personImportPatch(baseline.stored, row.person)
    // ... the existing updated/unchanged/nameMismatch/salary logic, unchanged ...
  }

  // Active people the file does not mention. Computed over the FULL row set
  // (the caller passes rows before any user-elected skip), so a row HR leaves
  // out as a name mismatch still counts as present and is never archived.
  for (const [externalRef, baseline] of baselineByRef) {
    if (baseline.archivedAt !== undefined) continue
    if (incomingRefs.has(externalRef)) continue
    diff.missingFromFile.push({
      externalRef,
      displayName: baseline.stored.displayName ?? "",
    })
  }

  return diff
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/backend && bun run test -- people/importDiff.test.ts`
Expected: PASS.

- [ ] **Step 5: Include archived people in the baseline and the wire shapes**

In `packages/backend/convex/people/importHelpers.ts`, `getImportBaseline`:
- add `archivedAt: v.optional(v.number()),` to the returned object validator (after `employmentType`),
- change the filter to `.filter((p) => p.externalRef !== undefined)` (archived people stay in),
- in the pushed object add `...(person.archivedAt !== undefined ? { archivedAt: person.archivedAt } : {}),` before `latestSalary`,
- update the comment above the query: "every person that carries an externalRef, archived ones included (the diff needs them to tell a returning person from a new one)".

In `packages/backend/convex/people/import.ts`, `previewImport`'s baseline mapping becomes:

```ts
    const baselineByRef = new Map<string, BaselinePerson>(
      baseline.map((person) => {
        const { latestSalary, externalRef, archivedAt, ...stored } = person
        return [
          externalRef,
          {
            stored,
            latestSalary,
            ...(archivedAt !== undefined ? { archivedAt } : {}),
          },
        ]
      })
    )
```

And extend the validators next to `nameMismatchValidator`:

```ts
const importPersonRefValidator = v.object({
  externalRef: v.string(),
  displayName: v.string(),
})
```

with `importDiffValidator` becoming:

```ts
const importDiffValidator = v.object({
  people: v.object({
    created: v.number(),
    updated: v.number(),
    unchanged: v.number(),
    returning: v.number(),
  }),
  updatedPeople: v.array(updatedPersonValidator),
  returningPeople: v.array(importPersonRefValidator),
  missingFromFile: v.array(importPersonRefValidator),
  nameMismatches: v.array(nameMismatchValidator),
  salary: v.object({
    newEntries: v.number(),
    changedSameYear: v.number(),
    identical: v.number(),
    changedDetails: v.array(salaryChangeDetailValidator),
  }),
})
```

- [ ] **Step 6: Typecheck and run the whole backend suite**

Run: `cd packages/backend && bunx tsc --noEmit -p tsconfig.json && bun run test`
Expected: PASS. (The existing `previewImport` tests still hold: their expectations on `people` use `toEqual({created, updated, unchanged})`; update those two assertions in `import.test.ts` to include `returning: 0`.)

- [ ] **Step 7: Biome and stage**

Run: `bunx biome check packages/backend/convex/people/importDiff.ts packages/backend/convex/people/importDiff.test.ts packages/backend/convex/people/importHelpers.ts packages/backend/convex/people/import.ts packages/backend/convex/people/import.test.ts`
Expected: no diagnostics.

Stage the five files. Commit message once approved: `feat(import): the dry-run diff names returning and missing people`

---

### Task 3: Reactivate a returning archived person on upsert

**Files:**
- Modify: `packages/backend/convex/people/people.ts` (`upsertPersonByExternalRefCore` update path ~line 196-244; `upsertPersonByExternalRef` returns validator ~line 276-283)
- Modify: `packages/backend/convex/people/importHelpers.ts` (`importChunk` ~line 217-283)
- Test: `packages/backend/convex/people/people.test.ts`

**Interfaces:**
- Consumes `AUDIT_EVENTS.personUnarchived` (Task 1).
- Produces `upsertPersonByExternalRefCore` return `{ personId, outcome, reactivated: boolean }`; `importChunk` return gains `peopleReactivated: number` (Task 4 sums it).

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe("upsertPersonByExternalRef", ...)` block in `people.test.ts`:

```ts
  it("reactivates an archived person with the same employee number and audits it", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    const first = await asAdmin.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "E-7",
        displayName: "Anna Svensson",
        gender: "Kvinna",
      }
    )
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId: first.personId,
    })

    const again = await asAdmin.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "E-7",
        displayName: "Anna Svensson",
        gender: "Kvinna",
      }
    )
    expect(again.personId).toBe(first.personId)
    expect(again.outcome).toBe("unchanged")
    expect(again.reactivated).toBe(true)

    await t.run(async (ctx) => {
      const person = await ctx.db.get(first.personId)
      expect(person?.archivedAt).toBeUndefined()
      const unarchived = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.unarchived")
        )
        .collect()
      expect(unarchived).toHaveLength(1)
      // No field changed, so no person.updated row rides along.
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.updated")
        )
        .collect()
      expect(updated).toHaveLength(0)
    })
  })

  it("reports reactivated: false on an active person", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(internal.people.people.upsertPersonByExternalRef, {
      orgId,
      actorId: userId,
      externalRef: "E-8",
      displayName: "Bo Karlsson",
      gender: "Man",
    })
    const again = await asAdmin.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "E-8",
        displayName: "Bo Karlsson",
        gender: "Man",
      }
    )
    expect(again.reactivated).toBe(false)
  })
```

(`internal` is already imported in this test file.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/backend && bun run test -- people/people.test.ts`
Expected: FAIL (`reactivated` is undefined; the archived person stays archived).

- [ ] **Step 3: Implement reactivation in the core**

In `upsertPersonByExternalRefCore`:

Change the return type to:

```ts
): Promise<{
  personId: Id<"people">
  outcome: "created" | "updated" | "unchanged"
  // True when the matched person was archived and this write brought them
  // back: the file says they are employed, so the archive flag is wrong data.
  reactivated: boolean
}> {
```

The insert path returns `{ personId, outcome: "created" as const, reactivated: false }`.

In the update path, BEFORE the `personImportPatch` call, add:

```ts
  // A returning leaver: the file lists them, so they are active again. Done
  // before the field patch so the reactivation row and any field diff both
  // land, in that order, in the same transaction.
  const reactivated = existing.archivedAt !== undefined
  if (reactivated) {
    await ctx.db.patch(existing._id, { archivedAt: undefined })
    await logAudit(ctx, {
      orgId: args.orgId,
      type: AUDIT_EVENTS.personUnarchived,
      actorId: args.actorId,
      payload: {
        personId: existing._id,
        changes: { archivedAt: { from: existing.archivedAt ?? null, to: null } },
      },
    })
  }
```

The no-change return becomes `{ personId: existing._id, outcome: "unchanged" as const, reactivated }` and the final return `{ personId: existing._id, outcome: "updated" as const, reactivated }`.

In the `upsertPersonByExternalRef` internal mutation's `returns` validator add `reactivated: v.boolean(),`.

In `importHelpers.ts` `importChunk`: add `peopleReactivated: v.number()` to `returns`, a `let peopleReactivated = 0` counter, `if (reactivated) peopleReactivated += 1` after destructuring `const { personId, outcome, reactivated } = await upsertPersonByExternalRefCore(...)`, and include it in the returned object.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/backend && bunx tsc --noEmit -p tsconfig.json && bun run test -- people/people.test.ts people/import.test.ts`
Expected: PASS.

- [ ] **Step 5: Biome and stage**

Run: `bunx biome check packages/backend/convex/people/people.ts packages/backend/convex/people/people.test.ts packages/backend/convex/people/importHelpers.ts`
Expected: no diagnostics.

Stage the three files. Commit message once approved: `feat(import): a returning leaver is reactivated by the upsert`

---

### Task 4: `importPayroll` archives the missing set on request

**Files:**
- Modify: `packages/backend/convex/people/importHelpers.ts` (new `getActiveExternalRefs`, `archiveChunk`; `logImportCompleted`)
- Modify: `packages/backend/convex/people/import.ts` (`importResultValidator` ~line 74-83, `importPayroll` args + handler ~line 464-660)
- Modify: `packages/backend/convex/lib/auditPayloads.ts` (`people.imported` ~line 367-373)
- Modify: `apps/dashboard/lib/audit-detail.tsx` (`FIELD_DISPLAY_ORDER`, after `"skippedRows"`)
- Modify: `apps/dashboard/lib/audit-labels.test.ts` (`OTHER_AUDIT_FIELDS`, after `"skippedRows"`)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.auditLog.fields`)
- Test: `packages/backend/convex/people/import.test.ts`

**Interfaces:**
- Consumes `archivePeopleCore` (Task 1), `importChunk.peopleReactivated` (Task 3), `PEOPLE_ARCHIVE_CHUNK_SIZE`.
- Produces `importPayroll` arg `archiveMissing?: boolean` and result fields `peopleArchived`, `peopleReactivated` (Task 5 sends the flag; Tasks 5 and 6 read the counts).

- [ ] **Step 1: Write the failing tests**

Append to `packages/backend/convex/people/import.test.ts` (uses the file's `seedOrg`, `simpleCsv`, `SIMPLE_MAP`, `V1_CSV`, `IMPORT_CHUNK_SIZE`, `DATE_FORMS_MAP`; add `import { PEOPLE_ARCHIVE_CHUNK_SIZE } from "@workspace/constants"` at the top):

```ts
describe("importPayroll (leavers and returners)", () => {
  // Only Anna: Bo is missing from this file.
  const ANNA_ONLY_CSV = simpleCsv(["1;Anna;Svensson;Kvinna;Controller;50000;2026"])

  async function importV1(
    asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
    orgId: string
  ) {
    return asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: V1_CSV,
      columnMap: SIMPLE_MAP,
    })
  }

  async function auditPayloads(
    t: ReturnType<typeof initConvexTest>,
    orgId: string,
    type: string
  ) {
    return t.run(async (ctx) =>
      (
        await ctx.db
          .query("auditLog")
          .withIndex("by_org_type", (q) => q.eq("orgId", orgId).eq("type", type))
          .collect()
      ).map((row) => row.payload as Record<string, unknown>)
    )
  }

  it("does not archive anyone without the flag, and reports zero", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await importV1(asAdmin, orgId)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: ANNA_ONLY_CSV,
      columnMap: SIMPLE_MAP,
    })
    expect(result.peopleArchived).toBe(0)
    expect(result.peopleReactivated).toBe(0)

    const list = await asAdmin.query(api.people.people.listPeople, { orgId })
    expect(list).toHaveLength(2)
  })

  it("archives exactly the active people missing from the file when asked", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await importV1(asAdmin, orgId)
    // A manually added person has no employee number and can never be
    // "missing from the file".
    await asAdmin.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Manuell Person",
      gender: "Man",
    })

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: ANNA_ONLY_CSV,
      columnMap: SIMPLE_MAP,
      archiveMissing: true,
    })
    expect(result.ok).toBe(true)
    expect(result.peopleArchived).toBe(1)

    const active = await asAdmin.query(api.people.people.listPeople, { orgId })
    expect(active.map((p) => p.displayName).sort()).toEqual([
      "Anna Svensson",
      "Manuell Person",
    ])
    const all = await asAdmin.query(api.people.people.listPeople, {
      orgId,
      includeArchived: true,
    })
    const bo = all.find((p) => p.displayName === "Bo Karlsson")
    expect(typeof bo?.archivedAt).toBe("number")

    const archivedRows = await auditPayloads(t, orgId, "person.archived")
    expect(archivedRows).toHaveLength(1)
    const imported = await auditPayloads(t, orgId, "people.imported")
    expect(imported.at(-1)).toMatchObject({
      peopleArchived: 1,
      peopleReactivated: 0,
    })
  })

  it("reactivates a returning archived person and counts it", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await importV1(asAdmin, orgId)
    const before = await asAdmin.query(api.people.people.listPeople, { orgId })
    const bo = before.find((p) => p.displayName === "Bo Karlsson")
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId: bo?.personId as NonNullable<typeof bo>["personId"],
    })

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: V1_CSV,
      columnMap: SIMPLE_MAP,
    })
    expect(result.peopleReactivated).toBe(1)
    expect(result.peopleArchived).toBe(0)

    const active = await asAdmin.query(api.people.people.listPeople, { orgId })
    expect(active).toHaveLength(2)
    const imported = await auditPayloads(t, orgId, "people.imported")
    expect(imported.at(-1)).toMatchObject({ peopleReactivated: 1 })
  })

  it("never archives a row HR skipped as a name mismatch", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await importV1(asAdmin, orgId)

    // Bo's number with a different name: the review step skips this row.
    const renamed = simpleCsv([
      "1;Anna;Svensson;Kvinna;Controller;50000;2026",
      "2;Britt;Karlsson;Kvinna;Tekniker;40000;2026",
    ])
    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: renamed,
      columnMap: SIMPLE_MAP,
      skipExternalRefs: ["2"],
      archiveMissing: true,
    })
    expect(result.peopleArchived).toBe(0)
    expect(result.skippedRows).toBe(1)

    const active = await asAdmin.query(api.people.people.listPeople, { orgId })
    expect(active.map((p) => p.displayName).sort()).toEqual([
      "Anna Svensson",
      "Bo Karlsson",
    ])
  })

  it("archives across the chunk bound and sets the progress total to rows plus leavers", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const leaverCount = PEOPLE_ARCHIVE_CHUNK_SIZE + 1
    const lines = ["Id;Fornamn;Kon;Manadslon;Befattning;Fodelsedatum"]
    for (let i = 1; i <= leaverCount; i++) {
      lines.push(`L${i};Leaver${i};Man;3${i};Utvecklare;1990-01-01`)
    }
    lines.push("S1;Stayer;Man;40000;Utvecklare;1990-01-01")
    await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: lines.join("\n"),
      columnMap: DATE_FORMS_MAP,
      payYear: 2026,
    })

    const stayerOnly = [
      "Id;Fornamn;Kon;Manadslon;Befattning;Fodelsedatum",
      "S1;Stayer;Man;40000;Utvecklare;1990-01-01",
    ].join("\n")
    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: stayerOnly,
      columnMap: DATE_FORMS_MAP,
      payYear: 2026,
      archiveMissing: true,
    })
    expect(result.peopleArchived).toBe(leaverCount)

    const active = await asAdmin.query(api.people.people.listPeople, { orgId })
    expect(active.map((p) => p.displayName)).toEqual(["Stayer"])
    const archivedRows = await auditPayloads(t, orgId, "person.archived")
    expect(archivedRows).toHaveLength(leaverCount)
    // The ephemeral progress row is gone; while it lived its total was
    // rows + leavers (asserted through the chunk mutation below).
    await t.run(async (ctx) => {
      const progress = await ctx.db
        .query("importProgress")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(progress).toBeNull()
    })
  })

  it("archiveChunk writes progress as processedBefore + ids against the given total", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    await importV1(asAdmin, orgId)
    const people = await asAdmin.query(api.people.people.listPeople, { orgId })
    const ids = people.map((p) => p.personId)

    const chunk = await t.mutation(internal.people.importHelpers.archiveChunk, {
      orgId,
      actorId: userId,
      importId: "run-1",
      personIds: ids,
      processedBefore: 3,
      total: 5,
    })
    expect(chunk).toEqual({ archived: 2 })
    const progress = await asAdmin.query(
      api.people.importHelpers.getImportProgress,
      { orgId, importId: "run-1" }
    )
    expect(progress).toEqual({ processed: 5, total: 5 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/backend && bun run test -- people/import.test.ts`
Expected: FAIL (`archiveMissing` is not an accepted arg; `peopleArchived` undefined; `archiveChunk` missing).

- [ ] **Step 3: Add the helpers**

In `packages/backend/convex/people/importHelpers.ts`:

Extend the `./people` import to include `archivePeopleCore`, and add:

```ts
import { PEOPLE_ARCHIVE_CHUNK_SIZE } from "@workspace/constants"
```

After `getImportBaseline` add:

```ts
// Every active person that carries an employee number: the set the import
// subtracts the file's rows from to find leavers. Bounded by headcount.
export const getActiveExternalRefs = internalQuery({
  args: { orgId: v.string() },
  returns: v.array(
    v.object({ personId: v.id("people"), externalRef: v.string() })
  ),
  handler: async (ctx, { orgId }) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
    return people
      .filter((p) => p.archivedAt === undefined && p.externalRef !== undefined)
      .map((p) => ({ personId: p._id, externalRef: p.externalRef ?? "" }))
  },
})
```

After `importChunk` add:

```ts
// One chunk of the import's leaver archiving, committed as ONE transaction
// together with its progress write, exactly like importChunk. The action
// drives chunks of PEOPLE_ARCHIVE_CHUNK_SIZE sequentially after the row
// chunks, so the importing screen keeps counting past the last row.
export const archiveChunk = internalMutation({
  args: {
    orgId: v.string(),
    actorId: v.string(),
    importId: v.string(),
    personIds: v.array(v.id("people")),
    processedBefore: v.number(),
    total: v.number(),
  },
  returns: v.object({ archived: v.number() }),
  handler: async (ctx, args) => {
    const { archived } = await archivePeopleCore(ctx, {
      orgId: args.orgId,
      actorId: args.actorId,
      personIds: args.personIds,
    })
    await setImportProgressCore(ctx, {
      orgId: args.orgId,
      importId: args.importId,
      processed: args.processedBefore + args.personIds.length,
      total: args.total,
    })
    return { archived }
  },
})
```

(`PEOPLE_ARCHIVE_CHUNK_SIZE` is imported here only if a lint rule needs it referenced; otherwise import it in `import.ts` alone and drop the import here.)

In `logImportCompleted`: add `peopleArchived: v.number(), peopleReactivated: v.number(),` to `args`, and `peopleArchived: args.peopleArchived, peopleReactivated: args.peopleReactivated,` to the payload.

In `packages/backend/convex/lib/auditPayloads.ts`, `"people.imported"` becomes:

```ts
  "people.imported": {
    peopleCreated: number
    peopleUpdated: number
    peopleUnchanged: number
    salariesImported: number
    skippedRows: number
    // Leavers archived on request (archiveMissing) and archived people the
    // file brought back. Counts only, never ids.
    peopleArchived: number
    peopleReactivated: number
  }
```

- [ ] **Step 4: Wire the action**

In `packages/backend/convex/people/import.ts`:

Add to the imports: `import { PEOPLE_ARCHIVE_CHUNK_SIZE } from "@workspace/constants"` (merge into the existing `@workspace/constants` import list).

`importResultValidator` gains, after `skippedRows`:

```ts
  // Leavers archived because the caller asked (archiveMissing), and archived
  // people the file brought back (always).
  peopleArchived: v.number(),
  peopleReactivated: v.number(),
```

`importPayroll.args` gains:

```ts
    // Archive every active person with an employee number that the file
    // does not mention. Off by default: the review step's checkbox sets it.
    archiveMissing: v.optional(v.boolean()),
```

The blocked return gains `peopleArchived: 0, peopleReactivated: 0,`.

Replace the block from `let peopleCreated = 0` through the post-loop `setImportProgress` call (the one with `processed: rows.length`) with:

```ts
    let peopleCreated = 0
    let peopleUpdated = 0
    let peopleUnchanged = 0
    let salariesImported = 0
    let peopleReactivated = 0
    let peopleArchived = 0

    // The leaver set is computed BEFORE the rows land so the progress total
    // is known up front. Presence is judged on every normalized row (before
    // the user-elected skips): a name-mismatched row HR leaves out is still
    // in the file, so that person is never a leaver. A person created by
    // this import is by definition present.
    const toArchive: Id<"people">[] = []
    if (args.archiveMissing === true) {
      const active = await ctx.runQuery(
        internal.people.importHelpers.getActiveExternalRefs,
        { orgId: args.orgId }
      )
      const present = new Set(prepared.normalized.map((r) => r.externalRef))
      for (const person of active) {
        if (!present.has(person.externalRef)) toArchive.push(person.personId)
      }
    }
    const total = rows.length + toArchive.length

    // Live progress for the importing screen: 0/total up front (the setup
    // state), then each chunk writes its own committed count in the same
    // transaction as its rows or its archived leavers.
    await ctx.runMutation(internal.people.importHelpers.setImportProgress, {
      orgId: args.orgId,
      importId,
      processed: 0,
      total,
    })

    // One shared stamp for the whole run, so every chunk's salaries carry
    // the same effective time.
    const effectiveAt = args.effectiveAt ?? Date.now()

    // Sequential chunks of IMPORT_CHUNK_SIZE rows, each ONE transaction
    // (person upserts, salary appends, progress). Sequential rather than
    // parallel on purpose: chunks cannot OCC-conflict with each other, the
    // progress row stays monotonic, and a failure leaves whole committed
    // chunks a re-run finishes idempotently.
    for (let start = 0; start < rows.length; start += IMPORT_CHUNK_SIZE) {
      const chunk = await ctx.runMutation(
        internal.people.importHelpers.importChunk,
        {
          orgId: args.orgId,
          actorId,
          importId,
          effectiveAt,
          processedBefore: start,
          total,
          rows: rows.slice(start, start + IMPORT_CHUNK_SIZE),
        }
      )
      peopleCreated += chunk.peopleCreated
      peopleUpdated += chunk.peopleUpdated
      peopleUnchanged += chunk.peopleUnchanged
      salariesImported += chunk.salariesImported
      peopleReactivated += chunk.peopleReactivated
    }

    // Leavers, in the same bounded-chunk shape, continuing the progress
    // count past the last row.
    for (
      let start = 0;
      start < toArchive.length;
      start += PEOPLE_ARCHIVE_CHUNK_SIZE
    ) {
      const chunk = await ctx.runMutation(
        internal.people.importHelpers.archiveChunk,
        {
          orgId: args.orgId,
          actorId,
          importId,
          personIds: toArchive.slice(start, start + PEOPLE_ARCHIVE_CHUNK_SIZE),
          processedBefore: rows.length + start,
          total,
        }
      )
      peopleArchived += chunk.archived
    }

    // Everything processed: show the final count while the post-loop steps
    // (profile save, employee count, audit, classification) run.
    await ctx.runMutation(internal.people.importHelpers.setImportProgress, {
      orgId: args.orgId,
      importId,
      processed: total,
      total,
    })
```

Add `import type { Id } from "../_generated/dataModel"` at the top of `import.ts` (the file is `"use node"`; a type import is fine).

Pass the two counts to `logImportCompleted` (`peopleArchived, peopleReactivated,`) and include them in the success return object.

- [ ] **Step 5: Labels and display order**

`apps/dashboard/lib/audit-detail.tsx`, `FIELD_DISPLAY_ORDER`, after `"skippedRows",` add:

```ts
  "peopleArchived",
  "peopleReactivated",
```

`apps/dashboard/lib/audit-labels.test.ts`, `OTHER_AUDIT_FIELDS`, after `"skippedRows",` add the same two entries.

Message files, `dashboard.auditLog.fields`, after `"skippedRows"`:

| locale | values |
|---|---|
| en | `"peopleArchived": "Archived employees", "peopleReactivated": "Reactivated employees"` |
| sv | `"peopleArchived": "Arkiverade anställda", "peopleReactivated": "Återaktiverade anställda"` |
| nb | `"peopleArchived": "Arkiverte ansatte", "peopleReactivated": "Reaktiverte ansatte"` |
| da | `"peopleArchived": "Arkiverede medarbejdere", "peopleReactivated": "Genaktiverede medarbejdere"` |
| fi | `"peopleArchived": "Arkistoidut työntekijät", "peopleReactivated": "Aktiivisiksi palautetut työntekijät"` |

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd packages/backend && bunx tsc --noEmit -p tsconfig.json && bun run test`
Expected: PASS (the pre-existing `people.imported` assertion in "imports good rows ... audits with counts only" checks fields one by one, so it needs no change; add `expect(auditPayload.peopleArchived).toBe(0)` and `expect(auditPayload.peopleReactivated).toBe(0)` beside them).

Run: `cd apps/dashboard && bun run test -- lib/audit-labels.test.ts lib/audit-detail.test.tsx`
Expected: PASS.

Run: `cd packages/i18n && bun run test`
Expected: PASS.

- [ ] **Step 7: Biome and stage**

Run: `bunx biome check packages/backend/convex/people/import.ts packages/backend/convex/people/import.test.ts packages/backend/convex/people/importHelpers.ts packages/backend/convex/lib/auditPayloads.ts apps/dashboard/lib/audit-detail.tsx apps/dashboard/lib/audit-labels.test.ts`
Expected: no diagnostics.

Stage those files plus the five message files. Commit message once approved: `feat(import): archive leavers missing from the file on request, in chunks`

---

### Task 5: Review step: returning and missing rows, the archive checkbox

**Files:**
- Modify: `apps/dashboard/components/people/import/review-step.tsx`
- Modify: `apps/dashboard/components/people/import/import-wizard.tsx` (`ImportResultCounts` ~line 45-51)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.people.import.review.changes`, `dashboard.help`)
- Test: `apps/dashboard/components/people/import/review-step.test.tsx`

**Interfaces:**
- Consumes the preview diff fields (Task 2) and `importPayroll`'s `archiveMissing` + result counts (Task 4).
- Produces `ImportResultCounts.reactivated` and `.archived` (Task 6 renders them).

- [ ] **Step 1: Add the strings**

`dashboard.people.import.review.changes`, after `"mismatchImportAnyway"`:

en:
```json
        "returningPeople": "Returning (reactivated)",
        "missingPeople": "Missing from the file",
        "missingTitle": "Employees missing from the file",
        "missingBody": "These employees are active in the register but not in this file. They stay active unless you archive them below.",
        "archiveMissing": "{count, plural, one {Archive this employee} other {Archive these # employees}}"
```
sv:
```json
        "returningPeople": "Återkommer (återaktiveras)",
        "missingPeople": "Saknas i filen",
        "missingTitle": "Anställda som saknas i filen",
        "missingBody": "Dessa anställda är aktiva i registret men finns inte i den här filen. De förblir aktiva om du inte arkiverar dem nedan.",
        "archiveMissing": "{count, plural, one {Arkivera den här anställda} other {Arkivera dessa # anställda}}"
```
nb:
```json
        "returningPeople": "Kommer tilbake (reaktiveres)",
        "missingPeople": "Mangler i filen",
        "missingTitle": "Ansatte som mangler i filen",
        "missingBody": "Disse ansatte er aktive i registeret, men finnes ikke i denne filen. De forblir aktive med mindre du arkiverer dem nedenfor.",
        "archiveMissing": "{count, plural, one {Arkiver denne ansatte} other {Arkiver disse # ansatte}}"
```
da:
```json
        "returningPeople": "Vender tilbage (genaktiveres)",
        "missingPeople": "Mangler i filen",
        "missingTitle": "Medarbejdere der mangler i filen",
        "missingBody": "Disse medarbejdere er aktive i registret, men findes ikke i denne fil. De forbliver aktive, medmindre du arkiverer dem nedenfor.",
        "archiveMissing": "{count, plural, one {Arkivér denne medarbejder} other {Arkivér disse # medarbejdere}}"
```
fi:
```json
        "returningPeople": "Palaavat (palautetaan aktiivisiksi)",
        "missingPeople": "Puuttuvat tiedostosta",
        "missingTitle": "Tiedostosta puuttuvat työntekijät",
        "missingBody": "Nämä työntekijät ovat aktiivisia rekisterissä, mutta eivät ole tässä tiedostossa. He pysyvät aktiivisina, ellet arkistoi heitä alla.",
        "archiveMissing": "{count, plural, one {Arkistoi tämä työntekijä} other {Arkistoi nämä # työntekijää}}"
```

`dashboard.help`, next to `archivePackageLabel`/`archivePackageBody` (keep the file's alphabetical or grouped placement, both keys adjacent):

| locale | label | body |
|---|---|---|
| en | `"archivedPersonLabel": "What does archiving mean?"` | `"archivedPersonBody": "An archived employee has left and is kept with their history, outside classification, pay mappings and counts. Archiving can be undone; deleting cannot."` |
| sv | `"archivedPersonLabel": "Vad betyder arkivering?"` | `"archivedPersonBody": "En arkiverad anställd har slutat och behålls med sin historik, utanför klassificering, lönekartläggningar och antal. Arkivering kan ångras, radering kan det inte."` |
| nb | `"archivedPersonLabel": "Hva betyr arkivering?"` | `"archivedPersonBody": "En arkivert ansatt har sluttet og beholdes med historikken sin, utenfor klassifisering, lønnskartlegginger og antall. Arkivering kan angres, sletting kan ikke."` |
| da | `"archivedPersonLabel": "Hvad betyder arkivering?"` | `"archivedPersonBody": "En arkiveret medarbejder er stoppet og bevares med sin historik, uden for klassificering, lønkortlægninger og antal. Arkivering kan fortrydes, sletning kan ikke."` |
| fi | `"archivedPersonLabel": "Mitä arkistointi tarkoittaa?"` | `"archivedPersonBody": "Arkistoitu työntekijä on lähtenyt ja säilyy historioineen luokittelun, palkkakartoitusten ja lukumäärien ulkopuolella. Arkistoinnin voi kumota, poistoa ei."` |

Run `cd packages/i18n && bun run test` to confirm parity and the help-body cap.

- [ ] **Step 2: Extend the wizard's result type**

In `import-wizard.tsx`:

```ts
export interface ImportResultCounts {
  created: number
  updated: number
  // Existing people whose incoming data matched what is already stored.
  unchanged: number
  skipped: number
  // Archived people the file brought back, and leavers archived on request.
  reactivated: number
  archived: number
}
```

- [ ] **Step 3: Write the failing tests**

In `review-step.test.tsx`, extend `OK_PREVIEW.diff`:

```ts
  diff: {
    people: { created: 2, updated: 0, unchanged: 0, returning: 0 },
    updatedPeople: [],
    returningPeople: [],
    missingFromFile: [],
    nameMismatches: [],
    salary: {
      newEntries: 2,
      changedSameYear: 0,
      identical: 0,
      changedDetails: [],
    },
  },
```

and `OK_RESULT` with `peopleArchived: 0, peopleReactivated: 0,`. Update the existing "signals onImportSuccess with the result counts" expectation to include `reactivated: 0, archived: 0`.

Append a describe block:

```ts
describe("ReviewStep — leavers and returners", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    previewImportMock.mockResolvedValue(OK_PREVIEW)
  })

  const c = messages.dashboard.people.import.review.changes

  it("renders the returning and missing rows with their counts and lists", async () => {
    previewImportMock.mockResolvedValueOnce({
      ...OK_PREVIEW,
      diff: {
        ...OK_PREVIEW.diff,
        people: { created: 2, updated: 0, unchanged: 0, returning: 1 },
        returningPeople: [{ externalRef: "E009", displayName: "Rita Return" }],
        missingFromFile: [
          { externalRef: "E100", displayName: "Lars Leaver" },
          { externalRef: "E101", displayName: "Mia Missing" },
        ],
      },
    })
    renderReview()
    await screen.findByText("Rita Return")
    expect(screen.getByTestId("returning-people").textContent).toContain("E009")
    const missing = screen.getByTestId("missing-people")
    expect(missing.textContent).toContain(c.missingTitle)
    expect(missing.textContent).toContain("Lars Leaver")
    expect(missing.textContent).toContain("Mia Missing")
    const checkbox = screen.getByRole("checkbox", {
      name: "Archive these 2 employees",
    })
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
  })

  it("renders neither list when there is nothing returning or missing", async () => {
    renderReview()
    await waitFor(() => expect(previewImportMock).toHaveBeenCalled())
    expect(screen.queryByTestId("returning-people")).toBeNull()
    expect(screen.queryByTestId("missing-people")).toBeNull()
  })

  it("omits archiveMissing unless the checkbox is ticked", async () => {
    previewImportMock.mockResolvedValueOnce({
      ...OK_PREVIEW,
      diff: {
        ...OK_PREVIEW.diff,
        missingFromFile: [{ externalRef: "E100", displayName: "Lars Leaver" }],
      },
    })
    importPayrollMock.mockResolvedValue(OK_RESULT)
    renderReview()
    await screen.findByText("Lars Leaver")
    await clickConfirm()
    await waitFor(() => expect(importPayrollMock).toHaveBeenCalled())
    expect(importPayrollMock.mock.calls[0]?.[0]).not.toHaveProperty(
      "archiveMissing"
    )
  })

  it("passes archiveMissing: true when the checkbox is ticked", async () => {
    previewImportMock.mockResolvedValueOnce({
      ...OK_PREVIEW,
      diff: {
        ...OK_PREVIEW.diff,
        missingFromFile: [{ externalRef: "E100", displayName: "Lars Leaver" }],
      },
    })
    importPayrollMock.mockResolvedValue(OK_RESULT)
    renderReview()
    await screen.findByText("Lars Leaver")
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Archive this employee" })
    )
    await clickConfirm()
    await waitFor(() => expect(importPayrollMock).toHaveBeenCalled())
    expect(importPayrollMock.mock.calls[0]?.[0]).toMatchObject({
      archiveMissing: true,
    })
  })

  it("passes the reactivated and archived counts to onImportSuccess", async () => {
    importPayrollMock.mockResolvedValue({
      ...OK_RESULT,
      peopleArchived: 3,
      peopleReactivated: 1,
    })
    const onImportSuccess = vi.fn()
    renderReview({ onImportSuccess })
    await clickConfirm()
    await waitFor(() => expect(onImportSuccess).toHaveBeenCalled())
    expect(onImportSuccess.mock.calls[0]?.[0]).toMatchObject({
      archived: 3,
      reactivated: 1,
    })
  })
})
```

`renderReviewStep` is this file's existing render helper (it takes prop overrides); use it wherever the tests above say `renderReview`. `clickConfirm` exists.

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd apps/dashboard && bun run test -- components/people/import/review-step.test.tsx`
Expected: FAIL (no rows, no checkbox, `archiveMissing` never passed).

- [ ] **Step 5: Implement the review step**

In `review-step.tsx`:

Add icons to the `@hugeicons/core-free-icons` import: `UserMinus01Icon, UserSwitchIcon` (both exist in the installed free set; verified 2026-09-02 against `node_modules/@hugeicons/core-free-icons/dist/types`).

Add the import `import { HelpMorphButton } from "@/components/help-morph-button"`.

Extend `CHANGE_GROUPS`'s employees lines:

```ts
    lines: [
      { key: "newPeople", icon: UserAdd01Icon },
      { key: "updatedPeople", icon: UserEdit01Icon },
      { key: "unchangedPeople", icon: UserCheck01Icon },
      { key: "returningPeople", icon: UserSwitchIcon },
      { key: "missingPeople", icon: UserMinus01Icon },
    ],
```

Extend `countForKey`'s parameter type and switch:

```ts
function countForKey(
  diff: {
    people: {
      created: number
      updated: number
      unchanged: number
      returning: number
    }
    missingFromFile: readonly unknown[]
    salary: {
      newEntries: number
      changedSameYear: number
      identical: number
    }
  },
  key: string
): number | undefined {
  switch (key) {
    case "newPeople":
      return diff.people.created
    case "updatedPeople":
      return diff.people.updated
    case "unchangedPeople":
      return diff.people.unchanged
    case "returningPeople":
      return diff.people.returning
    case "missingPeople":
      return diff.missingFromFile.length
    // ... salary cases unchanged ...
  }
}
```

Add a small list component after `FromTo`:

```tsx
// A capped list of people named by number, for the returning and missing
// lists; the same Show-all reveal as the updated-people cards.
function PersonRefList({
  people,
  showAll,
  onShowAll,
  showAllLabel,
}: {
  people: ReadonlyArray<{ externalRef: string; displayName: string }>
  showAll: boolean
  onShowAll: () => void
  showAllLabel: string
}) {
  const shown = showAll ? people : people.slice(0, UPDATED_PEOPLE_SHOWN)
  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-md border text-sm">
        {shown.map((person) => (
          <li
            key={person.externalRef}
            className="flex items-center justify-between gap-2 px-3 py-2"
          >
            <span className="font-medium">{person.displayName}</span>
            <span className="font-mono text-muted-foreground">
              {person.externalRef}
            </span>
          </li>
        ))}
      </ul>
      {!showAll && people.length > UPDATED_PEOPLE_SHOWN && (
        <button
          type="button"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          onClick={onShowAll}
        >
          {showAllLabel}
        </button>
      )}
    </div>
  )
}
```

In `ReviewStep`, add state and derived values after `showAllUpdated`:

```ts
  const tHelp = useTranslations("dashboard.help")
  // Leavers are archived only on an explicit tick (default off), so a partial
  // file can never archive the rest of the register by accident.
  const [archiveMissing, setArchiveMissing] = useState(false)
  const [showAllReturning, setShowAllReturning] = useState(false)
  const [showAllMissing, setShowAllMissing] = useState(false)
  const returningPeople = changePreview?.diff?.returningPeople ?? []
  const missingFromFile = changePreview?.diff?.missingFromFile ?? []
```

In `handleConfirm`'s `importPayroll` call add, after the basisMap spread:

```ts
        // Leavers archive only on the explicit tick; the arg is omitted
        // otherwise, like every other optional arg.
        ...(archiveMissing && missingFromFile.length > 0
          ? { archiveMissing: true }
          : {}),
```

and extend the `onImportSuccess` object with `reactivated: result.peopleReactivated, archived: result.peopleArchived,`.

Render the returning list right after the updated-people block (inside the same `space-y-4` container):

```tsx
            {changePreview !== null &&
              changePreview.diff !== null &&
              returningPeople.length > 0 && (
                <div data-testid="returning-people">
                  <h4 className="mb-2 font-medium text-muted-foreground text-xs">
                    {tChanges("returningPeople")}
                  </h4>
                  <PersonRefList
                    people={returningPeople}
                    showAll={showAllReturning}
                    onShowAll={() => setShowAllReturning(true)}
                    showAllLabel={tChanges("showAll", {
                      count: returningPeople.length,
                    })}
                  />
                </div>
              )}
```

Render the missing Alert right after the name-mismatch Alert (same level, before `WizardFooter`):

```tsx
      {/* Active people the file does not mention. Archiving is an explicit,
          reversible choice (default off): a partial file must never archive
          the rest of the register. Same amber tone as the mismatch guard. */}
      {missingFromFile.length > 0 && (
        <Alert className={WARNING_ALERT_CLASS} data-testid="missing-people">
          <div className="flex items-center gap-1.5">
            <AlertTitle>{tChanges("missingTitle")}</AlertTitle>
            <HelpMorphButton label={tHelp("archivedPersonLabel")}>
              {tHelp("archivedPersonBody")}
            </HelpMorphButton>
          </div>
          <AlertDescription>
            <p>{tChanges("missingBody")}</p>
            <div className="mt-2">
              <PersonRefList
                people={missingFromFile}
                showAll={showAllMissing}
                onShowAll={() => setShowAllMissing(true)}
                showAllLabel={tChanges("showAll", {
                  count: missingFromFile.length,
                })}
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Checkbox
                id="import-archive-missing"
                checked={archiveMissing}
                onCheckedChange={(checked) =>
                  setArchiveMissing(checked === true)
                }
              />
              <Label htmlFor="import-archive-missing" className="font-medium">
                {tChanges("archiveMissing", { count: missingFromFile.length })}
              </Label>
            </div>
          </AlertDescription>
        </Alert>
      )}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/dashboard && bun run test -- components/people/import/`
Expected: PASS for review-step; import-done-step tests may fail on the widened `ImportResultCounts` type until Task 6 (typecheck only; run the whole dashboard typecheck after Task 6).

- [ ] **Step 7: Biome and stage**

Run: `bunx biome check apps/dashboard/components/people/import/review-step.tsx apps/dashboard/components/people/import/review-step.test.tsx apps/dashboard/components/people/import/import-wizard.tsx`
Expected: no diagnostics.

Stage those files plus the message files. Commit message once approved: `feat(import): the review step lists returning and missing people and offers to archive leavers`

---

### Task 6: Done step: reactivated and archived rows

**Files:**
- Modify: `apps/dashboard/components/people/import/import-done-step.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.people.import.done`)
- Test: `apps/dashboard/components/people/import/import-done-step.test.tsx`

**Interfaces:**
- Consumes `ImportResultCounts.reactivated` / `.archived` (Task 5).

- [ ] **Step 1: Add the strings**

`dashboard.people.import.done`, after `"skipped"`:

| locale | values |
|---|---|
| en | `"reactivated": "Returning people reactivated", "archived": "People archived"` |
| sv | `"reactivated": "Återkommande personer återaktiverade", "archived": "Personer arkiverade"` |
| nb | `"reactivated": "Personer som kom tilbake reaktivert", "archived": "Personer arkivert"` |
| da | `"reactivated": "Tilbagevendte personer genaktiveret", "archived": "Personer arkiveret"` |
| fi | `"reactivated": "Palanneita henkilöitä palautettu aktiivisiksi", "archived": "Henkilöitä arkistoitu"` |

- [ ] **Step 2: Write the failing tests**

In `import-done-step.test.tsx`, change `renderDone`'s default to `{ created: 5, updated: 2, unchanged: 3, skipped: 1, reactivated: 0, archived: 0 } as const` and append:

```ts
  it("hides the reactivated and archived rows at zero", () => {
    renderDone()
    expect(screen.queryByTestId("done-reactivated")).toBeNull()
    expect(screen.queryByTestId("done-archived")).toBeNull()
  })

  it("shows the reactivated and archived rows when above zero", () => {
    renderDone({
      created: 0,
      updated: 0,
      unchanged: 9,
      skipped: 0,
      reactivated: 1,
      archived: 4,
    })
    const reactivated = screen.getByTestId("done-reactivated")
    expect(reactivated.textContent).toContain(m.reactivated)
    expect(reactivated.textContent).toContain("1")
    const archived = screen.getByTestId("done-archived")
    expect(archived.textContent).toContain(m.archived)
    expect(archived.textContent).toContain("4")
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/dashboard && bun run test -- components/people/import/import-done-step.test.tsx`
Expected: FAIL on the second test (rows absent).

- [ ] **Step 4: Implement**

In `import-done-step.tsx`, add `UserSwitchIcon` (same icon as Task 5) to the icon import and replace the `rows` constant with:

```ts
  // The two lifecycle rows show only when they happened, so an ordinary
  // import's done screen is unchanged.
  const rows = [
    { key: "created", icon: UserAdd01Icon, value: result.created },
    { key: "updated", icon: UserEdit01Icon, value: result.updated },
    { key: "unchanged", icon: UserCheck01Icon, value: result.unchanged },
    { key: "skipped", icon: UserMinus01Icon, value: result.skipped },
    ...(result.reactivated > 0
      ? [
          {
            key: "reactivated" as const,
            icon: UserSwitchIcon,
            value: result.reactivated,
          },
        ]
      : []),
    ...(result.archived > 0
      ? [
          {
            key: "archived" as const,
            icon: UserMinus01Icon,
            value: result.archived,
          },
        ]
      : []),
  ] as const
```

If TypeScript rejects `as const` on the spread array, type it explicitly: `const rows: Array<{ key: "created" | "updated" | "unchanged" | "skipped" | "reactivated" | "archived"; icon: typeof UserAdd01Icon; value: number }> = [...]`.

- [ ] **Step 5: Run the tests and the dashboard typecheck**

Run: `cd apps/dashboard && bun run test -- components/people/import/ && bunx tsc --noEmit -p tsconfig.json`
Expected: PASS, no type errors (every `ImportResultCounts` literal now carries the two new fields).

- [ ] **Step 6: Biome and stage**

Run: `bunx biome check apps/dashboard/components/people/import/import-done-step.tsx apps/dashboard/components/people/import/import-done-step.test.tsx`
Expected: no diagnostics.

Stage those files plus the message files. Commit message once approved: `feat(import): the done screen counts reactivated and archived people`

---

### Task 7: Register: status filter and the archived badge

**Files:**
- Modify: `apps/dashboard/components/people/people-section.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.people.toolbar`, `dashboard.people.archivedBadge`)
- Test: `apps/dashboard/components/people/people-section.test.tsx`

**Interfaces:**
- Consumes `listPeople({ includeArchived })` (existing).
- Produces `PeopleTableRow.archivedAt: number | null` (Task 8 reads it for the bulk action).

- [ ] **Step 1: Add the strings**

`dashboard.people.toolbar`, after `"ftePart"`:

| locale | values |
|---|---|
| en | `"statusLabel": "Status", "statusActive": "Active employees", "statusArchived": "Archived employees", "statusAll": "All employees"` |
| sv | `"statusLabel": "Status", "statusActive": "Aktiva anställda", "statusArchived": "Arkiverade anställda", "statusAll": "Alla anställda"` |
| nb | `"statusLabel": "Status", "statusActive": "Aktive ansatte", "statusArchived": "Arkiverte ansatte", "statusAll": "Alle ansatte"` |
| da | `"statusLabel": "Status", "statusActive": "Aktive medarbejdere", "statusArchived": "Arkiverede medarbejdere", "statusAll": "Alle medarbejdere"` |
| fi | `"statusLabel": "Tila", "statusActive": "Aktiiviset työntekijät", "statusArchived": "Arkistoidut työntekijät", "statusAll": "Kaikki työntekijät"` |

`dashboard.people`, after `"suggestedBadgeTooltip"`:

| locale | value |
|---|---|
| en | `"archivedBadge": "Archived"` |
| sv | `"archivedBadge": "Arkiverad"` |
| nb | `"archivedBadge": "Arkivert"` |
| da | `"archivedBadge": "Arkiveret"` |
| fi | `"archivedBadge": "Arkistoitu"` |

- [ ] **Step 2: Write the failing tests**

In `people-section.test.tsx`, add a fixture after `MANY_PEOPLE`:

```ts
const ARCHIVED_PERSON = {
  personId: "p9",
  publicId: "pub-p9",
  displayName: "Zara Archived",
  gender: "Kvinna",
  department: "Engineering",
  ftePercent: 100,
  externalRef: "99",
  birthDate: null,
  employmentStartDate: null,
  country: null,
  isManager: null,
  statisticalCode: null,
  archivedAt: 1_756_000_000_000,
  roleId: null,
  senioritySource: null,
}
const PEOPLE_WITH_ARCHIVED = [...PEOPLE, ARCHIVED_PERSON]
```

Make `queryRouter` honour the query args like the server does:

```ts
function queryRouter(
  ref: string,
  people = PEOPLE,
  byTitle = BY_TITLE,
  args?: unknown
): unknown {
  if (ref === "people.people.listPeople") {
    const includeArchived =
      (args as { includeArchived?: boolean } | undefined)?.includeArchived ===
      true
    return includeArchived ? people : people.filter((p) => p.archivedAt === null)
  }
  if (ref === "people.classificationQueries.listPeopleByTitle") return byTitle
  if (ref === "assessment.roles.listRoles") return ROLES
  return []
}
```

and call it as `onQuery((ref, args) => queryRouter(ref, PEOPLE_WITH_ARCHIVED, BY_TITLE, args))` in the new tests. Append inside `describe("PeopleSection")`:

```ts
  describe("status filter", () => {
    it("shows active people only by default and no badge", () => {
      onQuery((ref, args) =>
        queryRouter(ref, PEOPLE_WITH_ARCHIVED, BY_TITLE, args)
      )
      renderSection()
      expect(screen.queryByText("Zara Archived")).toBeNull()
      expect(screen.queryByText(m.archivedBadge)).toBeNull()
      expect(screen.queryByText(/of \d+ people/)).toBeNull()
    })

    it("narrows to archived people, with the badge and the result count", async () => {
      onQuery((ref, args) =>
        queryRouter(ref, PEOPLE_WITH_ARCHIVED, BY_TITLE, args)
      )
      renderSection()
      await pickSelectOption(
        screen.getByRole("combobox", { name: m.toolbar.statusLabel }),
        m.toolbar.statusArchived
      )
      await screen.findByText("Zara Archived")
      expect(screen.queryByText("Alice Svensson")).toBeNull()
      expect(screen.getByText(m.archivedBadge)).toBeDefined()
      expect(screen.getByText("1 of 4 people")).toBeDefined()
    })

    it("shows everyone under All, badging only the archived row", async () => {
      onQuery((ref, args) =>
        queryRouter(ref, PEOPLE_WITH_ARCHIVED, BY_TITLE, args)
      )
      renderSection()
      await pickSelectOption(
        screen.getByRole("combobox", { name: m.toolbar.statusLabel }),
        m.toolbar.statusAll
      )
      await screen.findByText("Zara Archived")
      expect(screen.getByText("Alice Svensson")).toBeDefined()
      expect(screen.getAllByText(m.archivedBadge)).toHaveLength(1)
    })

    it("clearing filters returns to active people", async () => {
      onQuery((ref, args) =>
        queryRouter(ref, PEOPLE_WITH_ARCHIVED, BY_TITLE, args)
      )
      renderSection()
      await pickSelectOption(
        screen.getByRole("combobox", { name: m.toolbar.statusLabel }),
        m.toolbar.statusArchived
      )
      await screen.findByText("Zara Archived")
      fireEvent.change(screen.getByPlaceholderText(m.toolbar.searchPlaceholder), {
        target: { value: "nobody" },
      })
      fireEvent.click(screen.getByRole("button", { name: m.toolbar.clearFilters }))
      await screen.findByText("Alice Svensson")
      expect(screen.queryByText("Zara Archived")).toBeNull()
    })
  })
```

(The `onQuery` handler receives `(ref, args)`; check the file's other calls still typecheck with the added parameter. The result-count string "1 of 4 people" follows `m.toolbar.resultCount`; if the total under "Archived" counts the whole returned list (4), keep "1 of 4"; adjust to the rendered total if the implementation counts differently, but the shown count must be 1.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/dashboard && bun run test -- components/people/people-section.test.tsx`
Expected: FAIL (no status combobox; archived rows never shown).

- [ ] **Step 4: Implement**

In `people-section.tsx`:

Imports: add `import { Badge } from "@workspace/ui/components/badge"`.

`PeopleTableRow` gains `archivedAt: number | null` (comment: "Set when the person has left; the status filter and the badge read it").

Add a status type near `PAGE_SIZE`:

```ts
// The status filter's three views. "active" is the default and asks the
// server for active people only; the other two load archived people too and
// narrow client-side through the `status` column.
type StatusFilter = "active" | "archived" | "all"
```

Add a column after the `fte` accessor:

```ts
  // Filter-only: "archived" narrows to archived rows; "All" sets no filter.
  columnHelper.accessor((row) => (row.archivedAt !== null ? "archived" : "active"), {
    id: "status",
    filterFn: exactString,
    enableGlobalFilter: false,
  }),
```

State and query: replace `const people = useQuery(api.people.people.listPeople, { orgId })` with

```ts
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")
  const people = useQuery(
    api.people.people.listPeople,
    statusFilter === "active" ? { orgId } : { orgId, includeArchived: true }
  )
```

Map `archivedAt: person.archivedAt` in the `rows` memo.

`filtersActive` becomes `globalFilter.trim() !== "" || columnFilters.length > 0 || statusFilter !== "active"`.

Add a handler next to `setColumnFilter`:

```ts
  // The status select drives both the query (archived rows are only loaded
  // when asked for) and the column filter that narrows "Archived".
  function setStatus(value: StatusFilter) {
    setStatusFilter(value)
    table
      .getColumn("status")
      ?.setFilterValue(value === "archived" ? "archived" : undefined)
    resetPage()
  }
```

`clearFilters` additionally calls `setStatusFilter("active")`.

Toolbar: after the FTE `Select` block add (rendered always: its options are static chrome):

```tsx
      <Select
        items={{
          active: tToolbar("statusActive"),
          archived: tToolbar("statusArchived"),
          all: tToolbar("statusAll"),
        }}
        value={statusFilter}
        onValueChange={onSelectValue((value: StatusFilter) => setStatus(value))}
      >
        <SelectTrigger aria-label={tToolbar("statusLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">{tToolbar("statusActive")}</SelectItem>
          <SelectItem value="archived">{tToolbar("statusArchived")}</SelectItem>
          <SelectItem value="all">{tToolbar("statusAll")}</SelectItem>
        </SelectContent>
      </Select>
```

Name cell: inside the existing `<div className="flex items-center gap-2">`, after the `SuggestedRoleBadge` block add:

```tsx
                        {row.archivedAt !== null && (
                          <Badge variant="outline">{t("archivedBadge")}</Badge>
                        )}
```

Update the file's header comment ("Displays active (non-archived) people" becomes "Displays active people by default; the status filter reveals archived ones").

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/dashboard && bun run test -- components/people/people-section.test.tsx`
Expected: PASS (all pre-existing register tests too).

- [ ] **Step 6: Biome and stage**

Run: `bunx biome check apps/dashboard/components/people/people-section.tsx apps/dashboard/components/people/people-section.test.tsx`
Expected: no diagnostics.

Stage those files plus the message files. Commit message once approved: `feat(people): the register filters by status and badges archived people`

---

### Task 8: Register: bulk archive

**Files:**
- Create: `apps/dashboard/components/people/bulk-archive-people-dialog.tsx`
- Modify: `apps/dashboard/components/people/people-section.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.people.bulkArchive`, `dashboard.toast.peopleArchived`)
- Test: `apps/dashboard/components/people/people-section.test.tsx`

**Interfaces:**
- Consumes `api.people.people.archivePeople` (Task 1), `PEOPLE_ARCHIVE_CHUNK_SIZE`, `PeopleTableRow.archivedAt` (Task 7).

- [ ] **Step 1: Add the strings**

`dashboard.people.bulkArchive` (a new object after `"bulk"`):

en:
```json
      "bulkArchive": {
        "cta": "{count, plural, one {Archive # employee} other {Archive # employees}}",
        "dialogTitle": "Archive selected employees?",
        "dialogDescription": "{count, plural, one {# employee leaves} other {# employees leave}} the active register, classification, pay mappings and counts. Their history is kept, and they can be reactivated.",
        "confirm": "Archive",
        "progress": "<done></done> / <total></total>",
        "error": "The employees could not be archived. Try again."
      }
```
sv:
```json
      "bulkArchive": {
        "cta": "{count, plural, one {Arkivera # anställd} other {Arkivera # anställda}}",
        "dialogTitle": "Arkivera markerade anställda?",
        "dialogDescription": "{count, plural, one {# anställd lämnar} other {# anställda lämnar}} det aktiva registret, klassificeringen, lönekartläggningarna och antalen. Historiken behålls och de kan återaktiveras.",
        "confirm": "Arkivera",
        "progress": "<done></done> / <total></total>",
        "error": "De anställda kunde inte arkiveras. Försök igen."
      }
```
nb:
```json
      "bulkArchive": {
        "cta": "{count, plural, one {Arkiver # ansatt} other {Arkiver # ansatte}}",
        "dialogTitle": "Arkivere valgte ansatte?",
        "dialogDescription": "{count, plural, one {# ansatt forlater} other {# ansatte forlater}} det aktive registeret, klassifiseringen, lønnskartleggingene og antallene. Historikken beholdes, og de kan reaktiveres.",
        "confirm": "Arkiver",
        "progress": "<done></done> / <total></total>",
        "error": "De ansatte kunne ikke arkiveres. Prøv igjen."
      }
```
da:
```json
      "bulkArchive": {
        "cta": "{count, plural, one {Arkivér # medarbejder} other {Arkivér # medarbejdere}}",
        "dialogTitle": "Arkivér valgte medarbejdere?",
        "dialogDescription": "{count, plural, one {# medarbejder forlader} other {# medarbejdere forlader}} det aktive register, klassificeringen, lønkortlægningerne og antallene. Historikken bevares, og de kan genaktiveres.",
        "confirm": "Arkivér",
        "progress": "<done></done> / <total></total>",
        "error": "Medarbejderne kunne ikke arkiveres. Prøv igen."
      }
```
fi:
```json
      "bulkArchive": {
        "cta": "{count, plural, one {Arkistoi # työntekijä} other {Arkistoi # työntekijää}}",
        "dialogTitle": "Arkistoidaanko valitut työntekijät?",
        "dialogDescription": "{count, plural, one {# työntekijä poistuu} other {# työntekijää poistuu}} aktiivisesta rekisteristä, luokittelusta, palkkakartoituksista ja lukumääristä. Historia säilyy, ja heidät voi palauttaa aktiivisiksi.",
        "confirm": "Arkistoi",
        "progress": "<done></done> / <total></total>",
        "error": "Työntekijöitä ei voitu arkistoida. Yritä uudelleen."
      }
```

`dashboard.toast`, after `"peopleErased"`:

| locale | value |
|---|---|
| en | `"peopleArchived": "{count, plural, one {# employee archived} other {# employees archived}}"` |
| sv | `"peopleArchived": "{count, plural, one {# anställd arkiverad} other {# anställda arkiverade}}"` |
| nb | `"peopleArchived": "{count, plural, one {# ansatt arkivert} other {# ansatte arkivert}}"` |
| da | `"peopleArchived": "{count, plural, one {# medarbejder arkiveret} other {# medarbejdere arkiveret}}"` |
| fi | `"peopleArchived": "{count, plural, one {# työntekijä arkistoitu} other {# työntekijää arkistoitu}}"` |

- [ ] **Step 2: Write the failing tests**

In `people-section.test.tsx`, register the mock next to `eraseMock`:

```ts
const archiveMock = mockMutation("people.people.archivePeople")
```

Append inside `describe("selection")`:

```ts
    const ARCHIVE_CTA = /^Archive \d+ employees?$/

    it("offers bulk archive to an editor once an active person is selected", () => {
      orgRole = "editor"
      onQuery((ref) => queryRouter(ref))
      renderSection()
      expect(screen.queryByRole("button", { name: ARCHIVE_CTA })).toBeNull()
      selectRow("Alice Svensson")
      expect(
        screen.getByRole("button", { name: "Archive 1 employee" })
      ).toBeDefined()
      expect(screen.queryByRole("button", { name: CTA })).toBeNull()
      orgRole = "admin"
    })

    it("counts only active people in the archive label", async () => {
      onQuery((ref, args) =>
        queryRouter(ref, PEOPLE_WITH_ARCHIVED, BY_TITLE, args)
      )
      renderSection()
      await pickSelectOption(
        screen.getByRole("combobox", { name: m.toolbar.statusLabel }),
        m.toolbar.statusAll
      )
      await screen.findByText("Zara Archived")
      selectRow("Zara Archived")
      expect(screen.queryByRole("button", { name: ARCHIVE_CTA })).toBeNull()
      selectRow("Alice Svensson")
      expect(
        screen.getByRole("button", { name: "Archive 1 employee" })
      ).toBeDefined()
    })

    it("archives the selected active people in one chunk, toasts, and clears the selection", async () => {
      archiveMock.mockReset().mockResolvedValue({ archived: 2 })
      onQuery((ref) => queryRouter(ref))
      renderSection()
      selectRow("Alice Svensson")
      selectRow("Bob Larsson")
      fireEvent.click(screen.getByRole("button", { name: ARCHIVE_CTA }))
      fireEvent.click(
        screen.getByRole("button", { name: m.bulkArchive.confirm })
      )
      await waitFor(() => expect(toast.success).toHaveBeenCalled())
      expect(archiveMock).toHaveBeenCalledTimes(1)
      expect(archiveMock.mock.calls[0]?.[0]).toEqual({
        orgId: "org1",
        personIds: ["p1", "p2"],
      })
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
      expect(screen.queryByRole("button", { name: ARCHIVE_CTA })).toBeNull()
    })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/dashboard && bun run test -- components/people/people-section.test.tsx`
Expected: FAIL (no archive button).

- [ ] **Step 4: Create the dialog**

Create `apps/dashboard/components/people/bulk-archive-people-dialog.tsx`:

```tsx
"use client"

import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { PEOPLE_ARCHIVE_CHUNK_SIZE } from "@workspace/constants"
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
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { toast } from "@/lib/toast"

// The register's batch archive. Archiving is reversible, so there is no
// type-to-confirm gate: one sentence states the consequence and the primary
// action archives. The ids arrive in chunks of PEOPLE_ARCHIVE_CHUNK_SIZE (the
// backend refuses more per call), driven from here with visible progress,
// like bulk delete. A failure mid-loop leaves the archived chunks archived;
// they drop out of an "Active" register on their own, and confirming again
// finishes the rest. Controlled: the trigger lives in the register's toolbar.
export function BulkArchivePeopleDialog({
  open,
  onOpenChange,
  personIds,
  onArchived,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The ACTIVE part of the register's effective selection.
  personIds: readonly string[]
  onArchived: () => void
}) {
  const t = useTranslations("dashboard.people.bulkArchive")
  const tArchive = useTranslations("dashboard.people.archive")
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const archivePeople = useMutation(api.people.people.archivePeople)
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [failed, setFailed] = useState(false)
  const busy = progress !== null
  // The frozen total wins while busy: the prop prunes as chunks land.
  const count = progress?.total ?? personIds.length

  function handleOpenChange(next: boolean) {
    if (!next) setFailed(false)
    onOpenChange(next)
  }

  async function handleArchive() {
    if (busy) return
    const ids = [...personIds]
    if (ids.length === 0) {
      handleOpenChange(false)
      return
    }
    setProgress({ done: 0, total: ids.length })
    setFailed(false)
    try {
      let done = 0
      for (let start = 0; start < ids.length; start += PEOPLE_ARCHIVE_CHUNK_SIZE) {
        const chunk = ids.slice(start, start + PEOPLE_ARCHIVE_CHUNK_SIZE)
        await archivePeople({
          orgId,
          personIds: chunk as Id<"people">[],
        })
        done += chunk.length
        setProgress({ done, total: ids.length })
      }
      toast.success(tToast("peopleArchived", { count: ids.length }))
      onArchived()
      handleOpenChange(false)
    } catch {
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
          <div className="flex items-center gap-1.5">
            <AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>
            <HelpMorphButton label={tHelp("archivedPersonLabel")}>
              {tHelp("archivedPersonBody")}
            </HelpMorphButton>
          </div>
          <AlertDialogDescription>
            {t("dialogDescription", { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{tArchive("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              // Keep the dialog mounted; it closes itself on success.
              event.preventDefault()
              void handleArchive()
            }}
          >
            {progress !== null ? (
              <>
                <Spinner />
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

(`dashboard.people.archive.cancel` is added in Task 9; if Task 8 runs first, add the `archive` object's `cancel` key in all five locales here: en "Cancel", sv "Avbryt", nb "Avbryt", da "Annuller", fi "Peruuta", and let Task 9 add the rest of that object.)

- [ ] **Step 5: Wire the toolbar**

In `people-section.tsx`:

Imports: `import { BulkArchivePeopleDialog } from "@/components/people/bulk-archive-people-dialog"`.

State: `const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false)` and `const tBulkArchive = useTranslations("dashboard.people.bulkArchive")`.

After `selectedCount`, derive the active part of the selection:

```ts
  // Archiving addresses the ACTIVE part of the selection: an archived row
  // ticked under "All" is simply not touched, and the label counts only
  // what the action will do.
  const archivedById = useMemo(
    () => new Map(rows.map((row) => [row.personId, row.archivedAt !== null])),
    [rows]
  )
  const activeSelectedIds = [...selection.effective].filter(
    (personId) => archivedById.get(personId) === false
  )
  const activeSelectedCount = activeSelectedIds.length
```

In the toolbar's right-aligned group, BEFORE the destructive delete button:

```tsx
        {activeSelectedCount > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setBulkArchiveOpen(true)}
          >
            {tBulkArchive("cta", { count: activeSelectedCount })}
          </Button>
        )}
```

At the bottom, next to the delete dialog:

```tsx
      <BulkArchivePeopleDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        personIds={activeSelectedIds}
        onArchived={() => setSelected(new Set())}
      />
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/dashboard && bun run test -- components/people/people-section.test.tsx`
Expected: PASS. The pre-existing "puts the delete button last, hard against the right edge" test still holds because the archive button is inserted before it.

- [ ] **Step 7: Biome and stage**

Run: `bunx biome check apps/dashboard/components/people/bulk-archive-people-dialog.tsx apps/dashboard/components/people/people-section.tsx apps/dashboard/components/people/people-section.test.tsx`
Expected: no diagnostics.

Stage those files plus the message files. Commit message once approved: `feat(people): archive selected people from the register in bounded chunks`

---

### Task 9: Person page: badge, Archive and Reactivate

**Files:**
- Create: `apps/dashboard/components/people/archive-person-dialog.tsx`
- Modify: `apps/dashboard/components/people/person-actions-menu.tsx`
- Modify: `apps/dashboard/components/people/person-detail.tsx` (card header ~line 253-275)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.people.archive`, `dashboard.people.archivedOn`, `dashboard.toast.personArchived`, `dashboard.toast.personReactivated`)
- Test: `apps/dashboard/components/people/person-actions-menu.test.tsx`

**Interfaces:**
- Consumes `api.people.people.archivePerson` (existing) and `unarchivePerson` (Task 1).
- Produces `PersonActionsMenu` prop `archivedAt: number | null`.

- [ ] **Step 1: Add the strings**

`dashboard.people.archive` (new object after `"erase"`; if Task 8 already added `cancel`, complete the object):

en:
```json
      "archive": {
        "trigger": "Archive employee",
        "reactivateTrigger": "Reactivate employee",
        "title": "Archive {name}?",
        "reactivateTitle": "Reactivate {name}?",
        "description": "The employee leaves the active register, classification, pay mappings and counts. Their history is kept, and they can be reactivated.",
        "reactivateDescription": "The employee returns to the active register, classification and future pay mappings.",
        "confirm": "Archive",
        "reactivateConfirm": "Reactivate",
        "cancel": "Cancel",
        "error": "The employee could not be updated. Try again."
      }
```
sv:
```json
      "archive": {
        "trigger": "Arkivera anställd",
        "reactivateTrigger": "Återaktivera anställd",
        "title": "Arkivera {name}?",
        "reactivateTitle": "Återaktivera {name}?",
        "description": "Den anställda lämnar det aktiva registret, klassificeringen, lönekartläggningarna och antalen. Historiken behålls och personen kan återaktiveras.",
        "reactivateDescription": "Den anställda återgår till det aktiva registret, klassificeringen och kommande lönekartläggningar.",
        "confirm": "Arkivera",
        "reactivateConfirm": "Återaktivera",
        "cancel": "Avbryt",
        "error": "Den anställda kunde inte uppdateras. Försök igen."
      }
```
nb:
```json
      "archive": {
        "trigger": "Arkiver ansatt",
        "reactivateTrigger": "Reaktiver ansatt",
        "title": "Arkivere {name}?",
        "reactivateTitle": "Reaktivere {name}?",
        "description": "Den ansatte forlater det aktive registeret, klassifiseringen, lønnskartleggingene og antallene. Historikken beholdes, og personen kan reaktiveres.",
        "reactivateDescription": "Den ansatte går tilbake til det aktive registeret, klassifiseringen og kommende lønnskartlegginger.",
        "confirm": "Arkiver",
        "reactivateConfirm": "Reaktiver",
        "cancel": "Avbryt",
        "error": "Den ansatte kunne ikke oppdateres. Prøv igjen."
      }
```
da:
```json
      "archive": {
        "trigger": "Arkivér medarbejder",
        "reactivateTrigger": "Genaktivér medarbejder",
        "title": "Arkivér {name}?",
        "reactivateTitle": "Genaktivér {name}?",
        "description": "Medarbejderen forlader det aktive register, klassificeringen, lønkortlægningerne og antallene. Historikken bevares, og personen kan genaktiveres.",
        "reactivateDescription": "Medarbejderen vender tilbage til det aktive register, klassificeringen og kommende lønkortlægninger.",
        "confirm": "Arkivér",
        "reactivateConfirm": "Genaktivér",
        "cancel": "Annuller",
        "error": "Medarbejderen kunne ikke opdateres. Prøv igen."
      }
```
fi:
```json
      "archive": {
        "trigger": "Arkistoi työntekijä",
        "reactivateTrigger": "Palauta työntekijä aktiiviseksi",
        "title": "Arkistoidaanko {name}?",
        "reactivateTitle": "Palautetaanko {name} aktiiviseksi?",
        "description": "Työntekijä poistuu aktiivisesta rekisteristä, luokittelusta, palkkakartoituksista ja lukumääristä. Historia säilyy, ja henkilön voi palauttaa aktiiviseksi.",
        "reactivateDescription": "Työntekijä palaa aktiiviseen rekisteriin, luokitteluun ja tuleviin palkkakartoituksiin.",
        "confirm": "Arkistoi",
        "reactivateConfirm": "Palauta aktiiviseksi",
        "cancel": "Peruuta",
        "error": "Työntekijää ei voitu päivittää. Yritä uudelleen."
      }
```

`dashboard.people`, after `"archivedBadge"`:

| locale | value |
|---|---|
| en | `"archivedOn": "Archived {date}"` |
| sv | `"archivedOn": "Arkiverad {date}"` |
| nb | `"archivedOn": "Arkivert {date}"` |
| da | `"archivedOn": "Arkiveret {date}"` |
| fi | `"archivedOn": "Arkistoitu {date}"` |

`dashboard.toast`, after `"peopleArchived"`:

| locale | values |
|---|---|
| en | `"personArchived": "Employee archived", "personReactivated": "Employee reactivated"` |
| sv | `"personArchived": "Anställd arkiverad", "personReactivated": "Anställd återaktiverad"` |
| nb | `"personArchived": "Ansatt arkivert", "personReactivated": "Ansatt reaktivert"` |
| da | `"personArchived": "Medarbejder arkiveret", "personReactivated": "Medarbejder genaktiveret"` |
| fi | `"personArchived": "Työntekijä arkistoitu", "personReactivated": "Työntekijä palautettu aktiiviseksi"` |

- [ ] **Step 2: Write the failing tests**

In `person-actions-menu.test.tsx`:

Extend the `convex/react` mock and the api mock:

```ts
const archiveMock = vi.fn()
const unarchiveMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "people.assignments.assignPersonToRole") return assignMock
    if (ref === "people.erase.erasePersonAsOrg") return eraseMock
    if (ref === "people.people.archivePerson") return archiveMock
    if (ref === "people.people.unarchivePerson") return unarchiveMock
    return vi.fn()
  },
}))
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    people: {
      assignments: {
        assignPersonToRole: "people.assignments.assignPersonToRole",
      },
      erase: { erasePersonAsOrg: "people.erase.erasePersonAsOrg" },
      people: {
        updatePerson: "people.people.updatePerson",
        archivePerson: "people.people.archivePerson",
        unarchivePerson: "people.people.unarchivePerson",
      },
    },
  },
}))
```

Give `renderMenu` a second parameter `archivedAt: number | null = null` and pass `archivedAt={archivedAt}` to the component. Append tests:

```ts
  it("archives an active person from the menu and toasts", async () => {
    archiveMock.mockReset().mockResolvedValue(null)
    renderMenu()
    await openActionsMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: m.archive.trigger }))
    const dialog = screen.getByRole("alertdialog")
    expect(dialog.textContent).toContain("Archive Alex Doe?")
    fireEvent.click(screen.getByRole("button", { name: m.archive.confirm }))
    await waitFor(() => expect(archiveMock).toHaveBeenCalledWith({
      orgId: "org-1",
      personId: "p1",
    }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it("reactivates an archived person from the menu", async () => {
    unarchiveMock.mockReset().mockResolvedValue(null)
    renderMenu(undefined, 1_756_000_000_000)
    await openActionsMenu()
    expect(
      screen.queryByRole("menuitem", { name: m.archive.trigger })
    ).toBeNull()
    fireEvent.click(
      screen.getByRole("menuitem", { name: m.archive.reactivateTrigger })
    )
    fireEvent.click(
      screen.getByRole("button", { name: m.archive.reactivateConfirm })
    )
    await waitFor(() =>
      expect(unarchiveMock).toHaveBeenCalledWith({
        orgId: "org-1",
        personId: "p1",
      })
    )
  })

  it("offers archive to an editor", async () => {
    orgRole = "editor"
    renderMenu()
    await openActionsMenu()
    expect(
      screen.getByRole("menuitem", { name: m.archive.trigger })
    ).toBeDefined()
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/dashboard && bun run test -- components/people/person-actions-menu.test.tsx`
Expected: FAIL (no archive item).

- [ ] **Step 4: Create the dialog**

Create `apps/dashboard/components/people/archive-person-dialog.tsx`:

```tsx
"use client"

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
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { toast } from "@/lib/toast"

// One dialog for both directions of the person lifecycle: archive an active
// person, reactivate an archived one. Reversible, so a plain confirm with the
// consequence in one sentence, no type-to-confirm. The archive direction
// carries the concept help on its title; reactivation needs none. Stays on
// the page after either action (the page shows the new state), unlike
// erasure. Controlled: the trigger lives in PersonActionsMenu.
export function ArchivePersonDialog({
  open,
  onOpenChange,
  personId,
  displayName,
  archived,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId: Id<"people">
  displayName: string
  archived: boolean
}) {
  const t = useTranslations("dashboard.people.archive")
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  const { orgId } = useOrganization()
  const archivePerson = useMutation(api.people.people.archivePerson)
  const unarchivePerson = useMutation(api.people.people.unarchivePerson)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  function handleOpenChange(next: boolean) {
    if (!next) setFailed(false)
    onOpenChange(next)
  }

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      if (archived) {
        await unarchivePerson({ orgId, personId })
        toast.success(tToast("personReactivated"))
      } else {
        await archivePerson({ orgId, personId })
        toast.success(tToast("personArchived"))
      }
      handleOpenChange(false)
    } catch {
      setFailed(true)
      toast.error(tToast("error"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-1.5">
            <AlertDialogTitle>
              {archived
                ? t("reactivateTitle", { name: displayName })
                : t("title", { name: displayName })}
            </AlertDialogTitle>
            {!archived && (
              <HelpMorphButton label={tHelp("archivedPersonLabel")}>
                {tHelp("archivedPersonBody")}
              </HelpMorphButton>
            )}
          </div>
          <AlertDialogDescription>
            {archived ? t("reactivateDescription") : t("description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault()
              void handleConfirm()
            }}
          >
            {busy && <Spinner />}
            {archived ? t("reactivateConfirm") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 5: Wire the menu and the page**

In `person-actions-menu.tsx`:
- import `ArchivePersonDialog` from `@/components/people/archive-person-dialog`,
- add the prop `archivedAt: number | null` to the component's props,
- add state `const [archiveOpen, setArchiveOpen] = useState(false)` and `const tArchive = useTranslations("dashboard.people.archive")`,
- insert a menu item between Edit and the destructive Delete:

```tsx
          <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
            {archivedAt !== null
              ? tArchive("reactivateTrigger")
              : tArchive("trigger")}
          </DropdownMenuItem>
```

- render the dialog next to `EditPersonDialog`:

```tsx
      <ArchivePersonDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        personId={person.personId}
        displayName={person.displayName}
        archived={archivedAt !== null}
      />
```

- update the header comment: the menu holds Edit, Archive or Reactivate (member-level, reversible), and the admin-only erasure.

In `person-detail.tsx`:
- imports: `import { Badge } from "@workspace/ui/components/badge"`, `import { HelpMorphButton } from "@/components/help-morph-button"`, and add `useFormatter` to the `next-intl` import,
- `const tPeople = useTranslations("dashboard.people")`, `const tHelp = useTranslations("dashboard.help")`, `const format = useFormatter()`,
- replace the identity card's `<CardTitle>` line with:

```tsx
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{t("identityHeading")}</CardTitle>
                {/* The lifecycle state, with its date, and the concept help
                    anchored on the card title (never floating). Absent on an
                    active person: the common case carries no lifecycle chrome. */}
                {person.archivedAt !== null && (
                  <>
                    <Badge variant="outline">
                      {tPeople("archivedOn", {
                        date: format.dateTime(new Date(person.archivedAt), {
                          dateStyle: "medium",
                        }),
                      })}
                    </Badge>
                    <HelpMorphButton label={tHelp("archivedPersonLabel")}>
                      {tHelp("archivedPersonBody")}
                    </HelpMorphButton>
                  </>
                )}
              </div>
```

- pass `archivedAt={person.archivedAt}` to `PersonActionsMenu`.

Every other `PersonActionsMenu` call site (grep `<PersonActionsMenu`) gets `archivedAt` too; `renderMenu` in the test already does.

- [ ] **Step 6: Run the tests and typecheck**

Run: `cd apps/dashboard && bun run test -- components/people/ && bunx tsc --noEmit -p tsconfig.json`
Expected: PASS, no type errors.

- [ ] **Step 7: Biome and stage**

Run: `bunx biome check apps/dashboard/components/people/archive-person-dialog.tsx apps/dashboard/components/people/person-actions-menu.tsx apps/dashboard/components/people/person-actions-menu.test.tsx apps/dashboard/components/people/person-detail.tsx`
Expected: no diagnostics.

Stage those files plus the message files. Commit message once approved: `feat(people): archive and reactivate a person from their page`

---

### Task 10: The guide, in five locales, and the docs sync

**Files:**
- Modify (all five locales under `apps/dashboard/content/docs/<locale>/`): `people-register.mdx`, `importing-people.mdx`, `person-details-and-salary.mdx`, `erasing-a-person.mdx`, `gdpr-and-erasure.mdx`, `glossary.mdx`
- Test: `apps/dashboard/lib/docs/docs-guards.test.ts` (existing guards)

**Interfaces:** none; content only. Headings must be inserted at the SAME position in every locale (guard 8 checks structural parity).

- [ ] **Step 1: `people-register.mdx`**

en: in "Reading the table", after the "Suggested" badge sentence, add:

```
A person who has left shows an "Archived" badge next to their name and is
hidden unless the status filter includes archived people.
```

In "Searching and filtering", after "part-time only)", change the sentence to read "...and FTE (all employees, full-time only, or part-time only), and a status filter shows active employees (the default), archived employees, or all;". After "## Selecting rows and bulk delete" section, insert a new section:

```
## Archiving employees who have left

Someone who has left the organization is archived, not deleted: select their
rows and choose the archive action naming how many employees are selected.
The dialog states what archiving does and archives them in batches with a
live count. An archived person leaves the active register, classification,
pay mappings and counts, keeps their salary history and role assignment,
and can be reactivated from their own page. Archiving is open to every
member; only deletion is admin-only. A payroll import can also archive
people who are missing from the file; see
[Importing people](/docs/importing-people).
```

sv (same positions):
```
En person som har slutat visas med brickan "Arkiverad" vid namnet och döljs
om inte statusfiltret tar med arkiverade personer.
```
"...och omfattning (alla anställda, bara heltid eller bara deltid), och ett statusfilter visar aktiva anställda (förvalet), arkiverade anställda eller alla;"
```
## Arkivera anställda som har slutat

Den som har lämnat organisationen arkiveras, inte raderas: markera raderna
och välj arkiveringsåtgärden som anger hur många anställda som är markerade.
Dialogen säger vad arkivering innebär och arkiverar dem i omgångar med en
löpande räkning. En arkiverad person lämnar det aktiva registret,
klassificeringen, lönekartläggningarna och antalen, behåller sin
lönehistorik och rolltilldelning, och kan återaktiveras från sin egen sida.
Arkivering är öppen för alla medlemmar; bara radering kräver admin. En
löneimport kan också arkivera personer som saknas i filen; se
[Importera personer](/docs/importing-people).
```

nb:
```
En person som har sluttet vises med merket "Arkivert" ved navnet og skjules
med mindre statusfilteret tar med arkiverte personer.
```
"...og stillingsandel (alle ansatte, bare heltid eller bare deltid), og et statusfilter viser aktive ansatte (standard), arkiverte ansatte eller alle;"
```
## Arkivere ansatte som har sluttet

Den som har forlatt organisasjonen arkiveres, ikke slettes: velg radene og
velg arkiveringshandlingen som oppgir hvor mange ansatte som er valgt.
Dialogen sier hva arkivering innebærer og arkiverer dem i omganger med en
løpende telling. En arkivert person forlater det aktive registeret,
klassifiseringen, lønnskartleggingene og antallene, beholder
lønnshistorikken og rolletildelingen sin, og kan reaktiveres fra sin egen
side. Arkivering er åpent for alle medlemmer; bare sletting krever admin. En
lønnsimport kan også arkivere personer som mangler i filen; se
[Importere personer](/docs/importing-people).
```

da:
```
En person, der er stoppet, vises med mærket "Arkiveret" ved navnet og skjules,
medmindre statusfilteret medtager arkiverede personer.
```
"...og stilling (alle medarbejdere, kun fuldtid eller kun deltid), og et statusfilter viser aktive medarbejdere (standard), arkiverede medarbejdere eller alle;"
```
## Arkivér medarbejdere, der er stoppet

Den, der har forladt organisationen, arkiveres, ikke slettes: vælg rækkerne
og vælg arkiveringshandlingen, der angiver hvor mange medarbejdere der er
valgt. Dialogen siger, hvad arkivering betyder, og arkiverer dem i omgange
med en løbende optælling. En arkiveret person forlader det aktive register,
klassificeringen, lønkortlægningerne og antallene, beholder sin lønhistorik
og rolletildeling og kan genaktiveres fra sin egen side. Arkivering er åben
for alle medlemmer; kun sletning kræver admin. En lønimport kan også
arkivere personer, der mangler i filen; se
[Importér personer](/docs/importing-people).
```

fi:
```
Lähtenyt henkilö näkyy nimensä vieressä merkillä "Arkistoitu" ja on
piilotettu, ellei tilasuodatin sisällytä arkistoituja henkilöitä.
```
"...ja työaika (kaikki työntekijät, vain kokoaikaiset tai vain osa-aikaiset), ja tilasuodatin näyttää aktiiviset työntekijät (oletus), arkistoidut työntekijät tai kaikki;"
```
## Lähteneiden työntekijöiden arkistointi

Organisaatiosta lähtenyt henkilö arkistoidaan, ei poisteta: valitse rivit ja
valitse arkistointitoiminto, joka kertoo valittujen työntekijöiden määrän.
Valintaikkuna kertoo, mitä arkistointi tekee, ja arkistoi heidät erissä
laskurin päivittyessä. Arkistoitu henkilö poistuu aktiivisesta rekisteristä,
luokittelusta, palkkakartoituksista ja lukumääristä, säilyttää
palkkahistoriansa ja roolinsa ja voidaan palauttaa aktiiviseksi omalta
sivultaan. Arkistointi on avoin kaikille jäsenille; vain poisto vaatii
admin-oikeudet. Palkkatuonti voi myös arkistoida tiedostosta puuttuvat
henkilöt; katso [Henkilöiden tuonti](/docs/importing-people).
```

Use each locale's existing link text for the importing-people page (read the locale's `people-register.mdx` Related list and reuse that title verbatim instead of the drafts above where they differ).

- [ ] **Step 2: `importing-people.mdx`**

en, step 4, append to the bullet:

```
   The review also lists people the file brings back (archived employees
   who are reactivated because the file lists them) and active employees
   who are missing from the file. Missing employees stay active unless you
   tick "Archive these employees"; the box is off by default, so a file
   covering only part of the organization never archives the rest.
```

and after "created, updated, already up to date, or skipped." add ", plus how many were reactivated or archived when that happened."

sv:
```
   Granskningen listar också personer som filen tar tillbaka (arkiverade
   anställda som återaktiveras eftersom filen listar dem) och aktiva
   anställda som saknas i filen. De som saknas förblir aktiva om du inte
   bockar i "Arkivera dessa anställda"; rutan är av som förval, så en fil
   som bara täcker en del av organisationen arkiverar aldrig resten.
```
"... skapades, uppdaterades, redan var aktuella eller hoppades över, samt hur många som återaktiverades eller arkiverades när det skedde."

nb:
```
   Gjennomgangen lister også personer filen tar tilbake (arkiverte ansatte
   som reaktiveres fordi filen lister dem) og aktive ansatte som mangler i
   filen. De som mangler forblir aktive med mindre du huker av "Arkiver
   disse ansatte"; boksen er av som standard, så en fil som bare dekker en
   del av organisasjonen arkiverer aldri resten.
```
"... ble opprettet, oppdatert, allerede var oppdatert eller hoppet over, samt hvor mange som ble reaktivert eller arkivert når det skjedde."

da:
```
   Gennemgangen viser også personer, filen bringer tilbage (arkiverede
   medarbejdere, der genaktiveres, fordi filen nævner dem), og aktive
   medarbejdere, der mangler i filen. De manglende forbliver aktive,
   medmindre du sætter kryds ved "Arkivér disse medarbejdere"; feltet er
   slået fra som standard, så en fil, der kun dækker en del af
   organisationen, arkiverer aldrig resten.
```
"... blev oprettet, opdateret, allerede var opdateret eller sprunget over, samt hvor mange der blev genaktiveret eller arkiveret, når det skete."

fi:
```
   Tarkistus luettelee myös henkilöt, jotka tiedosto tuo takaisin
   (arkistoidut työntekijät, jotka palautetaan aktiivisiksi, koska tiedosto
   luettelee heidät), sekä aktiiviset työntekijät, jotka puuttuvat
   tiedostosta. Puuttuvat pysyvät aktiivisina, ellet valitse "Arkistoi nämä
   työntekijät"; valinta on oletuksena pois päältä, joten vain osan
   organisaatiosta kattava tiedosto ei koskaan arkistoi muita.
```
"... luotiin, päivitettiin, oli jo ajan tasalla tai ohitettiin, sekä kuinka moni palautettiin aktiiviseksi tai arkistoitiin, kun niin tapahtui."

- [ ] **Step 3: `person-details-and-salary.mdx`**

en, end of "Identity and classification":

```
Someone who has left is archived from the same menu with "Archive employee":
the card then shows an "Archived" badge with the date, and the menu offers
"Reactivate employee" instead. See [The people register](/docs/people-register)
for what archiving changes.
```
sv:
```
Den som har slutat arkiveras från samma meny med "Arkivera anställd": kortet
visar då brickan "Arkiverad" med datumet, och menyn erbjuder i stället
"Återaktivera anställd". Se [Personregistret](/docs/people-register) för vad
arkivering ändrar.
```
nb:
```
Den som har sluttet arkiveres fra samme meny med "Arkiver ansatt": kortet
viser da merket "Arkivert" med datoen, og menyen tilbyr i stedet "Reaktiver
ansatt". Se [Personregisteret](/docs/people-register) for hva arkivering
endrer.
```
da:
```
Den, der er stoppet, arkiveres fra samme menu med "Arkivér medarbejder":
kortet viser så mærket "Arkiveret" med datoen, og menuen tilbyder i stedet
"Genaktivér medarbejder". Se [Personregistret](/docs/people-register) for,
hvad arkivering ændrer.
```
fi:
```
Lähtenyt henkilö arkistoidaan samasta valikosta kohdasta "Arkistoi
työntekijä": kortti näyttää silloin merkin "Arkistoitu" päivämäärineen, ja
valikko tarjoaa sen sijaan "Palauta työntekijä aktiiviseksi". Katso
[Henkilörekisteri](/docs/people-register), mitä arkistointi muuttaa.
```
(Reuse each locale's existing link title for the register page from its Related list.)

- [ ] **Step 4: `erasing-a-person.mdx`**

en, replace the lead paragraph with:

```
Erasing an employee is a true, permanent deletion, not an archive: it
exists for the [GDPR right to erasure](/docs/gdpr-and-erasure), so there
is no way to undo it or bring the person back afterward. Someone who has
simply left the organization is archived instead, from the
[people register](/docs/people-register) or their own page, which keeps
their history for next year's follow-up.
```
sv:
```
Att radera en anställd är en verklig, permanent radering, inte en
arkivering: den finns för [rätten till radering enligt GDPR](/docs/gdpr-and-erasure),
så den kan inte ångras och personen kan inte hämtas tillbaka efteråt. Den
som bara har slutat arkiveras i stället, från [personregistret](/docs/people-register)
eller sin egen sida, vilket behåller historiken till nästa års uppföljning.
```
nb:
```
Å slette en ansatt er en ekte, permanent sletting, ikke en arkivering: den
finnes for [retten til sletting etter GDPR](/docs/gdpr-and-erasure), så den
kan ikke angres, og personen kan ikke hentes tilbake etterpå. Den som bare
har sluttet, arkiveres i stedet, fra [personregisteret](/docs/people-register)
eller sin egen side, noe som beholder historikken til neste års oppfølging.
```
da:
```
At slette en medarbejder er en ægte, permanent sletning, ikke en arkivering:
den findes for [retten til sletning efter GDPR](/docs/gdpr-and-erasure), så
den kan ikke fortrydes, og personen kan ikke hentes tilbage bagefter. Den,
der blot er stoppet, arkiveres i stedet fra [personregistret](/docs/people-register)
eller sin egen side, hvilket bevarer historikken til næste års opfølgning.
```
fi:
```
Työntekijän poistaminen on aito, pysyvä poisto, ei arkistointi: se on
olemassa [GDPR:n mukaista poisto-oikeutta](/docs/gdpr-and-erasure) varten,
joten sitä ei voi kumota eikä henkilöä palauttaa jälkikäteen. Pelkästään
lähtenyt henkilö arkistoidaan sen sijaan [henkilörekisteristä](/docs/people-register)
tai omalta sivultaan, mikä säilyttää historian ensi vuoden seurantaa varten.
```
(Match each locale's current opening sentence and link titles; only the added second sentence is new.)

- [ ] **Step 5: `gdpr-and-erasure.mdx`**

en, insert after the "Erasing an employee" section and before "Erasing your own account":

```
## Archiving is not erasure

An employee who leaves is archived, not erased: their record, salary
history and role assignment are kept in full, because next year's pay
mapping follows up on this year's actions and the frozen documentation
refers to them. Archiving takes the person out of the active register,
classification, pay mappings and counts, and can be undone. The right to
erasure remains available at any time through the erasure path above.
```
sv:
```
## Arkivering är inte radering

En anställd som slutar arkiveras, inte raderas: posten, lönehistoriken och
rolltilldelningen behålls i sin helhet, eftersom nästa års lönekartläggning
följer upp årets åtgärder och den frysta dokumentationen hänvisar till dem.
Arkivering tar personen ur det aktiva registret, klassificeringen,
lönekartläggningarna och antalen och kan ångras. Rätten till radering finns
kvar när som helst via raderingsvägen ovan.
```
nb:
```
## Arkivering er ikke sletting

En ansatt som slutter, arkiveres, ikke slettes: oppføringen,
lønnshistorikken og rolletildelingen beholdes i sin helhet, fordi neste års
lønnskartlegging følger opp årets tiltak og den frosne dokumentasjonen viser
til dem. Arkivering tar personen ut av det aktive registeret,
klassifiseringen, lønnskartleggingene og antallene, og kan angres. Retten
til sletting finnes fortsatt når som helst via slettingsveien ovenfor.
```
da:
```
## Arkivering er ikke sletning

En medarbejder, der stopper, arkiveres, ikke slettes: posten, lønhistorikken
og rolletildelingen bevares fuldt ud, fordi næste års lønkortlægning følger
op på årets tiltag, og den frosne dokumentation henviser til dem. Arkivering
tager personen ud af det aktive register, klassificeringen,
lønkortlægningerne og antallene og kan fortrydes. Retten til sletning er
fortsat tilgængelig når som helst via sletningsvejen ovenfor.
```
fi:
```
## Arkistointi ei ole poistamista

Lähtevä työntekijä arkistoidaan, ei poisteta: tietue, palkkahistoria ja
roolitehtävä säilyvät kokonaisuudessaan, koska ensi vuoden palkkakartoitus
seuraa tämän vuoden toimenpiteitä ja jäädytetty dokumentaatio viittaa
niihin. Arkistointi poistaa henkilön aktiivisesta rekisteristä,
luokittelusta, palkkakartoituksista ja lukumääristä, ja sen voi kumota.
Oikeus poistoon on käytettävissä milloin tahansa yllä olevan poistopolun
kautta.
```

Also change the en lead sentence "blueprnt supports the GDPR right to erasure with a true, permanent deletion, never a soft "deactivated" flag." to "blueprnt supports the GDPR right to erasure with a true, permanent deletion; a leaver's archive (below) is a lifecycle state, never a substitute for erasure." and mirror the change in the four locales' lead sentence.

- [ ] **Step 6: `glossary.mdx`**

Insert a new entry after "## Anchor role" and before "## Assessment" in EVERY locale (same position; the guard checks heading order):

en:
```
## Archived employee

An archived employee has left the organization and is kept with their
salary history and role assignment, outside the active register,
classification, pay mappings and counts. Archiving can be undone.

Do not confuse archiving with erasure: erasure is the permanent GDPR
deletion and cannot be undone. See
[The people register](/docs/people-register).
```
sv (heading `## Arkiverad anställd`):
```
En arkiverad anställd har lämnat organisationen och behålls med sin
lönehistorik och rolltilldelning, utanför det aktiva registret,
klassificeringen, lönekartläggningarna och antalen. Arkivering kan ångras.

Blanda inte ihop arkivering med radering: radering är den permanenta
GDPR-raderingen och kan inte ångras. Se
[Personregistret](/docs/people-register).
```
nb (heading `## Arkivert ansatt`):
```
En arkivert ansatt har forlatt organisasjonen og beholdes med
lønnshistorikken og rolletildelingen sin, utenfor det aktive registeret,
klassifiseringen, lønnskartleggingene og antallene. Arkivering kan angres.

Ikke forveksle arkivering med sletting: sletting er den permanente
GDPR-slettingen og kan ikke angres. Se
[Personregisteret](/docs/people-register).
```
da (heading `## Arkiveret medarbejder`):
```
En arkiveret medarbejder har forladt organisationen og bevares med sin
lønhistorik og rolletildeling, uden for det aktive register,
klassificeringen, lønkortlægningerne og antallene. Arkivering kan fortrydes.

Forveksl ikke arkivering med sletning: sletning er den permanente
GDPR-sletning og kan ikke fortrydes. Se
[Personregistret](/docs/people-register).
```
fi (heading `## Arkistoitu työntekijä`):
```
Arkistoitu työntekijä on lähtenyt organisaatiosta ja säilyy
palkkahistorioineen ja roolitehtävineen aktiivisen rekisterin, luokittelun,
palkkakartoitusten ja lukumäärien ulkopuolella. Arkistoinnin voi kumota.

Älä sekoita arkistointia poistoon: poisto on pysyvä GDPR-poisto, eikä sitä
voi kumota. Katso [Henkilörekisteri](/docs/people-register).
```

- [ ] **Step 7: Run the guards and the sync**

Run: `cd apps/dashboard && bun run test -- lib/docs/docs-guards.test.ts`
Expected: PASS (locale parity, links, heading structure, glossary terms).

Run: `cd apps/dashboard && bun run docs:sync`
Expected: the six changed pages per locale re-embed; unchanged pages report no work.

- [ ] **Step 8: Stage**

Stage `apps/dashboard/content/docs/` (all five locales). Commit message once approved: `docs(guide): archiving a leaver, in the register, the import and the person page`

---

### Task 11: Whole-suite verification and the dev-deployment pass

**Files:** none new.

- [ ] **Step 1: Full test run and Biome**

Run from the repo root: `bun run test` (Turborepo runs every package) and `bunx biome check .`
Expected: every package green; Biome at zero.

- [ ] **Step 2: Typecheck everything**

Run: `bun run typecheck` (or the repo's turbo typecheck task; check `package.json` scripts).
Expected: no errors.

- [ ] **Step 3: Push to the dev deployment**

Run: `cd packages/backend && bunx convex dev --once`
Expected: the deployment accepts the functions (no schema change, so no data migration).

- [ ] **Step 4: Browser pass on localhost:3001 (owner keeps a signed-in tab)**

Verify, with the Chrome tools, never entering credentials:
1. People register: the status select shows Active by default; switch to Archived and All; an archived row carries the badge.
2. Select two active people: "Archive 2 employees" appears before the delete button; confirm; toast; the rows leave the Active view.
3. Open an archived person: the badge with the date and the help; the menu offers Reactivate; confirm; the badge disappears and the toast shows.
4. Import a CSV that omits one active person and includes one archived person: the review shows "Returning (reactivated)" 1 and "Missing from the file" 1 with both lists; leave the box unticked, confirm: done screen shows Reactivated 1 and no Archived row; the missing person is still active. Repeat with the box ticked: the importing screen's total includes the leaver; the done screen shows Archived 1; the audit log shows the import row with both stats and a "Person reactivated" row.
5. Audit log: the "Person reactivated" event and the two new fields render with labels, never raw keys.

- [ ] **Step 5: Report**

Present the full diff grouped by task with the file-by-file summary, and the commit messages queued above, for the owner's approval before any commit.

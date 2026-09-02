# Leaver archiving: reachable archive, import-driven archiving, reactivation

**Date:** 2026-09-02
**Source:** the Sysarb help-center review (G02 in the gap report, 2026-09-02) and brainstorming with the product owner the same day.
**Status:** approved design, pending implementation plan.

## Problem

`archivePerson` exists (`packages/backend/convex/people/people.ts`), is audited
and tested, and `people.archivedAt` is already read by every path that
matters: the pay-mapping preconditions and freeze population
(`payMapping/runs.ts`), classification, assignment maps, headcount, the
person page's pay comparison, and the assistant's insights. Yet nothing in
`apps/dashboard` calls it, there is no reactivation, the import never
proposes archiving people who are missing from a new payroll file, and the
import's own dry-run diff (`getImportBaseline`) hides archived people while
the upsert core (`upsertPersonByExternalRefCore`) still finds them by
employee number. Two consequences:

1. **A leaver has no path but erasure.** `erasePersonAsOrg` is an
   irreversible hard delete of the person, their `payRecords` and
   `personAssignments`, which is exactly the history next year's
   follow-up step and the report's previous-year chapter read. Routing
   leavers through the GDPR erasure path is also the wrong posture: art. 17
   is a right, not a lifecycle operation, and art. 5.1(d) wants accuracy,
   which "archived" expresses and "deleted" does not.
2. **A returning archived person is silently mishandled.** The review step's
   preview counts them as "new" (the baseline excludes archived people), but
   the import patches the archived row and leaves it archived, so the person
   is in the file, "imported", and invisible.

Sysarb's model, for reference: a leaver is deactivated, never deleted; the
import's review step lists "employees missing from the file" and asks
whether to deactivate them, with an openable list; historical analyses stay
comparable because the row survives.

## Decisions (settled with the product owner, 2026-09-02)

1. **Approach A: server-driven inside the import action.** `importPayroll`
   takes an `archiveMissing` flag; the server recomputes the missing set at
   import time and archives it in bounded chunks with the same progress row
   as the rest of the import. Rejected: a client-driven loop after import
   (a closed tab leaves it half-done, progress does not cover it) and a
   fifth wizard step (a whole step for a usually-empty case).
2. **The "missing from the file" checkbox defaults OFF.** The bucket and its
   list always show when non-empty; archiving happens only when HR ticks
   "Archive these N people". A partial file (one department) can never
   archive the rest by accident.
3. **Returning archived people are reactivated automatically.** The file says
   they are employed; leaving them archived would be wrong data. The review
   step shows the count and the list, with no checkbox.
4. **Editor and admin may archive and reactivate.** Archiving is reversible
   register work, the same tier as creating or editing a person. Erasure
   stays admin-only.
5. **Archiving does not end the open role assignment** (today's behaviour).
   Every consumer already filters on the person, and a reactivated person
   gets their classification back as it was.
6. **No leave date is imported or entered.** `archivedAt` is the moment of
   archiving. `archivedAt` is NOT added to `PERSON_IMPORT_OPTIONAL_FIELDS`:
   payroll exports carry no leaver flag, and a mapped column would archive
   silently on a mis-mapping.
7. **No bulk reactivation.** Reactivation is rare and lives on the person
   page.
8. **An archived person stays readable and editable** (details dialog,
   salary history). The register's default filter is the gate; no new
   locking.

## Backend

No schema change. `people.archivedAt` (`people/tables.ts`) is the whole model.

### Mutations

- **`unarchivePerson({ personId })`** (`people/people.ts`, `orgMutation`, so
  editor and admin like `archivePerson`). No-op when the person is active.
  Clears `archivedAt` and writes a `person.unarchived` audit row with
  `changes: { archivedAt: { from: <ts>, to: null } }`.
- **`archivePeople({ personIds })`** (`people/people.ts`, `orgMutation`).
  Accepts at most `PEOPLE_ARCHIVE_CHUNK_SIZE = 50` ids (a constant exported
  from `people/importDiff.ts` next to `IMPORT_CHUNK_SIZE`, so the client and
  the import share one bound); rejects a larger array with an `appError`.
  Archives each active person in the caller's org (a cross-org or unknown
  id is rejected fail-closed, as `requireOwnPerson` does), skips
  already-archived ids, writes one `person.archived` row per archived
  person, returns `{ archived: number }`.

### Audit

- New event key `personUnarchived: "person.unarchived"` in `AUDIT_EVENTS`
  (`lib/audit.ts`), payload `{ personId: string; changes: Changes }` in
  `AuditPayloads` (`lib/auditPayloads.ts`, next to `person.archived`),
  subject deriver `{ kind: "person", id: payload.personId }` in
  `AUDIT_SUBJECTS` (the scrub on erasure must reach this row too), and the
  `people` category falls out of the `person.` prefix in `categoryForEvent`.
  Label `dashboard.auditLog.events.personUnarchived` in every locale. The
  `archivedAt` field label already exists.
- `people.imported` gains two flat stats, `peopleArchived` and
  `peopleReactivated`, in `AuditPayloads`, in `logImportCompleted`
  (`people/importHelpers.ts`), and as `dashboard.auditLog.fields.*` labels in
  every locale (the field-label coverage test guards them).

### Import diff (pure, `people/importDiff.ts`)

- `BaselinePerson` gains `archivedAt?: number`. `getImportBaseline` returns
  archived people too (the `archivedAt === undefined` filter goes; the
  `externalRef !== undefined` filter stays), so the preview and the import
  see the same population.
- `ImportPreviewDiff` gains:
  - `people.returning: number`: rows whose baseline person is archived.
    Such a row ALSO counts as `updated` or `unchanged` on its fields, as
    today, so the existing three counts keep their meaning.
  - `returningPeople: Array<{ externalRef; displayName }>`.
  - `missingFromFile: Array<{ externalRef; displayName }>`: baseline people
    that are active, have an employee number, and whose number is not among
    the incoming rows. Computed over the FULL normalized row set, before any
    user-elected skip, so a name-mismatched row that HR leaves out still
    counts as present and is never archived.
  People without an employee number can never appear in `missingFromFile`
  (they are not in the baseline map at all).

### Upsert core (`people/people.ts`)

- When `existing.archivedAt !== undefined`, the update path clears it in the
  same patch and writes a `person.unarchived` row (with the `archivedAt`
  diff) in addition to the `person.updated` row when other fields changed.
  A returning person with no other changes is `outcome: "unchanged"` plus
  `reactivated: true`; no `person.updated` row is written for them.
- The return type gains `reactivated: boolean`. `importChunk` sums it into
  `peopleReactivated`.

### `importPayroll` action (`people/import.ts`)

- New optional arg `archiveMissing: boolean`.
- After the row chunks, when `archiveMissing` is true: the action asks a new
  internal query `getActiveExternalRefs({ orgId })` (active people with an
  employee number: `{ personId, externalRef }`), subtracts every normalized
  incoming `externalRef` (pre-skip, see above), and archives the remainder
  through a new internal mutation `archiveChunk({ orgId, actorId, importId,
  personIds, processedBefore, total })` in sequential chunks of
  `PEOPLE_ARCHIVE_CHUNK_SIZE`. `archiveChunk` shares its core with
  `archivePeople` (one `archivePeopleCore(ctx, ...)` in `people/people.ts`,
  used by both, like the upsert core), and writes the progress row through
  `setImportProgressCore` so the importing screen keeps counting.
- Progress: the initial `setImportProgress` sets `total = rows.length +
  missing.length` when archiving is requested, so the bar does not park at
  100 % while leavers are archived. The missing count for that initial
  total comes from the same `getActiveExternalRefs` query, run once before
  the loop (and reused for the archive set after the loop, minus the
  incoming refs; a person created by the import itself is by definition
  present in the file).
- `importResultValidator` and the action's result gain `peopleArchived` and
  `peopleReactivated`. Both flow into `logImportCompleted`.
- The employee-count recompute that already runs post-import covers the
  archived leavers (it filters on `archivedAt`).

## Import wizard (`apps/dashboard/components/people/import/`)

### Review step (`review-step.tsx`)

- The Employees group of `CHANGE_GROUPS` gains two lines after "Already up
  to date": **"Returning (reactivated)"** and **"Missing from the file"**,
  with the same icon-row anatomy and the same skeleton-while-loading count.
  `countForKey` maps them to `diff.people.returning` and
  `diff.missingFromFile.length`.
- Below the summary grid, only once the preview has landed and only when the
  count is above zero (so nothing on screen moves):
  - **Returning list**: a bordered list of `displayName` and `externalRef`
    rows, capped with the existing "Show all N" reveal
    (`UPDATED_PEOPLE_SHOWN` applies).
  - **Missing from the file**: an amber Alert in the name-mismatch anatomy
    (`WARNING_ALERT_CLASS`): a title, one sentence saying these people are
    active in the register but not in the file, the list (same cap and
    reveal), then a `Checkbox` + `Label` "Archive these N people",
    default unchecked. The Alert title carries a `HelpMorphButton` with
    `dashboard.help.archivedPerson` (what archiving is, and that it can be
    undone unlike deletion).
- `handleConfirm` passes `archiveMissing: true` only when the checkbox is
  ticked (the arg is omitted otherwise, like the other optional args).
- `onImportSuccess` receives `archived` and `reactivated` alongside the
  existing counts.

### Importing step (`importing-step.tsx`)

No change in code: it renders `processed / total` from the progress row,
and the action now sets `total` to rows plus leavers when archiving was
requested.

### Done step (`import-done-step.tsx`)

Two new rows, "Reactivated" and "Archived", rendered only when their count
is above zero, so an ordinary import's done screen is unchanged.

## Register and person page (`apps/dashboard/components/people/`)

### Status filter (`people-section.tsx`)

- A new `Select` in the filter row after the FTE filter: **Active**
  (default), **Archived**, **All**. Values `active | archived | all`.
- `listPeople` is called with `includeArchived: status !== "active"`. A
  filter-only column `archived` (accessor `row.archivedAt !== null`) with
  an `exactString`-style boolean match narrows "Archived"; "All" sets no
  column filter. Sorting, search, paging and the result count work
  unchanged; the skeleton is unchanged.
- The filter counts as an active filter for `filtersActive` only when it is
  not "Active" (the default must not show the result count on its own).

### Archived badge

- Register rows: an "Archived" `Badge` (outline) after the name link, inside
  the cell's block flex wrapper (the skeleton rule), only on archived rows.
- Person page (`person-detail.tsx`): the same badge next to the identity
  card's title, with the archive date formatted by the page's date
  formatter, plus a `HelpMorphButton` after the card title (the title is
  the anchor) reusing `dashboard.help.archivedPerson`.

### Bulk archive

- Toolbar (`people-section.tsx`): when the effective selection contains at
  least one ACTIVE person, an outline `Button` "Archive N" appears before
  the destructive delete button (which stays admin-only). N counts the
  active people in the selection; archived people in the selection are
  simply not touched.
- **`BulkArchivePeopleDialog`** (new file `bulk-archive-people-dialog.tsx`,
  the bulk-delete dialog's anatomy without the type-to-confirm): an
  `AlertDialog` whose title carries the concept help, one sentence stating
  the consequence (the people leave the active register, classification,
  pay mappings and counts; their history is kept and they can be
  reactivated), Cancel, and the primary "Archive" action. On confirm it
  loops `archivePeople` over the active ids in chunks of
  `PEOPLE_ARCHIVE_CHUNK_SIZE` with the same NumberFlow `done / total`
  progress as bulk delete, then `toast.success(t("dashboard.toast.peopleArchived", { count }))`
  and clears the selection. A failure mid-loop leaves the archived ones
  archived, shows the dialog's error line, and confirming again finishes
  the rest (the reactive query has already dropped the archived rows from
  an "Active" view, so the effective selection prunes on its own).

### Person page actions (`person-actions-menu.tsx`)

- A new non-destructive item above the destructive delete: **"Archive"**
  when the person is active, **"Reactivate"** when archived. Visible to
  editor and admin (no `canErase` gate).
- **`ArchivePersonDialog`** (new file `archive-person-dialog.tsx`): an
  `AlertDialog` used for both directions, parametrised by the person's
  state. Archive: the consequence sentence above and the concept help on
  the title. Reactivate: one sentence (the person returns to the active
  register, classification and future pay mappings). Calls `archivePerson`
  or `unarchivePerson`, toasts `personArchived` / `personReactivated`, and
  stays on the page (the page shows the new state; no navigation, unlike
  erasure).

## i18n (en first, then sv, nb, da, fi, with the cross-locale read)

- `dashboard.people.toolbar.statusActive`, `statusArchived`, `statusAll`, and
  a `statusLabel` for the trigger's `aria-label`.
- `dashboard.people.archivedBadge`, `archivedOn` ("Archived {date}").
- `dashboard.people.archive.*`: `trigger`, `reactivateTrigger`, `title`,
  `reactivateTitle`, `description`, `reactivateDescription`, `confirm`,
  `reactivateConfirm`, `cancel`, `error`.
- `dashboard.people.bulkArchive.*`: `cta` ("{count, plural, ...}"),
  `dialogTitle`, `dialogDescription`, `confirm`, `progress`
  (`<done></done> / <total></total>`, tag-based like bulk delete), `error`.
- `dashboard.people.import.review.changes.*`: `returningPeople`,
  `missingPeople`, `missingTitle`, `missingBody`, `archiveMissing`.
- `dashboard.people.import.done.*`: `reactivated`, `archived`.
- `dashboard.help.archivedPerson` (two sentences, at most 200 characters in
  en and 240 elsewhere; `messages.test.ts` enforces the cap).
- `dashboard.toast.personArchived`, `personReactivated`, `peopleArchived`
  (with `count`).
- `dashboard.auditLog.events.personUnarchived`;
  `dashboard.auditLog.fields.peopleArchived`, `peopleReactivated`.

Terms: sv "Arkivera / Återaktivera / Arkiverad", nb "Arkiver / Reaktiver /
Arkivert", da "Arkivér / Genaktivér / Arkiveret", fi "Arkistoi / Palauta
aktiiviseksi / Arkistoitu"; keep the locale's existing wording for the role
archive where a neighbouring key already uses it.

## Documentation (`apps/dashboard/content/docs/<locale>/`, all five, then `bun run docs:sync`)

- `people-register`: the status filter, the badge, and bulk archive (a new
  section next to bulk delete).
- `importing-people`: step 4's two new lines, the returning behaviour, and
  the checkbox with its default.
- `person-details-and-salary`: Archive and Reactivate in the actions menu,
  the badge.
- `erasing-a-person`: the lead paragraph states that someone who has left is
  archived, not erased, and links to the register page; erasure stays the
  GDPR path only. The "What erasure does not do" section is unchanged.
- `gdpr-and-erasure`: one paragraph on archiving versus erasure (an archived
  person's data is retained, in full, because the pay-mapping history and
  next year's follow-up read it; erasure remains available at any time).
- `glossary`: an "Archived (person)" entry.
- `audit-log` describes event families and never enumerates person events
  (verified 2026-09-02), so it is unchanged.
- The docs drift guards (`lib/docs/docs-guards.test.ts`) must stay green.

## Tests

Backend (`packages/backend`, convex-test):
- `people.test.ts`: `unarchivePerson` clears the flag and writes the audit
  row; no-op on an active person; `archivePeople` archives, skips archived,
  rejects more than the chunk size, rejects a foreign id, writes one row per
  person.
- `importDiff.test.ts`: `returning` counted and listed; `missingFromFile`
  lists active baseline people absent from the rows; a person without an
  employee number never appears; the archived baseline person absent from
  the file is not listed (already archived).
- `people.test.ts` / `import.test.ts`: the upsert reactivates an archived
  match (flag cleared, `person.unarchived` row, `person.updated` only when
  fields changed); `importPayroll` with `archiveMissing` archives exactly the
  absent active set and nothing else, in chunks (a test population above 50
  proves the loop), reports `peopleArchived` / `peopleReactivated`, sets the
  progress total to rows plus leavers, and logs both stats in
  `people.imported`; without the flag nothing is archived while returning
  people are still reactivated; a name-mismatch skip never archives that
  person.
- Audit: the label coverage tests pick up the new event and fields; the
  `AUDIT_SUBJECTS` compile-time map fails to compile until the deriver is
  added (no test needed beyond the existing one).

Frontend (`apps/dashboard`, vitest react):
- `review-step.test.tsx`: the two rows render with counts; the lists render
  only above zero; the checkbox is unchecked by default and gates
  `archiveMissing` in the action call.
- `import-done-step.test.tsx`: the two rows appear only when above zero.
- `people-section.test.tsx`: the status filter narrows and passes
  `includeArchived`; the badge renders on archived rows; "Archive N" appears
  for an editor with an active selection and counts only active people;
  bulk dialog loops in chunks and toasts.
- `person-actions-menu.test.tsx`: Archive for active, Reactivate for
  archived, visible to an editor; the dialog calls the right mutation and
  toasts.
- `messages.test.ts` parity and the help-body cap.

## Verification on the dev deployment

No schema change, so no migration. The wire shapes of `previewImport`,
`importPayroll` and `listPeople` rows change, so the change ends with a push
to the running dev deployment and a browser pass on localhost:3001: an
import with a file that omits one active person and includes one archived
person (both rows, the checkbox, the done screen), the register's status
filter and badge, bulk archive, and the person page's archive and
reactivate. Biome at zero, i18n parity, Vitest 4 (`bun run test`).

## Out of scope (deliberately unchanged)

- A leave date field (imported or entered).
- Bulk reactivation.
- Any change to erasure (`erasePersonAsOrg`, the bulk delete dialog).
- Ending or resuming role assignments on archive or reactivation.
- The classification-drift triage (G03) and the other gap-report items; they
  follow in order.

# People register: row selection and bulk delete

## Problem

Deleting employees from the people register is one person at a time, and the
only entry point is the person's own page: open `/people/<publicId>`, open the
"..." menu, type the employee number, confirm, land back on `/people`. Cleaning
up a bad import, or removing a batch of leavers, means repeating that per
person.

The product owner wants checkboxes on the register with a bulk action bar, and
bulk delete as the first action.

## Decisions (settled with the product owner)

1. **Bulk delete only.** Assign-role, change-department and export were
   considered and cut. One action ships; the toolbar's shape leaves room for
   more later.
2. **Select-all is page-scoped.** The header checkbox covers the 25 rows of the
   current page, not the whole filtered result. A mis-click cannot arm an
   irreversible delete over thousands of employees.
3. **Type-to-confirm `DELETE`.** The per-person dialog's employee-number token
   cannot address several people; `DELETE` is the same dialog's existing
   fallback token and is already translated in every locale.
4. **People register only.** The roles register keeps its family grouping and
   gets no selection in this change.

## Selection

- A new leading checkbox column, before Name. Rows key on `personId`.
- Header checkbox: toggles every row on the **current page**; tri-state
  (checked when the whole page is selected, indeterminate on a partial page).
- Selection state is a local `Set<personId>` that survives paging, so a
  selection can be built across pages.
- The **effective** selection is derived every render as the intersection with
  the current filtered row set. Consequences, all intended:
  - Narrowing the search or a filter drops the now-hidden people from the
    selection, so the surface never deletes something it is not showing.
  - A person erased meanwhile (by this loop or another session) leaves the
    reactive query and prunes out on their own.
  - The count in the toolbar and in the dialog is always exactly what the
    confirm will delete.
- `selectionState` in `components/people/classify/classify-bulk.ts` is already
  this math (`{ effective, all, some }` from a selected set and an actionable
  list). It gains a consumer outside the classify folder, so it **moves** to
  `apps/dashboard/lib/selection.ts` with its tests; `packAssignmentChunks`
  stays classify-owned. The register calls it twice: against the page's ids for
  the header tri-state, and against the filtered ids for the effective set and
  count.

## Bulk toolbar

- A slim row between the filter toolbar and the table, rendered in **both** the
  loading and the loaded branch with a reserved `min-h-8`, so neither the
  arrival of data nor a selection going from 0 to n reflows the table.
- Left: the selected count in an `aria-live="polite"` paragraph (nothing else
  announces a selection change); empty at zero.
- Right: one destructive `Button`, disabled at zero selection.
- One action means a plain button, not a dropdown. The dropdown rule governs
  per-row actions, and a menu holding a single item is worse than the button.
  A second bulk action turns this into a `DropdownMenu`.

## Delete flow

- The button opens an `AlertDialog` in the standard anatomy: `AlertDialogHeader`
  (title + a description stating the count and that the delete is permanent),
  the type-to-confirm field, then `AlertDialogFooter` with cancel (outline,
  first) and the destructive confirm (last).
- The gate reuses `ErasePersonControl`'s shape: react-hook-form with a Zod
  `refine` on the literal `DELETE`, `mode: "onChange"`, a plain `register()`ed
  `Input` (no `FormControl`, so a partial match never glows the field red), and
  `form.formState.isValid` disabling the confirm.
- Confirm runs a **client-driven chunk loop of one person per
  `erasePersonAsOrg` call**, sequentially.

  Why one person per transaction: erasing a person is already unbounded work.
  It deletes their `payRecords` (a full salary history) and
  `personAssignments`, pseudonymizes them inside every frozen pay-mapping
  snapshot, and rewrites every audit row carrying them as subject. One person
  is the honest bound, and it needs no new backend surface, no new limit
  constant, and no change to the audit trail.
- Progress renders inside the confirm button: a `Spinner` plus the
  `<done></done> / <total></total>` rich message through `NumberFlow`, the same
  treatment bulk-classify uses.
- **Partial completion is honest and resumable.** On a failed person the loop
  stops, the dialog stays open and an error toast fires. The people already
  erased are gone from the reactive query and have pruned out of the selection,
  so pressing confirm again finishes the remainder.
- On success: `toast.success(dashboard.toast.peopleErased)` with the count, the
  selection clears, the dialog closes. The register's existing page-clamp
  effect handles a page that shrank away under the deletions.

## Out of scope (deliberately unchanged)

- The person page's own erase keeps its per-person employee-number token. It is
  the deliberate, single-person gate; the register's is the batch gate.
- **No backend change.** No schema, no new mutation, no new audit event: each
  iteration writes its own `person.erased` row through the existing mutation,
  so the trail is byte-for-byte what deleting them one by one produces.
- **No admin-role gating on the button**, matching the person page, which shows
  erase to every member and lets the backend `adminMutation` refuse. If we ever
  want the UI to hide erase from editors, both surfaces should gate in the same
  change.

## Skeleton and layout

- The header gains a `w-10` checkbox `TableHead`, and
  `PEOPLE_SKELETON_COLUMNS` gains a matching leading entry whose `content` is a
  real disabled `Checkbox` (`aria-hidden`, `tabIndex={-1}`), not a gray bar:
  per-row chrome that is identical on every row renders as its real control.
  The loading table keeps the same silhouette and row height as the loaded one.
- The header checkbox itself renders live during loading (enabled), like every
  other static-label control in the toolbar; a click while the rows are still
  arriving selects the empty page and is a harmless no-op.

## i18n

New keys under `dashboard.people.bulk.*`:

| key | shape |
| --- | --- |
| `selectAll` | aria-label for the header checkbox |
| `selectRow` | aria-label per row, `{name}` |
| `selectedCount` | ICU plural over `{count}` |
| `cta` | the destructive button |
| `dialogTitle` | |
| `dialogDescription` | ICU plural over `{count}`, states permanence |
| `confirmLabel` | "Type DELETE to confirm" |
| `confirm` | the destructive action |
| `progress` | `<done></done> / <total></total>` |
| `error` | inline dialog error |

Plus `dashboard.toast.peopleErased`, an ICU plural over `{count}`.

Added to `packages/i18n/messages/en.json` first, then mirrored to sv, nb, da
and fi. The Nordic strings are machine drafts and are flagged for native
review.

## Tests

`apps/dashboard/lib/selection.test.ts` (moved from `classify-bulk.test.ts`):
the existing `selectionState` cases, plus the two-call shape this change
introduces (a page-scoped call and a filtered-set call over the same selection).

`apps/dashboard/components/people/people-section.test.tsx`:

- the header checkbox selects only the current page's rows, and is
  indeterminate on a partial page;
- a selection survives paging to page 2 and back;
- narrowing a filter prunes the effective count;
- the CTA is disabled at zero selection and the count text is absent;
- the dialog's confirm stays disabled until `DELETE` is typed;
- confirming calls `erasePersonAsOrg` once per selected person, with the right
  ids;
- a failure on the second person stops the loop, keeps the dialog open, and
  toasts the error;
- success clears the selection, closes the dialog, and toasts the count;
- the loading skeleton renders the checkbox column.

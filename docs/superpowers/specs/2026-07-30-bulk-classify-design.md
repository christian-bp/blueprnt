# Bulk classify: select title groups and confirm them at once

## Problem

Confirming classifications on `/people/classify` is one group at a time:
expand the group, review, click Confirm. With tens of title groups this is
too slow. The product owner wants a checkbox per row, a select-all checkbox
in the header, and one action that classifies everything selected.

## Decisions (settled with the product owner)

1. **Summary confirmation dialog.** Bulk-confirm applies the engine's
   suggested role and level without each group having been opened, which
   bypasses the per-group flow's deliberate review gate. The action therefore
   opens an AlertDialog stating the scope ("Classify 12 titles, 87 people,
   with their suggested roles and levels?") before writing.
2. **Chunked from the start** (CLAUDE.md scalability rule). One transaction
   per ~8-12 writes/person breaks at large-org scale, so the confirm runs as
   a client-driven chunk loop with visible progress, and the server enforces
   the bound.

## Selection

- New leading checkbox column in the classify table (before the expand
  chevron), plus a tri-state select-all checkbox in the header.
- A row is selectable iff the group is actionable under today's rules
  (`resolveGroup`): it has a resolved role (engine suggestion or manual pick)
  and is not already confirmed-without-changes. Unmatched titles and settled
  groups render a disabled checkbox.
- Header checkbox: checks all actionable groups; indeterminate on partial
  selection; unchecking clears.
- Selection state: local `Set<rowKey>`. The effective selection is derived by
  filtering against the current actionable set each render, so rows that
  become non-actionable (e.g. confirmed individually meanwhile) drop out
  automatically. Checkbox clicks stop propagation; the row click keeps
  toggling expansion.

## Action and dialog

- A slim toolbar row above the table, always rendered (no layout shift):
  selection summary ("N titles, M people selected") left, primary button
  "Classify selected" right, disabled at zero selection.
- Click opens an AlertDialog per the standard dialog anatomy: title,
  description with the scope and what will be applied, Cancel (outline) +
  primary confirm.
- Levels resolve per person exactly like the per-group flow
  (`resolveLevel`: current valid level, else engine suggestion, else the
  track's first level), `levelSource: "confirmed"`.

## Chunked write path

- Shared constant `MAX_ASSIGNMENTS_PER_MUTATION = 50` in
  `@workspace/constants`.
- Backend: `assignPeopleToRole` rejects `assignments` arrays longer than the
  constant (`appError(invalidInput)`), so no caller can submit an unbounded
  transaction. No other backend change: the mutation already batches
  atomically and writes per-person `assignment.set` audit rows.
- Client: the dialog's confirm greedy-packs whole title groups into chunks of
  at most `MAX_ASSIGNMENTS_PER_MUTATION` people (a single group larger than
  the limit splits internally), then awaits one `assignPeopleToRole` call per
  chunk, sequentially.
- The chunk loop is ONE shared helper used by BOTH the existing per-group
  Confirm and the new bulk confirm: with the server bound in place, a single
  title group larger than the limit would otherwise break the per-group flow
  too.
- Progress: while running, the dialog's primary button is disabled and shows
  a `Spinner` plus "37 / 87" (in-place action feedback per the conventions).
- Failure mid-loop: `toast.error`, the dialog stays open, and the derived
  selection has already pruned the chunks that landed, so pressing confirm
  again finishes the remainder. Partial completion is honest: the table
  reflects confirmed groups reactively.
- Success: `toast.success` (reuse `dashboard.toast.classificationConfirmed`),
  close the dialog, clear the selection.

## i18n

New keys under `dashboard.classify.bulk.*` in all five locales (nb/da/fi
flagged for native review): row/header checkbox aria-labels, the selection
summary (ICU plural over titles and people), the CTA, dialog title,
description (ICU), confirm label, and the progress text.

## Skeleton

`CLASSIFY_SKELETON_COLUMNS` gains the checkbox column as a real disabled
checkbox (per-row chrome renders as its real control, not a gray bar).

## Tests

- Pure helpers exported and unit-tested: the selectable-set derivation, the
  select-all/indeterminate state, the group-to-chunk packing (whole groups
  preferred, oversized groups split, limit respected), and the concatenated
  assignment payloads across groups.
- Component tests: dialog gates the write; confirm fires one mutation per
  chunk; selection prunes after success.
- Backend test: `assignPeopleToRole` rejects an oversized batch.

## Out of scope

- Chunking the other org-scaled single-transaction paths (`classifyOrg`, the
  import apply step, `deletePayMappingRun`): tracked in
  `docs/go-live-checklist.md`.
- Bulk role/level EDITING; bulk applies the resolved suggestion as-is.
- Any change to the per-group confirm flow.

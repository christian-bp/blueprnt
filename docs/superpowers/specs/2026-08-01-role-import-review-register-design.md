# Role import review: organize against the whole register

**Goal:** Make the AI import's review screen show the organization's existing role families, not just the AI's proposal, so a user can drop a proposed role into a family they already have instead of typing its name. This also removes the last blocker to collapsing the roles page down to one "Add roles" button.

**Status:** design agreed with Christian in conversation on 2026-08-01. Revised twice since.

- **2026-08-01, before build:** the slim drop row and the read-only disclosure were both dropped in favour of one uniform, fully expanded card.
- **2026-08-02, after product review in the browser:** the cards and their two-column packing are gone. The review is now ONE card holding ONE table grouped by family, and a proposal to add a role the family already has never becomes a row at all. Both revisions are folded into the sections below.

## Why

Two problems, one shape.

The review currently shows only what will be added. Family identity is derived from the typed name, which is right for a bulk import (the AI proposes a grouping and the user nudges it) but wrong for the single-role case: to put one role in Engineering you must type `Engineering` exactly, where the create-role dialog offers a proper picker. That gap is what keeps a separate `Create role` button alive on the roles page.

Second, the review gives no context. You are asked whether "Backend Engineer" belongs in Engineering without being shown what is already in Engineering.

Showing the register solves both, and dragging into a real family is a better affordance than any dropdown.

## What the screen becomes

Every family the org has appears, alongside the AI's proposed ones.

- **The whole thing is one `Card` holding one `Table`, grouped by family.** Each family is one `<tbody>`: a group header row carrying its name, then its rows. There is no second shape and no special case for a family the import adds nothing to.
- **Every role renders always, in the same four columns** (drag handle, title, track, remove). Nothing is collapsed and nothing sits behind a disclosure.
- A role the family already has is **read only**: static muted text and a short `TrackBadge` where a proposed row has an `Input` and a `Select`, and not draggable, because moving a role between families is a mutation this screen cannot perform. It keeps the drag handle's and the remove control's cells as empty reserved slots, so the two row types sit on the same columns and read as one table rather than two interleaved ones.
- A **proposed row whose title the target family already has is not rendered at all** (see "Duplicates never become rows").

Ordering: targeted families first, in the AI's order, then the untargeted ones alphabetically. The user's attention belongs on what is changing. Within a group, the roles the family already has come first and the proposed rows follow, so the group reads as the family as it stands plus what is being added, and the editable block stays contiguous above the add row.

## Layout

**One table, not a wall of cards.** The screen shows the org's whole register, which is the same content the roles page (`components/roles/roles-table.tsx`) already shows as a grouped register table. Rebuilding that content as a second visual language (dozens of cards) cost the user the page they already knew and cost the layout a packing problem it did not need. The table is `table-fixed` with the four column widths declared once on the header, so a title being typed in any row cannot re-measure the columns of every other row.

Following that precedent also settles two questions the table anatomy asks:

- **No per-column sorting.** A grouped register takes none: the grouping IS the order (the same rule the roles page follows), and here the order additionally carries meaning (targeted families first).
- **No pagination and no search toolbar.** Those belong to a register you browse. This is a bounded proposal to read once and confirm, and a review that hid rows behind a pager could confirm rows the user never saw.

Everything the old two-column packing needed is deleted: `lib/family-columns.ts` (the height model and the greedy packer), `hooks/use-fits-two-columns.ts` (the media query), `test/review-columns.ts`, and their tests. A table is single-column, so there is no assignment to compute, nothing to snapshot at drag start, and no predicted-height constants to hold to the classes they mirrored. The drag-freeze discipline reduces to what it always was underneath: the cross-family move applies live during `onDragOver` and the group under the pointer keeps its identity, because a `<tbody>` does not move when a row leaves or joins it.

**Density** carries over from the cards: the static row is shorter than a proposed one (no field to floor it at 36px), and on a real register those rows outnumber the proposed ones many times over. What the two row types must share is horizontal, and differing heights do not disturb it.

The review still takes the wizard's full `max-w-5xl` shell while the paste, wait and done screens keep their reading column, because only the review has four columns with a field and a select in every row.

## Duplicates never become rows

**Decided 2026-08-02.** The review used to render a proposal to add a role the family already has as a faded row noted "Already exists, will be skipped", directly under the identical row the family already had. Christian: "if we already have the role I believe we should not add a second one like this, if the user then still wants to add another one then they can do that inside the review window."

So `buildImportSeed` drops it. Filtering at SEED time rather than hiding it at render time is what makes it un-draggable and un-editable too: a row that cannot be created must not be movable into a family where it could be.

Two things have to stay true around it.

**The resolver's duplicate check stays**, as the safety net it always was: a user can still type or drag a title into a family that already has it, and that must not create a second one. The `duplicate` note therefore still exists; it just only ever marks a row the user made.

**The reported "Already existed" count stays honest.** The rows are gone from the draft before anything downstream can see them, so the number has to travel with the seed: `buildImportSeed` returns `{ families, skipped }`, the flow records `skipped` in state at seed time (in the same render-phase block that already calls `draft.seed()`), and passes it to `resolveImportTargets` as `skippedBeforeReview`. The resolver folds it into `counts.skipped`, which is already the number the confirm sends as `skippedInReview` and the done screen adds to the server's own. One number behind the CTA's gate, the line under it, and the total reported: none of the three can disagree with the other two. Recording it at seed time rather than re-deriving it per render also pins it to the register the seed actually ran against.

Folding it into the resolver is also what keeps the explanation under the CTA useful. When the AI proposes nothing but roles the org already has, the draft ends up with no proposed rows at all, and without the seed's count the blocker would fall through to "there is nothing to add", which says nothing about where the pasted list went. With it, the blocker is `allDuplicate` and the line names the number. That line is worded around the count (`{count, plural, ...} in this list already exist, so there is nothing left to add`) rather than as a categorical "every role already exists", because the same blocker is reachable after a user has removed by hand the rows that did NOT already exist, and the categorical version would be false there.

## Two decisions

### Both the "Existing" and "New" badges go away

Once the whole register is on screen, existing is the default state and badging most families with it is noise that hides the ones that matter, so the "Existing" badge never shipped.

The `New` badge was cut too, **2026-08-02**, on the same reasoning taken one step further: the two states are already visually distinct by construction, not by decoration. An existing family renders its stored name as static text; a family this import would create renders an editable name input. That difference is unmistakable, and being able to rename it already implies it does not exist yet, so a badge restating "new" on top of the input said nothing the input had not already said.

### Nothing on this screen can destroy anything

This is the important one, and the trap existed in a milder form in the first build: removing a family meant "drop it from this import", which reads as "delete this family" the moment the group represents a family you actually have. The mutation is purely additive and physically cannot delete, so the gesture would confirm, the group would vanish, and nothing would happen. A user could believe they had tidied their register when they had not.

The invariant:

> **Everything removable on this screen is something that does not exist yet.**

Concretely:

| Element | Removable |
| --- | --- |
| A proposed role row | Yes, drops it from the import |
| A family this import would create | Yes, it and its proposed roles leave the import |
| A family the org already has | **No control** |
| A role the org already has | **No control**, read only |

Real deletion already has homes: the family page's actions menu and role archiving from the role page. The review is not the place, and offering a control that silently does nothing is worse than offering none.

The remove control for a family this import would create sits in the same (last) column as the rows' own remove controls, so the group reads as one table rather than as a header with its own private geometry.

### Consequence: existing family names become static

Earlier the review made every family name editable so an AI match could be undone by renaming. With the whole register on screen that is no longer the escape hatch: to pull a role out of a family the AI chose, you drag it into another family or into a new one. So a group matched to an existing family shows its stored name as static text, and only new ones keep the editable input.

This simplifies the model rather than complicating it. Identity is still derived from the name for new families, so typing an existing family's name into a new one still merges; that path just stops being the primary one. The register's own group steps aside while a new one claims its name, because two groups would otherwise claim one family and the register's would carry a remove control naming it.

## Data and model

`useRoleImportFlow` already queries `listRoleFamilies` and `listRoles`, so no new backend read is needed.

The injected families must live **in the draft**, not beside it, because drag and drop operates on `DraftFamily[]` (`lib/family-dnd.ts`). A family that is not in the draft cannot be a drop target.

They enter through the seed rather than a second render-phase pass: `usePastedRoleDraft` takes an optional `prepareSeed` that contributes extra families to the one seed it already performs, and the same pass drops the duplicate proposals. Onboarding passes none and is unaffected.

`resolveImportTargets` gains one optional input (`skippedBeforeReview`, above) and is otherwise untouched. An injected family carries no proposed roles, and a family with no roles already contributes nothing to the payload and nothing to the counts. Its `familyId` match is derived from the name exactly as a targeted group's is.

### The component was forked, then merged back

**Decided 2026-08-02, superseded 2026-08-03.** `components/families-review.tsx` was shared with the onboarding families step, and every review-only feature added to it (the annotations prop, the register, the read-only rows, the columns) had to be GATED so onboarding would not change. That gating went wrong twice: once on the card header, once on the role row. The fork was the reaction to that.

The fork was wrong about why the gating failed. The problem was never that the two surfaces had diverged; it was that the shared component was being told WHICH SURFACE was asking, instead of being given data that already described the difference. Onboarding is the org's first role set, so it has no register and nothing to warn about. Feed the same component an empty register and empty annotations and it degrades to exactly onboarding's screen on its own: `registerFamilyOf` returns null for every family, so every group is editable and removable, no read-only rows render, no counts render, and every annotation lookup misses.

So there is ONE component, `components/family-review-table.tsx`, rendered by both surfaces, with `register` and `annotations` optional and defaulting to empty. `components/families-review.tsx` is deleted. The shared drag-and-drop controller is `hooks/use-family-dnd.ts`; the pure list operations stay in `lib/family-dnd.ts` and the resolver in `lib/role-import.ts`.

The copy moved with the component: the table's own chrome lives in `dashboard.familyTable.*` and the drag narration in `dashboard.dnd.*`, because keeping a per-surface copy is what let the two sets drift (the same English sentence had been machine-translated separately into each namespace, so a Swedish reader was told a role was "lyft" on one screen and "plockad upp" on the next).

One thing is genuinely per-family rather than per-surface and is derived, not injected: the remove-family warning. A group carrying a real `familyId` already exists (onboarding's template path creates the starter set before the review), so removing it archives its roles; a group without one is only a proposal. The dialog reads the id, not the caller.

The `ReviewAnnotations` contract is four id sets and no `labels`: the component reads its own copy from i18n instead of having it injected.

## Drag and drop

The drop targets are the family GROUPS, and a group is a real element with a box (`<tbody>`), so it carries the droppable ref directly under the same `family-{id}` id the handlers resolve a target from. Dropping anywhere in a group lands in that family: on the roles it already has, on a proposed row, or on the add row that closes every group (which is what gives a family with nothing proposed for it something to aim at).

Existing rows are never draggable and carry no handle. The handler is the second line of that: it resolves the dragged id out of the DRAFT, and a register row has no draft id at all.

## i18n

The review table owns its copy under `dashboard.roles.import.review.*` rather than borrowing onboarding's `dashboard.onboarding.families.*`, which is what the shared component forced. New keys: the two visible column headers and two screen-reader-only ones, the add/remove labels and their confirms, the drag handle label, and the five drag announcements. Onboarding keeps its own set, now genuinely its own.

`review.nothingToAdd` became a plural message taking `{count}` (see "Duplicates never become rows"). No key was orphaned by the rebuild.

`dashboard.help.familiesReviewBody` still carries the two mechanics that are not obvious on sight ("faded rows are roles the family already has, and only the families this import creates can be renamed"); both remain true of the table, where those rows are muted.

Earlier removals, unchanged: `review.hint` (the standalone subtitle, folded into the help popover 2026-08-02), `existingBadge`, `newBadge`, the drop hint and the disclosure's show/hide labels.

## Testing

- The resolver's existing suite passes unchanged (the new input defaults to 0), plus a describe for the pre-review count: it adds to `counts.skipped`, it stacks with a duplicate the review itself marked, it keeps `allDuplicate` reachable when the seed removed the whole proposal, and it does not turn an untouched empty draft into `allDuplicate`.
- `buildImportSeed`: a proposed role the target family already holds is dropped and counted; the match is trimmed and case-folded; a title that exists only in another family or in none is kept; a family the import would CREATE keeps every row; a fully duplicated family stays on the list with no proposed roles.
- `ReviewTable`: one card, one table, one group per family; every existing role in its own family's group; an existing role has no input, no select, no button and no drag handle; a static row has the same four cells with the same width classes as a proposed one (this is the column alignment, asserted directly); no remove control on anything the org already has, and one on everything it does not; per-family add row and add family; the register's group steps aside when a new one claims its name; each annotation renders.
- `ReviewTable` drag: each family group registers as a real droppable ATTACHED TO ITS `<tbody>` (an id alone would pass with a `setNodeRef` that goes nowhere); a proposed row drops into another group and `resolveImportTargets` then yields that family's `familyId`; the row and group counts do not change across pick-up, drag-over and drop; escape restores; a non-draft id moves nothing.
- The wizard: the already-present proposal never renders and is not in the count; a hand-typed duplicate is still caught and still reports `skippedInReview: 2`; the done screen still reports "Already existed" correctly; a wholly-duplicate list blocks create and says how many already exist.
- Onboarding's 32 tests stay green and unedited.

**Red checks.** Reintroducing the duplicate row (neutering the seed filter) fails 7 tests including "never renders the already-present proposal". Dropping the seed's count from the resolver call fails 5 tests including the done screen's "Already existed" and the confirm's `skippedInReview`.

## Open risk

Scale is the one thing this design mitigates rather than solves: an org with 40 families still gets 40 groups holding every role it has, in one long table. That is accepted deliberately. The table is a much shorter surface than the cards were (no per-family card chrome, no header block, rows at table density), and dropping the duplicate rows takes out the ones that were pure noise. If it still reads badly on the dev deployment, the fallback is to collapse the untargeted families behind a disclosure ("show 32 more families") rather than to bring back a second row shape.

## Follow-on

Once this lands, `CreateRoleDialog` can be dropped from the roles page and "Add roles" becomes the single entry point for one role or ninety. The dialog itself survives: it is the primary action on the family page, where the family is fixed context and a picker would be redundant.

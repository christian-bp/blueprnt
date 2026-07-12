# Change a role's track (IC ↔ Lead ↔ Manager), resetting affected people's levels

**Date:** 2026-07-12 · **Status:** approved design, pending spec review · **Scope:** V1 assessment (roles) + V2 people/classification surfacing

## Problem

A role's track (IC / Lead / Manager) can be set at creation (`create-role-dialog.tsx`) but never changed afterward: the role edit surface `role-profile-card.tsx` edits title/function/team/family/purpose/responsibilities and never exposes track (it even receives `trackName` as a prop and does not render it). The backend `updateRole` mutation already accepts `trackKey` (`assessment/roles.ts:383`), but it currently **blocks** the change with `roleTrackChangeBlocked` whenever an active person-assignment holds a level invalid for the new track (levels are per-track and disjoint: `IC1-5`, `Lead-1..3`, `M1-3`; ADR-0005). So a user cannot switch a role from IC to Lead.

## Goal

Let HR change a role's track from the edit form. Because track ladders are disjoint, every currently-assigned person's level becomes invalid for the new track. Instead of blocking, **reset those levels**: re-suggest a level in the new track and mark it unconfirmed (`levelSource: "suggested"`). The reset people then surface automatically as needing attention via the existing machinery (the "Suggested" badge in People and the "Classify people" dashboard to-do), and the save shows a clear message. Nothing is silently lost.

## Non-goals

- No schema change (level stays a required `v.string()`; "needs re-confirm" is `levelSource: "suggested"`, not a blank).
- No band/score recompute: band is derived from the assessment score, which track does not touch, so changing track never re-bands the role. Anchor status is preserved.
- No cross-track level mapping (IC3 does not map to a specific Lead level; the ladders are independent). We re-suggest from the person's own seniority signals, HR confirms.
- No new to-do surface: the existing `classifyPeople` group already counts anyone whose `currentAssignment.levelSource !== "confirmed"` (`lib/todo.ts:92`).

## Design

### 1. Backend: `updateRole` block → reset (`packages/backend/convex/assessment/roles.ts`)

Replace the `wouldOrphan` block (lines ~409-430) with a reset. Sequence matters:

1. Apply the role patch **including `trackKey`** first, so the role carries the new track (`writeAssignment` re-reads and validates against the role's current track).
2. Then, for each **active** assignment (`endedAt === undefined`) whose level is invalid for the new track (`!isValidLevelForTrack(newTrackKey, a.level)` — which, given disjoint ladders, is all of them), load the person, re-suggest a level, and rewrite the assignment:

```ts
const now = Date.now()
let levelsReset = 0
for (const a of activeAssignments) {
  if (isValidLevelForTrack(newTrackKey, a.level)) continue // defensive; disjoint ladders => rarely true
  const person = await ctx.db.get(a.personId)
  if (person === null) continue
  const suggestedLevel = suggestLevelForPerson({
    trackKey: newTrackKey,
    ...(person.title !== undefined ? { title: person.title } : {}),
    ...(person.employmentStartDate !== undefined ? { employmentStartDate: person.employmentStartDate } : {}),
    today: now,
  }).suggestedLevel
  await writeAssignment(ctx, {
    orgId: ctx.orgId,
    actorId: ctx.authUserId,
    personId: a.personId,
    roleId: role._id,
    level: suggestedLevel,
    levelSource: "suggested",
    effectiveAt: Math.max(now, a.effectiveAt + 1), // writeAssignment requires effectiveAt > the open assignment's
  })
  levelsReset++
}
```

- `writeAssignment` (people/assignments.ts) closes the person's open assignment and inserts a new effective-dated one, validating the level against the role's (now-new) track and writing the assignment audit row. Its chronological guard requires `effectiveAt >` the open assignment's `effectiveAt`, hence `Math.max(now, a.effectiveAt + 1)`.
- Closed (historical) assignments are never touched.
- The role's own track change is audited by the existing `updateRole` audit path; each level reset is audited by `writeAssignment`.
- **Return shape changes** from `v.null()` to `v.object({ levelsReset: v.number() })` so the UI can message. Regenerate `_generated/api.d.ts` if it changes.
- **Remove the now-dead `roleTrackChangeBlocked`** error code (`lib/errors.ts`), its i18n label, and rewrite the roles.test.ts case that asserted the block (`roles.test.ts:339`) to assert the reset instead.
- `updateRole` already imports `isValidLevelForTrack`; add `suggestLevelForPerson` (from `@workspace/core`) and `writeAssignment` (from `people/assignments.ts`). No new context boundary is crossed: the current block already queries `personAssignments` from `roles.ts` (lines 417-422), and `writeAssignment` reads the role via `ctx.db.get` without importing assessment, so there is no import cycle.
- A **confirmed** level (`levelSource: "confirmed"`) is also reset when its level is invalid for the new track: the confirmation cannot survive a track change (an `IC3` confirmation is meaningless on a Lead-track role), so it too becomes a re-suggested, unconfirmed level. This is unavoidable and correct; the reset is audited.

### 2. UI: track selector on the edit form (`apps/dashboard/components/roles/role-profile-card.tsx`)

- Add `trackKey` and a `tracks: { key; name }[]` to the `RoleProfile` props (the page supplies them).
- Read mode: render the current track (`trackName`) alongside function/team (it is currently passed but never shown).
- Edit mode: a `Select` of `tracks` defaulting to the current `trackKey`, mirroring `create-role-dialog.tsx`'s track select (same `Select` + `HelpMorphButton` pattern). Track goes into the draft and into the `updateRole` patch only when changed (like the other fields).
- On save: capture `updateRole`'s `{ levelsReset }`. If `levelsReset > 0`, show a specific toast (e.g. `dashboard.toast.roleTrackChanged` with `{count}`): *"Track changed. N people's levels need re-confirming."* Otherwise the normal `roleUpdated` toast.

### 3. Page wiring (`apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`)

The page already has `role.trackKey`/`role.trackName` (it renders `TrackBadge`). Query the model's tracks from the same source `create-role-dialog` uses for its `tracks` prop (the `getModel` tracks list on the roles/create surface), and pass `trackKey` + `tracks` to `RoleProfileCard`. Confirm the exact query name during implementation by reading where `create-role-dialog`'s `tracks` originate.

### 4. Surfacing (reused, no new code)

Reset people have `levelSource: "suggested"`, so they already: (a) show the "Suggested" badge in the People list (`people-section.tsx`), and (b) count in the dashboard "Classify people" to-do (`lib/todo.ts:92`, `currentAssignment.levelSource !== "confirmed"`). Confirm via test that a role-track-change reset person appears in both; no code change expected.

### 5. i18n

- The track selector label + help reuse existing keys (`model.track` / `assessment.role.track` and the `dashboard.help.track*` used by the create dialog).
- New toast key `dashboard.toast.roleTrackChanged` (ICU `{count}`) in `en.json` first, mirrored to sv/nb/da/fi.
- Remove the `errors.roleTrackChangeBlocked` label in all five locales.

## Testing

- **Backend (`roles.test.ts`):** changing a role's track re-suggests and resets `levelSource` to `"suggested"` for each active assignment, leaves a closed/historical assignment's level untouched, returns `levelsReset` equal to the number of active assignments, writes the role + per-assignment audit rows, and keeps band/anchor unchanged. Rewrite the former "block" test to assert the reset. A track change on a role with no active assignments returns `levelsReset: 0` and touches no assignments.
- **UI (`role-profile-card.test.tsx`):** the track select renders in edit mode with the current track, saving a changed track calls `updateRole` with the new `trackKey`, and a `levelsReset > 0` result shows the re-confirm toast; the track is shown in read mode.
- **Surfacing (`lib/todo.test.ts` / people-section test):** a person with `levelSource: "suggested"` after a reset counts in `classifyPeople` and shows the "Suggested" badge (assert against the existing predicate).
- **i18n parity** across the five locales for the new/removed keys.

## Component boundaries

- The level re-suggestion stays the pure `suggestLevelForPerson` engine (packages/core); the mutation supplies `today` (ADR-0002 purity).
- `writeAssignment` remains the single writer for assignment changes (validation + audit + history in one place); the reset reuses it rather than patching assignments directly.
- The UI holds no track/level logic beyond the selector and the message; the backend owns the reset.

## File-change checklist

- `packages/backend/convex/assessment/roles.ts` — `updateRole`: block → reset, return `{ levelsReset }`, add engine + writeAssignment reuse (+ tests).
- `packages/backend/convex/lib/errors.ts` — remove `roleTrackChangeBlocked`.
- `packages/backend/convex/assessment/roles.test.ts` — rewrite the block test to a reset test (+ the no-assignments case).
- `apps/dashboard/components/roles/role-profile-card.tsx` — track selector (read + edit), tracks/trackKey props, reset toast (+ test).
- `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx` — pass tracks + trackKey.
- `packages/i18n/messages/{en,sv,nb,da,fi}.json` — add `dashboard.toast.roleTrackChanged`, remove `errors.roleTrackChangeBlocked`.
- `packages/backend/convex/_generated/api.d.ts` — regenerate if the `updateRole` return change alters it.

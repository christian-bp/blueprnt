# Change a Role's Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR change a role's track (IC ↔ Lead ↔ Manager) from the role edit form; when the change orphans an active person-assignment's level, re-suggest a level in the new track and flag it unconfirmed instead of blocking.

**Architecture:** The backend `updateRole` mutation already accepts `trackKey` but currently blocks the change; turn the block into a reset that reuses the pure `suggestLevelForPerson` engine + the shared `writeAssignment` helper, returning how many levels were reset. The role edit card gains a track dropdown (default = current track) and messages the reset count. Reset people (`levelSource: "suggested"`) surface via the existing "Suggested" badge and the "Classify people" dashboard to-do with no new code.

**Tech Stack:** Convex (edge-runtime + convex-test), TypeScript monorepo (Turborepo, Bun), Vitest 4, Next.js 16, shadcn/Base UI, next-intl.

## Global Constraints

- **Tests:** Vitest 4 only. Run with `bun run test` (never `bun test`). New code ships with tests in the same task.
- **No schema change:** `personAssignments.level` stays a required `v.string()`; "needs re-confirm" is `levelSource: "suggested"`, never a blank.
- **Engine purity (ADR-0002):** level re-suggestion stays the pure `suggestLevelForPerson` (packages/core); the mutation supplies `today: Date.now()`.
- **Single writer:** all assignment changes go through `writeAssignment` (validation + audit + effective-dated history); never patch `personAssignments` directly.
- **No legacy before launch:** delete the now-dead `roleTrackChangeBlocked` error code and its i18n label completely.
- **Convex codegen:** if changing `updateRole`'s return validator alters `packages/backend/convex/_generated/api.d.ts`, run `bunx convex codegen` and keep the regenerated file.
- **i18n:** new keys added to `packages/i18n/messages/en.json` first, then mirrored to the identical key set in `sv/nb/da/fi` (parity-guarded). Edit the JSON with the editor, never shell sed (mojibake). English only in code/commits; no em dashes.

---

### Task 1: Backend — `updateRole` block becomes a reset

**Files:**
- Modify: `packages/backend/convex/assessment/roles.ts` (`updateRole`, ~lines 383-486)
- Modify: `packages/backend/convex/lib/errors.ts` (remove `roleTrackChangeBlocked`)
- Test: `packages/backend/convex/assessment/roles.test.ts` (rewrite the block test ~lines 333-345, add two cases)

**Interfaces:**
- Consumes: `suggestLevelForPerson({ trackKey, title?, employmentStartDate?, today }): { suggestedLevel: string }` from `@workspace/core`; `writeAssignment(ctx, { orgId, actorId, personId, roleId, level, levelSource, effectiveAt }): Promise<Id<"personAssignments">>` from `../people/assignments`; `isValidLevelForTrack(trackKey, level): boolean` (already imported).
- Produces: `updateRole` now returns `{ levelsReset: number }` (was `v.null()`).

- [ ] **Step 1: Rewrite the block test as a reset test (failing)**

In `packages/backend/convex/assessment/roles.test.ts`, find the test that currently ends with `.rejects.toThrow(/errors.roleTrackChangeBlocked/)` (around line 333). Keep its setup (it creates a role on `track`, a person, and a confirmed assignment at `level`, plus `otherTrack`). Replace the assertion block (from the `// The track change is blocked` comment to the end of that `it`) with:

```ts
    // The track change is NOT blocked: it re-suggests the level for the new
    // track and flags it unconfirmed, rather than orphaning it.
    const result = await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      trackKey: otherTrack.key,
    })
    expect(result.levelsReset).toBe(1)

    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.trackKey).toBe(otherTrack.key)

      const assignments = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      const open = assignments.find((a) => a.endedAt === undefined)
      expect(open).toBeDefined()
      // Re-suggested, unconfirmed, and valid for the NEW track.
      expect(open?.levelSource).toBe("suggested")
      expect(isValidLevelForTrack(otherTrack.key, open?.level ?? "")).toBe(true)
    })
  })
```

Rename the `it(...)` title to `"edits the role: a track swap re-suggests the level and flags it unconfirmed"`. Ensure `isValidLevelForTrack` is imported in the test file (from `@workspace/constants`); add the import if missing.

- [ ] **Step 2: Add a no-active-assignments case (failing)**

Add immediately after that test (reuse `seedOrg` and the role-creation helper the file already uses):

```ts
  it("track swap with no active assignments returns levelsReset 0", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { roleId, track, otherTrack } = await createRoleWithTracks(t, orgId, asAdmin)
    const result = await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      trackKey: otherTrack.key,
    })
    expect(result.levelsReset).toBe(0)
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.trackKey).toBe(otherTrack.key)
    })
  })
```

If the file has no `createRoleWithTracks` helper, inline the role creation the block test already used (create a role with `trackKey: track.key`, and pick `otherTrack` as a different track from `getModel`/`TRACKS`). Follow the existing test's exact setup pattern.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun run test --filter=@workspace/backend -- roles.test`
Expected: FAIL. The reset test fails because `updateRole` still throws `roleTrackChangeBlocked` (and `result.levelsReset` is undefined since the mutation returns `null`).

- [ ] **Step 4: Implement the reset in `updateRole`**

In `packages/backend/convex/assessment/roles.ts`:

Add imports near the top (with the other imports):
```ts
import { suggestLevelForPerson } from "@workspace/core"
import { writeAssignment } from "../people/assignments"
```

Replace the current `trackKey` block (the `if (args.trackKey !== undefined) { ... wouldOrphan ... patch.trackKey = args.trackKey }` at ~lines 409-431) with just:
```ts
    if (args.trackKey !== undefined) {
      patch.trackKey = args.trackKey
    }
```

Change the return validator from `returns: v.null(),` to:
```ts
  returns: v.object({ levelsReset: v.number() }),
```

Change the empty-patch early return (`if (Object.keys(patch).length === 0) return null`) to:
```ts
    if (Object.keys(patch).length === 0) return { levelsReset: 0 }
```

After `await ctx.db.patch(args.roleId, patch)` and its `ctx.audit.log(...)` call (the role is now on the new track, which `writeAssignment` validates against), and before the final `return`, add:
```ts
    // A track change orphans every active assignment's level (ladders are
    // disjoint: IC*/Lead-*/M*), so re-suggest a level in the new track and
    // flag it unconfirmed. HR re-confirms via the Classify surface / to-do.
    let levelsReset = 0
    if (args.trackKey !== undefined && args.trackKey !== role.trackKey) {
      const now = Date.now()
      const roleAssignments = await ctx.db
        .query("personAssignments")
        .withIndex("by_role", (q) =>
          q.eq("orgId", ctx.orgId).eq("roleId", role._id)
        )
        .collect()
      for (const a of roleAssignments) {
        if (a.endedAt !== undefined) continue // closed history is untouched
        if (isValidLevelForTrack(args.trackKey, a.level)) continue // defensive
        const person = await ctx.db.get(a.personId)
        if (person === null) continue
        const { suggestedLevel } = suggestLevelForPerson({
          trackKey: args.trackKey,
          ...(person.title !== undefined ? { title: person.title } : {}),
          ...(person.employmentStartDate !== undefined
            ? { employmentStartDate: person.employmentStartDate }
            : {}),
          today: now,
        })
        await writeAssignment(ctx, {
          orgId: ctx.orgId,
          actorId: ctx.authUserId,
          personId: a.personId,
          roleId: role._id,
          // writeAssignment requires effectiveAt strictly after the open row.
          effectiveAt: Math.max(now, a.effectiveAt + 1),
          level: suggestedLevel,
          levelSource: "suggested",
        })
        levelsReset++
      }
    }
    return { levelsReset }
```

Replace the old final `return null` (~line 484) with the `return { levelsReset }` above (there must be exactly one final return of the object).

In `packages/backend/convex/lib/errors.ts`, remove the `roleTrackChangeBlocked` entry from `ERROR_CODES` (and any `AppErrorCode` union member if listed).

- [ ] **Step 5: Regenerate codegen and run the tests**

Run: `bunx convex codegen` (from `packages/backend`) so `_generated/api.d.ts` reflects the new return type.
Run: `bun run test --filter=@workspace/backend -- roles.test`
Expected: PASS (both new tests). Then run `bun run test --filter=@workspace/backend` once to confirm no other test referenced `roleTrackChangeBlocked`.

- [ ] **Step 6: Commit** (skip if the executing skill defers commits)

```bash
git add packages/backend/convex/assessment/roles.ts packages/backend/convex/lib/errors.ts packages/backend/convex/assessment/roles.test.ts packages/backend/convex/_generated/api.d.ts
git commit -m "feat(roles): re-suggest levels on a role track change instead of blocking"
```

---

### Task 2: i18n — reset toast and remove the dead error label

**Files:**
- Modify: `packages/i18n/messages/en.json` (source), then `sv.json`, `nb.json`, `da.json`, `fi.json`
- Test: the `@workspace/i18n` parity test (run it)

**Interfaces:**
- Produces: `dashboard.toast.roleTrackChanged` (ICU `{count}`). Removes `errors.roleTrackChangeBlocked`.

- [ ] **Step 1: Add the toast key to `en.json` and remove the error label**

Under `dashboard.toast`, add:
```json
"roleTrackChanged": "Track changed. {count} people's levels need re-confirming."
```
Under `errors`, delete the `roleTrackChangeBlocked` entry.

- [ ] **Step 2: Mirror to the four other locales**

Add `dashboard.toast.roleTrackChanged` and remove `errors.roleTrackChangeBlocked` in `sv/nb/da/fi`, using these drafts (nb/da/fi flagged for native review):

| locale | roleTrackChanged |
|---|---|
| sv | Spåret har ändrats. {count} personers nivåer behöver bekräftas på nytt. |
| nb | Sporet er endret. {count} personers nivåer må bekreftes på nytt. |
| da | Sporet er ændret. {count} personers niveauer skal bekræftes igen. |
| fi | Ura muutettu. {count} henkilön tasot on vahvistettava uudelleen. |

Edit the JSON with the editor (not shell) to keep UTF-8 clean. Keep the `{count}` ICU placeholder intact in every locale.

- [ ] **Step 3: Run parity + grep for stragglers**

Run: `bun run test --filter=@workspace/i18n`
Expected: PASS (identical key sets across all five files).
Run: `grep -rn "roleTrackChangeBlocked" packages/i18n apps packages` — Expected: no matches.
Run: `grep -Rn "Ã\|â€" packages/i18n/messages/` — Expected: no matches (mojibake-clean).

- [ ] **Step 4: Commit** (skip if deferring commits)

```bash
git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "i18n(roles): add track-changed toast, drop the blocked-track error label"
```

---

### Task 3: UI — track selector on the role edit card + page wiring

**Files:**
- Modify: `apps/dashboard/components/roles/role-profile-card.tsx`
- Modify: `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`
- Test: `apps/dashboard/components/roles/role-profile-card.test.tsx`

**Interfaces:**
- Consumes: `updateRole` now returns `{ levelsReset: number }` (Task 1); `dashboard.toast.roleTrackChanged` (Task 2); the `Select` pattern from `create-role-dialog.tsx`; `getModel` returns `{ tracks: { key; name }[] }`.
- Produces: `RoleProfileCard` accepts `role.trackKey` + a `tracks` prop and edits the track.

- [ ] **Step 1: Write the failing UI test**

Add to `apps/dashboard/components/roles/role-profile-card.test.tsx` (mirror the file's existing mock setup for `updateRole`; the existing mock at the top routes `assessment.roles.updateRole` to `updateRoleMock`). Make `updateRoleMock` resolve `{ levelsReset: 2 }` for this case:

```ts
  it("edits the track and toasts the reset count", async () => {
    updateRoleMock.mockResolvedValueOnce({ levelsReset: 2 })
    render(
      <Wrapper>
        <RoleProfileCard
          orgId="org1"
          isAdmin
          role={{
            roleId: "r1" as never,
            title: "Dev",
            function: "",
            team: "",
            trackKey: "IC",
            trackName: "IC",
            familyId: null,
            familyName: null,
            familySlug: null,
            purpose: "",
            responsibilities: "",
            archived: false,
          }}
          tracks={[
            { key: "IC", name: "IC" },
            { key: "Lead", name: "Lead" },
          ]}
        />
      </Wrapper>
    )
    // Enter edit mode, change the track to Lead, save.
    fireEvent.click(screen.getByRole("menuitem", { name: /edit/i }))
    // The track control is a native <select> under the shadcn Select in tests
    // (follow the file's existing pattern for driving a Select); set it to Lead.
    // ... drive the track select to "Lead" per this file's existing Select helper ...
    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    await waitFor(() => {
      expect(updateRoleMock).toHaveBeenCalledWith(
        expect.objectContaining({ roleId: "r1", trackKey: "Lead" })
      )
    })
  })
```

Read the file's existing tests to reuse its `Wrapper` (intl + convex mocks) and the exact way it drives a `Select` (there is likely a hidden native select query, matching the classify tests). Do not invent a Select helper.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test --filter=@workspace/dashboard -- role-profile-card`
Expected: FAIL — `RoleProfileCard` has no `tracks` prop / no track control, so the render or the `trackKey: "Lead"` assertion fails.

- [ ] **Step 3: Add the track selector + reset toast to `role-profile-card.tsx`**

1. Extend the `RoleProfile` interface with `trackKey: string` (keep `trackName`).
2. Add a `tracks: { key: string; name: string }[]` prop to the component signature.
3. Add the track to `currentValues()` so a change is diffed:
```ts
    return {
      title: role.title,
      function: role.function,
      team: role.team,
      trackKey: role.trackKey,
      purpose: role.purpose,
      responsibilities: role.responsibilities,
    }
```
4. Render the track in the read/edit grid. In the `[["title", ...], ["function", ...], ["team", ...]]` block (the `sm:grid-cols-3` grid) the three are text inputs; add a fourth cell for track that renders `role.trackName` in read mode and a `Select` in edit mode. Import `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from `@workspace/ui/components/select` and `onSelectValue` from `@/lib/select` (same imports `create-role-dialog.tsx` uses). Render (place after the three-field map, inside the same grid container or a following row):
```tsx
        <div className="space-y-1">
          <Label htmlFor="profile-track" className="text-muted-foreground">
            {tRole("track")}
          </Label>
          {editing ? (
            <Select
              value={draft.trackKey ?? role.trackKey}
              onValueChange={onSelectValue((value: string) =>
                setField("trackKey", value)
              )}
              items={Object.fromEntries(tracks.map((tr) => [tr.key, tr.name]))}
            >
              <SelectTrigger id="profile-track" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tracks.map((tr) => (
                  <SelectItem key={tr.key} value={tr.key}>
                    {tr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p id="profile-track" className="text-sm">
              {role.trackName}
            </p>
          )}
        </div>
```
Use `tRole("track")` if `assessment.role.track` exists; otherwise use the same label key `create-role-dialog.tsx` uses (`t("trackLabel")` under its namespace). Confirm the exact key by reading `create-role-dialog.tsx`'s track `FormLabel`.
5. In `handleSave`, capture the result and toast the count on reset:
```ts
        const result = await updateRole({
          orgId,
          roleId: role.roleId,
          ...patch,
          ...familyChange,
        })
        if (result.levelsReset > 0) {
          toast.success(
            tToast("roleTrackChanged", { count: result.levelsReset })
          )
        } else {
          toast.success(tToast("roleUpdated"))
        }
```
(Replace the existing single `toast.success(tToast("roleUpdated"))`.)

- [ ] **Step 4: Wire the page to pass tracks + trackKey**

In `apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx`: it already has `role.trackKey`/`role.trackName` (it renders `TrackBadge`). Query the model tracks the same way the roles list page does (`const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })`) and pass to the card:
```tsx
<RoleProfileCard
  orgId={orgId}
  isAdmin={isAdmin}
  tracks={model?.tracks ?? []}
  role={{ ...existingRoleProps, trackKey: role.trackKey, trackName: role.trackName }}
/>
```
Guard the render on `model !== undefined` alongside the existing role guard (a skeleton already handles the loading branch), so `tracks` is populated before the card can enter edit mode. Add `role.trackKey` to whatever object literal builds the `RoleProfile` (the card already received `trackName`).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test --filter=@workspace/dashboard -- role-profile-card`
Expected: PASS. Then `bun run test --filter=@workspace/dashboard` once to catch any prop-type regression in the page/other role tests.

- [ ] **Step 6: Commit** (skip if deferring commits)

```bash
git add apps/dashboard/components/roles/role-profile-card.tsx "apps/dashboard/app/(app)/roles/[roleSlug]/page.tsx" apps/dashboard/components/roles/role-profile-card.test.tsx
git commit -m "feat(roles): add a track selector to the role edit form"
```

---

## Self-Review

**Spec coverage:**
- Block → reset with re-suggest + `writeAssignment` + `{ levelsReset }` return (spec §1) → Task 1. ✓
- Remove `roleTrackChangeBlocked` + rewrite the block test (spec §1) → Task 1. ✓
- Confirmed levels also reset (spec §1) → Task 1's reset test uses a confirmed assignment and asserts it becomes `suggested`. ✓
- Track selector read+edit + reset toast (spec §2) → Task 3. ✓
- Page passes tracks + trackKey (spec §3) → Task 3 Step 4. ✓
- Surfacing reused, no new code (spec §4) → Task 1 asserts `levelSource: "suggested"` (the surfacing contract; the badge + `classifyPeople` to-do already key off it and are covered by existing people/todo tests). ✓
- i18n toast add + error-label removal (spec §5) → Task 2. ✓
- No band/anchor recompute (spec non-goal) → Task 1 touches only `trackKey` + assignments, never score/band; the reset test can additionally assert `role.bandKey`/anchor unchanged if the file exposes them.

**Placeholder scan:** The UI test (Task 3 Step 1) intentionally defers the exact Select-driving line to "read the file's existing pattern" because the repo has a house helper for driving `Select` in tests (used by the classify tests); this is a named, real pattern to mirror, not an invented API. Everything else is concrete code.

**Type consistency:** `{ levelsReset: number }` is the `updateRole` return in Task 1, consumed identically in Task 3 Step 3. `tracks: { key; name }[]` matches `getModel().tracks` (`model.ts:404`) and the `create-role-dialog` `TrackOption` shape. `suggestLevelForPerson` args/return match `classificationShared.ts:78`. `writeAssignment` args match `assignments.ts:88`.

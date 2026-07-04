# V2 Classification Backend (Suggestion Mutation + Queries) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist deterministic classification suggestions (`levelSource: "suggested"` assignments) for imported people and expose the title-grouped assignment state the Classify surface renders.

**Architecture:** Extract the assignment write (validate level against track, close the current open assignment, insert, audit) from `assignPersonToRole` into a shared internal DB helper so both the public `orgMutation` and the new `runClassificationSuggestions` mutation write through one code path (DRY). `runClassificationSuggestions` loads the org's people (now carrying `title` from Plan 1) plus roles, runs the pure engines from Plan 1 (`@workspace/core`), and writes suggested assignments for people who have a title, a role match, and no confirmed/matching-suggested assignment yet. `listPeopleByTitle` groups people by their `title` in JS and joins each person's current open assignment. No AI, no new tables.

**Tech Stack:** Convex (customFunction wrappers `orgMutation`/`orgQuery` in `lib/functions.ts`), `@workspace/constants` (`isValidLevelForTrack`, `TRACK_LEVELS`), `@workspace/core` (pure classification engines from Plan 1), Vitest 4 + convex-test on `edge-runtime`.

## Global Constraints

- Every Convex function is org-scoped (tenant isolation); no cross-org reads or writes.
- Role != Person: the `roles`/`ratings` tables never carry person, gender, salary, or performance fields.
- No AI in the classification path: suggestions are deterministic engine output that HR confirms (ADR-0003); this plan calls no AI.
- Level is per-individual, validated against the role's `trackKey` via `isValidLevelForTrack` (ADR-0005).
- Score/band are derived, never stored (ADR-0002); the only rows written here are `personAssignments` (assignment records, not derived figures).
- All data stays in the EU (Convex eu-west-1; ADR-0001); no external calls.
- Every state-changing mutation writes an audit row via an `AUDIT_EVENTS` key; audit payloads carry no PII (no name, salary, performance, contact).
- New code ships with tests in the same commit.
- All tests run with Vitest 4 via `bun run test` (never `bun test`); backend tests use convex-test on `edge-runtime`.
- English identifiers, code comments, and commit messages; never use em dashes in anything we write.
- Commit messages use Conventional Commits (`feat:`, `refactor:`, `test:`, etc.).

---

### Task 1: Extract the shared assignment-write DB helper

Refactor the assignment write out of `assignPersonToRole` into a plain internal async function that takes a `MutationCtx`, the resolved `orgId` and `actorId`, and the assignment fields, so both the public mutation and `runClassificationSuggestions` (Task 2) write through it. Behavior is unchanged; the existing `assignPersonToRole` tests are the regression gate.

**Files:**
- Modify: `packages/backend/convex/people/assignments.ts:65-148` (extract helper, rewrite `assignPersonToRole` handler to delegate)
- Test: `packages/backend/convex/people/assignments.test.ts` (existing suite is the regression gate; no new test file)

**Interfaces:**
- Consumes: `isValidLevelForTrack(trackKey: string, level: string): boolean` (`@workspace/constants`); `requireOwnPerson` and `requireOwnRole` (already imported in `assignments.ts`); `AUDIT_EVENTS.assignmentSet`, `buildChanges`, `ASSIGNMENT_AUDIT_FIELDS`, `loadPersonAssignments` (already in `assignments.ts`); `logAudit(ctx, { orgId, type, actorId, payload })` (`../lib/audit`); `appError`, `ERROR_CODES.invalidLevel`, `ERROR_CODES.invalidEffectiveDate` (`../lib/errors`).
- Produces: `writeAssignment(ctx: MutationCtx, args: { orgId: string; actorId: string; personId: Id<"people">; roleId: Id<"roles">; level: string; levelSource: "suggested" | "confirmed"; effectiveAt: number }): Promise<Id<"personAssignments">>` exported from `people/assignments.ts`. It validates the level against the role's track (throws `ERROR_CODES.invalidLevel`), enforces the chronological guard against the current open assignment (throws `ERROR_CODES.invalidEffectiveDate`), closes the open assignment, inserts the new row, and writes the `assignment.set` audit row via `logAudit`. It assumes both entities are already asserted to belong to the org (the caller asserts).

- [ ] **Step 1: Confirm the existing assignment tests pass (baseline)**

Run: `cd /Volumes/development/blueprnt/frontend/packages/backend && bunx vitest run convex/people/assignments.test.ts`
Expected: PASS (baseline green before refactor).

- [ ] **Step 2: Extract `writeAssignment` and rewrite `assignPersonToRole` to delegate**

Replace the `assignPersonToRole` export block (lines 65-148) in `packages/backend/convex/people/assignments.ts` with the helper plus a thin public wrapper. `MutationCtx` is already importable from `../_generated/server`; add it to the existing type import.

Change the import on line 4 from:

```typescript
import type { QueryCtx } from "../_generated/server"
```

to:

```typescript
import type { MutationCtx, QueryCtx } from "../_generated/server"
```

Add `logAudit` to the audit import on line 5:

```typescript
import { AUDIT_EVENTS, buildChanges, logAudit } from "../lib/audit"
```

Then replace lines 65-148 (the `assignPersonToRole` export) with:

```typescript
// Shared assignment write. Validates the level against the role's track,
// enforces the strictly-chronological guard against the current open
// assignment, closes that open assignment, inserts the new row, and writes the
// assignment.set audit row. Callers MUST have already asserted that personId
// and roleId belong to orgId (requireOwnPerson / requireOwnRole). Both the
// public assignPersonToRole mutation and runClassificationSuggestions
// (people/classification.ts) write through this one code path (DRY).
export async function writeAssignment(
  ctx: MutationCtx,
  args: {
    orgId: string
    actorId: string
    personId: Id<"people">
    roleId: Id<"roles">
    level: string
    levelSource: "suggested" | "confirmed"
    effectiveAt: number
  }
): Promise<Id<"personAssignments">> {
  const role = await ctx.db.get(args.roleId)
  // Caller asserted ownership; this is a defensive re-read for the trackKey.
  if (role === null || role.orgId !== args.orgId) {
    throw appError(ERROR_CODES.notFound)
  }

  // Validate level against the role's track.
  if (!isValidLevelForTrack(role.trackKey, args.level)) {
    throw appError(ERROR_CODES.invalidLevel)
  }

  // Find and close the current open assignment, if any.
  // A person's assignment count is small so a collect + find is safe.
  const all = await loadPersonAssignments(ctx, args.orgId, args.personId)
  const openAssignment = all.find((a) => a.endedAt === undefined) ?? null

  // Guard: assignments must be strictly chronological. If the new effectiveAt
  // is <= the current open assignment's effectiveAt, closing the open row
  // would set its endedAt <= its own effectiveAt, producing a broken interval
  // (zero-length or inverted). Proper out-of-order timeline insertion is
  // deferred to V2-core; V1 assumes each new assignment is always the latest.
  if (
    openAssignment !== null &&
    args.effectiveAt <= openAssignment.effectiveAt
  ) {
    throw appError(ERROR_CODES.invalidEffectiveDate)
  }

  const prevSnapshot: Record<string, unknown> = {
    roleId: null,
    level: null,
    levelSource: null,
  }

  if (openAssignment !== null) {
    await ctx.db.patch(openAssignment._id, { endedAt: args.effectiveAt })
    prevSnapshot.roleId = openAssignment.roleId
    prevSnapshot.level = openAssignment.level
    prevSnapshot.levelSource = openAssignment.levelSource
  }

  const nextSnapshot: Record<string, unknown> = {
    roleId: args.roleId,
    level: args.level,
    levelSource: args.levelSource,
  }

  const assignmentId = await ctx.db.insert("personAssignments", {
    orgId: args.orgId,
    personId: args.personId,
    roleId: args.roleId,
    level: args.level,
    levelSource: args.levelSource,
    effectiveAt: args.effectiveAt,
  })

  await logAudit(ctx, {
    orgId: args.orgId,
    actorId: args.actorId,
    type: AUDIT_EVENTS.assignmentSet,
    payload: {
      personId: args.personId,
      roleId: args.roleId,
      changes: buildChanges(prevSnapshot, nextSnapshot, ASSIGNMENT_AUDIT_FIELDS),
    },
  })

  return assignmentId
}

// Assign a person to a role at a given seniority level.
// If the person has an open assignment (no endedAt), it is closed first by
// setting its endedAt = effectiveAt. The new assignment becomes the active one.
// Audit: assignment.set (changes diff: roleId, level, levelSource).
export const assignPersonToRole = orgMutation({
  args: {
    personId: v.id("people"),
    roleId: v.id("roles"),
    level: v.string(),
    levelSource: v.union(v.literal("suggested"), v.literal("confirmed")),
    effectiveAt: v.optional(v.number()),
  },
  returns: v.id("personAssignments"),
  handler: async (ctx, args) => {
    // Assert both entities belong to the caller's org.
    await requireOwnPerson(ctx, args.personId)
    await requireOwnRole(ctx, args.roleId)

    return await writeAssignment(ctx, {
      orgId: ctx.orgId,
      actorId: ctx.authUserId,
      personId: args.personId,
      roleId: args.roleId,
      level: args.level,
      levelSource: args.levelSource,
      effectiveAt: args.effectiveAt ?? Date.now(),
    })
  },
})
```

Note: the public wrapper still uses `ctx.audit.log` implicitly? No. The helper uses the free `logAudit` (it takes a plain `MutationCtx`), so `assignPersonToRole` no longer calls `ctx.audit.log`. This is intentional: the free `logAudit` writes an identical row and lets the helper be shared with plain-`MutationCtx` callers. `ctx.authUserId` is injected by the `orgMutation` wrapper (`lib/functions.ts`).

- [ ] **Step 3: Run the existing assignment suite to verify unchanged behavior**

Run: `cd /Volumes/development/blueprnt/frontend/packages/backend && bunx vitest run convex/people/assignments.test.ts`
Expected: PASS (all existing `assignPersonToRole`, `getCurrentAssignment`, `listAssignmentsForPerson`, and cross-org tests still green; the audit row assertion in "inserts an assignment row and writes an assignment.set audit row" still finds exactly one `assignment.set` row).

- [ ] **Step 4: Typecheck the backend package**

Run: `cd /Volumes/development/blueprnt/frontend/packages/backend && bun run typecheck`
Expected: PASS (no unused-import errors; `isValidLevelForTrack` and `requireOwnRole` are still used).

- [ ] **Step 5: Commit**

```bash
cd /Volumes/development/blueprnt/frontend
git add packages/backend/convex/people/assignments.ts
git commit -m "refactor(people): extract shared writeAssignment DB helper"
```

---

### Task 2: `runClassificationSuggestions` mutation

Add `people/classification.ts` with an `orgMutation` that computes and persists `levelSource: "suggested"` assignments for people who have a `title`, whose title matched a role via the Plan 1 engines, and who have no confirmed assignment and no identical existing suggestion. Idempotent on re-run; unmatched-title people get no assignment. It writes through the Task 1 `writeAssignment` helper and audits a PII-free summary via a new `classification.suggested` event.

**Files:**
- Create: `packages/backend/convex/people/classificationShared.ts` (the shared `buildTitleGroups` helper, reused by Task 4's query)
- Create: `packages/backend/convex/people/classification.ts`
- Modify: `packages/backend/convex/lib/audit.ts:44-48` (add `classificationSuggested` event key)
- Modify: `packages/backend/convex/lib/auditPayloads.ts:297-301` (add the `classification.suggested` payload entry)
- Modify: `packages/i18n/messages/en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json` (add the audit label under `dashboard.auditLog.events`, see Step 4)
- Test: `packages/backend/convex/people/classification.test.ts`

**Interfaces:**
- Consumes:
  - `writeAssignment(ctx, { orgId, actorId, personId, roleId, level, levelSource, effectiveAt })` (Task 1).
  - `title: v.optional(v.string())` on `people` (Plan 1); `people` doc fields `title`, `isManager`, `employmentStartDate`, `statisticalCode`.
  - Plan 1 pure engines from `@workspace/core`. These are the exact exported signatures (Plan 1 is authoritative); call them POSITIONALLY, not with a single object arg:
    - `suggestRoleForTitles(titles: readonly TitleInput[], roles: readonly RoleCandidate[], options?: { threshold?: number }): TitleSuggestion[]` where `TitleInput = { importedTitle: string; personCount: number; hasManager?: boolean; statisticalCode?: string }`, `RoleCandidate = { roleId: string; title: string; trackKey: "IC" | "Lead" | "M" }`, and `TitleSuggestion = { importedTitle: string; personCount: number; suggestedRoleId: string | null; confidence: "high" | "medium" | "unmatched" }`. Note the field names: it is `hasManager` (boolean) on the title input and `roleId` (not `id`) on the role candidate, and the two arrays are passed as separate positional arguments.
    - `suggestLevelForPerson(input: { trackKey: "IC" | "Lead" | "M"; title?: string; employmentStartDate?: string; isManager?: boolean; statisticalCode?: string; today: number }): { suggestedLevel: string }`
  - `orgMutation` / `orgQuery` (`../lib/functions.ts`), which inject `ctx.orgId`, `ctx.role`, `ctx.authUserId`, `ctx.audit`.
  - `loadPersonAssignments(ctx, orgId, personId)` (not exported) — instead read the open assignment inline via the `by_person` index (see Step 5).
  - `buildTitleGroups` — the shared helper this plan introduces in Task 2 (Step 5): it groups people by title, builds the positional `titleInputs`/`roleInputs`, runs `suggestRoleForTitles` + `suggestLevelForPerson`, and is reused by BOTH `classifyOrg` (Task 2/3, writes suggestions) and `listPeopleByTitle` (Task 4, returns suggestion fields), so the suggestion is computed identically in both.
- Produces: `runClassificationSuggestions` as `api.people.classification.runClassificationSuggestions`, an `orgMutation` with args `{ orgId: v.string() }` returning `v.object({ suggested: v.number(), skipped: v.number(), unmatchedTitles: v.number() })`. `suggested` = new suggested assignments written; `skipped` = people left untouched (already confirmed, or an identical suggestion already open, or no title); `unmatchedTitles` = distinct titles that cleared no role match. Also produces the audit event key `AUDIT_EVENTS.classificationSuggested = "classification.suggested"` with payload `{ suggested: number; skipped: number; unmatchedTitles: number }`.

- [ ] **Step 1: Add the audit event key and payload**

In `packages/backend/convex/lib/audit.ts`, add to `AUDIT_EVENTS` (after `assignmentSet: "assignment.set",` on line 44):

```typescript
  classificationSuggested: "classification.suggested",
```

`categoryForEvent` already maps `assignment.*` to `"people"`; add the new prefix branch so `classification.suggested` is categorized. In `categoryForEvent`, extend the people branch (lines 81-86) to include the new prefix:

```typescript
  if (
    type.startsWith("person.") ||
    type.startsWith("people.") ||
    type.startsWith("assignment.") ||
    type.startsWith("classification.")
  )
    return "people"
```

In `packages/backend/convex/lib/auditPayloads.ts`, add to the `AuditPayloads` interface (after the `"assignment.set"` line, line 294):

```typescript
  "classification.suggested": {
    suggested: number
    skipped: number
    unmatchedTitles: number
  }
```

- [ ] **Step 2: Write the failing test**

Create `packages/backend/convex/people/classification.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

// Seeds a minimal org with one admin member.
async function seedOrg(
  t: ReturnType<typeof initConvexTest>,
  email = "hr@acme.se"
) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "HR Person", role: "admin" }
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
  return { orgId, userId, asAdmin }
}

// Inserts a person carrying a title directly (bypasses the import wizard).
async function seedPerson(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  fields: {
    displayName: string
    title?: string
    employmentStartDate?: string
    isManager?: boolean
  }
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("people", {
      orgId,
      displayName: fields.displayName,
      gender: "Kvinna",
      ...(fields.title !== undefined ? { title: fields.title } : {}),
      ...(fields.employmentStartDate !== undefined
        ? { employmentStartDate: fields.employmentStartDate }
        : {}),
      ...(fields.isManager !== undefined
        ? { isManager: fields.isManager }
        : {}),
    })
  )
}

describe("runClassificationSuggestions", () => {
  it("writes a suggested assignment for a person whose title matches a role", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
    })

    const result = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(result.suggested).toBe(1)
    expect(result.unmatchedTitles).toBe(0)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current?.levelSource).toBe("suggested")
    expect(current?.level.startsWith("IC")).toBe(true)
  })

  it("creates no assignment for a person whose title matches no role", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, {
      displayName: "Bo Karlsson",
      title: "Rocket Scientist",
    })

    const result = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(result.suggested).toBe(0)
    expect(result.unmatchedTitles).toBe(1)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current).toBeNull()
  })

  it("creates no assignment for a person with no title", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, { displayName: "No Title" })

    const result = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(result.suggested).toBe(0)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current).toBeNull()
  })

  it("is idempotent: a second run adds no duplicate suggested assignment", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
    })

    const first = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(first.suggested).toBe(1)

    const second = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(second.suggested).toBe(0)
    expect(second.skipped).toBe(1)

    const assignments = await asAdmin.query(
      api.people.assignments.listAssignmentsForPerson,
      { orgId, personId }
    )
    expect(assignments).toHaveLength(1)
  })

  it("does not overwrite a confirmed assignment on re-run", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { roleId } = await asAdmin.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Software Engineer",
        function: "Engineering",
        team: "Platform",
        trackKey: "IC",
      }
    )
    const personId = await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
    })

    // HR confirms the person at IC5 first.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC5",
      levelSource: "confirmed",
    })

    const result = await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )
    expect(result.suggested).toBe(0)
    expect(result.skipped).toBe(1)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current?.levelSource).toBe("confirmed")
    expect(current?.level).toBe("IC5")
  })

  it("writes a PII-free classification.suggested audit row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
    })

    await asAdmin.mutation(
      api.people.classification.runClassificationSuggestions,
      { orgId }
    )

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "classification.suggested")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as Record<string, unknown>
      expect(payload.suggested).toBe(1)
      // No PII: the payload carries only counts, no names.
      expect(JSON.stringify(payload)).not.toContain("Anna")
    })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /Volumes/development/blueprnt/frontend/packages/backend && bunx vitest run convex/people/classification.test.ts`
Expected: FAIL (`api.people.classification.runClassificationSuggestions` does not exist / module not found).

- [ ] **Step 4: Confirm how the audit-label test derives the label key, then add the label in all five locales**

First CONFIRM the derivation rule (do not assume camelCase): open `apps/dashboard/lib/audit-labels.test.ts` and read its `orgEventKey` helper, then look at how an EXISTING event value maps to its label key in `packages/i18n/messages/en.json` under `dashboard.auditLog.events`. The neighbouring events are `assignment.set` and `people.imported`; check their labels in `en.json` (`grep -n '"assignmentSet"\|"peopleImported"' packages/i18n/messages/en.json`). If those labels are stored camelCased (`assignmentSet`, `peopleImported`), the test camelCases across dots and the new key is `classificationSuggested`; if instead the labels are stored as the raw dotted strings (`"assignment.set"`), the test reads the raw value and the new key must be `"classification.suggested"`. Add the label under WHICHEVER key form the test actually reads.

Then add that label under `dashboard.auditLog.events` in each locale file in `packages/i18n/messages/`, next to the existing `assignment.set` / `people.imported` labels (around `en.json:430-433`). English (source) value (using the camelCase key form the current test uses; if the confirmation above shows the raw-dotted form, use `"classification.suggested"` as the key instead):

```json
"classificationSuggested": "Classification suggestions computed"
```

Nordic drafts (flag for native review):
- sv: `"Klassificeringsförslag beräknade"`
- nb: `"Klassifiseringsforslag beregnet"`
- da: `"Klassifikationsforslag beregnet"`
- fi: `"Luokitteluehdotukset laskettu"`

Note: do not add the non-ASCII strings via shell `perl`/`sed` (they double-encode; see MEMORY i18n-nonascii-verification). Edit the JSON files directly, then verify with `grep -n classificationSuggested packages/i18n/messages/*.json` (five hits, no mojibake).

- [ ] **Step 5: Write the shared grouping helper and the mutation**

The suggestion (title -> role + per-person level) must be computed IDENTICALLY by the writer (`runClassificationSuggestions` / `classifyOrg`) and the reader (`listPeopleByTitle`, Task 4). Extract that computation into ONE shared helper so the logic is never duplicated. Put the pure grouping + engine call in `packages/backend/convex/people/classificationShared.ts` (a leaf module both `classification.ts` and `classificationQueries.ts` import, so there is no circular dependency between the mutation and the query):

Create `packages/backend/convex/people/classificationShared.ts`:

```typescript
import { suggestLevelForPerson, suggestRoleForTitles } from "@workspace/core"
import type { Doc } from "../_generated/dataModel"

// One title group: the exact imported title (or null for the no-title bucket),
// the people sharing it, the engine's role suggestion for the group, and the
// per-person level suggestion keyed by person id. Both the writer
// (runClassificationSuggestions/classifyOrg) and the reader (listPeopleByTitle)
// consume this so the suggestion is computed once, identically.
export interface TitleGroup {
  title: string | null
  people: Doc<"people">[]
  suggestedRoleId: string | null
  confidence: "high" | "medium" | "unmatched"
  // person._id (as string) -> engine level suggestion, or null when the group
  // matched no role (no track to draw a level from).
  suggestedLevelByPerson: Map<string, string | null>
}

// Groups active people by their exact title string (the no-title bucket keyed
// null), builds the POSITIONAL engine inputs, runs suggestRoleForTitles + a
// per-person suggestLevelForPerson, and returns one TitleGroup per distinct
// title. Titled groups come first (ascending by title), the null-title group
// last. `now` is passed so the engine's clock is caller-controlled (purity).
export function buildTitleGroups(
  people: readonly Doc<"people">[],
  roles: readonly Doc<"roles">[],
  now: number
): TitleGroup[] {
  // Bucket by title; the no-title bucket is keyed with the empty string here and
  // surfaced as title: null in the result.
  const NO_TITLE = ""
  const byTitle = new Map<string, Doc<"people">[]>()
  for (const person of people) {
    const key =
      person.title !== undefined && person.title.trim().length > 0
        ? person.title
        : NO_TITLE
    const bucket = byTitle.get(key) ?? []
    bucket.push(person)
    byTitle.set(key, bucket)
  }

  // Only titled groups are matchable. Build the positional engine inputs:
  // TitleInput carries `hasManager` (true if ANY person under the title is a
  // manager); RoleCandidate carries `roleId` (the role's _id as a string).
  const titledEntries = [...byTitle.entries()].filter(
    ([key]) => key !== NO_TITLE
  )
  const titleInputs = titledEntries.map(([importedTitle, group]) => ({
    importedTitle,
    personCount: group.length,
    hasManager: group.some((p) => p.isManager === true),
  }))
  const roleInputs = roles.map((r) => ({
    roleId: r._id as string,
    title: r.title,
    trackKey: r.trackKey,
  }))
  // POSITIONAL call: (titles, roles). Plan 1 is authoritative on the signature.
  const suggestions = suggestRoleForTitles(titleInputs, roleInputs)
  const suggestionByTitle = new Map(
    suggestions.map((s) => [s.importedTitle, s])
  )
  const roleById = new Map(roles.map((r) => [r._id as string, r]))

  const titled: TitleGroup[] = titledEntries
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([title, group]) => {
      const suggestion = suggestionByTitle.get(title)
      const suggestedRoleId = suggestion?.suggestedRoleId ?? null
      const confidence = suggestion?.confidence ?? "unmatched"
      const role =
        suggestedRoleId !== null ? roleById.get(suggestedRoleId) : undefined
      const suggestedLevelByPerson = new Map<string, string | null>()
      for (const person of group) {
        suggestedLevelByPerson.set(
          person._id as string,
          role === undefined
            ? null
            : suggestLevelForPerson({
                trackKey: role.trackKey,
                ...(person.title !== undefined ? { title: person.title } : {}),
                ...(person.employmentStartDate !== undefined
                  ? { employmentStartDate: person.employmentStartDate }
                  : {}),
                today: now,
              }).suggestedLevel
        )
      }
      return {
        title,
        people: group,
        suggestedRoleId,
        confidence,
        suggestedLevelByPerson,
      }
    })

  const untitled = byTitle.get(NO_TITLE)
  if (untitled === undefined) return titled
  return [
    ...titled,
    {
      title: null,
      people: untitled,
      suggestedRoleId: null,
      confidence: "unmatched" as const,
      suggestedLevelByPerson: new Map(
        untitled.map((p) => [p._id as string, null])
      ),
    },
  ]
}
```

Create `packages/backend/convex/people/classification.ts`:

```typescript
import { suggestLevelForPerson } from "@workspace/core"
import { v } from "convex/values"
import { AUDIT_EVENTS } from "../lib/audit"
import { orgMutation } from "../lib/functions"
import { writeAssignment } from "./assignments"
import { buildTitleGroups } from "./classificationShared"

// Computes and persists levelSource: "suggested" assignments for people whose
// imported title matched a role (Plan 1 engines, via the shared buildTitleGroups
// helper). No AI (ADR-0003): the engines are deterministic and HR confirms the
// result. Idempotent: re-running does not duplicate a matching suggestion and
// never overwrites a confirmed assignment. People with no title, or whose title
// matches no role, get no assignment.
export const runClassificationSuggestions = orgMutation({
  args: {},
  returns: v.object({
    suggested: v.number(),
    skipped: v.number(),
    unmatchedTitles: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now()

    // Load active people and their titles. Role != Person: we read no salary.
    const people = (
      await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
        .collect()
    ).filter((p) => p.archivedAt === undefined)

    // Load active roles (title + trackKey are all the title matcher needs).
    const roles = (
      await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
        .collect()
    ).filter((r) => r.archivedAt === undefined)

    // The single source of truth for grouping + engine output (shared with
    // listPeopleByTitle). The null-title group is emitted last.
    const groups = buildTitleGroups(people, roles, now)
    const roleById = new Map(roles.map((r) => [r._id as string, r]))

    let suggested = 0
    let skipped = 0
    let unmatchedTitles = 0

    for (const group of groups) {
      // The no-title group is not matchable: everyone in it is skipped.
      if (group.title === null) {
        skipped += group.people.length
        continue
      }
      const role =
        group.suggestedRoleId !== null
          ? roleById.get(group.suggestedRoleId)
          : undefined
      if (role === undefined) {
        // Unmatched title: nobody in the group gets an assignment.
        unmatchedTitles += 1
        skipped += group.people.length
        continue
      }

      for (const person of group.people) {
        // Read the person's current open assignment inline via by_person.
        const open =
          (
            await ctx.db
              .query("personAssignments")
              .withIndex("by_person", (q) =>
                q.eq("orgId", ctx.orgId).eq("personId", person._id)
              )
              .collect()
          ).find((a) => a.endedAt === undefined) ?? null

        // The shared helper already computed the per-person level for a matched
        // group; it is always a string here (role !== undefined). Fall back to
        // the engine's low level defensively so `level` is never null.
        const level =
          group.suggestedLevelByPerson.get(person._id as string) ??
          suggestLevelForPerson({ trackKey: role.trackKey, today: now })
            .suggestedLevel

        // Skip a person already confirmed (HR reviewed them). Skip a person
        // whose open suggestion already points at the same role AND level
        // (re-run idempotency: a no-op write is not performed).
        if (
          open !== null &&
          (open.levelSource === "confirmed" ||
            (open.roleId === role._id && open.level === level))
        ) {
          skipped += 1
          continue
        }

        await writeAssignment(ctx, {
          orgId: ctx.orgId,
          actorId: ctx.authUserId,
          personId: person._id,
          roleId: role._id,
          level,
          levelSource: "suggested",
          // Strictly after any existing open assignment's effectiveAt: an open
          // suggestion at `now` cannot exist yet (this run defines it), and a
          // prior suggestion from an earlier run was created at an earlier now.
          effectiveAt:
            open !== null && now <= open.effectiveAt
              ? open.effectiveAt + 1
              : now,
        })
        suggested += 1
      }
    }

    await ctx.audit.log({
      type: AUDIT_EVENTS.classificationSuggested,
      payload: { suggested, skipped, unmatchedTitles },
    })

    return { suggested, skipped, unmatchedTitles }
  },
})
```

Note: the mutation is an `orgMutation`, so its wire args are `{ orgId }` (injected by the wrapper) plus the empty `args: {}`. Callers pass `{ orgId }`. This Step 5 body is refactored again in Task 3 to extract the whole handler into a `classifyOrg` routine (shared with the import action); the `buildTitleGroups` call stays.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd /Volumes/development/blueprnt/frontend/packages/backend && bunx vitest run convex/people/classification.test.ts`
Expected: PASS (all six `runClassificationSuggestions` tests green).

- [ ] **Step 7: Run the audit-label coverage test**

Run: `cd /Volumes/development/blueprnt/frontend/apps/dashboard && bunx vitest run lib/audit-labels.test.ts`
Expected: PASS (`classificationSuggested` is present under `dashboard.auditLog.events`, so the "every org audit event has a readable label" test finds no missing labels).

- [ ] **Step 8: Run the i18n parity test and backend typecheck**

Run: `cd /Volumes/development/blueprnt/frontend/packages/i18n && bunx vitest run` then `cd /Volumes/development/blueprnt/frontend/packages/backend && bun run typecheck`
Expected: PASS (parity across all five locales confirms `classificationSuggested` exists in each; `AuditPayloads` compile-time coverage guards still hold).

- [ ] **Step 9: Commit**

```bash
cd /Volumes/development/blueprnt/frontend
git add packages/backend/convex/people/classificationShared.ts packages/backend/convex/people/classification.ts packages/backend/convex/people/classification.test.ts packages/backend/convex/lib/audit.ts packages/backend/convex/lib/auditPayloads.ts packages/i18n/messages
git commit -m "feat(people): add runClassificationSuggestions mutation"
```

---

### Task 3: `importPayroll` runs suggestions after upsert

Wire the import action to run `runClassificationSuggestions` at the end of a successful import (spec §5: automatic at the end of `importPayroll`), so re-imports keep suggestions current without an explicit HR action. The import action already runs internal mutations for employee count and audit; add a call that goes through a thin internal mutation wrapper (the action cannot call the public `orgMutation` directly, and `runClassificationSuggestions` reads `ctx.authUserId` from the JWT which the action has as `actorId`).

**Files:**
- Create: `packages/backend/convex/people/classificationInternal.ts` (internal mutation wrapper for the import action)
- Modify: `packages/backend/convex/people/import.ts:445-461` (add the suggestions call before the return)
- Test: `packages/backend/convex/people/classification.test.ts` (add one integration assertion via the internal wrapper)

**Interfaces:**
- Consumes: `writeAssignment` (Task 1); the same grouping/engine logic as Task 2. To avoid duplicating the Task 2 body, extract the core routine into a shared plain function.
- Produces: `internalRunClassificationSuggestions` as `internal.people.classificationInternal.internalRunClassificationSuggestions`, an `internalMutation` with args `{ orgId: v.string(); actorId: v.string() }` returning the same `{ suggested, skipped, unmatchedTitles }` shape. Also produces `classifyOrg(ctx: MutationCtx, orgId: string, actorId: string, now: number): Promise<{ suggested: number; skipped: number; unmatchedTitles: number }>` exported from `people/classification.ts` (the shared routine both the public and internal mutations call).

- [ ] **Step 1: Extract `classifyOrg` from the Task 2 handler**

In `packages/backend/convex/people/classification.ts`, refactor: move the whole handler body (everything from `const now = Date.now()` through the `return`) into an exported plain function, and have both entry points call it. The audit write moves into `classifyOrg` (it uses the free `logAudit`, so it works from any `MutationCtx`). Replace the file with:

```typescript
import { suggestLevelForPerson } from "@workspace/core"
import { v } from "convex/values"
import type { MutationCtx } from "../_generated/server"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { orgMutation } from "../lib/functions"
import { writeAssignment } from "./assignments"
import { buildTitleGroups } from "./classificationShared"

// Shared classification routine. Computes and persists levelSource:"suggested"
// assignments for people whose title matched a role (Plan 1 engines, via the
// shared buildTitleGroups helper, no AI). Idempotent; never overwrites
// confirmed. Writes a PII-free audit summary. Callers: the public
// runClassificationSuggestions orgMutation and the import action's internal
// wrapper (classificationInternal.ts). `now` is passed so the caller controls
// the clock (the import action already has one).
export async function classifyOrg(
  ctx: MutationCtx,
  orgId: string,
  actorId: string,
  now: number
): Promise<{ suggested: number; skipped: number; unmatchedTitles: number }> {
  const people = (
    await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
  ).filter((p) => p.archivedAt === undefined)

  const roles = (
    await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
  ).filter((r) => r.archivedAt === undefined)

  // Single source of truth for grouping + engine output (shared with
  // listPeopleByTitle). The null-title group is emitted last.
  const groups = buildTitleGroups(people, roles, now)
  const roleById = new Map(roles.map((r) => [r._id as string, r]))

  let suggested = 0
  let skipped = 0
  let unmatchedTitles = 0

  for (const group of groups) {
    // The no-title group is not matchable: everyone in it is skipped.
    if (group.title === null) {
      skipped += group.people.length
      continue
    }
    const role =
      group.suggestedRoleId !== null
        ? roleById.get(group.suggestedRoleId)
        : undefined
    if (role === undefined) {
      unmatchedTitles += 1
      skipped += group.people.length
      continue
    }

    for (const person of group.people) {
      const open =
        (
          await ctx.db
            .query("personAssignments")
            .withIndex("by_person", (q) =>
              q.eq("orgId", orgId).eq("personId", person._id)
            )
            .collect()
        ).find((a) => a.endedAt === undefined) ?? null

      // buildTitleGroups already computed the per-person level for a matched
      // group; fall back to the engine's low level defensively so it is never
      // null when role !== undefined.
      const level =
        group.suggestedLevelByPerson.get(person._id as string) ??
        suggestLevelForPerson({ trackKey: role.trackKey, today: now })
          .suggestedLevel

      if (
        open !== null &&
        (open.levelSource === "confirmed" ||
          (open.roleId === role._id && open.level === level))
      ) {
        skipped += 1
        continue
      }

      await writeAssignment(ctx, {
        orgId,
        actorId,
        personId: person._id,
        roleId: role._id,
        level,
        levelSource: "suggested",
        effectiveAt:
          open !== null && now <= open.effectiveAt ? open.effectiveAt + 1 : now,
      })
      suggested += 1
    }
  }

  await logAudit(ctx, {
    orgId,
    actorId,
    type: AUDIT_EVENTS.classificationSuggested,
    payload: { suggested, skipped, unmatchedTitles },
  })

  return { suggested, skipped, unmatchedTitles }
}

// Computes and persists classification suggestions for the caller's org.
// Triggered on opening the Classify surface (spec §5). No AI (ADR-0003).
export const runClassificationSuggestions = orgMutation({
  args: {},
  returns: v.object({
    suggested: v.number(),
    skipped: v.number(),
    unmatchedTitles: v.number(),
  }),
  handler: async (ctx) =>
    classifyOrg(ctx, ctx.orgId, ctx.authUserId, Date.now()),
})
```

- [ ] **Step 2: Run the Task 2 suite to verify the refactor is behavior-preserving**

Run: `cd /Volumes/development/blueprnt/frontend/packages/backend && bunx vitest run convex/people/classification.test.ts`
Expected: PASS (the six Task 2 tests still green after the extraction).

- [ ] **Step 3: Write the internal wrapper**

Create `packages/backend/convex/people/classificationInternal.ts`:

```typescript
import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { classifyOrg } from "./classification"

// Internal wrapper so the "use node" import action can run classification after
// upserting people. The action holds the resolved actorId (Better Auth id) and
// its own clock, both passed through. Not exposed to clients.
export const internalRunClassificationSuggestions = internalMutation({
  args: { orgId: v.string(), actorId: v.string() },
  returns: v.object({
    suggested: v.number(),
    skipped: v.number(),
    unmatchedTitles: v.number(),
  }),
  handler: async (ctx, { orgId, actorId }) =>
    classifyOrg(ctx, orgId, actorId, Date.now()),
})
```

- [ ] **Step 4: Wire the import action to call it**

In `packages/backend/convex/people/import.ts`, add the classification call after the audit-completion step (after the `logImportCompleted` runMutation on line 446-452, before the `return` on line 454). The import action's `internal` import is already present (line 19). Insert:

```typescript
    // Step 8: Run classification suggestions for the freshly imported people
    // (titles now persisted). Deterministic engines, no AI (ADR-0003).
    await ctx.runMutation(
      internal.people.classificationInternal.internalRunClassificationSuggestions,
      { orgId: args.orgId, actorId }
    )
```

- [ ] **Step 5: Add an integration test for the internal wrapper**

Add `internal` to the top import of `packages/backend/convex/people/classification.test.ts` (change `import { api, components } from "../_generated/api"` to `import { api, components, internal } from "../_generated/api"`), then add this test inside the existing `describe("runClassificationSuggestions", ...)` block:

```typescript
  it("the internal wrapper suggests for imported people", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    const personId = await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
    })

    const result = await t.mutation(
      internal.people.classificationInternal
        .internalRunClassificationSuggestions,
      { orgId, actorId: userId }
    )
    expect(result.suggested).toBe(1)

    const current = await asAdmin.query(
      api.people.assignments.getCurrentAssignment,
      { orgId, personId }
    )
    expect(current?.levelSource).toBe("suggested")
  })
```

- [ ] **Step 6: Run the classification suite plus the import suite**

Run: `cd /Volumes/development/blueprnt/frontend/packages/backend && bunx vitest run convex/people/classification.test.ts convex/people/import.test.ts`
Expected: PASS (the new internal-wrapper test passes; the existing `import.test.ts` suite still green, now with classification running as part of a successful import).

- [ ] **Step 7: Typecheck**

Run: `cd /Volumes/development/blueprnt/frontend/packages/backend && bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd /Volumes/development/blueprnt/frontend
git add packages/backend/convex/people/classification.ts packages/backend/convex/people/classificationInternal.ts packages/backend/convex/people/import.ts packages/backend/convex/people/classification.test.ts
git commit -m "feat(people): run classification suggestions after payroll import"
```

---

### Task 4: `listPeopleByTitle` org query

Add the query the Classify surface renders from: distinct titles across the org's people with per-title person lists, each person's tenure signals, their current open assignment, AND the deterministic engine suggestion for the group (matched role + confidence) and per person (suggested level). It reuses the SAME `buildTitleGroups` helper as `classifyOrg` (Task 2/3), so the suggestion HR sees is computed identically to the one that gets persisted. Groups by `title` in JS over a `by_org` collect (distinct titles are bounded by headcount) and joins the open assignment per person. This query only READS/derives (ADR-0002 permits deriving on read); it never writes.

**Files:**
- Create: `packages/backend/convex/people/classificationQueries.ts`
- Test: `packages/backend/convex/people/classification.test.ts` (add a `describe("listPeopleByTitle", ...)` block)

**Interfaces:**
- Consumes: `orgQuery` (`../lib/functions.ts`); `buildTitleGroups` (`./classificationShared`, Task 2); the `people` doc (`title`, `displayName`, `externalRef`, `employmentStartDate`, `isManager`); the `roles` doc (`title`, `trackKey`, `archivedAt`); the `personAssignments` doc (`roleId`, `level`, `levelSource`, `endedAt`).
- Produces: `listPeopleByTitle` as `api.people.classificationQueries.listPeopleByTitle`, an `orgQuery` with args `{ orgId: v.string() }` returning:

```typescript
v.array(
  v.object({
    title: v.union(v.string(), v.null()), // null = the "no title" group
    personCount: v.number(),
    // The group's role suggestion from buildTitleGroups (null for the no-title
    // group and for titles that matched no role).
    suggestedRoleId: v.union(v.id("roles"), v.null()),
    confidence: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("unmatched")
    ),
    people: v.array(
      v.object({
        personId: v.id("people"),
        displayName: v.string(),
        externalRef: v.union(v.string(), v.null()),
        employmentStartDate: v.union(v.string(), v.null()),
        isManager: v.union(v.boolean(), v.null()),
        // The engine's level suggestion for this person (from
        // suggestLevelForPerson against the matched role's trackKey), or null
        // when the title matched no role.
        suggestedLevel: v.union(v.string(), v.null()),
        currentAssignment: v.union(
          v.object({
            roleId: v.id("roles"),
            level: v.string(),
            levelSource: v.union(
              v.literal("suggested"),
              v.literal("confirmed")
            ),
          }),
          v.null()
        ),
      })
    ),
  })
)
```

Rows are sorted with the "no title" group (title `null`) last, other titles ascending by locale-independent string compare (this ordering is `buildTitleGroups`'s own output order). `confidence` is the `MatchConfidence` union `"high" | "medium" | "unmatched"` from Plan 1.

- [ ] **Step 1: Write the failing test**

Add to `packages/backend/convex/people/classification.test.ts` a new top-level `describe` block (the `seedOrg`/`seedPerson` helpers are already in the file):

```typescript
describe("listPeopleByTitle", () => {
  it("groups people by title with their current assignment", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { roleId } = await asAdmin.mutation(
      api.assessment.roles.createRole,
      {
        orgId,
        title: "Software Engineer",
        function: "Engineering",
        team: "Platform",
        trackKey: "IC",
      }
    )
    const anna = await seedPerson(t, orgId, {
      displayName: "Anna Svensson",
      title: "Software Engineer",
      employmentStartDate: "2020-01-01",
    })
    await seedPerson(t, orgId, {
      displayName: "Bo Karlsson",
      title: "Software Engineer",
    })
    await seedPerson(t, orgId, { displayName: "No Title Nils" })

    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: anna,
      roleId,
      level: "IC3",
      levelSource: "confirmed",
    })

    const groups = await asAdmin.query(
      api.people.classificationQueries.listPeopleByTitle,
      { orgId }
    )

    // Two groups: "Software Engineer" (2 people) and the null group (1).
    expect(groups).toHaveLength(2)
    const seGroup = groups.find((g) => g.title === "Software Engineer")
    expect(seGroup?.personCount).toBe(2)
    // The query runs the engines: the exact-title match is high confidence and
    // points at the created role.
    expect(seGroup?.confidence).toBe("high")
    expect(seGroup?.suggestedRoleId).toBe(roleId)
    const annaRow = seGroup?.people.find((p) => p.personId === anna)
    expect(annaRow?.currentAssignment?.level).toBe("IC3")
    expect(annaRow?.currentAssignment?.levelSource).toBe("confirmed")
    expect(annaRow?.employmentStartDate).toBe("2020-01-01")
    // Each matched person carries an engine level suggestion for the role's track.
    expect(annaRow?.suggestedLevel?.startsWith("IC")).toBe(true)
    const boRow = seGroup?.people.find(
      (p) => p.displayName === "Bo Karlsson"
    )
    expect(boRow?.currentAssignment).toBeNull()
    expect(boRow?.suggestedLevel?.startsWith("IC")).toBe(true)

    // The null-title group is last, with no role suggestion.
    const nullGroup = groups[groups.length - 1]
    expect(nullGroup?.title).toBeNull()
    expect(nullGroup?.suggestedRoleId).toBeNull()
    expect(nullGroup?.confidence).toBe("unmatched")
    expect(nullGroup?.people[0]?.suggestedLevel).toBeNull()
  })

  it("marks a title that matches no role as unmatched", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Software Engineer",
      function: "Engineering",
      team: "Platform",
      trackKey: "IC",
    })
    await seedPerson(t, orgId, {
      displayName: "Bo Karlsson",
      title: "Rocket Scientist",
    })

    const groups = await asAdmin.query(
      api.people.classificationQueries.listPeopleByTitle,
      { orgId }
    )
    const rsGroup = groups.find((g) => g.title === "Rocket Scientist")
    expect(rsGroup?.confidence).toBe("unmatched")
    expect(rsGroup?.suggestedRoleId).toBeNull()
    expect(rsGroup?.people[0]?.suggestedLevel).toBeNull()
  })

  it("returns an empty array for an org with no people", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const groups = await asAdmin.query(
      api.people.classificationQueries.listPeopleByTitle,
      { orgId }
    )
    expect(groups).toHaveLength(0)
  })

  it("does not leak another org's people", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "b@beta.se")
    await seedPerson(t, orgA, {
      displayName: "Anna A",
      title: "Engineer",
    })

    const groupsB = await asAdminB.query(
      api.people.classificationQueries.listPeopleByTitle,
      { orgId: orgB }
    )
    expect(groupsB).toHaveLength(0)
    // Sanity: org A does see its own person.
    const groupsA = await asAdminA.query(
      api.people.classificationQueries.listPeopleByTitle,
      { orgId: orgA }
    )
    expect(groupsA).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Volumes/development/blueprnt/frontend/packages/backend && bunx vitest run convex/people/classification.test.ts`
Expected: FAIL (the new `listPeopleByTitle` tests fail: `api.people.classificationQueries.listPeopleByTitle` does not exist).

- [ ] **Step 3: Write the query**

Create `packages/backend/convex/people/classificationQueries.ts`:

```typescript
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import { orgQuery } from "../lib/functions"
import { buildTitleGroups } from "./classificationShared"

// One person's row within a title group. Tenure signals (employmentStartDate,
// isManager) let the Classify surface show why a level was suggested;
// suggestedLevel is the engine's per-person level (null when the group matched
// no role); currentAssignment carries the persisted suggestion/confirmation
// state.
const personRowShape = v.object({
  personId: v.id("people"),
  displayName: v.string(),
  externalRef: v.union(v.string(), v.null()),
  employmentStartDate: v.union(v.string(), v.null()),
  isManager: v.union(v.boolean(), v.null()),
  suggestedLevel: v.union(v.string(), v.null()),
  currentAssignment: v.union(
    v.object({
      roleId: v.id("roles"),
      level: v.string(),
      levelSource: v.union(v.literal("suggested"), v.literal("confirmed")),
    }),
    v.null()
  ),
})

// Distinct titles across an org's active people, each with the people sharing
// it, their current open assignment, and the deterministic engine suggestion
// (matched role + confidence + per-person level) computed via the shared
// buildTitleGroups helper (the SAME grouping/engine path classifyOrg persists
// from, so what HR sees equals what gets written). Groups over a by_org collect
// (distinct titles are bounded by headcount, so the collect is safe; spec §5).
// The "no title" group is emitted with title: null and sorted last. Read-only:
// deriving the suggestion on read is allowed (ADR-0002); nothing is written.
export const listPeopleByTitle = orgQuery({
  args: {},
  returns: v.array(
    v.object({
      title: v.union(v.string(), v.null()),
      personCount: v.number(),
      suggestedRoleId: v.union(v.id("roles"), v.null()),
      confidence: v.union(
        v.literal("high"),
        v.literal("medium"),
        v.literal("unmatched")
      ),
      people: v.array(personRowShape),
    })
  ),
  handler: async (ctx) => {
    const people = (
      await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
        .collect()
    ).filter((p) => p.archivedAt === undefined)

    const roles = (
      await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
        .collect()
    ).filter((r) => r.archivedAt === undefined)

    // Build each person's current-open-assignment lookup up front.
    const openByPerson = new Map<string, Doc<"personAssignments">>()
    for (const person of people) {
      const open =
        (
          await ctx.db
            .query("personAssignments")
            .withIndex("by_person", (q) =>
              q.eq("orgId", ctx.orgId).eq("personId", person._id)
            )
            .collect()
        ).find((a) => a.endedAt === undefined) ?? null
      if (open !== null) openByPerson.set(person._id as string, open)
    }

    // The single source of truth for grouping + engine output (shared with
    // classifyOrg). `Date.now()` is fine here: an orgQuery is not in the pure
    // packages/core layer, and the tenure band only shifts on year boundaries.
    const groups = buildTitleGroups(people, roles, Date.now())

    return groups.map((group) => ({
      title: group.title,
      personCount: group.people.length,
      suggestedRoleId:
        group.suggestedRoleId !== null
          ? (group.suggestedRoleId as Id<"roles">)
          : null,
      confidence: group.confidence,
      people: group.people.map((person) => {
        const open = openByPerson.get(person._id as string) ?? null
        return {
          personId: person._id,
          displayName: person.displayName,
          externalRef: person.externalRef ?? null,
          employmentStartDate: person.employmentStartDate ?? null,
          isManager: person.isManager ?? null,
          suggestedLevel:
            group.suggestedLevelByPerson.get(person._id as string) ?? null,
          currentAssignment:
            open !== null
              ? {
                  roleId: open.roleId as Id<"roles">,
                  level: open.level,
                  levelSource: open.levelSource,
                }
              : null,
        }
      }),
    }))
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Volumes/development/blueprnt/frontend/packages/backend && bunx vitest run convex/people/classification.test.ts`
Expected: PASS (all three `listPeopleByTitle` tests green, plus the earlier `runClassificationSuggestions` tests).

- [ ] **Step 5: Typecheck and run the full backend suite**

Run: `cd /Volumes/development/blueprnt/frontend/packages/backend && bun run typecheck && bunx vitest run`
Expected: PASS (whole backend package green; no return-validator mismatches).

- [ ] **Step 6: Commit**

```bash
cd /Volumes/development/blueprnt/frontend
git add packages/backend/convex/people/classificationQueries.ts packages/backend/convex/people/classification.test.ts
git commit -m "feat(people): add listPeopleByTitle query for the classify surface"
```

---

## Produces (pinned for Plan 3)

- `api.people.classification.runClassificationSuggestions` — `orgMutation`, wire args `{ orgId: string }`, returns the OBJECT `{ suggested: number; skipped: number; unmatchedTitles: number }` (not a bare number). Call on opening the Classify surface; Plan 3 discards the return value.
- `api.people.classificationQueries.listPeopleByTitle` — `orgQuery`, wire args `{ orgId: string }`, returns `{ title: string | null; personCount: number; suggestedRoleId: Id<"roles"> | null; confidence: "high" | "medium" | "unmatched"; people: { personId: Id<"people">; displayName: string; externalRef: string | null; employmentStartDate: string | null; isManager: boolean | null; suggestedLevel: string | null; currentAssignment: { roleId: Id<"roles">; level: string; levelSource: "suggested" | "confirmed" } | null }[] }[]` (null-title group last, keyed `title: null`; unmatched titles carry `suggestedRoleId: null`, `confidence: "unmatched"`, and per-person `suggestedLevel: null`). Plan 3 prefills the group role Select from `suggestedRoleId`, renders the `confidence` badge, and prefills each person's level Select from `suggestedLevel`.
- `api.people.assignments.assignPersonToRole` — unchanged public signature (`{ orgId, personId, roleId, level, levelSource, effectiveAt? }` -> `Id<"personAssignments">`); Plan 3 calls it with `levelSource: "confirmed"` on HR confirmation.
- `writeAssignment(ctx, { orgId, actorId, personId, roleId, level, levelSource, effectiveAt })` — internal DB helper in `people/assignments.ts`; not called from the UI, listed so Plan 4 knows the shared write path exists.
- `buildTitleGroups(people, roles, now)` — the shared internal grouping+engine helper in `people/classificationShared.ts`; used by both `classifyOrg` (write path) and `listPeopleByTitle` (read path) so the suggestion is computed identically. Not exposed to the UI.
- Audit event `AUDIT_EVENTS.classificationSuggested = "classification.suggested"` with payload `{ suggested, skipped, unmatchedTitles }` and its readable label under `dashboard.auditLog.events` (under whichever key form the audit-label test derives, per Task 2 Step 4) in all five locales.

## Consumes (from Plan 1)

- `people.title: v.optional(v.string())` persisted by `upsertPersonByExternalRef` / `importPayroll`.
- `suggestRoleForTitles(titles, roles, options?)` (POSITIONAL: two arrays, not one object) and `suggestLevelForPerson({ trackKey, title?, employmentStartDate?, today })` from `@workspace/core` (pure engines). `TitleInput` carries `hasManager` (not `isManager`) and `RoleCandidate` carries `roleId` (not `id`). Plan 1's exported signatures are authoritative; the call sites in `classificationShared.ts` are written to match them exactly.

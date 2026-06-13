# Slim the role profile (delete the seven structured fields) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the seven optional structured role-profile fields (`decisionMandate`, `stakeholders`, `knowledge`, `financial`, `people`, `risk`, `deliverables`) end to end, keeping only role identity (`title`/`function`/`team`/`trackKey`/`familyId`), `purpose`, `responsibilities`, and the `isProfileComplete` gate.

**Architecture:** This is Unit 1 of the approved onboarding-role-scoring spec. The role profile collapses to identity plus a two-field text core across the Convex schema, the `roles` mutations/query, the AI suggester (generate/persist/suggest), two dashboard components, the i18n message files for all five locales, and the assessment glossary. The deterministic scoring engine, the `criteria.anchors` field, and the criterion ids are untouched.

**Tech Stack:** Convex (backend at `packages/backend`), Next.js 16 + React + next-intl (product app at `apps/dashboard`, package name `dashboard`), Turborepo, Bun, Vitest 4, Biome. Tests run with `bun run test` (NEVER `bun test`); backend tests use convex-test on the edge-runtime.

---

## CRITICAL GUARDRAIL: read before touching anything

> **The names `knowledge`, `stakeholders`, `financial`, `people`, `risk` (and `decisionMandate`, `deliverables`) exist in TWO unrelated places. This plan deletes ONE of them and must NOT touch the other.**
>
> **DELETE (role-profile fields, the subject of this unit):** these names as fields on the `roles` table, as `optionalProfileArgs`, in `PROFILE_TEXT_FIELDS`, in the `getRole` projection, in the AI role-profile zod schema / validator / prompt, in the dashboard `RoleProfile` interface / `OPTIONAL_FIELDS` / `PROFILE_FIELDS`, and as `assessment.role.*` i18n keys.
>
> **DO NOT TOUCH (criteria ids, a completely different concept):** the SAME names appear as **criterion ids / template keys** in:
> - `packages/backend/convex/evaluationModel/standardTemplate.ts` (e.g. line 25 `"knowledge"`, line 42 `knowledge: 3`)
> - `packages/backend/convex/evaluationModel/standardTemplate.content.{en,sv,nb,da,fi}.ts` (e.g. `knowledge: { ... }`)
> - `packages/core/src/scoring.fixtures.ts` (e.g. `{ criterionId: "knowledge", weightPoints: 3 }`)
> - `packages/core/src/scoring.test.ts` (e.g. `{ criterionId: "knowledge", value: 2 }`)
> - `packages/backend/convex/evaluationModel/criteria.test.ts`
>
> A criterion is a scoring dimension in the evaluation model. A role-profile field is descriptive text on a role. They merely share English words. **Any grep match inside `packages/core` or `evaluationModel` is a criterion and is OUT OF SCOPE.** Never edit those files in this unit. If a test in those files breaks, you changed the wrong thing.

---

### Task 1: Slim the `roles` table schema and regenerate Convex types

**Files:**
- Modify: `packages/backend/convex/assessment/tables.ts` (lines 28-34, the seven `v.optional(v.string())` definitions)

This is a schema-only task: removing fields the `roles` table validator declares. There is no separate failing-test step here because the change is a pure deletion that other tasks' tests depend on, and the codegen + typecheck in this task is the verification. (TDD per-task resumes from Task 2 onward, where behavior changes.)

- [ ] Open `packages/backend/convex/assessment/tables.ts`. Delete exactly these seven lines (28-34), leaving `purpose` and `responsibilities` in place:

  Remove:
  ```ts
    decisionMandate: v.optional(v.string()),
    stakeholders: v.optional(v.string()),
    knowledge: v.optional(v.string()),
    financial: v.optional(v.string()),
    people: v.optional(v.string()),
    risk: v.optional(v.string()),
    deliverables: v.optional(v.string()),
  ```

  The result must read (lines 17-39 region):
  ```ts
  export const roles = defineTable({
    orgId: v.string(),
    title: v.string(), // the role's display title, e.g. "System Developer"
    function: v.string(),
    team: v.string(),
    // Stable track key (ADR-0006): tracks are fixed V1 constants, so the
    // schema-level literal union IS the referential integrity check.
    trackKey: trackKeyValidator,
    familyId: v.optional(v.id("roleFamilies")),
    purpose: v.string(),
    responsibilities: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("inReview"),
      v.literal("approved")
    ),
    archivedAt: v.optional(v.number()),
  ```
  Do not touch `anchorRole` or the `ratings` table below it.

- [ ] Regenerate the Convex types so `Doc<"roles">` no longer carries the seven fields. Run from `packages/backend`:
  ```bash
  cd /Volumes/development/blueprnt/frontend/packages/backend && bunx convex codegen
  ```
  Expected: it writes `convex/_generated/dataModel.d.ts` etc. and exits 0 with no error. (If it prints a deployment/login prompt, codegen still updates `_generated` locally; the type artifacts are what the build needs.)

- [ ] Verify the schema compiles in isolation. Run from the repo root:
  ```bash
  bun run --filter @workspace/backend typecheck
  ```
  Expected: this will now FAIL with errors in `assessment/roles.ts`, `ai/generate.ts`, `ai/persist.ts`, and `ai/suggest.ts` (they still reference the deleted fields). That failure is expected and is fixed in Tasks 2-4. Do NOT commit yet; the full typecheck does not pass until Task 4's implementation lands, and a single commit covering Tasks 1-4 is made at the end of Task 4.

---

### Task 2: Trim `assessment/roles.ts` (field list, args, loops, projection)

**Files:**
- Modify: `packages/backend/convex/assessment/roles.ts` (lines 12-42 `PROFILE_TEXT_FIELDS` + `optionalProfileArgs`; lines 215-221 and 292-298 the `getRole` projection)
- Test: `packages/backend/convex/assessment/roles.test.ts` (lines 187-224 the `updateRole` test that uses `decisionMandate`)

- [ ] Update the failing test FIRST so it no longer references a deleted field. In `packages/backend/convex/assessment/roles.test.ts`, the `updateRole` test "patches profile fields, audits the field names, and locks approved roles" (lines 188-224) passes `decisionMandate: "  Decides implementation details  "` to `createRole` and then asserts it was stored trimmed. Replace that with `purpose` so the test exercises a kept field. Replace lines 191-203 (the `createRole` call through the first `t.run` block) with:

  ```ts
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackKey: track.key,
      purpose: "  Builds the core product  ",
    })
    await t.run(async (ctx) => {
      // Profile text fields store trimmed at create time.
      const created = await ctx.db.get(roleId)
      expect(created?.purpose).toBe("Builds the core product")
    })
  ```

  Then in the same test, the `updateRole` call that follows (lines 204-209) sets `purpose` to `"Builds the core product"` and asserts `fields: ["purpose", "responsibilities"]`. Since the create now already sets `purpose`, change the `updateRole` body and assertion to patch and audit only `responsibilities`. Replace lines 204-224 (the `updateRole` call through the closing of its `t.run`) with:

  ```ts
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      responsibilities: "Implementation and reviews",
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.responsibilities).toBe("Implementation and reviews")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0]?.payload).toEqual({
        roleId,
        fields: ["responsibilities"],
      })
    })
  ```

- [ ] Run the test to verify it fails for the RIGHT reason (compile error on the deleted field, not a logic mismatch). Run from the repo root:
  ```bash
  bun run --filter @workspace/backend test assessment/roles.test.ts
  ```
  Expected: FAIL. Vitest reports a TypeScript/transform error or runtime error because `roles.ts` (the source under test) still declares `decisionMandate` in `optionalProfileArgs` / `PROFILE_TEXT_FIELDS` while the schema no longer accepts it. This confirms the source needs the trim below.

- [ ] Write the minimal implementation in `packages/backend/convex/assessment/roles.ts`. Replace `PROFILE_TEXT_FIELDS` and its comment (lines 12-27) with:

  ```ts
  // The job profile text fields (assessment glossary). purpose and
  // responsibilities are the mandatory core (required before rating).
  // Title/function/team/track are identity, handled separately.
  export const PROFILE_TEXT_FIELDS = ["purpose", "responsibilities"] as const
  export type ProfileTextField = (typeof PROFILE_TEXT_FIELDS)[number]
  ```

- [ ] Replace `optionalProfileArgs` (lines 32-42) with the two-field version:

  ```ts
  const optionalProfileArgs = {
    purpose: v.optional(v.string()),
    responsibilities: v.optional(v.string()),
  }
  ```

- [ ] Simplify the `createRole` insert. The current insert (lines 107-124) spreads non-purpose/non-responsibilities optionals via `Object.fromEntries(...)`. Since the only optional fields are now `purpose` and `responsibilities`, remove that spread. Replace lines 107-124 (the `ctx.db.insert("roles", { ... })` call) with:

  ```ts
      const roleId = await ctx.db.insert("roles", {
        orgId: ctx.orgId,
        title,
        function: roleFunction,
        team,
        trackKey: args.trackKey,
        ...(args.familyId !== undefined ? { familyId: args.familyId } : {}),
        // purpose/responsibilities are required strings in the schema; they
        // start empty and gate the rating flow via profileComplete.
        purpose: optional.purpose ?? "",
        responsibilities: optional.responsibilities ?? "",
        status: "draft",
      })
  ```
  Leave the `const optional: Record<string, string> = {}` loop above it (lines 100-106) unchanged: it iterates `PROFILE_TEXT_FIELDS`, which is now the two fields, and still trims them.

- [ ] Trim the `getRole` returns validator. Delete these seven lines from the returns object (lines 215-221):
  ```ts
        decisionMandate: v.union(v.string(), v.null()),
        stakeholders: v.union(v.string(), v.null()),
        knowledge: v.union(v.string(), v.null()),
        financial: v.union(v.string(), v.null()),
        people: v.union(v.string(), v.null()),
        risk: v.union(v.string(), v.null()),
        deliverables: v.union(v.string(), v.null()),
  ```
  The validator keeps `purpose: v.string()` and `responsibilities: v.string()` (lines 213-214) and everything else.

- [ ] Trim the `getRole` return object. Delete these seven lines from the returned object (lines 292-298):
  ```ts
        decisionMandate: role.decisionMandate ?? null,
        stakeholders: role.stakeholders ?? null,
        knowledge: role.knowledge ?? null,
        financial: role.financial ?? null,
        people: role.people ?? null,
        risk: role.risk ?? null,
        deliverables: role.deliverables ?? null,
  ```
  Keep `purpose: role.purpose,` and `responsibilities: role.responsibilities,`.

  The `updateRole` loop (lines 365-370) iterates `PROFILE_TEXT_FIELDS` and needs no edit: it now patches only the two fields. `isProfileComplete` (lines 46-53) is unchanged.

- [ ] Run the backend typecheck. The `roles.ts` errors must be gone (the `ai/*` files still error; those are Tasks 3-4):
  ```bash
  bun run --filter @workspace/backend typecheck
  ```
  Expected: errors only in `ai/generate.ts`, `ai/persist.ts`, `ai/suggest.ts`. No errors in `assessment/roles.ts` or `assessment/tables.ts`.

- [ ] Run the roles test to verify it passes:
  ```bash
  bun run --filter @workspace/backend test assessment/roles.test.ts
  ```
  Expected: PASS. All `describe` blocks in `roles.test.ts` green (createRole, listRoles and getRole, updateRole, setRoleStatus, archiveRole, role family membership).

- [ ] Do not commit yet; the `ai/*` files still fail the full typecheck. The single commit covering Tasks 1-4 is made at the end of Task 4.

---

### Task 3: Trim the AI role-profile suggester (generate.ts + persist.ts)

**Files:**
- Modify: `packages/backend/convex/ai/generate.ts` (lines 251-271 the `roleProfileSchema` + `OPTIONAL_PROFILE_KEYS`; line 308 prompt line; lines 314-326 the strip-undefined block)
- Modify: `packages/backend/convex/ai/persist.ts` (lines 65-78 the `saveRoleProfileDraft` validator)
- Test: `packages/backend/convex/ai/suggest.test.ts` (lines 696-749 the `confirmRoleProfileDraft` test that uses `knowledge`/`financial`)

- [ ] Update the failing test FIRST. In `packages/backend/convex/ai/suggest.test.ts`, the test "confirmRoleProfileDraft applies only accepted, whitelisted, bounded fields" (lines 696-749) drafts `knowledge` and `financial` (deleted fields) and asserts they apply. Rewrite it to exercise the two kept fields plus the still-valid trust-boundary behavior (whitelist rejects non-fields, length bound skips over-long, unaccepted field stays empty). Replace lines 696-749 (the whole `it(...)` block) with:

  ```ts
    it("confirmRoleProfileDraft applies only accepted, whitelisted, bounded fields", async () => {
      const t = initConvexTest()
      const { orgId, asAdmin, roleId } = await seedRoleOrganization(t)
      const suggestionId = await asAdmin.mutation(
        api.ai.suggest.requestRoleProfileDraft,
        { orgId, roleId }
      )
      await t.mutation(internal.ai.persist.saveRoleProfileDraft, {
        suggestionId,
        profile: {
          purpose: "  Bygger och underhåller kärnprodukten.  ",
          responsibilities: "x".repeat(2001),
        },
      })
      await asAdmin.mutation(api.ai.suggest.confirmRoleProfileDraft, {
        orgId,
        suggestionId,
        acceptedFields: [
          "purpose",
          "responsibilities",
          "title",
          "nonsense",
        ],
      })
      await t.run(async (ctx) => {
        const docId = ctx.db.normalizeId("roles", roleId)
        if (docId === null) throw new Error("bad id")
        const role = await ctx.db.get(docId)
        // Accepted and valid: purpose (trimmed).
        expect(role?.purpose).toBe("Bygger och underhåller kärnprodukten.")
        // Over the length bound (responsibilities cap is 2000): skipped.
        expect(role?.responsibilities).toBe("")
        // Whitelist: title is never AI-writable.
        expect(role?.title).toBe("Junior Software Developer")
        const suggestion = await ctx.db.get(suggestionId)
        expect(suggestion?.status).toBe("confirmed")
        const updated = await ctx.db
          .query("auditLog")
          .withIndex("by_org_type", (q) =>
            q.eq("orgId", orgId).eq("type", "role.updated")
          )
          .collect()
        expect(updated.map((row) => row.payload)).toContainEqual({
          roleId: docId,
          fields: ["purpose"],
        })
      })
    })
  ```

- [ ] Run the test to verify it fails for the right reason. Run from the repo root:
  ```bash
  bun run --filter @workspace/backend test ai/suggest.test.ts
  ```
  Expected: FAIL. The suite fails to compile/run because `ai/generate.ts` and `ai/persist.ts` (transitively imported) still declare the deleted fields against the slimmed schema/types, and/or the rewritten test's expectations do not yet match the (still seven-field) persist validator. This confirms the source needs the trim below.

- [ ] Implement in `packages/backend/convex/ai/generate.ts`. Replace `roleProfileSchema` and `OPTIONAL_PROFILE_KEYS` (lines 251-271) with:

  ```ts
  const roleProfileSchema = z.object({
    purpose: z.string().min(1).max(1000),
    responsibilities: z.string().min(1).max(2000),
  })
  ```
  (Delete the `OPTIONAL_PROFILE_KEYS` constant entirely; nothing else references it after the edits below.)

- [ ] In the same file, fix the prompt line. Replace line 308 (the "Include the optional fields ..." line) by deleting it. The prompt array (lines 301-309) keeps the line 307 instruction and the closing; after deletion the relevant lines read:

  ```ts
          "Return purpose (one or two sentences: why the role exists) and responsibilities (4 to 7 key responsibility areas, one per line).",
        ]
  ```
  (Remove only the single string `"Include the optional fields (decisionMandate, ...); omit them otherwise."`. Leave the `.filter(...).join("\n")` chain intact.)

- [ ] In the same file, simplify the profile-build block. Replace lines 314-326 (the comment, the typed `profile` object, and the `for (const key of OPTIONAL_PROFILE_KEYS)` loop) with a plain two-field object:

  ```ts
        const profile = {
          purpose: result.output.purpose,
          responsibilities: result.output.responsibilities,
        }
  ```
  The `await ctx.runMutation(internal.ai.persist.saveRoleProfileDraft, { suggestionId, profile })` call below (lines 327-330) is unchanged.

- [ ] Implement in `packages/backend/convex/ai/persist.ts`. Replace the `saveRoleProfileDraft` args validator (lines 67-78) with the two-field profile:

  ```ts
    args: {
      suggestionId: v.id("suggestions"),
      profile: v.object({
        purpose: v.optional(v.string()),
        responsibilities: v.optional(v.string()),
      }),
    },
  ```
  The handler (lines 81-87) is unchanged.

  No edit needed in `ai/suggest.ts`: `ROLE_PROFILE_FIELDS = PROFILE_TEXT_FIELDS` (line 373) now resolves to the two fields automatically, and `maxLengthFor` (lines 375-377) already returns 2000 for `responsibilities` and 1000 otherwise, which still makes sense for `purpose`. The confirm loop (line 468) follows automatically.

- [ ] Run the backend typecheck. All `ai/*` errors must now be gone:
  ```bash
  bun run --filter @workspace/backend typecheck
  ```
  Expected: PASS (exit 0, no errors).

- [ ] Run the AI suggest test:
  ```bash
  bun run --filter @workspace/backend test ai/suggest.test.ts
  ```
  Expected: PASS. The rewritten `confirmRoleProfileDraft` test and the `editors can dismiss role-profile drafts` test (lines 569-627, which only uses `purpose`/`responsibilities`) are green.

- [ ] Run the full backend package test to confirm nothing else regressed:
  ```bash
  bun run --filter @workspace/backend test
  ```
  Expected: PASS. All backend test files green (this includes `evaluationModel/criteria.test.ts` and any `scoring`-adjacent backend tests, which must stay green because the criterion ids were not touched).

---

### Task 4: Update the dashboard components (`role-profile-card.tsx`, `role-ai-panel.tsx`) and their tests

**Files:**
- Modify: `apps/dashboard/components/roles/role-profile-card.tsx` (lines 24-54 the `RoleProfile` interface + `OPTIONAL_FIELDS`; lines 81-92 `currentValues`; lines 136-148 `textRows`)
- Modify: `apps/dashboard/components/roles/role-ai-panel.tsx` (lines 18-29 the `PROFILE_FIELDS` list)
- Test: `apps/dashboard/components/roles/role-profile-card.test.tsx` (lines 41-63 `makeRole`; line 85 the "7 blank optional fields" assertion)
- Test: `apps/dashboard/components/roles/role-ai-panel.test.tsx` (no structural change needed; verify it still passes)

- [ ] Update the failing test FIRST in `apps/dashboard/components/roles/role-profile-card.test.tsx`. Remove the seven null fields from `makeRole` (lines 41-63). Replace that function with:

  ```ts
  function makeRole(overrides?: Partial<RoleProfile>): RoleProfile {
    return {
      roleId: "role-1" as never,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackName: "Individual contributor",
      familyId: null,
      familyName: null,
      purpose: "Builds the product",
      responsibilities: "Implementation",
      status: "draft",
      archived: false,
      ...overrides,
    }
  }
  ```

- [ ] In the same test file, fix the empty-field assertion. The test "renders read mode with the empty-field hint for blank optionals" (lines 81-90) asserts `screen.getAllByText(labels.emptyField)` has length 7. With the optionals gone, the only profile text rows are `purpose` and `responsibilities`, both populated in `makeRole`, so there are now zero empty-field hints. Rename and rewrite the test (lines 81-90) to:

  ```ts
    it("renders read mode with the purpose and responsibilities text, no inputs", () => {
      renderCard(makeRole())
      expect(screen.getByText("Builds the product")).toBeDefined()
      expect(screen.getByText("Implementation")).toBeDefined()
      // No textbox inputs in read mode.
      expect(
        screen.queryByRole("textbox", { name: roleLabels.purpose })
      ).toBeNull()
    })
  ```

- [ ] Run the card test to verify it fails for the right reason. Run from the repo root:
  ```bash
  bun run --filter dashboard test role-profile-card.test.tsx
  ```
  Expected: FAIL. The test does not compile because the `RoleProfile` type in `role-profile-card.tsx` still requires the seven fields that `makeRole` no longer provides (TS error "missing properties decisionMandate, ..."). This confirms the component type needs trimming. (The filter `dashboard` is the exact `name` in `apps/dashboard/package.json`; using a wrong filter prints "No packages matched the filter" but still exits 0, so an empty run would falsely look green. Always use `--filter dashboard`.)

- [ ] Implement in `apps/dashboard/components/roles/role-profile-card.tsx`. Trim the `RoleProfile` interface (lines 24-43) by deleting the seven `... : string | null` lines. Result:

  ```ts
  // Structural subset of getRole used by this card.
  export interface RoleProfile {
    roleId: Id<"roles">
    title: string
    function: string
    team: string
    trackName: string
    familyId: string | null
    familyName: string | null
    purpose: string
    responsibilities: string
    status: string
    archived: boolean
  }
  ```

- [ ] Delete the `OPTIONAL_FIELDS` constant and its type (lines 45-54):
  ```ts
  const OPTIONAL_FIELDS = [ ... ] as const
  type OptionalField = (typeof OPTIONAL_FIELDS)[number]
  ```
  (Remove both entirely.)

- [ ] Simplify `currentValues` (lines 81-92) to drop the `OPTIONAL_FIELDS` spread:

  ```ts
    function currentValues(): Record<string, string> {
      return {
        title: role.title,
        function: role.function,
        team: role.team,
        purpose: role.purpose,
        responsibilities: role.responsibilities,
      }
    }
  ```

- [ ] Simplify `textRows` (lines 136-148) to the two kept rows:

  ```ts
    const textRows: { key: string; label: string; value: string }[] = [
      { key: "purpose", label: tRole("purpose"), value: role.purpose },
      {
        key: "responsibilities",
        label: tRole("responsibilities"),
        value: role.responsibilities,
      },
    ]
  ```
  The JSX that maps `textRows` (lines 231-262) and the `t("emptyField")` fallback inside it are unchanged: they still correctly render a hint if `purpose` or `responsibilities` is blank.

- [ ] Implement in `apps/dashboard/components/roles/role-ai-panel.tsx`. Replace the `PROFILE_FIELDS` list (lines 18-29) with the two fields:

  ```ts
  const PROFILE_FIELDS = ["purpose", "responsibilities"] as const
  type ProfileField = (typeof PROFILE_FIELDS)[number]
  ```
  Everything downstream (`suggestedFields`, the checkbox list, `tRole(field)`) follows automatically.

- [ ] Run the card test to verify it passes. Run from the repo root:
  ```bash
  bun run --filter dashboard test role-profile-card.test.tsx
  ```
  Expected: PASS. All `RoleProfileCard` tests green.

- [ ] Run the AI panel test (no source-field references to the deleted names, so it should still pass unchanged). Run from the repo root:
  ```bash
  bun run --filter dashboard test role-ai-panel.test.tsx
  ```
  Expected: PASS. The `RoleAiPanel` suite uses only `purpose`/`responsibilities` in its mock rows, so all tests stay green.

- [ ] Run the dashboard package typecheck to confirm no other consumer referenced the deleted `RoleProfile` fields. Run from the repo root:
  ```bash
  bun run --filter dashboard typecheck
  ```
  Expected: PASS (exit 0). If a page that maps `getRole` into `RoleProfile` (e.g. the role detail page) passed the seven fields explicitly, fix it by deleting those props at that call site; re-run until green.

- [ ] Now make the single backend+frontend commit covering Tasks 1-4 (deferred from Tasks 1-3 so the full-repo typecheck in the pre-commit hook passes). Stage all source + test changes from Tasks 1-4:
  ```bash
  cd /Volumes/development/blueprnt/frontend
  git add packages/backend/convex/assessment/tables.ts \
          packages/backend/convex/assessment/roles.ts \
          packages/backend/convex/assessment/roles.test.ts \
          packages/backend/convex/ai/generate.ts \
          packages/backend/convex/ai/persist.ts \
          packages/backend/convex/ai/suggest.test.ts \
          packages/backend/convex/_generated \
          apps/dashboard/components/roles/role-profile-card.tsx \
          apps/dashboard/components/roles/role-profile-card.test.tsx \
          apps/dashboard/components/roles/role-ai-panel.tsx
  git commit -m "refactor(assessment): delete the seven structured role-profile fields

Slim the role profile to identity (title/function/team/track/family) plus
purpose and responsibilities, end to end: roles table schema, PROFILE_TEXT_FIELDS,
optionalProfileArgs, createRole insert, getRole projection, the AI role-profile
zod schema/prompt/build in ai/generate.ts, the saveRoleProfileDraft validator in
ai/persist.ts (ai/suggest.ts follows PROFILE_TEXT_FIELDS), and the dashboard
RoleProfileCard and RoleAiPanel field lists. The isProfileComplete gate
(purpose + responsibilities) is unchanged. Regenerated Convex types.

The criterion ids of the same names (knowledge/stakeholders/financial/people/
risk) in standardTemplate, packages/core, and evaluationModel are a different
concept and were not touched.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
  Expected: the pre-commit hook runs Biome on staged files, the full typecheck, and `turbo run test` (cache-backed). All three pass and the commit lands.

---

### Task 5: Delete the seven `assessment.role.*` i18n keys from all five locales

**Files:**
- Modify: `packages/i18n/messages/en.json` (the `assessment.role` object: `decisionMandate`, `stakeholders`, `knowledge`, `financial`, `people`, `risk`, `deliverables`)
- Modify: `packages/i18n/messages/sv.json` (same keys)
- Modify: `packages/i18n/messages/nb.json` (same keys)
- Modify: `packages/i18n/messages/da.json` (same keys)
- Modify: `packages/i18n/messages/fi.json` (same keys)
- Test: `packages/i18n/src/messages.test.ts` (the parity test; run it, do not edit it)

English is the base locale (the `Messages` type is generated from `en.json`), so delete from `en.json` FIRST, then mirror the deletion to the other four so the parity test stays green.

- [ ] In `packages/i18n/messages/en.json`, locate the `assessment.role` object and delete exactly these seven entries, keeping `label`, `title`, `function`, `team`, `purpose`, `responsibilities`:
  ```json
  "decisionMandate": "Decision mandate",
  "stakeholders": "Stakeholders",
  "knowledge": "Knowledge requirements",
  "financial": "Financial responsibility",
  "people": "People responsibility",
  "risk": "Risk/consequence",
  "deliverables": "Deliverables"
  ```
  Ensure the JSON stays valid (the entry before the deleted block, `responsibilities`, must not have a trailing comma if it becomes the last key, or must keep its comma if other keys follow it; verify the closing `}` of `role`).

- [ ] In `packages/i18n/messages/sv.json`, delete the same seven keys from `assessment.role`:
  ```json
  "decisionMandate": "Beslutsmandat",
  "stakeholders": "Intressenter",
  "knowledge": "Kunskapskrav",
  "financial": "Finansiellt ansvar",
  "people": "Personalansvar",
  "risk": "Risk/konsekvens",
  "deliverables": "Leverabler"
  ```

- [ ] In `packages/i18n/messages/nb.json`, delete the same seven keys from `assessment.role`:
  ```json
  "decisionMandate": "Beslutningsmandat",
  "stakeholders": "Interessenter",
  "knowledge": "Kompetansekrav",
  "financial": "Økonomisk ansvar",
  "people": "Personalansvar",
  "risk": "Risiko/konsekvens",
  "deliverables": "Leveranser"
  ```

- [ ] In `packages/i18n/messages/da.json`, delete the same seven keys from `assessment.role`:
  ```json
  "decisionMandate": "Beslutningsmandat",
  "stakeholders": "Interessenter",
  "knowledge": "Kompetencekrav",
  "financial": "Økonomisk ansvar",
  "people": "Personaleansvar",
  "risk": "Risiko/konsekvens",
  "deliverables": "Leverancer"
  ```

- [ ] In `packages/i18n/messages/fi.json`, delete the same seven keys from `assessment.role`:
  ```json
  "decisionMandate": "Päätösvaltuudet",
  "stakeholders": "Sidosryhmät",
  "knowledge": "Osaamisvaatimukset",
  "financial": "Taloudellinen vastuu",
  "people": "Henkilöstövastuu",
  "risk": "Riski/seuraukset",
  "deliverables": "Tuotokset"
  ```

- [ ] Verify all five files are still valid JSON. Run from the repo root:
  ```bash
  cd /Volumes/development/blueprnt/frontend && for f in en sv nb da fi; do node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/$f.json','utf8')); console.log('$f ok')"; done
  ```
  Expected: `en ok`, `sv ok`, `nb ok`, `da ok`, `fi ok`.

- [ ] Run the i18n parity test:
  ```bash
  bun run --filter @workspace/i18n test
  ```
  Expected: PASS. "message file parity" describe block green for da/fi/nb/sv (every locale has exactly the keys of en.json) and the messages-folder-matches-routing test green. If it FAILS reporting a key present in one locale but not another, you missed a deletion in that locale; fix and re-run.

- [ ] Run the dashboard typecheck again. The `Messages` type is regenerated from `en.json`, so any remaining `tRole("knowledge")`-style call would now be a type error. Run from the repo root:
  ```bash
  bun run --filter dashboard typecheck
  ```
  Expected: PASS (exit 0). Tasks 2-4 already removed every call to the deleted keys, so this confirms nothing else references them. (Use `--filter dashboard`: a wrong filter would match no package and exit 0 without running anything, masking a real type error.)

- [ ] Commit the i18n deletions:
  ```bash
  cd /Volumes/development/blueprnt/frontend
  git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
  git commit -m "refactor(i18n): delete the seven structured role-profile keys in all locales

Remove assessment.role.{decisionMandate,stakeholders,knowledge,financial,
people,risk,deliverables} from en/sv/nb/da/fi. Keep title/function/team/
purpose/responsibilities. Parity test stays green.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
  Expected: hook passes, commit lands.

---

### Task 6: Update the assessment glossary (`docs/contexts/assessment/CONTEXT.md`)

**Files:**
- Modify: `docs/contexts/assessment/CONTEXT.md` (the "Jobbprofil" definition, lines 11-14; the i18n string table, the seven rows at lines 55-61)

This is a docs change (Swedish domain document; per CLAUDE.md, domain docs are in Swedish). No test, but it ships in the same unit so the glossary matches the code.

- [ ] Read the current "Jobbprofil" definition. Replace the definition body (line 12, the line beginning `Den standardiserade beskrivningen...`) with a slim-core version that notes the structured fields are deferred. Replace line 12 with:

  ```
  Den standardiserade beskrivningen av en roll som krävs som input före värdering. Obligatorisk kärna: identitet (titel, funktion/avdelning, team, track) plus syfte och ansvarsområden. Titeln är rollens visningstitel (t.ex. "System Developer"); ingen nivå anges (ADR-0005). Standardiserad input = jämförbara värderingar. De tidigare strukturerade valfria fälten (beslutsmandat, intressenter, kunskapskrav, finansiellt ansvar, personalansvar, risk/konsekvens, leverabler) är borttagna före lansering för enkelhet; de kan återinföras senare utan migrationskostnad.
  ```
  Leave the `_Undvik (fältet titel)_` and `_Undvik_` lines (13-14) unchanged.

- [ ] In the i18n string table ("Översättningssträngar"), delete the seven rows for the removed keys (lines 55-61):
  ```
  | `assessment.role.decisionMandate` | Beslutsmandat | Decision mandate |
  | `assessment.role.stakeholders` | Intressenter | Stakeholders |
  | `assessment.role.knowledge` | Kunskapskrav | Knowledge requirements |
  | `assessment.role.financial` | Finansiellt ansvar | Financial responsibility |
  | `assessment.role.people` | Personalansvar | People responsibility |
  | `assessment.role.risk` | Risk/konsekvens | Risk/consequence |
  | `assessment.role.deliverables` | Leverabler | Deliverables |
  ```
  Keep the `assessment.role.title`, `.function`, `.team`, `.purpose`, `.responsibilities` rows and every other table row.

- [ ] Verify the doc has no leftover mention of the deleted fields as profile fields. Run from the repo root:
  ```bash
  cd /Volumes/development/blueprnt/frontend && grep -n "decisionMandate\|stakeholders\|deliverables" docs/contexts/assessment/CONTEXT.md
  ```
  Expected: matches only inside the rewritten "Jobbprofil" sentence (the parenthetical listing the deferred fields). No matches in the i18n table. (The criterion-related glossary mentions of `kunskapskrav` etc., if any, belong to the evaluation-model glossary, not this file, and are out of scope.)

- [ ] Commit the glossary update:
  ```bash
  cd /Volumes/development/blueprnt/frontend
  git add docs/contexts/assessment/CONTEXT.md
  git commit -m "docs(assessment): rewrite Jobbprofil to the slim core and drop the seven i18n rows

The job profile is now identity (titel/funktion/team/track) plus syfte and
ansvarsområden. Note the structured fields are deferred pre-launch and can
return without migration cost. Drop the seven assessment.role.* rows from the
i18n table.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
  Expected: hook passes (docs-only change; Biome ignores Markdown content, typecheck and tests unaffected), commit lands.

---

### Task 7: Full-suite verification of the unit

**Files:** none (verification only).

- [ ] Run the complete, cache-backed test suite from the repo root exactly as the pre-commit hook does:
  ```bash
  cd /Volumes/development/blueprnt/frontend && bun run test
  ```
  Expected: PASS across all packages. In particular: `@workspace/backend` (roles.test, suggest.test, criteria.test all green), `@workspace/core` (scoring.test green: the criterion ids `knowledge`/`stakeholders`/`financial`/`people`/`risk` were untouched), `@workspace/i18n` (parity green), and the dashboard app (role-profile-card, role-ai-panel green).

- [ ] Run the full repo typecheck across every package:
  ```bash
  cd /Volumes/development/blueprnt/frontend && bun run --filter "*" typecheck
  ```
  Expected: PASS (exit 0) in every package. (If `--filter "*"` is not how this repo runs the full typecheck, the equivalent is `turbo run typecheck`. Both run every package; do NOT substitute a single-package filter here.)

- [ ] Confirm the guardrail held: the criterion-id files were NOT modified in this unit. Run:
  ```bash
  cd /Volumes/development/blueprnt/frontend && git diff --name-only HEAD~3 HEAD | grep -E "scoring|standardTemplate|evaluationModel" || echo "GUARDRAIL OK: no criterion-id files changed"
  ```
  Expected: `GUARDRAIL OK: no criterion-id files changed`. If any `scoring*`, `standardTemplate*`, or `evaluationModel/*` file appears, a criterion was wrongly touched: revert that file and re-verify.

---

## Done when

- [ ] The `roles` table in `packages/backend/convex/assessment/tables.ts` declares only identity + `purpose` + `responsibilities` (+ `status`, `archivedAt`, `anchorRole`); the seven optional fields are gone and `bunx convex codegen` has regenerated `_generated`.
- [ ] `PROFILE_TEXT_FIELDS` is `["purpose", "responsibilities"]`; `optionalProfileArgs`, the `createRole` insert, and the `getRole` projection carry only those two text fields; `isProfileComplete` is unchanged.
- [ ] `ai/generate.ts` `roleProfileSchema` and prompt cover only the two fields (`OPTIONAL_PROFILE_KEYS` deleted); `ai/persist.ts` `saveRoleProfileDraft` validator covers only the two fields; `ai/suggest.ts` is unchanged and follows `PROFILE_TEXT_FIELDS`.
- [ ] `RoleProfileCard`'s `RoleProfile` interface and `RoleAiPanel`'s `PROFILE_FIELDS` carry only the two fields; `OPTIONAL_FIELDS` is deleted.
- [ ] The seven `assessment.role.*` keys are gone from all five locale files and the i18n parity test passes.
- [ ] `docs/contexts/assessment/CONTEXT.md` Jobbprofil definition and i18n table reflect the slim core.
- [ ] `bun run test` and the full typecheck pass repo-wide; the criterion-id files in `packages/core` and `evaluationModel` are untouched.

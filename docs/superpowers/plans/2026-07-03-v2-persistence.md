# V2 Salary Import — Plan 2: the `people` / `pay` persistence domain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Use the `convex:convex-expert` agent type for the Convex tasks.

**Goal:** Add the org-scoped `people` bounded context to the Convex backend: employees, effective-dated person→role assignments, effective-dated salary history (import + manual entry), and a saved import-mapping profile — with audit rows, GDPR hard-delete erasure, and full convex-test coverage. This is the data layer the import action (Plan 3) and the wizard (Plan 4) build on.

**Architecture:** A new bounded context `packages/backend/convex/people/` (tables + entity modules), wired into `schema.ts`. All functions org-scoped via `orgMutation`/`orgQuery`/`adminMutation` (`lib/functions.ts`). Every state-changing mutation writes an audit row via `ctx.audit.log` with a new `AUDIT_EVENTS` key + a compile-guarded `AuditPayloads` entry + an i18n label in all 5 locales. Salaries and assignments are append-only effective-dated history (current = latest `effectiveAt`, derived at read time, never cached). Erasure of a person is a true hard delete wired into the existing `eraseSelf` / `deleteUser` / dev-teardown flows.

**Tech Stack:** Convex (object-syntax functions), Vitest 4 + convex-test (`edge-runtime`), next-intl i18n.

## Global Constraints

- **Role ≠ Person (absolute):** `roles`/`ratings` gain nothing. Person, salary, gender, and performance data live ONLY in the new `people` context. Audit payloads carry IDs and codes, never person PII (name/email) — so erasure leaves no PII.
- **Org-scoped:** every table's first field is `orgId: v.string()` with a `by_org` index; every function uses the `orgMutation`/`orgQuery`/`adminMutation` wrappers (they inject `ctx.orgId`/`ctx.role`/`ctx.authUserId`/`ctx.audit`). Point-reads by id must assert `row.orgId === ctx.orgId` and throw `appError(ERROR_CODES.notFound)` (mirror `requireOwnRole`, `assessment/roles.ts:47-56`).
- **Audit every state change:** new `AUDIT_EVENTS` key (`lib/audit.ts`) + `AuditPayloads` entry (`lib/auditPayloads.ts`, compile-guarded) + label under `dashboard.auditLog.events` in ALL 5 locales, plus the new `people`/`pay` categories in `AUDIT_CATEGORIES` + `categoryForEvent` + `dashboard.auditLog.categories` (5 locales). The `apps/dashboard/lib/audit-labels.test.ts` coverage test + the i18n parity test guard this. `band.shift` does NOT apply here (people/pay never reach `deriveResults`).
- **Effective-dated, never cached:** assignments + salaries are append-only rows with `effectiveAt: v.number()` (epoch ms). Current value = the row with the greatest `effectiveAt <= now`. Never store a mutable "current salary" on the person.
- **Erasure = true hard delete:** child rows first (payRecords → personAssignments → person), `ctx.db.delete`. No soft flag on the person for erasure (a *leaver* is a soft `archivedAt`; an *erased* person is deleted).
- **Effective dates come from the caller, not the engine.** Mutations may read `Date.now()` (Convex mutations are allowed to); pure helpers must not.
- New code ships with tests in the same commit (convex-test, `bun run test`, never `bun test`). English identifiers/comments; no em dashes. Use `appError(ERROR_CODES.*)`, never raw throws. `returns` validator mandatory; return `null` not `undefined`.
- Use the `convex:convex-expert` agent for implementation; it must read the referenced pattern files before writing.

---

### Task 1: Schema — the four `people` tables

**Files:** Create `packages/backend/convex/people/tables.ts`; Modify `packages/backend/convex/schema.ts`, `packages/backend/package.json`; Test `packages/backend/convex/people/schema.test.ts` (a smoke insert/read per table).

**Pattern to mirror:** `assessment/tables.ts:9-72` (table + `by_org` baseline), `schema.ts:1-30` (import + spread), `package.json:20-22` (`@workspace/*` deps).

Tables (all `orgId: v.string()` first, `.index("by_org", ["orgId"])` first):
- `people`: `orgId`, `externalRef: v.optional(v.string())` (Anstnr, import upsert key), `displayName: v.string()`, `gender: v.union(v.literal("Man"), v.literal("Kvinna"))`, `birthDate: v.optional(v.string())` (full YYYY-MM-DD), `employmentStartDate: v.optional(v.string())`, `ftePercent: v.optional(v.number())`, `country: v.optional(v.string())`, `isManager: v.optional(v.boolean())`, `statisticalCode: v.optional(v.string())`, `department: v.optional(v.string())`, `archivedAt: v.optional(v.number())` (leaver soft-archive; NOT erasure). Indexes: `by_org`, `by_org_externalRef` (`["orgId","externalRef"]`).
- `personAssignments`: `orgId`, `personId: v.id("people")`, `roleId: v.id("roles")`, `level: v.string()` (per-individual within the role's track), `levelSource: v.union(v.literal("suggested"), v.literal("confirmed"))`, `effectiveAt: v.number()`, `endedAt: v.optional(v.number())`. Indexes: `by_org`, `by_person` (`["orgId","personId"]`), `by_role` (`["orgId","roleId"]`).
- `payRecords`: `orgId`, `personId: v.id("people")`, `payYear: v.number()` (Löneår), `source: v.union(v.literal("import"), v.literal("manual"))`, `basicMonthly: v.number()`, `currency: v.string()`, `variable: v.optional(v.number())`, `benefitInKind: v.optional(v.number())`, `effectiveAt: v.number()`, `createdAt: v.number()`. Indexes: `by_org`, `by_person` (`["orgId","personId"]`).
- `importMappingProfiles`: `orgId`, `columnMap: v.record(v.string(), v.string())` (canonical field → source header), `parseRules: v.optional(v.object({ delimiter: v.optional(v.string()) }))`, `updatedAt: v.number()`. Index: `by_org`. One active profile per org.

Also add `"@workspace/import": "workspace:*"` to `packages/backend/package.json` dependencies and run `bun install` (Plan 3's action needs it; declaring it here keeps the schema task self-contained).

- [ ] Step 1: Add the `@workspace/import` dep + `bun install`.
- [ ] Step 2: Write `people/schema.test.ts` — for each table, `initConvexTest()` then `t.run` insert a minimal row + read it back, asserting the id and a field. Run it, confirm it fails (tables not defined).
- [ ] Step 3: Create `people/tables.ts` + register the four tables in `schema.ts`.
- [ ] Step 4: Run the test, confirm pass; `bun run typecheck` for `@workspace/backend`.
- [ ] Step 5: Commit (`feat(people): add the people/pay bounded-context schema`).

---

### Task 2: Audit foundation for `people`/`pay`

**Files:** Modify `convex/lib/audit.ts`, `convex/lib/auditPayloads.ts`, all 5 `packages/i18n/messages/*.json`. Test: the existing `apps/dashboard/lib/audit-labels.test.ts` + i18n parity must pass (no test edits needed; they auto-guard).

**Pattern to mirror:** `lib/audit.ts:10-72` (AUDIT_EVENTS / AUDIT_CATEGORIES / categoryForEvent), `lib/auditPayloads.ts:144-324` (interface + compile guards), `en.json:279-309` (event labels) + `categories`.

- Add `AUDIT_EVENTS`: `personCreated: "person.created"`, `personUpdated: "person.updated"`, `personArchived: "person.archived"`, `personErased: "person.erased"`, `assignmentSet: "assignment.set"`, `salarySet: "pay.salarySet"`, `mappingProfileSaved: "pay.mappingSaved"`. (Import-batch + employeeCount events are Plan 3.)
- Add `"people"` + `"pay"` to `AUDIT_CATEGORIES`; extend `categoryForEvent` (`person.`/`assignment.` → `"people"`; `pay.` → `"pay"`).
- Add one `AuditPayloads` entry per new key (IDs + `changes` only; `person.erased` = `{ personId; changes }` with NO name/email). Use the compile guards to verify.
- Define `PERSON_AUDIT_FIELDS` in `lib/audit.ts` (mirror `ROLE_CREATE_FIELDS:349-357`) for the person create/update/delete diffs.
- Add labels under `dashboard.auditLog.events` (camelCase keys: `personCreated`, `assignmentSet`, `salarySet`, `mappingProfileSaved`, `personArchived`, `personErased`) AND `dashboard.auditLog.categories.people` / `.pay`, in ALL 5 locales.

- [ ] Step 1: Add the events/categories/payloads in `audit.ts` + `auditPayloads.ts`; run `bun run typecheck` for backend (the compile guards fail if keys/payloads drift). Confirm it passes.
- [ ] Step 2: Add the i18n labels + categories in all 5 locales.
- [ ] Step 3: Run `apps/dashboard` audit-label coverage test + `packages/i18n` parity; confirm both pass.
- [ ] Step 4: Commit (`feat(people): register people/pay audit events and labels`).

---

### Task 3: `people` mutations + queries

**Files:** Create `convex/people/people.ts`, `convex/people/people.test.ts`.
**Pattern:** `assessment/roles.ts` create (96-175) / list (177-238) / `requireOwnRole` (47-56); `families.ts:73-74` (no-op update writes nothing).

- `createPerson` (`orgMutation`): args = the person fields (no `orgId`); insert with `orgId: ctx.orgId`; audit `personCreated` with `buildCreateChanges`; returns `v.id("people")`.
- `upsertPersonByExternalRef` (`internalMutation`): args include `orgId`, `actorId`, `externalRef`, fields; look up by `by_org_externalRef`; insert or patch; audit created/updated (call `logAudit` free-function with orgId+actorId, like `mirrors.ts`); returns the id. (Import path uses this.)
- `listPeople` / `getPerson` (`orgQuery`): `by_org` list; point-read asserts `orgId`.
- `archivePerson` (`adminMutation`): set `archivedAt` (leaver, NOT erasure); audit `personArchived`. Unchanged → no-op.
- Tenant isolation + `appError(ERROR_CODES.notFound)` on cross-org / missing.

- [ ] Steps: TDD each (create + audit assertion; list scoped to org; cross-org isolation; upsert insert-then-update; archive). Run `cd packages/backend && bunx vitest run convex/people/people.test.ts`. Commit (`feat(people): person create/list/get/archive + external-ref upsert`).

---

### Task 4: `personAssignments` (effective-dated person→role)

**Files:** Create `convex/people/assignments.ts`, `convex/people/assignments.test.ts`.

- `assignPersonToRole` (`orgMutation`): args `personId`, `roleId`, `level`, `levelSource`, optional `effectiveAt` (default `Date.now()`); assert the person + role belong to `ctx.orgId`; validate `level` against the role's `trackKey` (a helper `isValidLevelForTrack(trackKey, level)` — reuse/read the existing track/level definitions; if none exists yet, accept a documented level string set per track and note it). Append a new assignment row (do not mutate prior rows; close the previous open one by setting its `endedAt` = new `effectiveAt`). Audit `assignmentSet`. Returns the id.
- `getCurrentAssignment` / `listAssignmentsForPerson` (`orgQuery`): current = greatest `effectiveAt <= now` with no `endedAt`.
- [ ] Steps: TDD (assign; level-vs-track validation rejects a bad level; re-assign closes the prior interval; current-assignment derivation; cross-org isolation). Commit (`feat(people): effective-dated person-to-role assignments`).

---

### Task 5: `payRecords` (salary history: manual + import append)

**Files:** Create `convex/people/pay.ts`, `convex/people/pay.test.ts`.

- `setSalary` (`orgMutation`, manual entry): args `personId`, `payYear`, `basicMonthly`, `currency`, optional `variable`/`benefitInKind`/`effectiveAt` (default now); assert person in org; APPEND a `payRecords` row with `source: "manual"`, `createdAt: Date.now()`; audit `salarySet`. Returns the id. (Never overwrites; a raise is a new row.)
- `appendSalary` (`internalMutation`): same insert with `source: "import"` (import path uses this).
- `getSalaryHistory` / `getCurrentSalary` (`orgQuery`): history sorted by `effectiveAt`; current = greatest `effectiveAt <= now`. Return raw components (no FTE-adjusted figure — that is derived later by the gap engine).
- [ ] Steps: TDD (manual set appends; a second set appends a new row and keeps the first; current = latest; import-source append via internal; cross-org isolation). Commit (`feat(pay): effective-dated salary history with manual entry`).

---

### Task 6: `importMappingProfiles` (saved column mapping)

**Files:** Create `convex/people/importProfile.ts`, `convex/people/importProfile.test.ts`.

- `saveImportMappingProfile` (`orgMutation`): args `columnMap`, optional `parseRules`; upsert the single per-org row (look up by `by_org`; patch or insert); set `updatedAt`; audit `mappingProfileSaved`. Returns `v.null()`.
- `getImportMappingProfile` (`orgQuery`): returns the org's profile or `null`.
- [ ] Steps: TDD (save then get; save again updates in place, not a second row; cross-org isolation). Commit (`feat(pay): saved import-mapping profile`).

---

### Task 7: GDPR erasure (admin erase-person) + dev-teardown wiring

**Decision (confirmed with the owner):** imported employees are payroll DATA, not app users, so erasure is a dedicated **admin action on a `personId`** — NOT the self-service `eraseSelf` / platform `deleteUser` flows (those erase app-user identities, which `people` rows are not linked to in V2). If a `people`↔app-user link is ever added, `eraseSelf` should then cascade to it (future, out of scope).

**Files:** Create `convex/people/erase.ts` (the `erasePerson` mutation); Modify `convex/accounts/mirrors.ts` (`removeSeededOrganization`). Test: `convex/people/erase.test.ts` + extend the mirrors dev-teardown test.

**Pattern:** `platform/admin.ts:652-707` (cascade child deletes → parent → audit), `accounts/mirrors.ts:90-136` (dev-teardown table loop).

- `erasePerson` (`adminMutation`): args `personId`; assert the person belongs to `ctx.orgId`; hard-delete child-first — all `payRecords`, then `personAssignments` (via `by_person`), then the `people` row (`ctx.db.delete`); audit `personErased` with IDs only (no name/email — GDPR). Returns `v.null()`. A true hard delete (right to erasure), not an archive.
- Extend `removeSeededOrganization`'s table loop to also delete `payRecords`, `personAssignments`, `people`, `importMappingProfiles` (child-first order).
- [ ] Steps: TDD (seed person + assignment + pay via `t.run`; call `erasePerson`; assert all three tables have no rows for that person and the `person.erased` audit payload carries only ids; cross-org — cannot erase another org's person; dev-teardown removes the four new tables). Commit (`feat(people): admin erase-person hard delete + dev teardown`).

---

## Self-review
- Spec coverage: implements spec §4.1-4.3 + §4.6 (the `people`/`personAssignments`/`payRecords`/`importMappingProfile` tables), the manual-salary path (§ decision 8), effective-dated history (§ decisions 7/8), audit (§4.5 multi-actor groundwork), and erasure/§9. Excludes the import ACTION (tokenize+validate+upsert+employeeCount — Plan 3), the wizard UI (Plan 4), and classification/level suggestion (Plan 5).
- Invariants: Role ≠ Person (new context only), org-scoped, audit-every-mutation, hard-delete erasure, effective-dated-never-cached — all in Global Constraints and each task.
- Open item to resolve during Task 4: the exact per-track level ladder (Lead 1-2 vs 1-3; reconcile against V1's live model, flagged in the spec §10). If undefined, accept a documented level-string set and leave a TODO referencing the spec open item.
- Task 7 erasure model (RESOLVED with the owner): imported people are data, not app users; erasure is a dedicated admin `erasePerson(personId)` + dev teardown, with no `eraseSelf` cascade (no people↔user link in V2).

## Follow-on plans
3. **Import action + employeeCount:** a `"use node"` action that tokenizes + validates via `@workspace/import`, upserts people/assignments/pay (via Tasks 3-5 internal mutations), saves the mapping profile, and patches authoritative `organizations.employeeCount`; audit `import.completed`.
4. **Import wizard UI** on the onboarding frame.
5. **Classification:** title → role mapping + HR-confirmed level suggestion.

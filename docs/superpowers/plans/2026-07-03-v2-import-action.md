# V2 Salary Import — Plan 3: the import action

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Use the `convex:convex-expert` agent for the Convex tasks. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A Convex action that ingests a payroll CSV end-to-end: tokenize + validate it with `@workspace/import`, then (if valid) upsert **people** and append their **salaries**, save the org's import-mapping profile, and set the authoritative `employeeCount`. This is the backend the import wizard (Plan 4) calls. Role assignment/classification is deferred to Plan 5 (the Kravbild sequence is import → classify → group → analyze), so this action creates people + salaries, not assignments.

**Architecture:** A `"use node"` action `convex/people/import.ts` (Node runtime so it can use `@workspace/import`'s papaparse tokenizer). It authenticates via `requireOrgAdminAction`, runs the pure engine to tokenize + validate, and drives all DB writes through the existing internal mutations (`upsertPersonByExternalRef`, `appendSalary`, `saveImportMappingProfile`) plus a new internal `setEmployeeCountFromPeople`. Deterministic; no AI; PII + salary stay inside the EU Convex deployment (never sent anywhere external).

**Tech Stack:** Convex `"use node"` action, `@workspace/import`, Vitest 4 + convex-test.

## Global Constraints
- Org-scoped + admin-gated: the action uses `requireOrgAdminAction(ctx, orgId)` (actions cannot use the customMutation wrappers). All DB writes go through `internalMutation`s via `ctx.runMutation`.
- Deterministic, no AI, no external calls. The CSV (PII + salary) is tokenized/validated in-process (EU). No PII/salary is logged or sent out.
- Audit + GDPR: the batch `import.completed` audit + the `employeeCount` change audit carry NO person PII and NO salary amounts (only counts). Per-person `person.created/updated` and per-salary `pay.salarySet` audits are already amount/PII-free from Plan 2.
- `"use node"` MUST be the first line of the action file (no blank line before it).
- Bad rows are never silently imported: rows with blocking validation issues are skipped and reported; if REQUIRED fields are unmapped, nothing is persisted and the validation is returned.
- New code ships with tests; Vitest 4 (`bun run test`), never `bun test`. English/no em dashes. `appError(ERROR_CODES.*)`.

---

### Task 1: `import.completed` audit event
**Files:** Modify `convex/lib/audit.ts`, `convex/lib/auditPayloads.ts`, all 5 `packages/i18n/messages/*.json`. Test: the audit-label coverage + i18n parity (auto-guard).
- Add `AUDIT_EVENTS.importCompleted: "people.imported"` (category `people`, already mapped by the `person.`/`people.`... — confirm `categoryForEvent` routes `people.imported` to `people`; if it keys on `person.` prefix, extend it to also match `people.`).
- `AuditPayloads["people.imported"] = { peopleImported: number; salariesImported: number; skippedRows: number }` — counts only, no PII.
- Labels under `dashboard.auditLog.events.peopleImported` in all 5 locales (Nordic = drafts).
- [ ] TDD via the coverage + parity tests; `bun run typecheck` (bijection guards). Commit (`feat(people): add the import-completed audit event`).

### Task 2: `setEmployeeCountFromPeople` internal mutation
**Files:** Create/extend `convex/people/import.ts` (or `people/employeeCount.ts`), test alongside.
**Pattern:** the mapping notes — `organizations.employeeCount` is `v.optional(v.number())`; write via a direct patch + `logAudit(ctx, orgId, actorId, AUDIT_EVENTS.organizationSettingsUpdated, buildChanges(before, {employeeCount}, ["employeeCount"]))` (mirror `accounts/mirrors.ts seedOrganizationSettings`; do NOT call `updateOrganizationSettings`).
- `setEmployeeCountFromPeople` (`internalMutation`, args `orgId`, `actorId`): count non-archived `people` for the org (via `by_org`), patch `organizations.employeeCount`, audit the change (no-op if unchanged). Returns the new count.
- [ ] TDD (seed N people + 1 archived → count is N; patch + audit; no-op when unchanged). Commit (`feat(people): authoritative employeeCount from imported people`).

### Task 3: the import action + end-to-end test with the real CSV
**Files:** Create `convex/people/import.ts` (the `"use node"` action), `convex/people/import.test.ts`, and copy the anonymized test CSV to `convex/people/__fixtures__/import-testfil.csv` (it is anonymized; safe to commit as the acceptance fixture). Source: `/Users/ce/Downloads/blueprnt docs/Import Anonymiserad - testfil.csv`.
**Interfaces consumed:** `@workspace/import` (`tokenizeCsv`, `detectColumns`, `validateImport`, the parsers, `CANONICAL_FIELDS`); Plan 2 internal mutations `internal.people.people.upsertPersonByExternalRef`, `internal.people.pay.appendSalary`, `internal.people.importProfile...` (or the orgMutation saveImportMappingProfile — see note), `internal.people.import.setEmployeeCountFromPeople`.

`importPayroll` (public `action`): args `orgId: v.string()`, `csvText: v.string()`, `columnMap: v.record(v.string(), v.string())` (the wizard's confirmed mapping; the source-header → canonical-field map), `payYear: v.optional(v.number())`, `effectiveAt: v.optional(v.number())`. Handler:
1. `actorId = await requireOrgAdminAction(ctx, orgId)`.
2. `const { headers, rows } = tokenizeCsv(csvText)`. Build the detected/confirmed mapping object for `@workspace/import` from `columnMap`. `const validation = validateImport({ headers, rows }, mapping, {})`.
3. If `validation.blocking.length > 0`, return `{ ok: false, validation }` WITHOUT persisting.
4. Else, for each row, using the mapping + the `@workspace/import` parsers: parse the person fields (externalRef via the mapped column, displayName = firstName+lastName, gender via `parseGender`, birthDate/employmentStartDate via `parseDate`, ftePercent via `parsePercent`, country/isManager/statisticalCode/department). Skip a row flagged by a per-row `RowIssue` (duplicate id, blank gender, unparsable money, non-numeric code) and count it as skipped. For a good row: `ctx.runMutation(internal...upsertPersonByExternalRef, {...})` → then `ctx.runMutation(internal...appendSalary, { personId, basicMonthly: parseMoney(...), currency: parseCurrency(...) ?? org currency, components: [ ...variable/benefit mapped columns as {kind, monthlyAmount} ], payYear, effectiveAt })`.
5. Save the mapping profile (`saveImportMappingProfile`) so the next re-import fast-forwards.
6. `setEmployeeCountFromPeople(orgId, actorId)`.
7. Audit `AUDIT_EVENTS.importCompleted` with the counts.
8. Return `{ ok: true, peopleImported, salariesImported, skippedRows, validation }`.

Note: `saveImportMappingProfile` is an `orgMutation` (needs identity); the action cannot call it via `ctx.runMutation(internal...)`. Add a thin `internalSaveImportMappingProfile` `internalMutation` (orgId + actorId + columnMap) and have the public `saveImportMappingProfile` delegate to it, OR add an internal variant — mirror how other internal/public pairs are done. The action calls the internal variant.

Tests (`import.test.ts`, convex-test): read the fixture CSV; call `importPayroll` with a columnMap matching the file's Swedish headers; assert people + salaries created for the good rows; assert the known data-quality rows are skipped + counted (duplicate `Anstnr` 114, `"UX Developer"` non-numeric Statistikkod); assert `employeeCount` is set to the imported count; assert the mapping profile is saved; assert `import.completed` audit with the right counts and NO PII. Add a blocking case: a columnMap missing `basicMonthly` → `{ ok:false, validation.blocking includes basicMonthly }`, nothing persisted.
- [ ] TDD. Commit (`feat(people): payroll import action (tokenize, validate, upsert people + salaries)`).

## Self-review
- Covers spec §5.2 step 4 (review + confirm → persist) backend + §5.5 (data-quality skip) + §7 authoritative employeeCount. Excludes assignments (Plan 5) and the wizard UI (Plan 4).
- No AI, deterministic, EU-only; audit counts carry no PII/salary.
- The action reuses Plan 1 (engine) + Plan 2 (mutations); the only new internal seams are `setEmployeeCountFromPeople` and the internal mapping-profile save.

## Follow-on
- **Plan 4:** the import wizard UI (upload → map → check → review) that calls `importPayroll`.
- **Plan 5:** classification — an internal `appendAssignment` + the title→role mapping + HR-confirmed level suggestion, assigning each imported person to a role/level.

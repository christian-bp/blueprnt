# Audit log: full before/after capture + clear Sheet rendering

Goal: every state-changing event in the org audit trail (`logAudit`) records a complete, structured `before -> after` of the domain state it changed, and the detail Sheet renders that before/after unmistakably (scalars, create snapshots, delete snapshots, bulk/nested groups), with no `[object Object]` leaks and no person PII.

No schema migration: `auditLog.payload` is `v.any()`. All payload changes are pure data.

## Decision: free-text is role-content (confirmed by product owner)

Hand-typed justifications (rating `motivation`, anchorRole `motivation`, AI weight-move rationale) and AI/template free text (role `purpose`/`responsibilities`, criterion text) ARE captured before/after, on the same basis the role/rating/anchor tables already store them: role-level domain content, retained across person erasure. Refine the invariant wording (CLAUDE.md + the `auditLog` table comment): the trail records role/org/model domain content, never person identity/salary/performance/contact data. Member/invitation rows stay id+role/status only; invitation `email` is never captured.

## 1. Payload convention (unified shapes)

### 1.1 Scalar changes (base shape, already exists)
`payload.changes: Record<field, { from: unknown; to: unknown }>`
- create: `{ field: { from: null, to: value } }` for every created field (incl. empty strings) -> `buildCreateChanges`.
- update: `{ field: { from: old, to: new } }`, only changed fields -> `buildChanges`.
- delete: `{ field: { from: value, to: null } }` for every field -> `buildDeleteChanges`.
- Sub-objects (anchorRole) flatten into the top-level map under bare field names (`status`, `reviewedAt`, `expectedBand`, `motivation`). Never nested objects, never dotted keys.

### 1.2 Bulk shape (single canonical form)
```
payload.count: number
payload.items: Array<{
  criterionId?|roleId?|familyId?|memberUserId?|suggestionId?: string  // exactly one id field
  label?: string         // human name captured AT WRITE TIME (ids in items are NOT resolved at read time)
  changes: Record<field, { from, to }>
}>
```
Parent entity's own diff stays in top-level `changes`; children go in `items`. Pure bulk create = each item all-`from:null`; pure bulk delete = all-`to:null`; bulk update = real from/to. Always `items` + `count` (one bulk renderer), never name-keyed maps or `created`/`deleted` array names.

### 1.3 Top-level meta scalars (not rendered as field changes)
`source`, `via`, `viaArchive`, `viaReconcile`, `seeded`, `batchId`, `suggestionId`, `modelId`, `roleId`, `familyId`, `criterionId`, `memberUserId`, `invitationId`, `templateKey`, `locale`, `kind`, `cause`, `count`, `change`, plus convenience scalars (`title`, `name`, `expectedBand`, `computedBand`, `created`, `appliedCount`, `totalProposed`, `deletedRatingCount`, `anchorRetired`, `appliedMoveIndexes`, `budget`, `criteriaCount`, `hadModel`, `profileClearedByRename`, `confirmed`, etc.). These feed searchText + an optional provenance line; the Sheet does not list them as changes.

### 1.4 cause shape (band.shift)
`cause?: { event: AuditEvent; roleId?: string; criterionId?: string; entityId?: string }` (CORRECTION: carries full triggering context, not a single ambiguous id; rating.change threads `{ event, roleId, criterionId }`).

## 2. Per-event target payloads

The precise per-file tables live in the workflow output and are pasted into each implementer's prompt. Summary by file:
- `assessment/roles.ts`: role.created (create-snapshot 7 fields), role.updated (keep), anchorRole.updated via archive, role.archived (+ identity fields function/team/familyId, see corrections).
- `assessment/families.ts`: family created/renamed/removed (removed = delete-changes + `items` of cleared roles, keep top-level `name`).
- `assessment/starters.ts`: per-row create/rename/update/archive/remove all sharing one `batchId` per writer; `insertStarterSet` returns the created tree.
- `assessment/ratings.ts`: rating.change = `created` flag + `changes` over `value`+`motivation` (motivation entry omitted when arg undefined).
- `assessment/anchorRoles.ts`: designated (create-snapshot + computedBand), updated (changes over expectedBand/motivation/status/reviewedAt; ALWAYS computedBand; remove `motivationChanged`).
- `assessment/compute.ts`: band.shift = `changes` over band/score/complete/ratedCount (full-RoleResult maps) + `cause` + `totalCriteria`.
- `evaluationModel/criteria.ts`: criterion.added/updated/removed + weights.rebalanced (bulk `items`); thread `cause`.
- `evaluationModel/model.ts`: model.created x3 (template/seed/scratch) with criteria `items`; model.discarded (delete-changes + criteria `items` + `suggestions` array id/kind/status).
- `ai/suggest.ts`: modelDraft (bulk items), weightReview (net per-criterion `items` + `moves` group), roleProfile (names-only confirm + companion role.updated with values), starterImport (families tree), rejected (status change). Thread `cause`.
- `ai/prefillData.ts`: role.updated with `source:"ai"`, `via:"onboardingPrefill"`, `changes`.
- `accounts/mirrors.ts`: org.created marker, member added/roleChanged/removed (id+role only), invitation created/accepted/revoked (id+role/status/expiry, NO email).
- `accounts/organization.ts`: settingsUpdated (+ `employeeCount`, `created` flag), onboardingCompleted (stamp).

## 3. Backend helpers (`convex/lib/audit.ts`)

- `buildCreateChanges(after, fields)`: every listed field -> `{from:null, to: after[field] ?? null}`; retains empty strings; skips fields absent from `after`.
- `buildDeleteChanges(before, fields)`: mirror -> `{from: before[field] ?? null, to:null}`.
- `anchorDiff(before, after)`: returns `{anchors:{from,to}}` only when any level-ordered anchor text differs, else `{}` (buildChanges compares arrays by reference and would always flag).
- `criterionCreateItem(args)` / `criterionDeleteItem(criterion)`: one bulk `items` entry; wrap buildCreate/DeleteChanges; `label` = criterion name. Field list identical across both and INCLUDES `templateKey` (CORRECTION: symmetry between criterion.removed and model.discarded). Fields: name, description, helpText, anchors, weightPoints, order, isCustom, templateKey.
- Extend `collectPayloadLeaves` to also walk `items[].label`, `items[].changes.*.{from,to}`, `suggestions[]` scalars, AND `moves[].{fromLabel,toLabel,motivation}` (CORRECTION) one level; `pushScalar` already ignores objects so anchors/bandThresholds don't crash.
- Extend `logBandShifts` args (`compute.ts`) with optional `cause`; build full-RoleResult Maps from `args.before`/`args.after`; diff via buildChanges over [band, score, complete, ratedCount].
- `insertStarterSet` return -> `{ familyCount, roleCount, families: [{ familyId, name, roles: [{ roleId, title, trackKey }] }] }`.

## 4. Sheet / rendering (`apps/dashboard/lib/audit-detail.ts` + `org-audit-log-section.tsx`)

- `formatAuditValue(value)`: scalars pass through; null/undefined -> ""; objects/arrays -> compact `JSON.stringify` (never `[object Object]`); throw -> "". `changeEntries`/`formatChanges` switch from `String()` to this. Add `isComplex` (typeof object) per `changeEntries` item so the Sheet can render complex values in an `overflow-x-auto` `<pre>` block.
- `payloadItems(payload, fieldLabel)`: narrows `{count, items:[{key, title=label, entries=changeEntries(item.changes)}]}` or null. Ids in items NOT resolved (titles come from captured `label`).
- `payloadMoves(payload)` / `payloadSuggestions(payload)` / `payloadProvenance(payload)`: narrow the moves / dropped-suggestions / meta groups.
- **AuditDetailSheet (CORRECTION: remove the changes-XOR-summary gate):** ALWAYS render an entity-context line first (resolved `roleName` from `row.names` + captured criterion/family `label`; for invitation rows the subject is role+status+expiry, there is no per-invitation label since email is PII), THEN: top-level field changes, bulk `items` group, AI `moves` group (weightReview: `fromLabel -> toLabel (points)`, muted motivation, struck when `applied===false`), dropped `suggestions` group, provenance line, and only as a final fallback the one-line summary / `detail.noChanges`. Complex values render in an `overflow-x-auto` mono block; the body never scrolls horizontally.
- `formatAuditDetail` (table cell, CORRECTION): band.shift reads `changes.band.{from,to}` (delete the dead expectedBand/computedBand branch); bulk events show a `details.itemsChanged {count}` summary; non-bulk `model.updated` (criterion.added/updated) shows the criterion label + `details.fieldsChanged`; `role.updated` with only complex diffs shows `details.fieldsChanged`; keep `roleFamily.removed` -> `p.name`. Never `[object Object]`.
- organization.created shows a "created" label, not an id-only change row.
- reconcile auto profile-clear: `role.updated` carries `profileClearedByRename: true` so the Sheet annotates purpose/responsibilities entries as cleared-on-rename.

## 5. i18n (all 5 locales, parity; en source, Nordic drafts flagged for review)

New under `dashboard.auditLog.detail`: `itemsHeading {count, plural}`, `unnamedItem`, `movesHeading`, `moveApplied`, `moveSkipped`, `suggestionsHeading {count, plural}`, `complexValue`, `provenance.{source,via,viaArchive,viaReconcile,seeded,batch,cause}`, `provenance.sourceValues.{ai,template,scratch,starter,aiImport,aiSuggestion}`, `entity` (context line label), `createdMarker`, `clearedOnRename`.
New under `dashboard.auditLog.details`: `itemsChanged {count, plural}`, `fieldsChanged {count, plural}`, `complexValue`.
New `dashboard.auditLog.fields`: purpose, responsibilities, description, helpText, anchors, weightPoints, order, isCustom, templateKey, value, motivation, expectedBand, reviewedAt, archivedAt, bandThresholds, band, score, complete, ratedCount, onboardingCompletedAt, employeeCount, expiresAt, orgId, status, role, archived. (Per terminology memory: `score` label = "Weighting", `value` label = "Rating".)

## 6. Implementation order (minimize shared-file conflict)

- Unit 0 (backend helpers + compute): lib/audit.ts helpers + collectPayloadLeaves extension + logBandShifts(cause). `cause` optional so callers still compile. Tests. No call sites changed.
- Unit 1 (frontend rendering + i18n): audit-detail.ts helpers + AuditDetailSheet groups + safe complex blocks + i18n. Tolerates every new shape before any backend writes them. Tests + parity.
- Units 2..N (one batch per context, each adds payload data + threads cause/batchId, ships its payload tests): mirrors+organization; families+ratings; roles+anchorRoles; criteria+model; starters; prefillData+suggest (last; depends on starters return + cause).

## Binding corrections (from adversarial verdicts)

1. PII: motivation/free-text included as role-content (decision above); refine invariant wording; never person data; invitation email excluded; member rows id+role only.
2. Sheet: remove changes-XOR-summary; ALWAYS show entity-context line + before/after.
3. cause shape carries `{event, roleId?, criterionId?, entityId?}`; rating.change threads role+criterion.
4. weightReview: capture per-criterion `from` post-guard with THIS iteration's get (first-touch only); capture `to` via a post-loop re-read of each touched id (NO delta accumulation). Add a skipped-move test (two moves on one criterion, second breaches 1-5).
5. anchorRole.updated: ALWAYS capture live `computedBand` (derive single role), not only on reactivation.
6. criterionDeleteItem includes `templateKey` (symmetry).
7. role.archived (direct + via reconcile): capture identity fields function/team/familyId.
8. reconcile role.updated: `profileClearedByRename: true` flag when a title change auto-clears purpose/responsibilities.
9. band.shift table summary reads `changes.band.{from,to}`; delete dead branch.
10. invitation rows: subject = role+status+expiry (no email, invitationId unresolved); state in the id-resolution note.
11. model.updated non-bulk table cell (criterion.added/updated) shows label + field count (not blank).
12. collectPayloadLeaves also walks `moves[]`.
13. organization.created is an intentional marker (id-only); Sheet shows "created" label; substantive before/after is the following settingsUpdated row.
14. Timestamp hoist (logged == patched): role.archived, anchorRole.updated, anchorRole.designated, both onboardingCompleted sites (org + seed). Hoist `const ts = Date.now()`.
15. Read-placement: every `from` reads the pre-write in-memory doc (Convex patch/delete does not mutate the already-read object); roleFamily.removed items use the family-id constant as `from`, never a post-patch get.

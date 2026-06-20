# Audit-log API ergonomics: ctx-aware writer + typed payloads

Goal: simpler, reusable audit-creation that cannot drift, WITHOUT losing granularity. The diff engine (`buildChanges`, `buildCreateChanges`, `buildDeleteChanges`, `anchorDiff`, `criterionCreateItem`, `criterionDeleteItem`, `logBandShifts` body, `collectPayloadLeaves`) is UNTOUCHED, so audit-row contents stay byte-identical and the existing 352 backend tests are the regression net.

## Non-negotiables (from adversarial review)

1. **Discriminated unions, not flat maps.** `model.updated` (4 shapes keyed on `change`) and `ai.suggestionConfirmed` (4 shapes keyed on `kind`) MUST be discriminated unions, or the type is strictly weaker than today (it would make per-variant fields optional). Done faithfully or it is cosmetic.
2. **Keep `buildChanges`/`buildCreateChanges`/`buildDeleteChanges` callable with a runtime `readonly string[]` field list.** The AI role-profile path (`buildChanges(role, patch, appliedFields)` where `appliedFields` is data) and the synthetic-object model-create paths REQUIRE it. Do NOT introduce a Doc-anchored `diffOf<T>` that forces literal field lists (it cannot express those sites). Instead remove duplication by sharing field-list CONSTANTS.
3. **Two-row AI emissions are intentional.** `confirmRoleProfileDraft` emits a names-only `ai.suggestionConfirmed` row PLUS a companion `role.updated` row carrying the values. Never merge them (PII boundary: values only on the companion row).
4. **`band.shift` is produced only by `logBandShifts`.** Its map entry must match exactly what `logBandShifts` builds; do not expose a looser hand-writable shape.
5. **Triggers + shared helpers stay on the free function.** `accounts/mirrors.ts` handlers (plain `GenericMutationCtx`, sentinels `"system"`/`"seeded"`), `seedStandardModel`/seed `internalMutation`s, and `assessment/starters.ts` (`insertStarterSet` shared helper + `reconcileStarterSet` which destructures ctx into explicit `orgId`/`actorId` to share the helper shape) keep calling the free `logAudit`/`logBandShifts`. They get the SAME typed map, just not the `ctx.audit` sugar.

## Part 1 - Typed payload contracts (`lib/audit-payloads.ts`, new)

Shared sub-types (match `collectPayloadLeaves` exactly):
```ts
export type Changes = Record<string, { from: unknown; to: unknown }>
export type AuditItem = {
  criterionId?: string; roleId?: string; familyId?: string; memberUserId?: string; suggestionId?: string
  label?: string                 // optional: weightReview labels can be undefined
  changes: Changes
  // per-variant extras allowed (modelDraft items carry originalWeightPoints/anchorCount):
  [k: string]: unknown
}
export type AuditMove = {
  fromCriterionId?: string; fromLabel?: string; toCriterionId?: string; toLabel?: string
  points: number; applied: boolean; motivation?: string | null
}
export type AuditSuggestionItem = { suggestionId: string; kind: string; status: string }
export type BandCause = { event: AuditEvent; roleId?: string; criterionId?: string; entityId?: string }
```

`AuditPayloads` interface keyed 1:1 by every `AUDIT_EVENTS` value, EXCEPT the two multi-shape events which are discriminated unions:
```ts
export type ModelUpdatedPayload =
  | { change: "criterion.added"; criterionId: string; modelId: string; changes: Changes }
  | { change: "criterion.updated"; criterionId: string; modelId: string; changes: Changes }
  | { change: "weights.rebalanced"; modelId: string; budget: number; count: number; items: AuditItem[] }
  | { change: "criterion.removed"; modelId: string; deletedRatingCount: number; budget: { from: number; to: number }; changes: Changes; count: number; items: AuditItem[] }

export type AiConfirmedPayload =
  | { suggestionId: string; kind: "model.draft"; acceptedCount: number; totalProposed: number; count: number; items: AuditItem[] }
  | { suggestionId: string; kind: "model.weightReview"; appliedCount: number; totalMoves: number; skippedCount: number; appliedMoveIndexes: number[]; count: number; items: AuditItem[]; moves: AuditMove[] }
  | { suggestionId: string; kind: "role.profile"; roleId: string; appliedCount: number; appliedFields: string[]; requestedFields: string[]; offeredFields: string[]; confirmed: boolean }
  | { suggestionId: string; kind: "starter.import"; familyCount: number; roleCount: number; families: unknown[] }
```
Build the rest faithfully (read EVERY call site; the forcing function is: make `logAudit` generic and iterate until `tsc` passes with NO call-site payload edits). Known optional fields to include: role.created `{ roleId; familyId?; source?; batchId?; changes }`; role.updated `{ roleId; source?; via?; suggestionId?; batchId?; profileClearedByRename?; changes }`; role.archived `{ roleId; title; trackKey; function; team; familyId: string|null; viaReconcile?; batchId?; anchorRetired: boolean; changes }`; roleFamily.created/renamed `{ familyId; source?; batchId?; changes }`; roleFamily.removed `{ familyId; name; viaReconcile?; batchId?; changes; count; items }`; rating.change `{ roleId; criterionId; created: boolean; changes }`; anchorRole.designated `{ roleId; computedBand: number|null; changes }`; anchorRole.updated `{ roleId; computedBand?: number|null; expectedBand?: number; viaArchive?; viaReconcile?; batchId?; changes }`; band.shift `{ roleId; cause: BandCause; changes: Changes; totalCriteria?: number }`; model.created `{ modelId; source; templateKey?: string|null; locale?; seeded?; name; changes; count; items }`; model.discarded `{ modelId; name; changes; count; items; suggestionCount; suggestions: AuditSuggestionItem[] }`; ai.suggestionRejected `{ suggestionId; kind: string; changes; roleId?; modelId?; criterionId? }`; member.* `{ memberUserId; memberId?; changes }`; invitation.created `{ invitationId; changes }`; invitation.accepted/revoked `{ invitationId; status; changes }`; organization.created `{ changes }`; organization.settingsUpdated `{ created?: boolean; changes }`; organization.onboardingCompleted `{ created?: boolean; criteriaCount?: number|null; hadModel?: boolean; changes }`.

A separate `PlatformAuditPayloads` keyed by `PLATFORM_AUDIT_EVENTS` (also heterogeneous: `{}` for userCreated/orgCreated, `{ role }` for membershipGranted, `{ from, to }` for membershipRoleChanged, etc.).

## Part 2 - Generic writers + DRY (`lib/audit.ts`)

- `export async function logAudit<E extends keyof AuditPayloads>(ctx, entry: { orgId: string; type: E; actorId: string; payload: AuditPayloads[E] })`. Body unchanged (payload still serialized to the row).
- `logPlatformAudit<E extends keyof PlatformAuditPayloads>` similarly.
- Extract the duplicated ~12-line actorName-snapshot block into `async function resolveActorName(ctx, actorId): Promise<string>` used by both writers.
- `logBandShifts` (`compute.ts`): make `cause` REQUIRED (remove the `?`). All current callers already pass it; this closes the forgot-cause gap.
- Field-list constants: add `ROLE_CREATE_FIELDS`, `ROLE_UPDATE_FIELDS` (or reuse `Object.keys(patch)`), `ANCHOR_FIELDS = ["expectedBand","motivation","status","reviewedAt"]`, `SETTINGS_FIELDS`, `MODEL_FIELDS = ["name","templateKey","bandThresholds"]`, and reuse the existing `CRITERION_AUDIT_FIELDS` in `addCriterion` (currently a 3rd inline spelling). Export from `lib/audit.ts`; replace the inline string lists at call sites.

## Part 3 - ctx-aware writer (`lib/functions.ts` + call sites)

- In `orgMutation`/`adminMutation` `input`, add `audit` to the returned ctx:
  ```ts
  audit: {
    log: <E extends keyof AuditPayloads>(entry: { type: E; payload: AuditPayloads[E] }) =>
      logAudit(ctx, { orgId, actorId: authUserId, ...entry }),
    bandShifts: (entry: { before: RoleResult[]; after: RoleResult[]; cause: BandCause }) =>
      logBandShifts(ctx, { orgId, actorId: authUserId, ...entry }),
  }
  ```
- Migrate the ~37 org/admin call sites from `logAudit(ctx, { orgId: ctx.orgId, actorId: ctx.authUserId, type, payload })` to `ctx.audit.log({ type, payload })`, and the band-shift sites to `ctx.audit.bandShifts({ before, after, cause })`.
- DO NOT migrate: `accounts/mirrors.ts` (triggers), seed `internalMutation`s, `assessment/starters.ts` (`insertStarterSet` + `reconcileStarterSet`). They keep the free `logAudit`/`logBandShifts` (now generically typed).
- Centralize the `"system"`/`"seeded"` sentinels as exported constants while in `mirrors.ts`.

## Migration phases (each ships green; pre-commit runs full suite)

- **Unit A (types + DRY + required cause):** Part 1 + Part 2. Make `logAudit`/`logPlatformAudit` generic; iterate the map until `tsc` is clean with NO payload edits (this validates every existing payload against the faithful types). Extract `resolveActorName`. Make `cause` required. Add + apply shared field-list constants. No `ctx.audit` yet. Risk: the map must be faithful; the compiler enforces it.
- **Unit B (ctx writer):** Part 3. Add `ctx.audit`; migrate the ~37 org/admin sites; leave triggers + starters + seed free. Mechanical; per-file.

## Granularity guarantee

No diff-engine code changes. The typed map constrains only the ENVELOPE (which keys/shape per event); it never reduces what `buildChanges`/snapshots/`logBandShifts` capture. Every field's `{from,to}`, create/delete snapshots, positional anchors diff, bulk `items[].changes`, `moves[]`, provenance meta, and `band.shift` cause+changes are produced by the same code and now additionally type-checked.

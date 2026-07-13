# Kartläggning entity + frozen data-layer snapshot (M3, first slice)

**Date:** 2026-07-12 · **Status:** approved design, pending spec review · **Scope:** V2 analysis pillar, guide Modul 3 (Kartläggningshantering) foundation

## Problem

The analysis pillar of the lönekartläggning (guide Moduls 4-8: comparison groups, statistics, objective reasons, action plans, reporting) all runs against a **frozen snapshot** at a reference date, never against live data (ADR-0011). Nothing to create or store that snapshot exists yet: there are no `payMapping*` tables and no analysis context. This slice builds the **spine everything else attaches to** — the kartläggning entity and its immutable data snapshot — so the later slices have a `snapshot_id` to hang off.

Prerequisites are already built and correct: import (with monthly/annual fidelity, full pay components, employment type), classification (role + per-individual level), pay records, and the deterministic V1 engine that derives band/score. So the data the snapshot must freeze all exists.

## Goal

Let HR **start a kartläggning**, which **freezes a complete, immutable snapshot** of the current population (pay, role/band/track/level, demographics, ratings + model config), see it in a **list**, and open a read-only **detail** of the frozen population. Erasing a person **pseudonymizes them inside the snapshot** (never leaves residual PII), and survey **views are logged**. No analysis, flags, work layer, comparison, or export yet — those are later slices that attach to this snapshot.

## Scope: M3 conformance

This slice maps to the roadmap artifact's Modul 3 as follows. It is M3-core **minus** band policy salary-range (its only consumer, off-policy detection, is P3 — deferred to that slice) and **minus** the genuinely-later items, **plus** the GDPR erasure handler (required for correctness the moment a snapshot stores demographics).

| M3 requirement (guide Del 5.4 / ADR-0011) | This slice |
|---|---|
| Start a survey with a reference date | ✅ in (reference date = freeze time / today) |
| Reference-date immutable snapshot | ✅ in |
| Survey list view | ✅ in |
| Status lifecycle | ⚠️ partial — created `active`; transitions (pause / under-review / completed) land with the P1 completion gate (ADR-0012) |
| Snapshot metadata (UTC timestamp, actor, system version) | ✅ in (retention/backup deferred) |
| Access + export logging | ⚠️ partial — **view** logging in (export does not exist yet) |
| GDPR: pseudonymize-in-snapshot on erasure | ✅ in |
| Band policy salary-range (min/mid/max) | ❌ deferred — consumer (off-policy) is P3 |
| Cross-survey comparison (trend) | ❌ deferred — needs analysis on ≥2 runs |
| Archive export package (PDF+XLSX+JSON) | ❌ deferred — needs report content (M8) |
| Retention / ≥5y backup | ❌ deferred |

## Non-goals

- No analysis, gap computation, flags, or the P1 gender-gap view (next slices, packages/core + ADR-0012).
- No work layer (comparison groups, objective reasons, action plans, notes).
- No band policy salary-range entity, no off-policy detection.
- No status transitions beyond creation; no completion gate.
- No export/archive package, no cross-survey comparison, no retention/backup routine.
- No per-person exclusion UI (a free-text population note covers documented exclusions for now).
- No backdating: the reference date is the freeze time. (If a chosen reference date is ever needed, adding a picker is a clean additive change; the effective-dated seams already support it.)

## Design

### 1. Boundary & naming

- **New Convex context** `packages/backend/convex/payMapping/` (bounded context `pay` per CONTEXT-MAP: "lönedata och lika/likvärdigt arbete-analys"). Raw pay CRUD stays in `people/pay.ts`; this context owns the survey + snapshot + (later) the analysis. ADR-0011 §3 gives it a stricter view/export-logging dimension, which is why it does not live under `people/`.
- **Entity `payMappingRun`** = one kartläggning. Tables `payMappingRuns` and `payMappingSnapshotRows`.
- **Route** `/pay-mappings` (list) and `/pay-mappings/[slug]` (detail). All copy localized; nav label "Kartläggningar" (sv).
- **i18n namespace** `dashboard.payMapping.*`, mirrored to all five locales.
- **Slug** generated from `label` with the shared `uniqueSlug` (`convex/lib/slug.ts`), unique per org via `by_org_slug`, regenerated on rename (route-slug rule). The Convex `_id` stays the internal key mutations take.

### 2. Schema

`payMappingRuns` (the survey / kartläggning; Option 3 hybrid — metadata + frozen model config on the run):

```ts
payMappingRuns: defineTable({
  orgId: v.string(),
  slug: v.string(),
  label: v.string(),                 // e.g. "Lönekartläggning 2026"
  status: v.union(                   // ADR-0011 flow; slice 1 only ever sets "active"
    v.literal("active"),
    v.literal("paused"),
    v.literal("underReview"),
    v.literal("completed"),
  ),
  referenceDate: v.number(),         // epoch ms; = createdAt in slice 1
  initiatedBy: v.string(),           // actorId (HR operator)
  initiatedAt: v.number(),           // UTC epoch ms
  systemVersion: v.string(),         // shared version constant, for reproducibility
  populationNote: v.optional(v.string()),        // documented exclusions (free text)
  populationCount: v.number(),                   // frozen rows written
  withPayCount: v.number(),                      // rows with a pay record at freeze
  unclassifiedExcludedCount: v.number(),         // active people skipped (no assignment)
  frozenModel: v.object({                        // ADR-0008: freeze the model config once
    criteria: v.array(v.object({
      name: v.string(),
      weightPoints: v.number(),
      anchorCount: v.number(),
    })),
    bandThresholds: v.array(v.number()),
  }),
})
  .index("by_org", ["orgId"])
  .index("by_org_slug", ["orgId", "slug"])
```

`payMappingSnapshotRows` (one immutable frozen row per person in the population):

```ts
payMappingSnapshotRows: defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  // Pseudonymizable identity — NOT a live FK (the live person is hard-deletable).
  personPublicId: v.string(),        // the person's publicId at freeze; erasure keys on this
  displayName: v.string(),           // frozen; tombstoned on erasure
  erased: v.boolean(),               // true once pseudonymized
  // Demographics (frozen; current values — people fields are not historized).
  gender: v.union(v.literal("Man"), v.literal("Kvinna")),
  birthDate: v.optional(v.string()), // cleared on erasure
  employmentType: v.optional(v.string()),
  department: v.optional(v.string()),
  ftePercent: v.optional(v.number()),
  employmentStartDate: v.optional(v.string()),
  // Role + engine-derived band/score (frozen point-in-time; legitimate in an
  // immutable record — ADR-0002's "never stored" governs LIVE state only).
  roleTitle: v.string(),
  trackKey: v.string(),
  level: v.string(),
  band: v.union(v.number(), v.null()),
  score: v.union(v.number(), v.null()),
  // Pay (frozen as-of the reference date via getCurrentSalary; amounts kept —
  // this is the survey evidence document, HR-only, not the audit trail).
  basicMonthly: v.union(v.number(), v.null()),
  components: v.array(v.object({ kind: v.string(), monthlyAmount: v.number() })),
  currency: v.optional(v.string()),
  payYear: v.optional(v.number()),
})
  .index("by_run", ["orgId", "runId"])
  .index("by_org_person", ["orgId", "personPublicId"])   // erasure finds rows by person
```

`payMappingAccessLog` (the read-oriented access dimension, ADR-0011 §3, kept separate from the domain audit trail so high-volume view events do not pollute it):

```ts
payMappingAccessLog: defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  actorId: v.string(),
  at: v.number(),
  kind: v.union(v.literal("view"), v.literal("export")),   // slice 1: only "view"
})
  .index("by_run", ["orgId", "runId"])
```

### 3. Freeze flow — `startPayMappingRun`

`orgMutation({ args: { label }, returns: { runId, slug } })`. Reference date = `Date.now()` (no picker). Sequence:

1. `uniqueSlug` from `label` (`by_org_slug`).
2. Load all non-archived people in the org. **Population = those with an open assignment** (classified); people with no assignment are skipped and counted in `unclassifiedExcludedCount` (they have no role/band to analyse).
3. Freeze the model config once (`frozenModel`) from the org's active model.
4. For each person in the population, build a `payMappingSnapshotRow`:
   - role/level from the open assignment; resolve `roleTitle` + `trackKey` from the role.
   - **band/score** derived by the pure engine over the role's ratings + the frozen model, via the existing `assessment` compute (reused, not reimplemented; memoized per unique role so shared roles compute once — DRY).
   - **pay** via the existing `getCurrentSalary({ personId, asOf: referenceDate })` → `basicMonthly`, `components`, `currency`, `payYear` (null when the person has no pay record; excluded from `withPayCount`).
   - demographics + `displayName` from the current person row; `erased: false`.
5. Insert the `payMappingRuns` row (`status: "active"`, `referenceDate`, metadata, `frozenModel`, counts), then the N snapshot rows.
6. Write one domain audit row `payMapping.runStarted` (event key + `AuditPayloads` entry + label in every locale + coverage; payload carries the run label + counts, never person data).
7. Return `{ runId, slug }`.

Determinism/purity: band/score come from the pure `packages/core` engine (ADR-0002); the mutation supplies `referenceDate`/`now`. The snapshot stores the derived values because it is an immutable record, not live state.

**Freeze at scale (plan decides against verified limits).** One mutation writing N snapshot rows (each after reads for pay/assignment/role) risks Convex's per-transaction read/write cap for a large employer (customers range from ~25 to thousands of employees). The data model above is identical either way, so this is an implementation choice for the plan, which MUST verify Convex's current limits and pick: (a) a single `orgMutation` — simplest, fine up to a few hundred people; or (b) the established **batched-action pattern** (mirror `people/import` — an action pages the population and calls an internal mutation per batch), with the run written first and a `freezeComplete` boolean flipped when all batches land (the list/detail show a "fryser…" state until then). Given the target market, the batched action is the likely answer; slice 1 adds `freezeComplete` to `payMappingRuns` if (b) is chosen, and a small `discardPayMappingRun` mutation so an interrupted freeze is recoverable.

### 4. GDPR: pseudonymize-in-snapshot on erasure

Extend the existing erasure path (`people/erase.ts` `erasePersonAsOrg`, which hard-deletes `people` + `payRecords` + `personAssignments` child-first). After those deletes, call a helper exported by the payMapping context:

```ts
// convex/payMapping/erasure.ts
pseudonymizePersonInSnapshots(ctx, orgId, personPublicId)
```

It loads that person's rows via `by_org_person` and, for each, sets `erased: true`, replaces `displayName` with the shared tombstone (`ERASED_ACTOR_NAME` pattern from `lib/audit.ts`), and clears `birthDate`. It **keeps the aggregate** — `gender`, role/`band`/`level`, and pay — so the statutory evidence document survives (ADR-0011's scoped exception to hard delete; same anonymize-not-retain principle as the audit trail). This closes the loop: no snapshot ever retains an erased person's identifying data.

### 4a. Data-protection invariant: a new sanctioned PII location

CLAUDE.md states that person PII (identity, salary) lives ONLY in `people` / `payRecords` / `personAssignments`, the `users` mirror, and the Better Auth tables, and must never be added to the `role`/`rating`/model/`audit`/AI tables (Role != Person). `payMappingSnapshotRows` deliberately holds `displayName`, `gender`, `birthDate`, and pay — so it is a **new sanctioned PII store**, authorized by **ADR-0011** (the frozen lönekartläggning is the statutory evidence document; identity is pseudonymized on erasure, aggregate retained). CLAUDE.md's erasure invariant already forward-references ADR-0011 for this exception. This does **not** relax the rule: the snapshot lives in the `pay` bounded context (where person + pay legitimately coexist, HR-only, minimized), never on the assessment/audit/AI side, which stay person-free. **Implementation task:** update CLAUDE.md's PII-location sentence to name the snapshot (pointing at ADR-0011), so the enumerated list and the code agree.

### 5. UI

- **Nav:** a new "Kartläggningar" entry.
- **List page** (`/pay-mappings`): the runs newest-first (chronological order, so no per-column sorting — the timeline is the order), columns: label, reference date, status badge, population count, ansvarig (initiatedBy resolved), created. A primary **"Starta kartläggning"** button above it. Content-shaped `TableSkeleton` while loading. `AnimatePresence` for a newly-created run entering. Empty state explains what a kartläggning is (HelpMorph on the term).
- **Start dialog** (standard shadcn anatomy, react-hook-form + Zod factory `makeStartRunSchema(t)`): a single **label** field (default `"Lönekartläggning {year}"`), footer cancel + `SubmitButton` gated on `isValid`. On success: `toast.success(payMapping toast key)`, navigate to the new run's detail. A HelpMorph explains "referensdatum = idag" so the frozen-at-today behaviour is stated, not hidden.
- **Detail stub** (`/pay-mappings/[slug]`): resolves the run by `(orgId, slug)`; shows metadata (reference date, status, ansvarig, counts, population note) and a read-only table of the frozen population (name, gender, role, band, level, pay). Fires the `logPayMappingAccess({ runId, kind: "view" })` mutation on mount (view-logging). Content-shaped skeleton. The analysis views land here in later slices.

### 6. i18n

All strings under `dashboard.payMapping.*` in `en.json` first, mirrored to sv/nb/da/fi. Domain terms (kartläggning, referensdatum, snapshot, band) get inline HelpMorph copy under `dashboard.help.*`. New audit event `payMapping.runStarted` gets its `dashboard.auditLog.events.*` label in every locale (audit-label coverage test), and its payload fields their `dashboard.auditLog.fields.*` labels (field-label coverage test).

### 7. Component boundaries

- Freeze reads live data and writes frozen rows; band/score derivation stays in the pure engine, invoked from the mutation.
- Snapshot rows are written once and never patched, except the erasure pseudonymization (the single sanctioned mutation of a frozen row).
- The erasure helper lives in `payMapping/` and is called by `people/erase.ts` (a one-way handler-scope import, like the audit helpers), so the people context does not learn the snapshot's internals.
- The list/detail/start-dialog are separate components under `apps/dashboard/components/pay-mapping/`; the detail's frozen-population table is its own component.

## Testing

**Backend (`payMapping/*.test.ts`, convex-test):**
- `startPayMappingRun` freezes one row per classified active person; skips unclassified (counted); `withPayCount` matches rows with pay.
- Band/score on a frozen row equal what the engine derives for that role at freeze time.
- Pay is taken as-of the reference date (a later raise is not reflected when reference date precedes it — via the existing `getCurrentSalary` asOf seam).
- Writes exactly one `payMapping.runStarted` audit row (no person data in the payload); slug is unique per org; a second run with the same label gets a distinct slug.
- Empty/zero-classified org → run with `populationCount: 0`, no snapshot rows.
- **Erasure:** after `erasePersonAsOrg`, the person's snapshot rows have `erased: true`, tombstoned `displayName`, cleared `birthDate`, and **retained** `gender`/`band`/`pay`; live rows are gone.
- Access log: `logPayMappingAccess` appends a `view` row.

**UI (`components/pay-mapping/*.test.tsx`):**
- List renders runs + skeleton; empty state shows the explainer.
- Start dialog validates the label, calls `startPayMappingRun`, toasts, navigates.
- Detail stub renders metadata + frozen population and fires the view-log mutation on mount.

**i18n:** parity for `dashboard.payMapping.*` and the new audit label/fields across all five locales.

## Open questions / risks

- **Access-log volume:** view-logging writes a row per detail open. Kept in its own table (not the audit trail) to isolate volume; revisit retention when export logging + analysis views land.
- **Demographics are current, not as-of** (people fields are not historized). Acceptable and documented; a reference date ≈ today makes it moot. Historizing people fields is a larger V2+ concern, out of scope.
- **Model config freeze shape** mirrors the assessment model; if that shape changes pre-launch, the frozen shape follows (no legacy, dev data resets).

## Follow-on slices (not this spec)

1. Deterministic stats/gap engine in `packages/core` (pure, AI-free).
2. **P1 gender-gap primary view** (ADR-0012): `classifyPayGap` core helper + aggregate query over the snapshot (lika = title+band+level, likvärdigt = band) + the four-flag UI; gates completion.
3. Band policy salary-range entity + off-policy detection (P3).
4. Status transitions + completion gate; comparison view (≥2 runs).
5. Objective reasons, action plans (Modul 6-7); reporting + export + archive (Modul 8); retention/backup.

## After implementation

Update the "Lönekartläggning progress tracker" roadmap artifact: flip the covered M3 rows (start, snapshot, list, status-partial, view-logging, GDPR-in-snapshot, metadata) from grey "absent" to green, add a changelog entry, and move "now building" to the P1 gender-gap slice.

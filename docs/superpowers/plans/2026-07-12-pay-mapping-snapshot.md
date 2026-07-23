# Kartläggning snapshot (M3 first slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR start a kartläggning that freezes an immutable snapshot of the current population (pay, role/band/level, demographics, model config), see it in a list, and open a read-only detail — with GDPR erasure reaching the snapshot and survey views logged.

**Architecture:** A new `payMapping` Convex bounded context (the `pay` context per CONTEXT-MAP). A `payMappingRuns` row holds metadata + the frozen model config; one immutable `payMappingSnapshotRows` row per person holds frozen pay/role/band/demographics; a `payMappingAccessLog` row is written per view. The freeze is a single `orgMutation` that bulk-reads live data, derives band/score via the pure engine (`deriveResults`), and writes the run + rows. Erasure pseudonymizes snapshot rows (tombstone name, clear birth date, keep the gender/band/pay aggregate). UI: a Kartläggningar nav entry, a list page, a start dialog, and a detail stub.

**Tech Stack:** Convex (edge-runtime + convex-test, Vitest 4), Next.js 16 App Router, shadcn/Base UI, next-intl, react-hook-form + Zod, Motion.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-12-pay-mapping-snapshot-design.md`. ADRs: 0011 (lifecycle + frozen layer), 0012 (P1 gate — later), 0002 (engine purity), 0008 (freeze includes model config).
- **All user-facing text through i18n**, added to `packages/i18n/messages/en.json` first, then mirrored to `sv.json`, `nb.json`, `da.json`, `fi.json`. Edit locale JSON with the Edit/Write tool only — never shell sed (mojibake). Nordic strings are drafts; flag for native review.
- **No em dashes** in any copy, comment, or commit.
- **Every state-changing mutation writes a typed audit row** via `ctx.audit.log({ type, payload })`; a new event needs its `AUDIT_EVENTS` key, `AuditPayloads` entry, `categoryForEvent` branch, a `dashboard.auditLog.events.<camelKey>` label in every locale, and a `dashboard.auditLog.fields.<field>` label for every scalar payload field (coverage tests in `apps/dashboard/lib/audit-labels.test.ts`).
- **Route-exposed entities carry a slug** (`by_org_slug`), resolved by `(orgId, slug)`; the `_id` stays the mutation key.
- **person PII / snapshot:** `payMappingSnapshotRows` is a NEW sanctioned PII store per ADR-0011 (evidence document); it lives in the `pay` context, never the assessment/audit/AI side. Erasure pseudonymizes it (does not delete it).
- **Forms:** react-hook-form + `zodResolver` + `mode: "onTouched"`, shadcn `Form`/`FormField`, `makeXSchema(t)` factory, `SubmitButton` gated `disabled={!form.formState.isValid}`.
- **Tables:** content-shaped skeleton while `useQuery` is `undefined`; toast on create; dialogs use standard shadcn anatomy (cancel outline first, primary last).
- **Vitest 4 via `bun run test`**, never `bun test`. Backend tests use convex-test on edge-runtime.
- **Naming (use verbatim across tasks):** context `payMapping/`; tables `payMappingRuns`, `payMappingSnapshotRows`, `payMappingAccessLog`; mutation `startPayMappingRun` → `{ runId, slug }`; queries `listPayMappingRuns`, `getPayMappingRunBySlug`; mutation `logPayMappingView`; helper `pseudonymizePersonInSnapshots`; audit event `AUDIT_EVENTS.payMappingRunStarted = "payMapping.runStarted"`; i18n namespace `dashboard.payMapping.*`; route `/pay-mappings/[slug]`; status union `"active" | "paused" | "underReview" | "completed"` (only `"active"` set this slice).

## File Structure

- `packages/backend/convex/payMapping/tables.ts` — the three table definitions (new).
- `packages/backend/convex/payMapping/runs.ts` — `startPayMappingRun`, `listPayMappingRuns`, `getPayMappingRunBySlug`, `logPayMappingView` (new).
- `packages/backend/convex/payMapping/erasure.ts` — `pseudonymizePersonInSnapshots` (new).
- `packages/backend/convex/payMapping/*.test.ts` — backend tests (new).
- `packages/backend/convex/schema.ts` — register the three tables (modify).
- `packages/backend/convex/lib/slug.ts` — add `"payMappingRuns"` to `SlugTable` + a branch (modify).
- `packages/backend/convex/lib/audit.ts` — `AUDIT_EVENTS.payMappingRunStarted` + `categoryForEvent` branch (modify).
- `packages/backend/convex/lib/auditPayloads.ts` — `"payMapping.runStarted"` payload (modify).
- `packages/backend/convex/people/erase.ts` — call the pseudonymize helper (modify).
- `apps/dashboard/lib/audit-labels.test.ts` — add the 3 new fields to `OTHER_AUDIT_FIELDS` (modify).
- `apps/dashboard/lib/pay-mapping-schemas.ts` — `makeStartRunSchema(t)` (new).
- `apps/dashboard/components/pay-mapping/pay-mappings-section.tsx`, `start-pay-mapping-dialog.tsx`, `pay-mapping-detail.tsx` (new).
- `apps/dashboard/app/(app)/pay-mappings/page.tsx`, `pay-mappings/[slug]/page.tsx` (new).
- `apps/dashboard/components/app-sidebar.tsx` — nav entry (modify).
- `packages/i18n/messages/{en,sv,nb,da,fi}.json` — new keys (modify).
- `docs/go-live-checklist.md`, `CLAUDE.md` — doc tasks (modify).

---

### Task 1: Schema + slug support

**Files:**
- Create: `packages/backend/convex/payMapping/tables.ts`
- Modify: `packages/backend/convex/schema.ts`
- Modify: `packages/backend/convex/lib/slug.ts`
- Test: `packages/backend/convex/payMapping/tables.test.ts`

**Produces:** the three tables + `uniqueSlug(ctx, "payMappingRuns", orgId, source)` support that later tasks consume.

- [ ] **Step 1: Write `tables.ts`**

```ts
// packages/backend/convex/payMapping/tables.ts
import { defineTable } from "convex/server"
import { v } from "convex/values"

// A kartläggning (pay-mapping survey). The mutable metadata + the model config
// frozen once (ADR-0008); per-person frozen data lives in payMappingSnapshotRows.
export const payMappingRuns = defineTable({
  orgId: v.string(),
  slug: v.string(),
  label: v.string(),
  status: v.union(
    v.literal("active"),
    v.literal("paused"),
    v.literal("underReview"),
    v.literal("completed"),
  ),
  referenceDate: v.number(), // epoch ms; = createdAt this slice (freeze time)
  initiatedBy: v.string(), // actorId
  initiatedAt: v.number(), // UTC epoch ms
  systemVersion: v.string(),
  populationNote: v.optional(v.string()),
  populationCount: v.number(),
  withPayCount: v.number(),
  unclassifiedExcludedCount: v.number(),
  frozenModel: v.object({
    criteria: v.array(
      v.object({
        name: v.string(),
        weightPoints: v.number(),
        anchorCount: v.number(),
      }),
    ),
    bandThresholds: v.array(
      v.object({ band: v.number(), minScore: v.number() }),
    ),
  }),
})
  .index("by_org", ["orgId"])
  .index("by_org_slug", ["orgId", "slug"])

// One immutable frozen row per person in a run's population. Holds a
// pseudonymizable identity (NOT a live FK): erasure keys on personPublicId,
// tombstones displayName, clears birthDate, keeps the gender/band/pay aggregate.
export const payMappingSnapshotRows = defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  personPublicId: v.string(),
  displayName: v.string(),
  erased: v.boolean(),
  gender: v.union(v.literal("Man"), v.literal("Kvinna")),
  birthDate: v.optional(v.string()),
  employmentType: v.optional(v.string()),
  department: v.optional(v.string()),
  ftePercent: v.optional(v.number()),
  employmentStartDate: v.optional(v.string()),
  roleTitle: v.string(),
  trackKey: v.string(),
  level: v.string(),
  band: v.union(v.number(), v.null()),
  score: v.union(v.number(), v.null()),
  basicMonthly: v.union(v.number(), v.null()),
  components: v.array(
    v.object({ kind: v.string(), monthlyAmount: v.number() }),
  ),
  currency: v.optional(v.string()),
  payYear: v.optional(v.number()),
})
  .index("by_run", ["orgId", "runId"])
  .index("by_org_person", ["orgId", "personPublicId"])

// Read-oriented access dimension (ADR-0011 §3), kept out of the domain audit
// trail so high-volume view events do not pollute it. Slice 1: only "view".
export const payMappingAccessLog = defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  actorId: v.string(),
  at: v.number(),
  kind: v.union(v.literal("view"), v.literal("export")),
}).index("by_run", ["orgId", "runId"])
```

- [ ] **Step 2: Register in `schema.ts`**

Add the import next to the people import and the three names to `defineSchema`:

```ts
// after the people/tables import block:
import {
  payMappingRuns,
  payMappingSnapshotRows,
  payMappingAccessLog,
} from "./payMapping/tables"
```
```ts
// inside defineSchema({ ... }), after importProgress:
  payMappingRuns,
  payMappingSnapshotRows,
  payMappingAccessLog,
```

- [ ] **Step 3: Extend `lib/slug.ts`**

Change the union and add a branch in `uniqueSlug`'s `isTaken` (mirrors the existing `roles`/`roleFamilies` branches, because a union table arg loses index typing):

```ts
type SlugTable = "roles" | "roleFamilies" | "payMappingRuns"
```
```ts
  // inside isTaken, add a third branch:
  const hit =
    table === "roles"
      ? await ctx.db.query("roles").withIndex("by_org_slug", (q) =>
          q.eq("orgId", orgId).eq("slug", slug)).first()
      : table === "roleFamilies"
        ? await ctx.db.query("roleFamilies").withIndex("by_org_slug", (q) =>
            q.eq("orgId", orgId).eq("slug", slug)).first()
        : await ctx.db.query("payMappingRuns").withIndex("by_org_slug", (q) =>
            q.eq("orgId", orgId).eq("slug", slug)).first()
```

- [ ] **Step 4: Write the failing test**

```ts
// packages/backend/convex/payMapping/tables.test.ts
import { describe, expect, it } from "vitest"
import { initConvexTest } from "../testing.helpers"
import { uniqueSlug } from "../lib/slug"

describe("payMapping schema + slug", () => {
  it("stores and reads a payMappingRuns row", async () => {
    const t = initConvexTest()
    const runId = await t.run(async (ctx) =>
      ctx.db.insert("payMappingRuns", {
        orgId: "org1",
        slug: "lonekartlaggning-2026",
        label: "Lönekartläggning 2026",
        status: "active",
        referenceDate: 1,
        initiatedBy: "u1",
        initiatedAt: 1,
        systemVersion: "test",
        populationCount: 0,
        withPayCount: 0,
        unclassifiedExcludedCount: 0,
        frozenModel: { criteria: [], bandThresholds: [] },
      }),
    )
    const row = await t.run(async (ctx) => ctx.db.get(runId))
    expect(row?.slug).toBe("lonekartlaggning-2026")
  })

  it("uniqueSlug avoids a taken payMappingRuns slug", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("payMappingRuns", {
        orgId: "org1", slug: "lonekartlaggning-2026", label: "x",
        status: "active", referenceDate: 1, initiatedBy: "u1", initiatedAt: 1,
        systemVersion: "test", populationCount: 0, withPayCount: 0,
        unclassifiedExcludedCount: 0, frozenModel: { criteria: [], bandThresholds: [] },
      })
      const slug = await uniqueSlug(ctx, "payMappingRuns", "org1", "Lönekartläggning 2026")
      expect(slug).not.toBe("lonekartlaggning-2026")
      expect(slug.startsWith("lonekartlaggning-2026")).toBe(true)
    })
  })
})
```

- [ ] **Step 5: Run** `cd packages/backend && bunx vitest run convex/payMapping/tables.test.ts` — Expected: PASS (2 tests).
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat(pay-mapping): add kartläggning snapshot schema + slug support"`

---

### Task 2: Audit event + payload + field labels

**Files:**
- Modify: `packages/backend/convex/lib/audit.ts`
- Modify: `packages/backend/convex/lib/auditPayloads.ts`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`
- Modify: `apps/dashboard/lib/audit-labels.test.ts`
- Test: `apps/dashboard/lib/audit-labels.test.ts` (existing coverage tests)

**Produces:** `AUDIT_EVENTS.payMappingRunStarted` + its payload type, consumed by Task 3's `ctx.audit.log`.

**Interfaces:**
- Produces: `AuditPayloads["payMapping.runStarted"] = { runId: string; populationCount: number; withPayCount: number; unclassifiedExcludedCount: number }`.

- [ ] **Step 1: Add the event** in `lib/audit.ts` `AUDIT_EVENTS` (after `importCompleted`):

```ts
  importCompleted: "people.imported",
  payMappingRunStarted: "payMapping.runStarted",
```

- [ ] **Step 2: Add the category branch** in `categoryForEvent` (the `pay.` branch does not match `payMapping.`):

```ts
  if (type.startsWith("pay.") || type.startsWith("payMapping.")) return "pay"
```

- [ ] **Step 3: Add the payload type** in `lib/auditPayloads.ts` `AuditPayloads` (after `"people.imported"`):

```ts
  "payMapping.runStarted": {
    runId: string
    populationCount: number
    withPayCount: number
    unclassifiedExcludedCount: number
  }
```

- [ ] **Step 4: Add field labels + coverage** — in `apps/dashboard/lib/audit-labels.test.ts`, add the three fields to `OTHER_AUDIT_FIELDS`:

```ts
  // payMapping.runStarted flat-stat fields
  "populationCount",
  "withPayCount",
  "unclassifiedExcludedCount",
```

- [ ] **Step 5: Add i18n** — in each of the 5 locale files, add the event label under `dashboard.auditLog.events` (key `payMappingRunStarted`) and the 3 field labels under `dashboard.auditLog.fields`. English:

```json
// dashboard.auditLog.events
"payMappingRunStarted": "Pay mapping started",
// dashboard.auditLog.fields
"populationCount": "People included",
"withPayCount": "With a salary",
"unclassifiedExcludedCount": "Excluded (unclassified)",
```

Nordic drafts (flag for native review): sv `"Lönekartläggning startad"` / `"Personer inkluderade"` / `"Med lön"` / `"Exkluderade (oklassade)"`; nb `"Lønnskartlegging startet"` / `"Personer inkludert"` / `"Med lønn"` / `"Ekskludert (uklassifisert)"`; da `"Lønkortlægning startet"` / `"Personer inkluderet"` / `"Med løn"` / `"Ekskluderet (uklassificeret)"`; fi `"Palkkakartoitus aloitettu"` / `"Mukana olevat henkilöt"` / `"Palkka tiedossa"` / `"Suljettu pois (luokittelematon)"`.

- [ ] **Step 6: Run** `cd apps/dashboard && bunx vitest run lib/audit-labels.test.ts` — Expected: PASS (both coverage tests). Then `cd packages/i18n && bunx vitest run` — Expected: parity PASS. Then `bun run turbo typecheck` — Expected: PASS (the `auditPayloads` compile-guard accepts the new key).
- [ ] **Step 7: Commit** `git add -A && git commit -m "feat(pay-mapping): add payMapping.runStarted audit event + labels"`

---

### Task 3: The freeze mutation `startPayMappingRun`

**Files:**
- Create: `packages/backend/convex/payMapping/runs.ts`
- Test: `packages/backend/convex/payMapping/runs.test.ts`

**Interfaces:**
- Consumes: `uniqueSlug` (Task 1), `AUDIT_EVENTS.payMappingRunStarted` (Task 2), `deriveResults` from `../assessment/compute`, `orgMutation` from `../lib/functions`.
- Produces: `startPayMappingRun({ orgId, label }) → { runId: Id<"payMappingRuns">, slug: string }`.

- [ ] **Step 1: Write `runs.ts` (freeze mutation)**

```ts
// packages/backend/convex/payMapping/runs.ts
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import { deriveResults } from "../assessment/compute"
import { AUDIT_EVENTS } from "../lib/audit"
import { orgMutation } from "../lib/functions"
import { uniqueSlug } from "../lib/slug"

const SYSTEM_VERSION = "v2-slice1"

// The pay record active at `asOf`: greatest effectiveAt <= asOf (mirrors
// getCurrentSalary's inner rule; raw Doc, not the wire shape).
function payRecordAt(
  rows: readonly Doc<"payRecords">[],
  asOf: number,
): Doc<"payRecords"> | null {
  let current: Doc<"payRecords"> | null = null
  for (const row of rows) {
    if (row.effectiveAt <= asOf && (current === null || row.effectiveAt > current.effectiveAt)) {
      current = row
    }
  }
  return current
}

export const startPayMappingRun = orgMutation({
  args: { label: v.string() },
  returns: v.object({ runId: v.id("payMappingRuns"), slug: v.string() }),
  handler: async (ctx, { label }) => {
    const referenceDate = Date.now()
    const trimmed = label.trim() || `Lönekartläggning ${new Date(referenceDate).getFullYear()}`
    const slug = await uniqueSlug(ctx, "payMappingRuns", ctx.orgId, trimmed)

    // Freeze the model config once (ADR-0008).
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    const criteriaRows = model
      ? await ctx.db
          .query("criteria")
          .withIndex("by_model", (q) => q.eq("modelId", model._id))
          .collect()
      : []
    const frozenModel = {
      criteria: criteriaRows.map((c) => ({
        name: c.name,
        weightPoints: c.weightPoints,
        anchorCount: c.anchors.length,
      })),
      bandThresholds: model?.bandThresholds ?? [],
    }

    // Derive band/score for every role once, index by roleId.
    const derived = await deriveResults(ctx, ctx.orgId)
    const bandByRole = new Map(derived.results.map((r) => [r.roleId, r]))

    // Roles for title/track lookup.
    const roleRows = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const roleById = new Map(roleRows.map((r) => [r._id as string, r]))

    // Population = active (non-archived) people with an open assignment.
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const active = people.filter((p) => p.archivedAt === undefined)

    const runId = await ctx.db.insert("payMappingRuns", {
      orgId: ctx.orgId,
      slug,
      label: trimmed,
      status: "active",
      referenceDate,
      initiatedBy: ctx.authUserId,
      initiatedAt: referenceDate,
      systemVersion: SYSTEM_VERSION,
      populationCount: 0,
      withPayCount: 0,
      unclassifiedExcludedCount: 0,
      frozenModel,
    })

    let populationCount = 0
    let withPayCount = 0
    let unclassifiedExcludedCount = 0

    for (const person of active) {
      const assignments = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", ctx.orgId).eq("personId", person._id))
        .collect()
      const open = assignments.find((a) => a.endedAt === undefined) ?? null
      if (open === null) {
        unclassifiedExcludedCount += 1
        continue
      }
      const role = roleById.get(open.roleId as string)
      const result = bandByRole.get(open.roleId as string)
      const payRows = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", ctx.orgId).eq("personId", person._id))
        .collect()
      const pay = payRecordAt(payRows, referenceDate)
      if (pay !== null) withPayCount += 1

      await ctx.db.insert("payMappingSnapshotRows", {
        orgId: ctx.orgId,
        runId,
        personPublicId: person.publicId,
        displayName: person.displayName,
        erased: false,
        gender: person.gender,
        ...(person.birthDate !== undefined ? { birthDate: person.birthDate } : {}),
        ...(person.employmentType !== undefined ? { employmentType: person.employmentType } : {}),
        ...(person.department !== undefined ? { department: person.department } : {}),
        ...(person.ftePercent !== undefined ? { ftePercent: person.ftePercent } : {}),
        ...(person.employmentStartDate !== undefined ? { employmentStartDate: person.employmentStartDate } : {}),
        roleTitle: role?.title ?? "",
        trackKey: role?.trackKey ?? "",
        level: open.level,
        band: result?.band ?? null,
        score: result?.score ?? null,
        basicMonthly: pay?.basicMonthly ?? null,
        components: pay?.components ?? [],
        ...(pay?.currency !== undefined ? { currency: pay.currency } : {}),
        ...(pay?.payYear !== undefined ? { payYear: pay.payYear } : {}),
      })
      populationCount += 1
    }

    await ctx.db.patch(runId, { populationCount, withPayCount, unclassifiedExcludedCount })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingRunStarted,
      payload: { runId, populationCount, withPayCount, unclassifiedExcludedCount },
    })
    return { runId, slug }
  },
})
```

- [ ] **Step 2: Write the failing test**

```ts
// packages/backend/convex/payMapping/runs.test.ts
import { describe, expect, it } from "vitest"
import { api } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
// Reuse the people/assessment seed helpers already used by classification.test.ts.
// Confirm the exact helper names during implementation (grep people/__fixtures__).

describe("startPayMappingRun", () => {
  it("freezes one row per classified active person and skips unclassified", async () => {
    const t = initConvexTest()
    // seed: an org with a model, 1 evaluated role, 2 classified people (one with
    // pay, one without), 1 unclassified active person. Use the fixtures.
    // ... seed via t.run / public mutations ...
    const { orgId, asHr } = await seedForFreeze(t) // implement from fixtures
    const { runId } = await asHr.mutation(api.payMapping.runs.startPayMappingRun, {
      orgId, label: "Test",
    })
    const run = await t.run((ctx) => ctx.db.get(runId))
    expect(run?.populationCount).toBe(2)
    expect(run?.withPayCount).toBe(1)
    expect(run?.unclassifiedExcludedCount).toBe(1)
    const rows = await t.run((ctx) =>
      ctx.db.query("payMappingSnapshotRows")
        .withIndex("by_run", (q) => q.eq("orgId", orgId).eq("runId", runId)).collect())
    expect(rows).toHaveLength(2)
    // band/score match the engine for the assigned role
    const withRole = rows.find((r) => r.roleTitle !== "")
    expect(withRole?.band).not.toBeUndefined()
  })

  it("writes exactly one payMapping.runStarted audit row with no person data", async () => {
    const t = initConvexTest()
    const { orgId, asHr } = await seedForFreeze(t)
    await asHr.mutation(api.payMapping.runs.startPayMappingRun, { orgId, label: "Test" })
    const audits = await t.run((ctx) =>
      ctx.db.query("auditLog").withIndex("by_org_type", (q) =>
        q.eq("orgId", orgId).eq("type", "payMapping.runStarted")).collect())
    expect(audits).toHaveLength(1)
    const payload = audits[0]?.payload as Record<string, unknown>
    expect(payload).not.toHaveProperty("displayName")
    expect(payload.populationCount).toBe(2)
  })
})
```

- [ ] **Step 3: Run** `cd packages/backend && bunx vitest run convex/payMapping/runs.test.ts` — Expected: FAIL then PASS after the seed helper is written. Regenerate the API if needed: the freeze mutation appears at `api.payMapping.runs.startPayMappingRun`.
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(pay-mapping): freeze a kartläggning snapshot at start"`

---

### Task 4: Read queries + view logging

**Files:**
- Modify: `packages/backend/convex/payMapping/runs.ts`
- Test: `packages/backend/convex/payMapping/runs.test.ts`

**Interfaces:**
- Produces: `listPayMappingRuns({ orgId }) → RunSummary[]` (newest first); `getPayMappingRunBySlug({ orgId, slug }) → { run, rows } | null`; `logPayMappingView({ orgId, runId })`.

- [ ] **Step 1: Add the queries + view-log mutation to `runs.ts`**

```ts
import { orgQuery } from "../lib/functions"

const runSummary = v.object({
  runId: v.id("payMappingRuns"),
  slug: v.string(),
  label: v.string(),
  status: v.union(v.literal("active"), v.literal("paused"), v.literal("underReview"), v.literal("completed")),
  referenceDate: v.number(),
  initiatedBy: v.string(),
  populationCount: v.number(),
  withPayCount: v.number(),
})

export const listPayMappingRuns = orgQuery({
  args: {},
  returns: v.array(runSummary),
  handler: async (ctx) => {
    const runs = await ctx.db
      .query("payMappingRuns")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    runs.sort((a, b) => b.referenceDate - a.referenceDate) // newest first
    return runs.map((r) => ({
      runId: r._id, slug: r.slug, label: r.label, status: r.status,
      referenceDate: r.referenceDate, initiatedBy: r.initiatedBy,
      populationCount: r.populationCount, withPayCount: r.withPayCount,
    }))
  },
})

const snapshotRowShape = v.object({
  displayName: v.string(),
  erased: v.boolean(),
  gender: v.union(v.literal("Man"), v.literal("Kvinna")),
  roleTitle: v.string(),
  trackKey: v.string(),
  level: v.string(),
  band: v.union(v.number(), v.null()),
  basicMonthly: v.union(v.number(), v.null()),
  currency: v.optional(v.string()),
  payYear: v.optional(v.number()),
})

export const getPayMappingRunBySlug = orgQuery({
  args: { slug: v.string() },
  returns: v.union(v.null(), v.object({
    runId: v.id("payMappingRuns"),
    label: v.string(),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("underReview"), v.literal("completed")),
    referenceDate: v.number(),
    initiatedBy: v.string(),
    populationCount: v.number(),
    withPayCount: v.number(),
    unclassifiedExcludedCount: v.number(),
    populationNote: v.union(v.string(), v.null()),
    rows: v.array(snapshotRowShape),
  })),
  handler: async (ctx, { slug }) => {
    const run = await ctx.db
      .query("payMappingRuns")
      .withIndex("by_org_slug", (q) => q.eq("orgId", ctx.orgId).eq("slug", slug))
      .first()
    if (run === null) return null
    const rows = await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", run._id))
      .collect()
    return {
      runId: run._id, label: run.label, status: run.status,
      referenceDate: run.referenceDate, initiatedBy: run.initiatedBy,
      populationCount: run.populationCount, withPayCount: run.withPayCount,
      unclassifiedExcludedCount: run.unclassifiedExcludedCount,
      populationNote: run.populationNote ?? null,
      rows: rows.map((r) => ({
        displayName: r.displayName, erased: r.erased, gender: r.gender,
        roleTitle: r.roleTitle, trackKey: r.trackKey, level: r.level,
        band: r.band, basicMonthly: r.basicMonthly,
        ...(r.currency !== undefined ? { currency: r.currency } : {}),
        ...(r.payYear !== undefined ? { payYear: r.payYear } : {}),
      })),
    }
  },
})

// View-logging (ADR-0011 §3). A mutation, called by the detail page on mount.
// Not audited via ctx.audit (this is the separate access dimension).
export const logPayMappingView = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId) return null
    await ctx.db.insert("payMappingAccessLog", {
      orgId: ctx.orgId, runId, actorId: ctx.authUserId, at: Date.now(), kind: "view",
    })
    return null
  },
})
```

- [ ] **Step 2: Write tests** (append to `runs.test.ts`): `listPayMappingRuns` returns runs newest-first; `getPayMappingRunBySlug` resolves a run + its rows and returns `null` for an unknown slug; `logPayMappingView` appends one `view` row to `payMappingAccessLog`.
- [ ] **Step 3: Run** `cd packages/backend && bunx vitest run convex/payMapping/runs.test.ts` — Expected: PASS.
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(pay-mapping): list, detail-by-slug, and view logging"`

---

### Task 5: GDPR erasure into the snapshot

**Files:**
- Create: `packages/backend/convex/payMapping/erasure.ts`
- Modify: `packages/backend/convex/people/erase.ts`
- Test: `packages/backend/convex/payMapping/erasure.test.ts`

**Interfaces:**
- Produces: `pseudonymizePersonInSnapshots(ctx, orgId, personPublicId)`.
- Consumes: `ERASED_ACTOR_NAME` from `../lib/audit`.

- [ ] **Step 1: Write `erasure.ts`**

```ts
// packages/backend/convex/payMapping/erasure.ts
import type { MutationCtx } from "../_generated/server"
import { ERASED_ACTOR_NAME } from "../lib/audit"

// GDPR (ADR-0011): pseudonymize an erased person inside every immutable snapshot
// row (tombstone the name, clear the birth date) while KEEPING the aggregate
// (gender, role/band/level, pay) so the statutory evidence document survives.
export async function pseudonymizePersonInSnapshots(
  ctx: MutationCtx,
  orgId: string,
  personPublicId: string,
): Promise<void> {
  const rows = await ctx.db
    .query("payMappingSnapshotRows")
    .withIndex("by_org_person", (q) =>
      q.eq("orgId", orgId).eq("personPublicId", personPublicId))
    .collect()
  for (const row of rows) {
    await ctx.db.patch(row._id, {
      erased: true,
      displayName: ERASED_ACTOR_NAME,
      birthDate: undefined,
    })
  }
}
```

- [ ] **Step 2: Wire into `people/erase.ts`** — capture `person.publicId` before deletion and call the helper. In `erasePersonRecords`, add the import and, after step 3 (delete the people row), the pseudonymize call. Because `person` is fetched at the top, capture its publicId before the deletes:

```ts
import { pseudonymizePersonInSnapshots } from "../payMapping/erasure"
```
```ts
  // near the top, after the ownership check:
  const personPublicId = person.publicId
```
```ts
  // 3. The people row itself.
  await ctx.db.delete(personId)

  // 4. Pseudonymize the person inside any frozen kartläggning snapshot
  //    (ADR-0011): the row stays, identity is tombstoned, aggregate kept.
  await pseudonymizePersonInSnapshots(ctx, orgId, personPublicId)
```

- [ ] **Step 3: Write the failing test**

```ts
// packages/backend/convex/payMapping/erasure.test.ts
import { describe, expect, it } from "vitest"
import { api } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

describe("erasure pseudonymizes snapshot rows", () => {
  it("tombstones name + clears birthDate, keeps gender/band/pay", async () => {
    const t = initConvexTest()
    // seed org + admin, a classified person with pay + birthDate, then freeze.
    const { orgId, asAdmin, personId, publicId } = await seedPersonAndFreeze(t)
    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, { orgId, personId })
    const rows = await t.run((ctx) =>
      ctx.db.query("payMappingSnapshotRows").withIndex("by_org_person", (q) =>
        q.eq("orgId", orgId).eq("personPublicId", publicId)).collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.erased).toBe(true)
    expect(rows[0]?.displayName).toBe("deleted user")
    expect(rows[0]?.birthDate).toBeUndefined()
    expect(rows[0]?.gender).toBe("Kvinna") // aggregate kept
    // live person + pay are gone:
    expect(await t.run((ctx) => ctx.db.get(personId))).toBeNull()
  })
})
```

- [ ] **Step 4: Run** `cd packages/backend && bunx vitest run convex/payMapping/erasure.test.ts` — Expected: PASS. Confirm no import cycle warning (people → payMapping handler-scope import is one-way; mirror the audit-helper precedent).
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(pay-mapping): pseudonymize erased people inside the snapshot"`

---

### Task 6: i18n for the payMapping UI

**Files:**
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`
- Test: `packages/i18n` parity test

**Interfaces:**
- Produces: `dashboard.payMapping.*`, `dashboard.nav.payMapping`, `dashboard.toast.payMappingStarted`, `dashboard.help.payMapping{Label,Body}` / `referenceDate{Label,Body}`.

- [ ] **Step 1: Add the `dashboard.payMapping` namespace to `en.json`** (sibling of `roles`):

```json
"payMapping": {
  "heading": "Pay mappings",
  "description": "Frozen snapshots of your pay data for equal-pay analysis. Each one captures a point in time.",
  "startCta": "Start pay mapping",
  "empty": "No pay mappings yet. Start one to freeze today's pay data for analysis.",
  "table": {
    "label": "Name",
    "referenceDate": "Reference date",
    "status": "Status",
    "population": "People",
    "responsible": "Started by",
    "created": "Created"
  },
  "status": { "active": "Active", "paused": "Paused", "underReview": "Under review", "completed": "Completed" },
  "start": {
    "title": "Start a pay mapping",
    "description": "This freezes a snapshot of today's pay, roles and demographics. The reference date is today.",
    "labelLabel": "Name",
    "labelPlaceholder": "e.g. Pay mapping 2026",
    "cta": "Start",
    "cancel": "Cancel",
    "error": "The pay mapping could not be started. Try again."
  },
  "detail": {
    "population": "People included",
    "withPay": "With a salary",
    "excluded": "Excluded (unclassified)",
    "referenceDate": "Reference date",
    "notFound": "That pay mapping was not found.",
    "back": "Back to pay mappings",
    "erased": "Erased",
    "columns": { "name": "Name", "gender": "Gender", "role": "Role", "band": "Band", "level": "Level", "salary": "Monthly salary" }
  }
}
```

- [ ] **Step 2: Add flat keys** — `dashboard.nav.payMapping` = `"Pay mappings"`; `dashboard.toast.payMappingStarted` = `"Pay mapping started"`; `dashboard.help.payMappingLabel` = `"What is a pay mapping?"` + `payMappingBody` = `"A pay mapping (lönekartläggning) is a frozen snapshot of your pay, roles and demographics at a point in time. All equal-pay analysis runs against the frozen copy, never live data, so the numbers cannot shift under you."`; `dashboard.help.referenceDateLabel` = `"What is the reference date?"` + `referenceDateBody` = `"The date the snapshot represents. It is set to today when you start the mapping."`
- [ ] **Step 3: Mirror all keys into `sv/nb/da/fi.json`** (draft translations, flag for native review) — same key paths, translated values. Swedish `heading` = `"Lönekartläggningar"`, `startCta` = `"Starta lönekartläggning"`, etc.
- [ ] **Step 4: Run** `cd packages/i18n && bunx vitest run` — Expected: parity PASS across all 4 non-en locales. Then a mojibake sniff (grep the new values for `�`, `Ã`, `â€`).
- [ ] **Step 5: Commit** `git add -A && git commit -m "i18n(pay-mapping): add the kartläggning UI strings"`

---

### Task 7: Nav + list page + start dialog

**Files:**
- Create: `apps/dashboard/lib/pay-mapping-schemas.ts`
- Create: `apps/dashboard/components/pay-mapping/pay-mappings-section.tsx`
- Create: `apps/dashboard/components/pay-mapping/start-pay-mapping-dialog.tsx`
- Create: `apps/dashboard/app/(app)/pay-mappings/page.tsx`
- Modify: `apps/dashboard/components/app-sidebar.tsx`
- Test: `apps/dashboard/components/pay-mapping/pay-mappings-section.test.tsx`, `start-pay-mapping-dialog.test.tsx`

**Interfaces:**
- Consumes: `api.payMapping.runs.listPayMappingRuns`, `api.payMapping.runs.startPayMappingRun`.

- [ ] **Step 1: Schema factory** `apps/dashboard/lib/pay-mapping-schemas.ts`:

```ts
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

export function makeStartRunSchema(t: ValidationT) {
  return z.object({ label: z.string().trim().min(1, t("required")) })
}
export type StartRunValues = z.infer<ReturnType<typeof makeStartRunSchema>>
```

- [ ] **Step 2: Start dialog** — mirror `apps/dashboard/components/roles/create-role-dialog.tsx` verbatim for structure (Dialog + Form + FormField(Input) + DialogFooter + SubmitButton + `handleOpenChange` reset). The only differences: one `label` field; `onSubmit` calls `startPayMappingRun({ orgId, label: values.label })`, then `toast.success(tToast("payMappingStarted"))` and `router.push(\`/pay-mappings/\${slug}\`)`; `useForm` defaults `{ label: "" }` with `makeStartRunSchema`. A `HelpMorphButton label={tHelp("referenceDateLabel")}` beside the title explains the today-reference. SubmitButton gated `disabled={!form.formState.isValid}` + `isSubmitting`.

- [ ] **Step 3: List section** `pay-mappings-section.tsx` — mirror the loading/empty/loaded three-way from `components/people/people-section.tsx` (`loading = runs === undefined`), but a plain (non-paginated) `Table className="table-fixed"` since runs are few and chronological (newest first is the query order). Columns from `dashboard.payMapping.table.*`. Rows link to `/pay-mappings/[slug]` via `next/link`. A `TableSkeleton` with matching columns while loading; an `Empty` (with the `payMappingLabel` HelpMorph + the start dialog trigger) when `runs.length === 0`. `AnimatePresence` + `motion.tr` (key `runId`, `layout="position"`, `SPRING`, fade) for a newly-created run entering (mirror `components/bands/band-ladder.tsx`). The "Starta kartläggning" primary button (opening the dialog) sits above the table.

- [ ] **Step 4: Page** `app/(app)/pay-mappings/page.tsx`:

```tsx
"use client"
import { useTranslations } from "next-intl"
import { PayMappingsSection } from "@/components/pay-mapping/pay-mappings-section"
import { usePageTitle } from "@/hooks/use-page-title" // confirm the exact hook path

export default function PayMappingsPage() {
  const t = useTranslations("dashboard.payMapping")
  usePageTitle(t("heading"))
  return <PayMappingsSection />
}
```
`PayMappingsSection` reads `orgId` from `useOrganization()` and runs `useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })`.

- [ ] **Step 5: Nav** — in `components/app-sidebar.tsx`, import an icon (e.g. `import { ChartColumnIcon } from "@hugeicons/core-free-icons"` — confirm the exact export name) and push into `navMain` after the people entry:

```tsx
  {
    title: t("nav.payMapping"),
    url: "/pay-mappings",
    icon: <HugeiconsIcon icon={ChartColumnIcon} strokeWidth={2} />,
  },
```

- [ ] **Step 6: Tests** — `pay-mappings-section.test.tsx`: renders the skeleton while the query is undefined, the empty state at zero runs, and a row per run when loaded (mock `useQuery`). `start-pay-mapping-dialog.test.tsx`: the label field validates (empty → submit disabled), a valid submit calls `startPayMappingRun` and toasts (mock `useMutation` + `sonner` + `next/navigation`). Mirror the mocking setup in `components/roles/create-role-dialog.test.tsx`.
- [ ] **Step 7: Run** `cd apps/dashboard && bunx vitest run components/pay-mapping/` — Expected: PASS. Then `bun run turbo typecheck`.
- [ ] **Step 8: Commit** `git add -A && git commit -m "feat(pay-mapping): nav, list page, and start dialog"`

---

### Task 8: Detail page + view logging

**Files:**
- Create: `apps/dashboard/components/pay-mapping/pay-mapping-detail.tsx`
- Create: `apps/dashboard/app/(app)/pay-mappings/[slug]/page.tsx`
- Test: `apps/dashboard/components/pay-mapping/pay-mapping-detail.test.tsx`

**Interfaces:**
- Consumes: `api.payMapping.runs.getPayMappingRunBySlug`, `api.payMapping.runs.logPayMappingView`.

- [ ] **Step 1: Detail page** — mirror `app/(app)/roles/[roleSlug]/page.tsx` verbatim for the slug-param + loading contract (`use(props.params)`, `useQuery(...getPayMappingRunBySlug, { orgId, slug })`, `undefined → skeleton`, `null → not-found + back link`, object → render `<PayMappingDetail run={run} />`). Read `orgId` from `useOrganization()`.

- [ ] **Step 2: Detail component** `pay-mapping-detail.tsx` — renders a metadata block (label, reference date via `useFormatter().dateTime`, status badge, `populationCount`/`withPayCount`/`unclassifiedExcludedCount`, `populationNote`) and a read-only `Table` of `run.rows` (columns from `dashboard.payMapping.detail.columns.*`: name — or the `detail.erased` label when `row.erased` — gender, role, band, level, monthly salary). Fires the view-log once on mount:

```tsx
const logView = useMutation(api.payMapping.runs.logPayMappingView)
useEffect(() => {
  void logView({ orgId, runId: run.runId })
  // run.runId is stable for the mounted detail; log once.
}, [logView, orgId, run.runId])
```
A `HelpMorphButton label={tHelp("payMappingLabel")}` beside the heading explains the concept.

- [ ] **Step 3: Test** `pay-mapping-detail.test.tsx`: renders metadata + one row per `run.rows`, shows the `erased` label for an erased row, and calls `logPayMappingView` on mount (mock `useMutation`). Mirror the component-test setup used elsewhere in `components/`.
- [ ] **Step 4: Run** `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-mapping-detail.test.tsx` — Expected: PASS. Then `bun run turbo typecheck`.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(pay-mapping): frozen-population detail page + view logging"`

---

### Task 9: Docs — go-live scale task + CLAUDE.md PII note

**Files:**
- Modify: `docs/go-live-checklist.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: go-live-checklist** — add: "Pay-mapping freeze (`startPayMappingRun`) is a single transaction. Verify against Convex's per-transaction read/write limits and convert to the batched-action pattern (mirror `people/import`) before onboarding an org above ~1000 employees."
- [ ] **Step 2: CLAUDE.md** — update the "Person PII lives ONLY in ..." sentence in the erasure invariant to add the snapshot as a sanctioned location: "... and the frozen `payMappingSnapshotRows` (ADR-0011, the pay-mapping evidence document; pseudonymized on erasure, never hard-deleted)." Keep the "never the role/rating/model/audit/AI tables" clause intact.
- [ ] **Step 3: Commit** `git add -A && git commit -m "docs(pay-mapping): note the freeze scaling task and snapshot PII location"`

---

## Notes for the implementer

- **Seed helpers:** Tasks 3-5 need an org with a model, an evaluated role, classified people (with/without pay), and an unclassified person. Reuse the fixtures under `packages/backend/convex/people/__fixtures__` and the seed patterns in `people/classification.test.ts` and `assessment/roles.test.ts`. `asHr`/`asAdmin` are `t.withIdentity({ subject })` wrappers as used in `accounts/audit.test.ts`.
- **API regeneration:** new Convex functions surface at `api.payMapping.runs.*` automatically via `_generated`; run the convex codegen (or the dev server) if the `api` object lookup fails to typecheck.
- **`deriveResults` collects the whole org once** — never call it per person (Task 3 already indexes it into a Map).
- **Pre-commit hook** runs Biome + typecheck + full `turbo test`; all must pass per commit.
```

# Model Compliance Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let HR document per-criterion rationale and bias review, and export the model plus that evidence as a branded, localized metodbilaga PDF, at V1 compliance level 2.

**Architecture:** A new backend module `evaluationModel/method.ts` owns the compliance write path (two mutations) and read path (one query). A new `/model/method` route hosts the capture UI (per-criterion editor + status + progress) and the export button. A reusable `@react-pdf/renderer` branded kit under `apps/dashboard/components/pdf/` renders the metodbilaga from a pure, tested assembler.

**Tech Stack:** Convex (backend), Next.js 16 App Router + React 19 (dashboard), next-intl i18n, react-hook-form + Zod + shadcn Form, `@react-pdf/renderer` (new), Vitest 4 + convex-test.

**Spec:** `docs/superpowers/specs/2026-07-01-model-compliance-evidence-design.md` (read it for rationale).

## Global Constraints

- **No schema change.** All fields already exist on `criteria` (`purpose`, `whyRelevant`, `overlapNotes`, `biasRisk`, `biasComment`, `biasAction`, `approved`, `decidedBy`, `decidedAt`) and `models.bandThresholds`.
- **Completeness (single source of truth):** required = `purpose`, `whyRelevant`, `biasRisk`, `biasComment`; optional = `overlapNotes`, `biasAction`. A criterion is **documented** when all four required are present (non-empty after trim; `biasRisk` set). Four-state status: `notStarted` | `inProgress` | `documented` | `approved`. Approval requires documented. Metodbilaga is **FINAL** when every criterion is `approved`, else **DRAFT**.
- **Approval** is an explicit admin sign-off; `decidedBy` = `ctx.authUserId`, `decidedAt` = `Date.now()`. **Editing content after approval reopens it** (clears `approved`/`decidedBy`/`decidedAt`).
- **Audit:** compliance edits log `AUDIT_EVENTS.modelUpdated` with a new `change` discriminant (`criterion.complianceUpdated` / `criterion.approvalChanged`). **No band-shift** (documentation never moves a score). No new audit event key, so no new audit label.
- **Role ≠ Person:** never put person/salary/performance data in these fields, the appendix, or the audit trail.
- **i18n:** all user-facing text via next-intl; add keys to `packages/i18n/messages/en.json` first, then mirror to `sv`, `nb`, `da`, `fi`. Swedish is the authoritative compliance copy; nb/da/fi are machine drafts flagged for native review. The parity test requires the same key set in all five files.
- **Wording rule:** the appendix says **"biasreducerande", never "biasfri"**. **No em dashes** in any copy.
- **PDF:** `@react-pdf/renderer` runs as a client component only (`'use client'` + `next/dynamic` with `ssr: false`). Generation is client-side. Charts are out of scope (metodbilaga is chartless).
- **Org-scoped, admin-only** (`adminQuery`/`adminMutation`). Backend re-validates independently of the client.
- **Forms:** react-hook-form + `zodResolver`, `mode: "onTouched"`, factory `makeXSchema(t)`, shadcn `Form` components, submit gated on `isValid` (+ `isDirty` for the prefilled editor).
- **Tests:** Vitest 4, `bun run test` (never `bun test`). Backend uses convex-test on edge-runtime. New code ships with tests in the same commit. The pre-commit hook runs Biome + full typecheck + `turbo run test`; all must pass.
- **Conventions:** row actions via dropdown; dialogs use standard shadcn anatomy (header, body, footer: cancel outline first, primary last); minimize layout shift; commit messages use conventional prefixes.

---

## File Structure

- `packages/backend/convex/evaluationModel/method.ts` (create): `complianceStatus` helper, `saveCriterionCompliance`, `setCriterionApproval`, `getMethodModel`.
- `packages/backend/convex/evaluationModel/method.test.ts` (create): backend tests.
- `packages/backend/convex/lib/auditPayloads.ts` (modify): two new `ModelUpdatedPayload` variants.
- `apps/dashboard/lib/criterion-compliance-schemas.ts` (create): `makeCriterionComplianceSchema` + `CriterionComplianceValues`.
- `apps/dashboard/lib/criterion-compliance-schemas.test.ts` (create).
- `apps/dashboard/components/model/model-tabs.tsx` (modify): add the Method tab.
- `apps/dashboard/app/(app)/model/method/page.tsx` (create): the Method page.
- `apps/dashboard/components/model/method-panel.tsx` (create): list + progress + export button host.
- `apps/dashboard/components/model/criterion-compliance-dialog.tsx` (create): per-criterion editor + approve control.
- `apps/dashboard/components/model/method-panel.test.tsx`, `criterion-compliance-dialog.test.tsx` (create).
- `apps/dashboard/lib/pdf/method-appendix-data.ts` (create): pure assembler.
- `apps/dashboard/lib/pdf/method-appendix-data.test.ts` (create).
- `apps/dashboard/components/pdf/branded-document.tsx` (create): reusable branded kit.
- `apps/dashboard/components/pdf/method-appendix.tsx` (create): the metodbilaga document.
- `apps/dashboard/components/pdf/method-appendix-download.tsx` (create): client-only export trigger.
- `packages/i18n/messages/{en,sv,nb,da,fi}.json` (modify): new keys under `model.tabs.method`, `dashboard.model.method.*`, `dashboard.model.methodAppendix.*`, `dashboard.help.*`.

---

## Task 1: Backend write path (mutations + audit contract)

**Files:**
- Create: `packages/backend/convex/evaluationModel/method.ts`
- Create: `packages/backend/convex/evaluationModel/method.test.ts`
- Modify: `packages/backend/convex/lib/auditPayloads.ts` (extend `ModelUpdatedPayload`)

**Interfaces:**
- Consumes: `adminMutation` (`ctx.orgId`, `ctx.authUserId`, `ctx.audit`, `ctx.db`), `AUDIT_EVENTS.modelUpdated`, `buildChanges`, `appError`, `ERROR_CODES` from `../lib/*`.
- Produces: `complianceStatus(criterion): ComplianceStatus`, `ComplianceStatus`, `COMPLIANCE_AUDIT_FIELDS`, and mutations `saveCriterionCompliance({criterionId, purpose, whyRelevant, overlapNotes, biasRisk?, biasComment, biasAction})` and `setCriterionApproval({criterionId, approved})`.

- [ ] **Step 1: Extend the audit payload contract.** In `lib/auditPayloads.ts`, add two variants to the `ModelUpdatedPayload` union (after the `criterion.removed` variant, before the closing of the type):

```ts
  | {
      change: "criterion.complianceUpdated"
      criterionId: string
      modelId: string
      changes: Changes
    }
  | {
      change: "criterion.approvalChanged"
      criterionId: string
      modelId: string
      changes: Changes
    }
```

- [ ] **Step 2: Run typecheck to confirm the contract compiles.**

Run: `cd packages/backend && bun run typecheck`
Expected: PASS (the discriminated union now has the two extra variants).

- [ ] **Step 3: Write the failing backend tests.** Create `packages/backend/convex/evaluationModel/method.test.ts`. Use the existing seed helpers (mirror `model.test.ts`: `initConvexTest`, `seedReadyOrganization`, `asAdmin`). Read back state with `t.run`.

```ts
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api } from "../_generated/api"
import { initConvexTest, seedReadyOrganization } from "../test/helpers"

describe("criterion compliance write path", () => {
  it("saves rationale + bias fields and audits with no band-shift", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const model = await asAdmin.query(api.evaluationModel.model.getModel, { orgId })
    const criterionId = model!.criteria[0]!.criterionId

    await asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId,
      criterionId,
      purpose: "Measure scope of impact",
      whyRelevant: "Distinguishes seniority objectively",
      overlapNotes: "",
      biasRisk: "low",
      biasComment: "Gender-neutral wording checked",
      biasAction: "",
    })

    const saved = await t.run(async (ctx) => ctx.db.get(criterionId))
    expect(saved!.purpose).toBe("Measure scope of impact")
    expect(saved!.overlapNotes).toBeUndefined() // empty string clears
    expect(saved!.biasRisk).toBe("low")

    const rows = await t.run(async (ctx) =>
      ctx.db.query("auditLog").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect()
    )
    const compliance = rows.filter((r) => (r.payload as { change?: string }).change === "criterion.complianceUpdated")
    expect(compliance).toHaveLength(1)
    const bandShifts = rows.filter((r) => r.type === "band.shift")
    expect(bandShifts).toHaveLength(0)
  })

  it("blocks approval until documented, then stamps and reopens on edit", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const model = await asAdmin.query(api.evaluationModel.model.getModel, { orgId })
    const criterionId = model!.criteria[0]!.criterionId

    await expect(
      asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
        orgId, criterionId, approved: true,
      })
    ).rejects.toThrow(/invalidInput/)

    await asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId, criterionId,
      purpose: "p", whyRelevant: "w", overlapNotes: "",
      biasRisk: "medium", biasComment: "b", biasAction: "",
    })
    await asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
      orgId, criterionId, approved: true,
    })
    let doc = await t.run(async (ctx) => ctx.db.get(criterionId))
    expect(doc!.approved).toBe(true)
    expect(typeof doc!.decidedBy).toBe("string")
    expect(typeof doc!.decidedAt).toBe("number")

    // Editing content reopens the sign-off.
    await asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId, criterionId,
      purpose: "p2", whyRelevant: "w", overlapNotes: "",
      biasRisk: "medium", biasComment: "b", biasAction: "",
    })
    doc = await t.run(async (ctx) => ctx.db.get(criterionId))
    expect(doc!.approved).toBeUndefined()
    expect(doc!.decidedBy).toBeUndefined()
  })

  it("rejects a criterion from another org", async () => {
    const t = initConvexTest()
    const a = await seedReadyOrganization(t)
    const b = await seedReadyOrganization(t)
    const modelB = await b.asAdmin.query(api.evaluationModel.model.getModel, { orgId: b.orgId })
    const foreignCriterion = modelB!.criteria[0]!.criterionId
    await expect(
      a.asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
        orgId: a.orgId, criterionId: foreignCriterion,
        purpose: "x", whyRelevant: "x", overlapNotes: "",
        biasRisk: "low", biasComment: "x", biasAction: "",
      })
    ).rejects.toThrow(/notFound/)
  })
})
```

Note: confirm the seed-helper import path and names against `model.test.ts` (top of that file); reuse exactly what it uses. If `seedReadyOrganization` returns a different handle name, adapt.

- [ ] **Step 4: Run the tests to confirm they fail.**

Run: `cd packages/backend && bun run test evaluationModel/method.test.ts`
Expected: FAIL (module `evaluationModel/method` has no `saveCriterionCompliance`).

- [ ] **Step 5: Implement `method.ts` (helper + mutations).** Create `packages/backend/convex/evaluationModel/method.ts`:

```ts
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { AUDIT_EVENTS, buildChanges } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation } from "../lib/functions"

// The compliance metadata captured per criterion for the metodbilaga (E2/E5).
// Documentation only: editing these never moves a score, so no band-shift.
export const COMPLIANCE_AUDIT_FIELDS = [
  "purpose",
  "whyRelevant",
  "overlapNotes",
  "biasRisk",
  "biasComment",
  "biasAction",
  "approved",
  "decidedBy",
  "decidedAt",
] as const

const biasRiskValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high")
)

const MAX_COMPLIANCE_TEXT = 2000

const filled = (s: string | undefined) => (s?.trim().length ?? 0) > 0

// A criterion is "documented" when the required subset is present: purpose,
// whyRelevant, biasRisk, biasComment. overlapNotes and biasAction are optional.
function isDocumented(c: {
  purpose?: string
  whyRelevant?: string
  biasRisk?: "low" | "medium" | "high"
  biasComment?: string
}): boolean {
  return (
    filled(c.purpose) &&
    filled(c.whyRelevant) &&
    c.biasRisk !== undefined &&
    filled(c.biasComment)
  )
}

export type ComplianceStatus =
  | "notStarted"
  | "inProgress"
  | "documented"
  | "approved"

// Four-state per-criterion status. Single source of truth, reused by
// getMethodModel (per-criterion status + aggregate) and the approval gate.
export function complianceStatus(c: Doc<"criteria">): ComplianceStatus {
  if (c.approved === true) return "approved"
  if (isDocumented(c)) return "documented"
  const hasAny =
    filled(c.purpose) ||
    filled(c.whyRelevant) ||
    filled(c.overlapNotes) ||
    filled(c.biasComment) ||
    filled(c.biasAction) ||
    c.biasRisk !== undefined
  return hasAny ? "inProgress" : "notStarted"
}

// Saves rationale + bias texts. Empty strings clear a field (stored as
// undefined so the optional stays clean). Reopen-on-edit: if any content field
// changed and the criterion was approved, the sign-off no longer attests to the
// current text, so approval/decidedBy/decidedAt are cleared. No band-shift.
export const saveCriterionCompliance = adminMutation({
  args: {
    criterionId: v.id("criteria"),
    purpose: v.string(),
    whyRelevant: v.string(),
    overlapNotes: v.string(),
    biasRisk: v.optional(biasRiskValidator),
    biasComment: v.string(),
    biasAction: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const criterion = await ctx.db.get(args.criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    for (const text of [
      args.purpose,
      args.whyRelevant,
      args.overlapNotes,
      args.biasComment,
      args.biasAction,
    ]) {
      if (text.length > MAX_COMPLIANCE_TEXT) throw appError(ERROR_CODES.invalidInput)
    }
    const norm = (s: string) => (s.trim().length === 0 ? undefined : s.trim())
    const next = {
      purpose: norm(args.purpose),
      whyRelevant: norm(args.whyRelevant),
      overlapNotes: norm(args.overlapNotes),
      biasRisk: args.biasRisk,
      biasComment: norm(args.biasComment),
      biasAction: norm(args.biasAction),
    }
    const contentChanged =
      next.purpose !== criterion.purpose ||
      next.whyRelevant !== criterion.whyRelevant ||
      next.overlapNotes !== criterion.overlapNotes ||
      next.biasRisk !== criterion.biasRisk ||
      next.biasComment !== criterion.biasComment ||
      next.biasAction !== criterion.biasAction
    const reopen = contentChanged && criterion.approved === true
    const patch = {
      ...next,
      ...(reopen
        ? { approved: undefined, decidedBy: undefined, decidedAt: undefined }
        : {}),
    }
    await ctx.db.patch(args.criterionId, patch)
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelUpdated,
      payload: {
        change: "criterion.complianceUpdated",
        criterionId: args.criterionId,
        modelId: criterion.modelId,
        // buildChanges skips fields absent from `patch`, so approved/decidedBy/
        // decidedAt only appear when reopen added them.
        changes: buildChanges(criterion, patch, COMPLIANCE_AUDIT_FIELDS),
      },
    })
    return null
  },
})

// Explicit admin sign-off. Approving requires the criterion to be documented
// (required subset present); stamps decidedBy (the acting admin) + decidedAt.
// Un-approving clears the stamp. No band-shift.
export const setCriterionApproval = adminMutation({
  args: { criterionId: v.id("criteria"), approved: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const criterion = await ctx.db.get(args.criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    if (args.approved && !isDocumented(criterion)) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const patch = args.approved
      ? { approved: true, decidedBy: ctx.authUserId, decidedAt: Date.now() }
      : { approved: undefined, decidedBy: undefined, decidedAt: undefined }
    await ctx.db.patch(args.criterionId, patch)
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelUpdated,
      payload: {
        change: "criterion.approvalChanged",
        criterionId: args.criterionId,
        modelId: criterion.modelId,
        changes: buildChanges(criterion, patch, [
          "approved",
          "decidedBy",
          "decidedAt",
        ]),
      },
    })
    return null
  },
})
```

- [ ] **Step 6: Run the tests to confirm they pass.**

Run: `cd packages/backend && bun run test evaluationModel/method.test.ts`
Expected: PASS (all three tests).

- [ ] **Step 7: Commit.**

```bash
git add packages/backend/convex/evaluationModel/method.ts packages/backend/convex/evaluationModel/method.test.ts packages/backend/convex/lib/auditPayloads.ts
git commit -m "feat(model): add criterion compliance write path (rationale, bias review, sign-off)"
```

---

## Task 2: Backend read path (`getMethodModel`)

**Files:**
- Modify: `packages/backend/convex/evaluationModel/method.ts` (add the query)
- Modify: `packages/backend/convex/evaluationModel/method.test.ts` (add query tests)

**Interfaces:**
- Consumes: `adminQuery`, `complianceStatus` (Task 1), `templateContent`/`clampLocale`/`isCriterionKey` from the model/localize modules (see how `getModel` imports them in `model.ts`), the `users` `by_auth_id` index.
- Produces: `getMethodModel({locale?})` returning `{ modelName, pointBudget, criteria[], bandThresholds[], progress }`.

- [ ] **Step 1: Write the failing query test.** Append to `method.test.ts`:

```ts
describe("getMethodModel", () => {
  it("returns localized names, shares, status, and aggregate progress", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedReadyOrganization(t)
    const base = await asAdmin.query(api.evaluationModel.method.getMethodModel, {
      orgId, locale: "sv",
    })
    expect(base!.criteria.length).toBeGreaterThanOrEqual(5)
    expect(base!.criteria[0]!.name).toBe("Scope & Påverkan") // localized sv
    const totalShare = base!.criteria.reduce((s, c) => s + c.share, 0)
    expect(Math.abs(totalShare - 100)).toBeLessThanOrEqual(base!.criteria.length) // rounding
    expect(base!.criteria.every((c) => c.status === "notStarted")).toBe(true)
    expect(base!.progress).toEqual({ documented: 0, approved: 0, total: base!.criteria.length })

    const criterionId = base!.criteria[0]!.criterionId
    await asAdmin.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId, criterionId,
      purpose: "p", whyRelevant: "w", overlapNotes: "",
      biasRisk: "low", biasComment: "b", biasAction: "",
    })
    await asAdmin.mutation(api.evaluationModel.method.setCriterionApproval, {
      orgId, criterionId, approved: true,
    })
    const after = await asAdmin.query(api.evaluationModel.method.getMethodModel, {
      orgId, locale: "sv",
    })
    const target = after!.criteria.find((c) => c.criterionId === criterionId)!
    expect(target.status).toBe("approved")
    expect(target.decidedByName).not.toBeNull()
    expect(after!.progress.documented).toBe(1)
    expect(after!.progress.approved).toBe(1)
  })
})
```

- [ ] **Step 2: Run to confirm it fails.**

Run: `cd packages/backend && bun run test evaluationModel/method.test.ts`
Expected: FAIL (`getMethodModel` is not a function).

- [ ] **Step 3: Implement `getMethodModel`.** Add to `method.ts`. First extend imports at the top of the file:

```ts
import { adminMutation, adminQuery } from "../lib/functions"
```

Then check `model.ts` for the exact export names of the localize helpers (`templateContent`, `clampLocale`, `isCriterionKey`) and their import paths, and import them the same way. Append the query:

```ts
const orderShape = (a: { order: number }, b: { order: number }) => a.order - b.order

export const getMethodModel = adminQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      modelName: v.string(),
      pointBudget: v.number(),
      criteria: v.array(
        v.object({
          criterionId: v.id("criteria"),
          name: v.string(),
          description: v.string(),
          weightPoints: v.number(),
          share: v.number(),
          order: v.number(),
          purpose: v.union(v.string(), v.null()),
          whyRelevant: v.union(v.string(), v.null()),
          overlapNotes: v.union(v.string(), v.null()),
          biasRisk: v.union(
            v.literal("low"),
            v.literal("medium"),
            v.literal("high"),
            v.null()
          ),
          biasComment: v.union(v.string(), v.null()),
          biasAction: v.union(v.string(), v.null()),
          status: v.union(
            v.literal("notStarted"),
            v.literal("inProgress"),
            v.literal("documented"),
            v.literal("approved")
          ),
          decidedByName: v.union(v.string(), v.null()),
          decidedAt: v.union(v.number(), v.null()),
        })
      ),
      bandThresholds: v.array(
        v.object({ band: v.number(), minScore: v.number() })
      ),
      progress: v.object({
        documented: v.number(),
        approved: v.number(),
        total: v.number(),
      }),
    })
  ),
  handler: async (ctx, { locale }) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null

    const content = templateContent(clampLocale(locale))
    const isTemplateModel = model.templateKey !== undefined

    const rows = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    rows.sort(orderShape)

    const totalPoints = rows.reduce((sum, r) => sum + r.weightPoints, 0)

    // Resolve each distinct decidedBy (Better Auth id) to a display name via the
    // users mirror, deduped so N approvals by one admin cost one lookup.
    const nameCache = new Map<string, string | null>()
    const resolveName = async (authId: string): Promise<string | null> => {
      if (nameCache.has(authId)) return nameCache.get(authId) ?? null
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", authId))
        .first()
      const name = user?.name ?? null
      nameCache.set(authId, name)
      return name
    }

    const criteria = []
    let documented = 0
    let approved = 0
    for (const row of rows) {
      const localized =
        row.templateKey !== undefined && isCriterionKey(row.templateKey)
          ? content.criteria[row.templateKey]
          : null
      const status = complianceStatus(row)
      if (status === "documented" || status === "approved") documented++
      if (status === "approved") approved++
      criteria.push({
        criterionId: row._id,
        name: localized?.name ?? row.name,
        description: localized?.description ?? row.description,
        weightPoints: row.weightPoints,
        share:
          totalPoints > 0
            ? Math.round((row.weightPoints / totalPoints) * 100)
            : 0,
        order: row.order,
        purpose: row.purpose ?? null,
        whyRelevant: row.whyRelevant ?? null,
        overlapNotes: row.overlapNotes ?? null,
        biasRisk: row.biasRisk ?? null,
        biasComment: row.biasComment ?? null,
        biasAction: row.biasAction ?? null,
        status,
        decidedByName:
          row.decidedBy !== undefined ? await resolveName(row.decidedBy) : null,
        decidedAt: row.decidedAt ?? null,
      })
    }

    const thresholds = [...model.bandThresholds].sort((a, b) => a.band - b.band)

    return {
      modelName: isTemplateModel ? content.modelName : model.name,
      pointBudget: rows.length * 3,
      criteria,
      bandThresholds: thresholds,
      progress: { documented, approved, total: rows.length },
    }
  },
})
```

- [ ] **Step 4: Run to confirm it passes.**

Run: `cd packages/backend && bun run test evaluationModel/method.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add packages/backend/convex/evaluationModel/method.ts packages/backend/convex/evaluationModel/method.test.ts
git commit -m "feat(model): add getMethodModel query (localized, shares, status, progress)"
```

---

## Task 3: Client Zod schema for the compliance form

**Files:**
- Create: `apps/dashboard/lib/criterion-compliance-schemas.ts`
- Create: `apps/dashboard/lib/criterion-compliance-schemas.test.ts`

**Interfaces:**
- Consumes: `ValidationT` from `@/lib/validation` (see `criterion-schemas.ts` for the exact type import).
- Produces: `makeCriterionComplianceSchema(t): ZodObject`, `CriterionComplianceValues` (`{ purpose, whyRelevant, overlapNotes, biasRisk?, biasComment, biasAction }`).

Design note: saving allows partial progress (all fields optional at the schema level), so the editor's Save button gates on `isDirty` alone. Approval (which requires the documented subset) is a separate control, gated on the query's `status`.

- [ ] **Step 1: Write the failing test.** Create `apps/dashboard/lib/criterion-compliance-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { makeCriterionComplianceSchema } from "@/lib/criterion-compliance-schemas"

const t = ((key: string) => key) as never

describe("makeCriterionComplianceSchema", () => {
  const schema = makeCriterionComplianceSchema(t)

  it("accepts an empty form (partial progress allowed)", () => {
    const result = schema.safeParse({
      purpose: "", whyRelevant: "", overlapNotes: "", biasComment: "", biasAction: "",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a valid bias risk and rejects an unknown one", () => {
    expect(schema.safeParse({
      purpose: "", whyRelevant: "", overlapNotes: "",
      biasRisk: "medium", biasComment: "", biasAction: "",
    }).success).toBe(true)
    expect(schema.safeParse({
      purpose: "", whyRelevant: "", overlapNotes: "",
      biasRisk: "extreme", biasComment: "", biasAction: "",
    }).success).toBe(false)
  })

  it("rejects text over the max length", () => {
    expect(schema.safeParse({
      purpose: "x".repeat(2001), whyRelevant: "", overlapNotes: "",
      biasComment: "", biasAction: "",
    }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm it fails.**

Run: `cd apps/dashboard && bun run test lib/criterion-compliance-schemas.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the schema.** Create `apps/dashboard/lib/criterion-compliance-schemas.ts`:

```ts
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

const MAX = 2000

// Client gate for the criterion compliance form. All fields are optional so
// partial progress can be saved; the editor gates Save on isDirty and gates
// Approve on the server-computed status (which requires the documented subset).
// The backend re-validates.
export function makeCriterionComplianceSchema(t: ValidationT) {
  return z.object({
    purpose: z.string().max(MAX, t("maxLength")),
    whyRelevant: z.string().max(MAX, t("maxLength")),
    overlapNotes: z.string().max(MAX, t("maxLength")),
    biasRisk: z.enum(["low", "medium", "high"]).optional(),
    biasComment: z.string().max(MAX, t("maxLength")),
    biasAction: z.string().max(MAX, t("maxLength")),
  })
}

export type CriterionComplianceValues = z.infer<
  ReturnType<typeof makeCriterionComplianceSchema>
>
```

Note: confirm `t("maxLength")` exists under `dashboard.validation`; `criterion-schemas.ts` uses `t("required")`. If `maxLength` needs a `{min}`-style param it will not fit here; use a param-free validation key. If none exists, add `"maxLength": "This field is too long."` to `dashboard.validation` in all five locales in this task (en first, then mirror).

- [ ] **Step 4: Run to confirm it passes.**

Run: `cd apps/dashboard && bun run test lib/criterion-compliance-schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/dashboard/lib/criterion-compliance-schemas.ts apps/dashboard/lib/criterion-compliance-schemas.test.ts
git commit -m "feat(model): add the criterion compliance form schema"
```

---

## Task 4: Method tab UI (route, tab, list, editor, approve)

**Files:**
- Modify: `apps/dashboard/components/model/model-tabs.tsx`
- Create: `apps/dashboard/app/(app)/model/method/page.tsx`
- Create: `apps/dashboard/components/model/method-panel.tsx`
- Create: `apps/dashboard/components/model/criterion-compliance-dialog.tsx`
- Create: `apps/dashboard/components/model/method-panel.test.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`

**Interfaces:**
- Consumes: `getMethodModel` (Task 2), `saveCriterionCompliance` + `setCriterionApproval` (Task 1), `makeCriterionComplianceSchema` + `CriterionComplianceValues` (Task 3), `useOrganization`, `PageHeader`, `usePageTitle`, shadcn `Dialog`/`Form`/`Select`/`Textarea`, `SubmitButton`, `HelpMorphButton`, `DropdownMenu`.
- Produces: the `/model/method` page and its components; the export button slot is filled in Task 6.

- [ ] **Step 1: Add the i18n keys (en first, then mirror to sv/nb/da/fi).** In `packages/i18n/messages/en.json`, add `"method": "Method"` under `dashboard.model.tabs`, and add this block under `dashboard.model` (choose the object position consistent with the file's ordering):

```json
"method": {
  "title": "Method",
  "description": "Document why each criterion exists and its bias review, then export the method appendix.",
  "documented": "{documented}/{total} documented",
  "approved": "{approved}/{total} approved",
  "status": {
    "notStarted": "Not started",
    "inProgress": "In progress",
    "documented": "Documented",
    "approved": "Approved"
  },
  "openCta": "Document",
  "rowMenu": "Criterion actions",
  "dialogTitle": "Rationale and bias review",
  "dialogDescription": "Record why this criterion belongs in the model and its bias review. This is evidence, not a guarantee.",
  "purpose": "Purpose",
  "whyRelevant": "Why relevant",
  "overlapNotes": "Overlap with other criteria",
  "biasRisk": "Bias risk",
  "biasRiskOption": { "low": "Low", "medium": "Medium", "high": "High" },
  "biasComment": "Bias comment",
  "biasAction": "Bias mitigation",
  "saveCta": "Save",
  "cancelCta": "Cancel",
  "approveCta": "Approve",
  "reopenCta": "Reopen",
  "approveHint": "Fill in purpose, why relevant, bias risk, and a bias comment to approve.",
  "decidedBy": "Approved by {name} on {date}",
  "error": "Something went wrong. Please try again.",
  "export": "Export method appendix (PDF)"
}
```

Add help keys under `dashboard.help` in `en.json`: `"methodAppendixLabel": "Method appendix"`, `"methodAppendixBody": "An exportable document with your criteria, weights, rationale, and bias review as compliance evidence."`, `"biasReviewLabel": "Bias review"`, `"biasReviewBody": "A per-criterion check of gender and bias risk with a mitigating action. It shows the model is designed to reduce bias."`. Then mirror every added key into `sv.json` (authoritative Swedish; e.g. `"method": "Metod"`, `title` "Metod", export "Exportera metodbilaga (PDF)", status "Ej påbörjad"/"Pågår"/"Dokumenterad"/"Godkänd", etc.), and into `nb.json`/`da.json`/`fi.json` as drafts flagged for native review. No em dashes anywhere.

- [ ] **Step 2: Run the i18n parity test to confirm keys match across locales.**

Run: `cd packages/i18n && bun run test`
Expected: PASS (all five files carry the same key set). If it fails, it names the missing keys; add them.

- [ ] **Step 3: Add the Method tab.** In `model-tabs.tsx`, add the third tab and fix the index-tab active logic:

```ts
const TABS = [
  { labelKey: "criteria", href: "/model" },
  { labelKey: "weighting", href: "/model/weighting" },
  { labelKey: "method", href: "/model/method" },
] as const
```

and change the `active` computation for the index tab:

```ts
        const active =
          tab.href === "/model"
            ? !pathname.startsWith("/model/weighting") &&
              !pathname.startsWith("/model/method")
            : pathname.startsWith(tab.href)
```

- [ ] **Step 4: Write the failing panel test.** Create `apps/dashboard/components/model/method-panel.test.tsx`. Mirror the render/mocking setup used by `criterion-item.test.tsx` (same test providers, i18n wrapper, and Convex mocking approach). Test that the list renders each criterion with its status pill and progress:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("convex/react", () => ({
  useQuery: () => ({
    modelName: "Standard model",
    pointBudget: 27,
    criteria: [
      { criterionId: "c1", name: "Scope", description: "", weightPoints: 3, share: 33, order: 1,
        purpose: null, whyRelevant: null, overlapNotes: null, biasRisk: null,
        biasComment: null, biasAction: null, status: "notStarted", decidedByName: null, decidedAt: null },
      { criterionId: "c2", name: "Risk", description: "", weightPoints: 3, share: 33, order: 2,
        purpose: "p", whyRelevant: "w", overlapNotes: null, biasRisk: "low",
        biasComment: "b", biasAction: null, status: "approved", decidedByName: "Alex", decidedAt: 1 },
    ],
    bandThresholds: [], progress: { documented: 1, approved: 1, total: 2 },
  }),
  useMutation: () => vi.fn(),
}))

import { MethodPanel } from "@/components/model/method-panel"
import { renderWithProviders } from "@/test/render" // use the repo's actual helper

describe("MethodPanel", () => {
  it("lists criteria with their status and shows progress", () => {
    renderWithProviders(<MethodPanel orgId="org1" />)
    expect(screen.getByText("Scope")).toBeInTheDocument()
    expect(screen.getByText("Risk")).toBeInTheDocument()
    expect(screen.getByText(/1\/2 documented/)).toBeInTheDocument()
    expect(screen.getByText("Approved")).toBeInTheDocument()
    expect(screen.getByText("Not started")).toBeInTheDocument()
  })
})
```

Note: replace `renderWithProviders`/`@/test/render` with the repo's real shared test renderer (check `apps/dashboard/test/` and how `criterion-item.test.tsx` renders with i18n). Match its locale-provider setup.

- [ ] **Step 5: Run to confirm it fails.**

Run: `cd apps/dashboard && bun run test components/model/method-panel.test.tsx`
Expected: FAIL (module `method-panel` not found).

- [ ] **Step 6: Implement `criterion-compliance-dialog.tsx`.** Create the per-criterion editor. It mirrors `edit-criterion-dialog.tsx` + `criterion-form.tsx` patterns (react-hook-form + zodResolver + shadcn Form; Save gated on `isDirty`; a separate Approve/Reopen control gated on `status`). Prefill from the query row (nulls to empty strings). biasRisk uses shadcn `Select`.

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@workspace/ui/components/form"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SubmitButton } from "@/components/submit-button"
import {
  type CriterionComplianceValues,
  makeCriterionComplianceSchema,
} from "@/lib/criterion-compliance-schemas"

type Row = {
  criterionId: Id<"criteria">
  name: string
  purpose: string | null
  whyRelevant: string | null
  overlapNotes: string | null
  biasRisk: "low" | "medium" | "high" | null
  biasComment: string | null
  biasAction: string | null
  status: "notStarted" | "inProgress" | "documented" | "approved"
  decidedByName: string | null
  decidedAt: number | null
}

export function CriterionComplianceDialog({
  orgId, target, onClose,
}: {
  orgId: string
  target: Row | null
  onClose: () => void
}) {
  const t = useTranslations("dashboard.model.method")
  const tHelp = useTranslations("dashboard.help")
  const tv = useTranslations("dashboard.validation")
  const format = useFormatter()
  const save = useMutation(api.evaluationModel.method.saveCriterionCompliance)
  const setApproval = useMutation(api.evaluationModel.method.setCriterionApproval)
  const [failed, setFailed] = useState(false)

  const schema = useMemo(() => makeCriterionComplianceSchema(tv), [tv])
  const form = useForm<CriterionComplianceValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      purpose: target?.purpose ?? "",
      whyRelevant: target?.whyRelevant ?? "",
      overlapNotes: target?.overlapNotes ?? "",
      biasRisk: target?.biasRisk ?? undefined,
      biasComment: target?.biasComment ?? "",
      biasAction: target?.biasAction ?? "",
    },
  })
  const { isDirty, isSubmitting } = form.formState

  async function handleValid(values: CriterionComplianceValues) {
    if (target === null) return
    setFailed(false)
    try {
      await save({ orgId, criterionId: target.criterionId, ...values })
      onClose()
    } catch {
      setFailed(true)
    }
  }

  const canApprove = target?.status === "documented"
  const isApproved = target?.status === "approved"

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            {t("dialogTitle")}
            <HelpMorphButton label={tHelp("biasReviewLabel")}>
              {tHelp("biasReviewBody")}
            </HelpMorphButton>
          </DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        {target !== null && (
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(handleValid)}>
              <FormField control={form.control} name="purpose" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("purpose")}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="whyRelevant" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("whyRelevant")}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="overlapNotes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("overlapNotes")}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="biasRisk" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("biasRisk")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="low">{t("biasRiskOption.low")}</SelectItem>
                      <SelectItem value="medium">{t("biasRiskOption.medium")}</SelectItem>
                      <SelectItem value="high">{t("biasRiskOption.high")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="biasComment" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("biasComment")}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="biasAction" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("biasAction")}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {failed && <p role="alert" className="text-destructive text-sm">{t("error")}</p>}
              <div className="space-y-2">
                {isApproved && target.decidedByName !== null && target.decidedAt !== null && (
                  <p className="text-muted-foreground text-sm">
                    {t("decidedBy", {
                      name: target.decidedByName,
                      date: format.dateTime(new Date(target.decidedAt), { dateStyle: "medium" }),
                    })}
                  </p>
                )}
                {!isApproved && !canApprove && (
                  <p className="text-muted-foreground text-sm">{t("approveHint")}</p>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    {t("cancelCta")}
                  </Button>
                  {isApproved ? (
                    <Button type="button" variant="outline"
                      onClick={async () => { await setApproval({ orgId, criterionId: target.criterionId, approved: false }); onClose() }}>
                      {t("reopenCta")}
                    </Button>
                  ) : (
                    <Button type="button" disabled={!canApprove}
                      onClick={async () => { await setApproval({ orgId, criterionId: target.criterionId, approved: true }); onClose() }}>
                      {t("approveCta")}
                    </Button>
                  )}
                  <SubmitButton type="submit" isSubmitting={isSubmitting} disabled={!isDirty}>
                    {t("saveCta")}
                  </SubmitButton>
                </DialogFooter>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

Note: confirm the shadcn `Select` import path in `packages/ui/src/components/select`, and that `SubmitButton`'s prop names match the repo (`isSubmitting`, `disabled`). The cancel label uses the `dashboard.model.method.cancelCta` key added in Step 1.

- [ ] **Step 7: Implement `method-panel.tsx`.** The list host: queries `getMethodModel` with the active locale, renders the header (title + help + progress + export slot), a criterion row list with status pill + `Document` action (opens the dialog), and holds the export button slot (filled in Task 6, so import a placeholder that renders nothing for now, or leave a clearly-marked slot). Use `useLocale()` for the query locale.

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { CriterionComplianceDialog } from "@/components/model/criterion-compliance-dialog"

export function MethodPanel({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.method")
  const locale = useLocale()
  const data = useQuery(api.evaluationModel.method.getMethodModel, { orgId, locale })
  const [target, setTarget] = useState<
    NonNullable<typeof data>["criteria"][number] | null
  >(null)

  if (data === undefined) return null // loading; keep layout stable

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {t("documented", { documented: data.progress.documented, total: data.progress.total })}
          {" · "}
          {t("approved", { approved: data.progress.approved, total: data.progress.total })}
        </p>
        {/* Export button slot (filled in Task 6). */}
      </div>
      <ul className="space-y-2">
        {data.criteria.map((c) => (
          <li key={c.criterionId} className="flex items-center justify-between rounded-md border p-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{c.name}</p>
              <p className="text-muted-foreground text-sm tabular-nums">{c.share}%</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={c.status === "approved" ? "default" : "secondary"}>
                {t(`status.${c.status}`)}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setTarget(c)}>
                {t("openCta")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <CriterionComplianceDialog orgId={orgId} target={target} onClose={() => setTarget(null)} />
    </div>
  )
}
```

Note: confirm the `Badge` variant names in `packages/ui/src/components/badge`. If per-row actions grow beyond a single button, switch to the dropdown-menu pattern per the row-actions convention; a single `Document` action can stay a button.

- [ ] **Step 8: Implement the page.** Create `apps/dashboard/app/(app)/model/method/page.tsx`, mirroring `model/page.tsx`:

```tsx
"use client"

import { useTranslations } from "next-intl"
import { MethodPanel } from "@/components/model/method-panel"
import { useOrganization } from "@/components/org-context"
import { PageHeader } from "@/components/page-header"
import { usePageTitle } from "@/hooks/use-page-title"
import { HelpMorphButton } from "@/components/help-morph-button"

export default function ModelMethodPage() {
  const { orgId } = useOrganization()
  const t = useTranslations("dashboard.model.method")
  const tHelp = useTranslations("dashboard.help")
  usePageTitle(t("title"))
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        titleAdornment={
          <HelpMorphButton label={tHelp("methodAppendixLabel")}>
            {tHelp("methodAppendixBody")}
          </HelpMorphButton>
        }
        description={t("description")}
      />
      <MethodPanel orgId={orgId} />
    </div>
  )
}
```

- [ ] **Step 9: Run the panel test to confirm it passes; then typecheck.**

Run: `cd apps/dashboard && bun run test components/model/method-panel.test.tsx`
Expected: PASS.
Run: `cd apps/dashboard && bun run typecheck`
Expected: PASS.

- [ ] **Step 10: Commit.**

```bash
git add apps/dashboard/components/model/model-tabs.tsx apps/dashboard/app/'(app)'/model/method/page.tsx apps/dashboard/components/model/method-panel.tsx apps/dashboard/components/model/criterion-compliance-dialog.tsx apps/dashboard/components/model/method-panel.test.tsx packages/i18n/messages
git commit -m "feat(model): add the Method tab for criterion rationale and bias review"
```

---

## Task 5: Branded PDF kit + pure appendix assembler

**Files:**
- Modify: `apps/dashboard/package.json` (add `@react-pdf/renderer`)
- Create: `apps/dashboard/lib/pdf/method-appendix-data.ts`
- Create: `apps/dashboard/lib/pdf/method-appendix-data.test.ts`
- Create: `apps/dashboard/components/pdf/branded-document.tsx`

**Interfaces:**
- Consumes: the `getMethodModel` return type (Task 2) as the assembler input; `@react-pdf/renderer` primitives.
- Produces: `assembleMethodAppendix(model, labels): MethodAppendixDoc` (pure) with a `status: "draft" | "final"` field and structured sections; branded kit components `BrandedDocument`, `Cover`, `PageFrame`, `Section`, `DataTable`.

- [ ] **Step 1: Add the dependency.**

Run: `cd apps/dashboard && bun add @react-pdf/renderer`
Expected: resolves to a v4 release (≥4.1.0 for React 19). Confirm in `apps/dashboard/package.json`.

- [ ] **Step 2: Write the failing assembler test.** Create `apps/dashboard/lib/pdf/method-appendix-data.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { assembleMethodAppendix } from "@/lib/pdf/method-appendix-data"

const base = {
  modelName: "Standard model",
  pointBudget: 6,
  bandThresholds: [{ band: 1, minScore: 80 }, { band: 2, minScore: 60 }],
  criteria: [
    { criterionId: "c1", name: "Scope", description: "d", weightPoints: 3, share: 50, order: 1,
      purpose: "p", whyRelevant: "w", overlapNotes: null, biasRisk: "low",
      biasComment: "b", biasAction: null, status: "approved", decidedByName: "Alex", decidedAt: 1700000000000 },
    { criterionId: "c2", name: "Risk", description: "d", weightPoints: 3, share: 50, order: 2,
      purpose: null, whyRelevant: null, overlapNotes: null, biasRisk: null,
      biasComment: null, biasAction: null, status: "notStarted", decidedByName: null, decidedAt: null },
  ],
  progress: { documented: 1, approved: 1, total: 2 },
} as const

describe("assembleMethodAppendix", () => {
  it("is DRAFT when not every criterion is approved", () => {
    const doc = assembleMethodAppendix(base, { biasStatement: "Bias-reducing, never bias-free." })
    expect(doc.status).toBe("draft")
    expect(doc.criteria).toHaveLength(2)
    expect(doc.criteria[0]!.name).toBe("Scope")
  })

  it("is FINAL when every criterion is approved", () => {
    const allApproved = {
      ...base,
      criteria: base.criteria.map((c) => ({ ...c, status: "approved" as const })),
      progress: { documented: 2, approved: 2, total: 2 },
    }
    const doc = assembleMethodAppendix(allApproved, { biasStatement: "x" })
    expect(doc.status).toBe("final")
  })
})
```

- [ ] **Step 3: Run to confirm it fails.**

Run: `cd apps/dashboard && bun run test lib/pdf/method-appendix-data.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the pure assembler.** Create `apps/dashboard/lib/pdf/method-appendix-data.ts`. It has no React import and no side effects. It takes the `getMethodModel` result plus already-localized label strings and returns the document model.

```ts
// Pure assembler: turns the getMethodModel query result into the structured
// content of the metodbilaga, and computes the DRAFT/FINAL status. No React,
// no i18n, no side effects, so it is fully unit-testable.
type BiasRisk = "low" | "medium" | "high"
type Status = "notStarted" | "inProgress" | "documented" | "approved"

export type MethodModel = {
  modelName: string
  pointBudget: number
  bandThresholds: { band: number; minScore: number }[]
  criteria: {
    criterionId: string
    name: string
    description: string
    weightPoints: number
    share: number
    order: number
    purpose: string | null
    whyRelevant: string | null
    overlapNotes: string | null
    biasRisk: BiasRisk | null
    biasComment: string | null
    biasAction: string | null
    status: Status
    decidedByName: string | null
    decidedAt: number | null
  }[]
  progress: { documented: number; approved: number; total: number }
}

export type MethodAppendixDoc = {
  status: "draft" | "final"
  modelName: string
  pointBudget: number
  biasStatement: string
  criteria: MethodModel["criteria"]
  bandThresholds: { band: number; minScore: number }[]
}

export function assembleMethodAppendix(
  model: MethodModel,
  labels: { biasStatement: string }
): MethodAppendixDoc {
  const status =
    model.progress.total > 0 && model.progress.approved === model.progress.total
      ? "final"
      : "draft"
  return {
    status,
    modelName: model.modelName,
    pointBudget: model.pointBudget,
    biasStatement: labels.biasStatement,
    criteria: [...model.criteria].sort((a, b) => a.order - b.order),
    bandThresholds: [...model.bandThresholds].sort((a, b) => a.band - b.band),
  }
}
```

- [ ] **Step 5: Run to confirm it passes.**

Run: `cd apps/dashboard && bun run test lib/pdf/method-appendix-data.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement the branded kit.** Create `apps/dashboard/components/pdf/branded-document.tsx`. Reusable chrome for every future branded PDF; all text is passed in as props (no i18n inside). Uses react-pdf's standard fonts (Helvetica covers Nordic Latin-1); brand rose `#f43f5e` on the cover and rules. A short comment records the chart seam.

```tsx
// Reusable branded PDF kit built on @react-pdf/renderer. This is the app-wide
// foundation for exportable documents; per-document templates (e.g. the
// metodbilaga) compose these primitives. All strings are passed in as props so
// this layer stays i18n-free. Charts (future): embed via react-pdf-charts (SVG,
// isAnimationActive={false}) or a rasterized PNG; not used by the metodbilaga.
import {
  Document, Page, StyleSheet, Text, View,
} from "@react-pdf/renderer"
import type { ReactNode } from "react"

const BRAND = "#f43f5e"

const styles = StyleSheet.create({
  page: { paddingTop: 64, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, color: "#111", fontFamily: "Helvetica", lineHeight: 1.4 },
  cover: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: BRAND, paddingBottom: 12 },
  wordmark: { fontSize: 20, fontFamily: "Helvetica-Bold", color: BRAND },
  docTitle: { fontSize: 16, marginTop: 8, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: "#666", marginTop: 4 },
  statusTag: { fontSize: 9, color: BRAND, fontFamily: "Helvetica-Bold", marginTop: 4 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#999", flexDirection: "row", justifyContent: "space-between" },
})

export function BrandedDocument({ children }: { children: ReactNode }) {
  return <Document>{children}</Document>
}

export function BrandedPage({
  footerLeft, children,
}: { footerLeft: string; children: ReactNode }) {
  return (
    <Page size="A4" style={styles.page}>
      {children}
      <View style={styles.footer} fixed>
        <Text>{footerLeft}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  )
}

export function Cover({
  docTitle, metaLines, statusTag,
}: { docTitle: string; metaLines: string[]; statusTag: string }) {
  return (
    <View style={styles.cover}>
      <Text style={styles.wordmark}>blueprnt</Text>
      <Text style={styles.docTitle}>{docTitle}</Text>
      {metaLines.map((line) => <Text key={line} style={styles.meta}>{line}</Text>)}
      <Text style={styles.statusTag}>{statusTag}</Text>
    </View>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}
```

Note: confirm the installed `@react-pdf/renderer` exposes `Document/Page/View/Text/StyleSheet` (v4 does). If the JSX types complain under the app's tsconfig, ensure `@react-pdf/renderer`'s types are picked up (it ships its own).

- [ ] **Step 7: Typecheck.**

Run: `cd apps/dashboard && bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add apps/dashboard/package.json apps/dashboard/bun.lock apps/dashboard/lib/pdf apps/dashboard/components/pdf/branded-document.tsx
git commit -m "feat(pdf): add the branded PDF kit and the pure metodbilaga assembler"
```

Note: the lockfile may be at the repo root (`bun.lock`); stage whichever the install changed.

---

## Task 6: Metodbilaga document + export trigger

**Files:**
- Create: `apps/dashboard/components/pdf/method-appendix.tsx`
- Create: `apps/dashboard/components/pdf/method-appendix-download.tsx`
- Modify: `apps/dashboard/components/model/method-panel.tsx` (fill the export button slot)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (appendix document copy)
- Create: `apps/dashboard/components/pdf/method-appendix-download.test.tsx`

**Interfaces:**
- Consumes: `assembleMethodAppendix` + `MethodModel` (Task 5), branded kit (Task 5), `getMethodModel` (Task 2), `@react-pdf/renderer` `pdf()` + `next/dynamic`.
- Produces: `<MethodAppendix doc={...} labels={...} />` document and `<MethodAppendixDownload orgId=... />` button.

- [ ] **Step 1: Add the appendix document i18n keys (en first, mirror to all).** Under `dashboard.model.methodAppendix` in `en.json`:

```json
"methodAppendix": {
  "docTitle": "Method appendix",
  "generatedOn": "Generated on {date}",
  "model": "Model: {name}",
  "draft": "DRAFT: not all criteria are reviewed and approved",
  "final": "FINAL",
  "methodologyTitle": "Methodology",
  "methodologyBody": "Roles are evaluated criterion by criterion on a 0 to 5 scale. Criterion weights sum to a fixed point budget; the role score is normalized to 0 to 100 and the band is derived, never set by hand. Ratings are hidden until every criterion is scored. Every change is recorded in the audit log. Roles describe work, never a person.",
  "biasStatement": "This model is designed to reduce bias. It is bias-reducing, never bias-free.",
  "criteriaTitle": "Criteria and weights",
  "rationaleTitle": "Criterion rationale and bias review",
  "bandsTitle": "Band thresholds",
  "colCriterion": "Criterion",
  "colWeight": "Weight",
  "colShare": "Share",
  "colBand": "Band",
  "colMinScore": "Min score",
  "purpose": "Purpose",
  "whyRelevant": "Why relevant",
  "overlap": "Overlap",
  "biasRisk": "Bias risk",
  "biasComment": "Bias comment",
  "biasAction": "Bias mitigation",
  "approvedBy": "Approved by {name} on {date}",
  "notApproved": "Not yet approved",
  "notDocumented": "Not documented"
}
```

Use no em dashes in any value. Provide authoritative Swedish in `sv.json` (e.g. docTitle "Metodbilaga", the biasStatement uses "biasreducerande" and "aldrig biasfri"), and nb/da/fi drafts flagged for native review. Then run the parity test.

- [ ] **Step 2: Run the i18n parity test.**

Run: `cd packages/i18n && bun run test`
Expected: PASS.

- [ ] **Step 3: Implement the document.** Create `apps/dashboard/components/pdf/method-appendix.tsx`. Presentational: consumes an assembled `MethodAppendixDoc` + a `labels` bag (already localized), renders sections via the branded kit.

```tsx
import { StyleSheet, Text, View } from "@react-pdf/renderer"
import { BrandedDocument, BrandedPage, Cover, Section } from "@/components/pdf/branded-document"
import type { MethodAppendixDoc } from "@/lib/pdf/method-appendix-data"

const s = StyleSheet.create({
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  cellName: { flex: 3 }, cellNum: { flex: 1, textAlign: "right" },
  para: { marginBottom: 3 }, label: { fontFamily: "Helvetica-Bold" },
  block: { marginBottom: 10 }, blockName: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
})

export type MethodAppendixLabels = {
  docTitle: string; generatedOn: string; model: string; statusTag: string
  methodologyTitle: string; methodologyBody: string; biasStatement: string
  criteriaTitle: string; rationaleTitle: string; bandsTitle: string
  colCriterion: string; colWeight: string; colShare: string; colBand: string; colMinScore: string
  purpose: string; whyRelevant: string; overlap: string; biasRisk: string
  biasComment: string; biasAction: string; footer: string
  riskLabel: (r: "low" | "medium" | "high") => string
  approval: (c: MethodAppendixDoc["criteria"][number]) => string
}

export function MethodAppendix({
  doc, labels,
}: { doc: MethodAppendixDoc; labels: MethodAppendixLabels }) {
  return (
    <BrandedDocument>
      <BrandedPage footerLeft={labels.footer}>
        <Cover
          docTitle={labels.docTitle}
          metaLines={[labels.model, labels.generatedOn]}
          statusTag={labels.statusTag}
        />
        <Section title={labels.methodologyTitle}>
          <Text style={s.para}>{labels.methodologyBody}</Text>
          <Text style={s.para}>{doc.biasStatement}</Text>
        </Section>
        <Section title={labels.criteriaTitle}>
          <View style={s.row}>
            <Text style={[s.cellName, s.label]}>{labels.colCriterion}</Text>
            <Text style={[s.cellNum, s.label]}>{labels.colWeight}</Text>
            <Text style={[s.cellNum, s.label]}>{labels.colShare}</Text>
          </View>
          {doc.criteria.map((c) => (
            <View key={c.criterionId} style={s.row}>
              <Text style={s.cellName}>{c.name}</Text>
              <Text style={s.cellNum}>{c.weightPoints}</Text>
              <Text style={s.cellNum}>{c.share}%</Text>
            </View>
          ))}
        </Section>
        <Section title={labels.rationaleTitle}>
          {doc.criteria.map((c) => (
            <View key={c.criterionId} style={s.block} wrap={false}>
              <Text style={s.blockName}>{c.name}</Text>
              <Text style={s.para}><Text style={s.label}>{labels.purpose}: </Text>{c.purpose ?? "-"}</Text>
              <Text style={s.para}><Text style={s.label}>{labels.whyRelevant}: </Text>{c.whyRelevant ?? "-"}</Text>
              {c.overlapNotes !== null && <Text style={s.para}><Text style={s.label}>{labels.overlap}: </Text>{c.overlapNotes}</Text>}
              <Text style={s.para}><Text style={s.label}>{labels.biasRisk}: </Text>{c.biasRisk ? labels.riskLabel(c.biasRisk) : "-"}</Text>
              <Text style={s.para}><Text style={s.label}>{labels.biasComment}: </Text>{c.biasComment ?? "-"}</Text>
              {c.biasAction !== null && <Text style={s.para}><Text style={s.label}>{labels.biasAction}: </Text>{c.biasAction}</Text>}
              <Text style={s.para}>{labels.approval(c)}</Text>
            </View>
          ))}
        </Section>
        <Section title={labels.bandsTitle}>
          <View style={s.row}>
            <Text style={[s.cellName, s.label]}>{labels.colBand}</Text>
            <Text style={[s.cellNum, s.label]}>{labels.colMinScore}</Text>
          </View>
          {doc.bandThresholds.map((b) => (
            <View key={b.band} style={s.row}>
              <Text style={s.cellName}>{b.band}</Text>
              <Text style={s.cellNum}>{b.minScore}</Text>
            </View>
          ))}
        </Section>
      </BrandedPage>
    </BrandedDocument>
  )
}
```

- [ ] **Step 4: Implement the export trigger.** Create `apps/dashboard/components/pdf/method-appendix-download.tsx`. It builds the labels bag from next-intl, assembles the doc, and downloads via `pdf(...).toBlob()`. It is client-only.

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { pdf } from "@react-pdf/renderer"
import { useQuery } from "convex/react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { MethodAppendix, type MethodAppendixLabels } from "@/components/pdf/method-appendix"
import { assembleMethodAppendix } from "@/lib/pdf/method-appendix-data"

export function MethodAppendixDownload({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.methodAppendix")
  const tRisk = useTranslations("dashboard.model.method.biasRiskOption")
  const tButton = useTranslations("dashboard.model.method")
  const format = useFormatter()
  const locale = useLocale()
  const data = useQuery(api.evaluationModel.method.getMethodModel, { orgId, locale })
  const [busy, setBusy] = useState(false)

  async function onExport() {
    if (data === undefined || data === null) return
    setBusy(true)
    try {
      const doc = assembleMethodAppendix(data, { biasStatement: t("biasStatement") })
      const now = format.dateTime(new Date(), { dateStyle: "medium" })
      const labels: MethodAppendixLabels = {
        docTitle: t("docTitle"),
        generatedOn: t("generatedOn", { date: now }),
        model: t("model", { name: data.modelName }),
        statusTag: doc.status === "final" ? t("final") : t("draft"),
        methodologyTitle: t("methodologyTitle"),
        methodologyBody: t("methodologyBody"),
        biasStatement: t("biasStatement"),
        criteriaTitle: t("criteriaTitle"),
        rationaleTitle: t("rationaleTitle"),
        bandsTitle: t("bandsTitle"),
        colCriterion: t("colCriterion"), colWeight: t("colWeight"), colShare: t("colShare"),
        colBand: t("colBand"), colMinScore: t("colMinScore"),
        purpose: t("purpose"), whyRelevant: t("whyRelevant"), overlap: t("overlap"),
        biasRisk: t("biasRisk"), biasComment: t("biasComment"), biasAction: t("biasAction"),
        footer: t("docTitle"),
        riskLabel: (r) => tRisk(r),
        approval: (c) =>
          c.status === "approved" && c.decidedByName && c.decidedAt
            ? t("approvedBy", { name: c.decidedByName, date: format.dateTime(new Date(c.decidedAt), { dateStyle: "medium" }) })
            : c.status === "documented" ? t("notApproved") : t("notDocumented"),
      }
      const blob = await pdf(<MethodAppendix doc={doc} labels={labels} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${data.modelName}-metodbilaga.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={onExport} disabled={data === undefined || data === null || busy}>
      {tButton("export")}
    </Button>
  )
}
```

- [ ] **Step 5: Wire the button into the panel via a dynamic, SSR-disabled import.** In `method-panel.tsx`, add at the top:

```tsx
import dynamic from "next/dynamic"

const MethodAppendixDownload = dynamic(
  () => import("@/components/pdf/method-appendix-download").then((m) => m.MethodAppendixDownload),
  { ssr: false }
)
```

and replace the export-slot comment with `<MethodAppendixDownload orgId={orgId} />`.

- [ ] **Step 6: Write a smoke test for the assembled labels/download wiring.** Create `apps/dashboard/components/pdf/method-appendix-download.test.tsx`. Mock `@react-pdf/renderer`'s `pdf` to avoid real rendering, mock the query, click, and assert `pdf` was called (the document construction path runs). Mirror the repo's mocking style.

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const toBlob = vi.fn(async () => new Blob(["x"], { type: "application/pdf" }))
vi.mock("@react-pdf/renderer", () => ({ pdf: () => ({ toBlob }) }))
vi.mock("convex/react", () => ({
  useQuery: () => ({
    modelName: "M", pointBudget: 6, bandThresholds: [],
    criteria: [{ criterionId: "c1", name: "Scope", description: "", weightPoints: 3, share: 50, order: 1,
      purpose: "p", whyRelevant: "w", overlapNotes: null, biasRisk: "low", biasComment: "b", biasAction: null,
      status: "approved", decidedByName: "Alex", decidedAt: 1 }],
    progress: { documented: 1, approved: 1, total: 1 },
  }),
}))

import { MethodAppendixDownload } from "@/components/pdf/method-appendix-download"
import { renderWithProviders } from "@/test/render" // repo's real helper

describe("MethodAppendixDownload", () => {
  it("builds and downloads the PDF on click", async () => {
    globalThis.URL.createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.revokeObjectURL = vi.fn()
    renderWithProviders(<MethodAppendixDownload orgId="org1" />)
    fireEvent.click(screen.getByRole("button"))
    await waitFor(() => expect(toBlob).toHaveBeenCalled())
  })
})
```

- [ ] **Step 7: Run the tests + typecheck.**

Run: `cd apps/dashboard && bun run test components/pdf/method-appendix-download.test.tsx`
Expected: PASS.
Run: `cd apps/dashboard && bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Manual verification (once).** Run the dashboard dev server, open `/model/method`, document a criterion, approve it, and click Export. Confirm the PDF downloads, is branded, shows FINAL only when all criteria are approved, and renders Nordic characters correctly under a non-English locale.

- [ ] **Step 9: Commit.**

```bash
git add apps/dashboard/components/pdf/method-appendix.tsx apps/dashboard/components/pdf/method-appendix-download.tsx apps/dashboard/components/pdf/method-appendix-download.test.tsx apps/dashboard/components/model/method-panel.tsx packages/i18n/messages
git commit -m "feat(pdf): render and export the branded metodbilaga"
```

---

## Final verification (whole feature)

- [ ] Run the full suite: `bun run test` (repo root). Expected: all packages pass.
- [ ] Run the full typecheck: `turbo typecheck`. Expected: PASS.
- [ ] Confirm the invariants: no score/band stored, no band-shift on compliance edits (Task 1 test), no PII in fields/appendix/audit, admin-only + org-scoped (Task 1 test), all copy localized in five locales (parity test), the appendix says "biasreducerande, aldrig biasfri" and contains no em dashes.

---

## Notes for the executor

- **nb/da/fi copy** is a machine draft in this feature; flag it for native review (do not treat English fallback as done). Swedish is authoritative compliance copy.
- **Audit rendering:** the new `change` discriminants render through the existing generic `changes` diff view in the audit-log detail; no per-change UI label is required (the coverage test guards event keys only, and `model.updated` already has a label).
- **Band-threshold editing stays out of scope**; the appendix shows the thresholds read-only.
- If any shadcn component import path or shared test-helper name differs from what a step assumes, use the repo's real one (grep the neighbor file named in the same task) rather than inventing it.

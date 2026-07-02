# Standard Model Compliance Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the standard model pre-documented: every standard-model org's 9 criteria start with complete compliance evidence (status "documented", never approved), re-localized to the viewer's locale like the criterion names.

**Architecture:** Curated compliance prose lives in the per-locale `standardTemplate.content.*.ts` modules (like `name`/`anchors`). `createModelFromTemplate` seeds it into the criterion rows (org language) so `complianceStatus` reads "documented". `getMethodModel` re-localizes it to the viewer's locale for template criteria until HR edits, gated by a new `complianceEdited` flag that `saveCriterionCompliance` sets.

**Tech Stack:** Convex (edge-runtime, convex-test), Vitest 4, TypeScript. Backend only; no frontend changes.

## Global Constraints

- Seed compliance as **documented**, never `approved` (never set `approved`/`decidedBy`/`decidedAt` at seed).
- Compliance content must exist in **all five locales** (en, sv, nb, da, fi). `sv` is the source + `en` curated; `nb/da/fi` are machine-drafts flagged for native review (add a `docs/go-live-checklist.md` line).
- Each criterion's compliance must satisfy `isDocumented`: non-empty `purpose`, `whyRelevant`, `biasComment`, and a `biasRisk` of `"low"|"medium"|"high"`. `overlapNotes`/`biasAction` may be `""`.
- Bias reviews are grounded in the fixed 6-question diagnostic checklist (`BIAS_CHECKLIST` in `ai/generate.ts`): (1) over-valuing male-coded roles; (2) under-valuing relational/coordination/care work; (3) rewarding visible mandate over impact; (4) formal status over work content; (5) gender-neutral level language; (6) budget/headcount over-weighted vs complexity/responsibility/knowledge.
- `complianceEdited: true` means HR owns the text (no re-localization); `undefined`/`false` means template content (re-localizes).
- All code/comments in English; UI copy is not involved (backend content is the compliance prose itself). Never use em dashes.
- New code ships with tests in the same commit. `bun run test`, never `bun test`.

---

## File Structure

- `packages/backend/convex/evaluationModel/standardTemplate.content.en.ts` — add `compliance` to the `CriterionContent` interface; author en compliance for 9 criteria.
- `packages/backend/convex/evaluationModel/standardTemplate.content.{sv,nb,da,fi}.ts` — author compliance for 9 criteria (sv source; nb/da/fi drafts).
- `packages/backend/convex/evaluationModel/tables.ts` — add `complianceEdited` to the `criteria` table.
- `packages/backend/convex/evaluationModel/model.ts` — seed compliance in `createModelFromTemplate` and its dev twin `createModelFromTemplateForOrg` (via a shared local helper).
- `packages/backend/convex/evaluationModel/method.ts` — re-localize compliance in `getMethodModel`; set `complianceEdited` in `saveCriterionCompliance`.
- `packages/backend/convex/evaluationModel/standardTemplate.test.ts` — content-completeness/parity test (existing file).
- `packages/backend/convex/evaluationModel/method.test.ts` — seed + re-localize + edit + approval tests (new or existing).
- `docs/go-live-checklist.md` — flag nb/da/fi compliance for native review.

---

## Task 1: Compliance content in all five locale modules

**Files:**
- Modify: `packages/backend/convex/evaluationModel/standardTemplate.content.en.ts` (interface + en content)
- Modify: `packages/backend/convex/evaluationModel/standardTemplate.content.sv.ts`
- Modify: `packages/backend/convex/evaluationModel/standardTemplate.content.nb.ts`
- Modify: `packages/backend/convex/evaluationModel/standardTemplate.content.da.ts`
- Modify: `packages/backend/convex/evaluationModel/standardTemplate.content.fi.ts`
- Test: `packages/backend/convex/evaluationModel/standardTemplate.test.ts`

**Interfaces:**
- Produces: `CriterionContent.compliance: { purpose: string; whyRelevant: string; overlapNotes: string; biasRisk: "low" | "medium" | "high"; biasComment: string; biasAction: string }` on every criterion in every locale module.

- [ ] **Step 1: Extend the `CriterionContent` interface** (`standardTemplate.content.en.ts`, after `weightLevels`):

```ts
  // Compliance evidence (kriterieurvalsprotokoll + bias-granskning) shown in the
  // Method tab and metodbilaga. Template content: re-localized to the viewer's
  // locale until HR edits it. Must satisfy isDocumented (purpose, whyRelevant,
  // biasComment non-empty; biasRisk set). overlapNotes/biasAction may be "".
  compliance: {
    purpose: string
    whyRelevant: string
    overlapNotes: string
    biasRisk: "low" | "medium" | "high"
    biasComment: string
    biasAction: string
  }
```

- [ ] **Step 2: Write the failing content-completeness test** (`standardTemplate.test.ts`):

```ts
import { describe, expect, it } from "vitest"
import { CRITERION_KEYS, templateContent } from "./standardTemplate"

const LOCALES = ["en", "sv", "nb", "da", "fi"] as const

describe("standard template compliance content", () => {
  it("every criterion in every locale has documented-complete compliance", () => {
    for (const locale of LOCALES) {
      const content = templateContent(locale)
      for (const key of CRITERION_KEYS) {
        const c = content.criteria[key].compliance
        expect(c.purpose.trim().length, `${locale}/${key} purpose`).toBeGreaterThan(0)
        expect(c.whyRelevant.trim().length, `${locale}/${key} whyRelevant`).toBeGreaterThan(0)
        expect(c.biasComment.trim().length, `${locale}/${key} biasComment`).toBeGreaterThan(0)
        expect(["low", "medium", "high"], `${locale}/${key} biasRisk`).toContain(c.biasRisk)
      }
    }
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd packages/backend && bun run test -- standardTemplate`
Expected: FAIL (compliance is missing / type error until content is authored).

- [ ] **Step 4: Author the compliance content for all 9 criteria in each locale module.**

Author to the standard shown below (worked example, criterion `people`). Every criterion's `compliance` must reference the relevant diagnostic questions and satisfy `isDocumented`. `sv` is the source; `en` is a curated translation; `nb/da/fi` are drafts translated from `sv`. Keep prose concise (one to three sentences per field), plain, gender-neutral.

Worked example — `people` (en), added inside `criteria.people` after `weightLevels`:

```ts
      compliance: {
        purpose:
          "Measures the role's responsibility for leading others: formal people responsibility, operational supervision, team leadership, and responsibility for capacity, prioritization and development through other people.",
        whyRelevant:
          "Leading others is part of a role's contribution to the organization's value. It is judged by the scope and content of the leadership assignment, not by title or headcount, so that leading a small team well and leading a large one are assessed on actual responsibility rather than on visible rank.",
        overlapNotes:
          "Overlaps partly with Scope & Impact (organizational reach) and Autonomy (decision authority); here the focus is specifically responsibility exercised through other people.",
        biasRisk: "medium",
        biasComment:
          "Known bias risk (diagnostic questions 3 and 6): rewarding visible mandate and number of direct reports more than actual leadership impact can over-value traditionally male-coded manager roles and under-value senior individual contributors and coordination-heavy work. The level descriptions themselves are gender-neutral (question 5).",
        biasAction:
          "The level anchors describe leadership content rather than headcount alone, and the criterion is kept at a moderate weight so a manager title does not by itself dominate the evaluation.",
      },
```

Worked example — `people` (sv), for `standardTemplate.content.sv.ts`:

```ts
      compliance: {
        purpose:
          "Mäter rollens ansvar för att leda andra: formellt personalansvar, operativ arbetsledning, teamledning och ansvar för kapacitet, prioritering och utveckling genom andra människor.",
        whyRelevant:
          "Att leda andra är en del av rollens bidrag till verksamhetens värde. Det bedöms utifrån ledaruppdragets omfattning och innehåll, inte utifrån titel eller antal underställda, så att det att leda ett litet team väl och att leda ett stort bedöms på faktiskt ansvar snarare än på synlig rang.",
        overlapNotes:
          "Överlappar delvis med Scope & Impact (organisatorisk räckvidd) och Autonomi (beslutsmandat); här ligger fokus specifikt på ansvar som utövas genom andra människor.",
        biasRisk: "medium",
        biasComment:
          "Känd biasrisk (diagnosfrågorna 3 och 6): att belöna synligt mandat och antal underställda mer än faktisk ledarpåverkan kan övervärdera traditionellt mansdominerade chefsroller och undervärdera seniora specialister och samordningstungt arbete. Nivåbeskrivningarna i sig är könsneutrala (fråga 5).",
        biasAction:
          "Nivåankarna beskriver ledarskapets innehåll snarare än enbart antal underställda, och kriteriet hålls på en måttlig vikt så att en chefstitel inte i sig dominerar utvärderingen.",
      },
```

Per-criterion bias-risk guidance (author the other 8 to this standard):
- `scope`: question 3 (reach vs visible mandate). risk low-medium.
- `complexity`: question 2 (don't under-value coordination/relational complexity). risk low.
- `autonomy`: question 3 (mandate vs impact). risk low-medium.
- `risk`: questions 1/2 (visible operational risk vs quiet care/quality work). risk low.
- `knowledge`: question 4 (formal vs actual competence); question 1. risk low.
- `stakeholders`: question 2 (this criterion values coordination, so note it counters that bias); question 3 (external visibility). risk low.
- `financial`: questions 3/6 (budget size over-weighted vs complexity/responsibility). risk medium.
- `formal`: question 4 (formal status/credentials over actual work content). risk medium.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/backend && bun run test -- standardTemplate`
Expected: PASS.

- [ ] **Step 6: Flag nb/da/fi for native review** — append one line to `docs/go-live-checklist.md` under the translation-review section: "Standard model compliance evidence (purpose/whyRelevant/overlap/bias fields) in nb/da/fi is machine-drafted; native review before go-live."

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/evaluationModel/standardTemplate.content.*.ts packages/backend/convex/evaluationModel/standardTemplate.test.ts docs/go-live-checklist.md
git commit -m "feat(model): author standard-model compliance evidence in all locales"
```

---

## Task 2: Schema flag + seed compliance

**Files:**
- Modify: `packages/backend/convex/evaluationModel/tables.ts:49` (add field before `approved`)
- Modify: `packages/backend/convex/evaluationModel/model.ts` (`createModelFromTemplate` ~82-95 and the dev twin `createModelFromTemplateForOrg`)
- Test: `packages/backend/convex/evaluationModel/method.test.ts`

**Interfaces:**
- Consumes: `CriterionContent.compliance` (Task 1); `complianceStatus`, `getMethodModel` (existing, `method.ts`).
- Produces: `criteria.complianceEdited?: boolean`; seeded criteria carry the compliance fields.

- [ ] **Step 1: Add the schema field** (`tables.ts`, immediately before `approved: v.optional(v.boolean()),`):

```ts
  // true once HR edits compliance via saveCriterionCompliance: the row's stored
  // compliance is then authored, not template, so getMethodModel stops
  // re-localizing it. undefined/false = template content (re-localizes).
  complianceEdited: v.optional(v.boolean()),
```

- [ ] **Step 2: Write the failing seed test** (`method.test.ts`). Mirror the `seedOrg` helper pattern from `ai/draft.test.ts` (seedMembership + insert organization + `createModelFromTemplate`):

```ts
/// <reference types="vite/client" />
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedStandardOrg(t: ReturnType<typeof initConvexTest>, email: string, language = "sv") {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "HR", role: "admin" }
  )
  await t.run(async (ctx) => {
    await ctx.db.insert("organizations", { orgId, country: "se", currency: "SEK", language, industry: "itTelecom" })
  })
  const asUser = t.withIdentity({ subject: userId })
  await asUser.mutation(api.evaluationModel.model.createModelFromTemplate, { orgId })
  return { orgId, asUser }
}

describe("standard model seeds compliance", () => {
  it("seeds all 9 criteria as documented, none approved", async () => {
    const t = initConvexTest()
    const { orgId, asUser } = await seedStandardOrg(t, "seed-doc@acme.se")
    const model = await asUser.query(api.evaluationModel.method.getMethodModel, { orgId, locale: "sv" })
    expect(model).not.toBeNull()
    expect(model?.progress).toEqual({ documented: 9, approved: 0, total: 9 })
    for (const c of model?.criteria ?? []) {
      expect(c.status).toBe("documented")
      expect((c.purpose ?? "").length).toBeGreaterThan(0)
      expect(c.biasRisk).not.toBeNull()
    }
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd packages/backend && bun run test -- method`
Expected: FAIL (`progress.documented` is 0; criteria are `notStarted`).

- [ ] **Step 4: Seed compliance in the insert.** In `createModelFromTemplate` (`model.ts`), extend the `ctx.db.insert("criteria", {...})` object (after `isCustom: false,`) with a shared helper so the dev twin does not duplicate it. Add near the top of `model.ts`:

```ts
// Seed-time compliance fields from the localized template. Empty optional text
// is stored as undefined so the optional stays clean (matches saveCriterionCompliance).
function seededCompliance(compliance: {
  purpose: string
  whyRelevant: string
  overlapNotes: string
  biasRisk: "low" | "medium" | "high"
  biasComment: string
  biasAction: string
}) {
  const norm = (s: string) => (s.trim().length === 0 ? undefined : s.trim())
  return {
    purpose: norm(compliance.purpose),
    whyRelevant: norm(compliance.whyRelevant),
    overlapNotes: norm(compliance.overlapNotes),
    biasRisk: compliance.biasRisk,
    biasComment: norm(compliance.biasComment),
    biasAction: norm(compliance.biasAction),
    // complianceEdited stays undefined = template content (re-localizes at read).
  }
}
```

Then in the insert object add `...seededCompliance(criterion.compliance),` after `isCustom: false,`. Apply the identical addition to the dev twin `createModelFromTemplateForOrg`'s insert. Do NOT add compliance to the audit `criterionCreateItem` snapshot (compliance is template content, not a user edit; the modelCreated row already records the create).

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/backend && bun run test -- method`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/evaluationModel/tables.ts packages/backend/convex/evaluationModel/model.ts packages/backend/convex/evaluationModel/method.test.ts
git commit -m "feat(model): seed standard-model criteria with compliance evidence"
```

---

## Task 3: Read-time re-localization + edit flag

**Files:**
- Modify: `packages/backend/convex/evaluationModel/method.ts` (`getMethodModel` loop ~259-289; `saveCriterionCompliance` patch ~103-111)
- Test: `packages/backend/convex/evaluationModel/method.test.ts`

**Interfaces:**
- Consumes: `criteria.complianceEdited` (Task 2); `CriterionContent.compliance` (Task 1); `content` (already fetched in `getMethodModel` via `templateContent(clampLocale(locale))`); `isCriterionKey` (already imported).

- [ ] **Step 1: Write the failing re-localization + edit tests** (`method.test.ts`, add to the existing describe):

```ts
  it("re-localizes seeded compliance to the requested locale for template criteria", async () => {
    const t = initConvexTest()
    const { orgId, asUser } = await seedStandardOrg(t, "seed-loc@acme.se", "sv")
    const sv = await asUser.query(api.evaluationModel.method.getMethodModel, { orgId, locale: "sv" })
    const en = await asUser.query(api.evaluationModel.method.getMethodModel, { orgId, locale: "en" })
    const svPurpose = sv?.criteria[0]?.purpose ?? ""
    const enPurpose = en?.criteria[0]?.purpose ?? ""
    expect(svPurpose.length).toBeGreaterThan(0)
    expect(enPurpose.length).toBeGreaterThan(0)
    expect(enPurpose).not.toBe(svPurpose) // different locale => different prose
  })

  it("stops re-localizing once HR edits, and keeps the edited text", async () => {
    const t = initConvexTest()
    const { orgId, asUser } = await seedStandardOrg(t, "seed-edit@acme.se", "sv")
    const before = await asUser.query(api.evaluationModel.method.getMethodModel, { orgId, locale: "sv" })
    const id = before?.criteria[0]?.criterionId
    if (id === undefined) throw new Error("no criterion")
    await asUser.mutation(api.evaluationModel.method.saveCriterionCompliance, {
      orgId, criterionId: id,
      purpose: "HR authored purpose", whyRelevant: "HR authored why",
      overlapNotes: "", biasRisk: "high", biasComment: "HR authored bias", biasAction: "",
    })
    const en = await asUser.query(api.evaluationModel.method.getMethodModel, { orgId, locale: "en" })
    const edited = en?.criteria.find((c) => c.criterionId === id)
    expect(edited?.purpose).toBe("HR authored purpose") // stored wins, not re-localized to en
    expect(edited?.biasRisk).toBe("high")
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && bun run test -- method`
Expected: FAIL (compliance is read straight from the row, not re-localized).

- [ ] **Step 3: Re-localize compliance in `getMethodModel`.** In the row loop, after `const localized = ...`, add the gate and use it for the 6 compliance fields:

```ts
      const useTemplateCompliance = localized !== null && row.complianceEdited !== true
      const comp = useTemplateCompliance ? localized.compliance : null
```

Then replace the 6 compliance lines in the pushed object with:

```ts
        purpose: comp ? comp.purpose : (row.purpose ?? null),
        whyRelevant: comp ? comp.whyRelevant : (row.whyRelevant ?? null),
        overlapNotes: comp ? (comp.overlapNotes || null) : (row.overlapNotes ?? null),
        biasRisk: comp ? comp.biasRisk : (row.biasRisk ?? null),
        biasComment: comp ? comp.biasComment : (row.biasComment ?? null),
        biasAction: comp ? (comp.biasAction || null) : (row.biasAction ?? null),
```

`status` is unchanged: it is computed from the stored row (`complianceStatus(row)`), which the seed filled, so template criteria stay "documented" regardless of display locale.

- [ ] **Step 4: Set the edit flag in `saveCriterionCompliance`.** In the `patch` object (after `biasAction: norm(args.biasAction),`) add:

```ts
      complianceEdited: true,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/backend && bun run test -- method`
Expected: PASS (all method tests, including Task 2's).

- [ ] **Step 6: Full backend suite + typecheck**

Run: `cd packages/backend && bun run test` then `bun run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/evaluationModel/method.ts packages/backend/convex/evaluationModel/method.test.ts
git commit -m "feat(model): re-localize seeded compliance until HR edits it"
```

---

## Self-Review

**Spec coverage:**
- Content in all 5 locales → Task 1 (+ parity test). ✓
- `complianceEdited` schema → Task 2. ✓
- Seed documented, never approved → Task 2 (`seededCompliance` sets no `approved`; test asserts `approved: 0`). ✓
- Re-localize like names until edit → Task 3. ✓
- `saveCriterionCompliance` sets flag → Task 3. ✓
- Approval works on seeded criterion → covered: `setCriterionApproval` reads stored `isDocumented` (seed filled it); Task 2 test asserts documented. (Optional extra assertion: approve criterion[0] and expect no throw.)
- nb/da/fi flagged for review → Task 1 Step 6. ✓
- Real-render metodbilaga test still green → run in Task 3 Step 6 full suite (the render test is in apps/dashboard, not backend; run `turbo run test` at repo root before finishing).

**Placeholder scan:** worked example `people` is fully authored in en+sv; the other 8 criteria are authored to that standard during Task 1 Step 4 with explicit per-criterion bias-risk guidance. This is a content-authoring task: the contract (isDocumented + checklist-grounded + all locales) and one worked example define acceptance; the remaining prose is produced in-task, not pre-embedded.

**Type consistency:** `compliance` shape identical in the interface (Task 1), `seededCompliance` (Task 2), and the `comp` reads (Task 3). `complianceEdited?: boolean` consistent between `tables.ts` and both readers/writers.
</content>

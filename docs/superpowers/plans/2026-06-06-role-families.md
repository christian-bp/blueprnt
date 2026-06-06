# Role Families Implementation Plan: Grouping Roles + Documentation Guide

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rollfamilj becomes a real entity: pickable on roles, grouping the roles list, filtering the results view, and a per-family progression page; plus docs/README.md documenting where decisions live.

**Architecture:** A new `roleFamilies` table (orgId, name) with member-scope CRUD; `roles.familyId` is optional, so no migration. Families never touch scoring: packages/core is untouched and no band-shift wraps are needed. Read queries join family names the same way track/level names are joined. The UI adds a reusable family picker (Select with inline create), grouped sections on the roles page, a client-side filter on results, and a family page at `/roles/families/[familyId]`.

**Tech Stack:** unchanged (Convex wrappers, Next.js 16 client pages, Vitest 4 + convex-test + testing-library, next-intl).

**Spec:** `docs/superpowers/specs/2026-06-06-role-families-design.md`. Read it before starting.

**Branch:** all work happens on `feat/role-families` (already created from main). Lands on main later as ONE squash commit after founder approval.

**Conventions for every task:**
- Biome style: no semicolons (asNeeded), double quotes, 2-space indent. All code, comments, and filenames in English; the docs in Task 1 are Swedish domain documents. Never an em dash in any text.
- All commands run from the repo root unless stated. Use `bun run test`, never `bun test`.
- Conventional commits. The pre-commit hook (Biome + typecheck + full turbo test) must pass; never `--no-verify`. Commit `packages/backend/convex/_generated/api.d.ts` together with backend changes when codegen updates it.
- Backend returns error CODES only (`convex/lib/errors.ts`). New i18n strings: en first, sv mirrored, nb/da/fi machine drafts (flag in the commit message). Weights never as numbers; scores/bands only where the results rules already allow them.
- Read `packages/backend/convex/_generated/ai/guidelines.md` before Convex work. NEVER run convex CLI commands that deploy functions, except the final-sweep `convex dev --once`. Running `bun x convex codegen` from packages/backend to regenerate `_generated/` is PERMITTED and REQUIRED when a brand-new backend module is added (the static api.d.ts module map must gain the entry or every typecheck fails); it writes local files (note: it contacts the dev deployment to resolve components, which is fine). Fallback without deployment access: hand-edit api.d.ts to add the module import + fullApi entry.
- New code ships with tests in the same commit.

---

## Task 1: Documentation (README guide + glossary + PLAN 9.14)

Swedish domain docs. No code.

**Files:**
- Create: `docs/README.md`
- Modify: `docs/contexts/evaluation-model/CONTEXT.md`
- Modify: `docs/PLAN-V1.md`

- [x] **Step 1: Create `docs/README.md`**

```markdown
# Dokumentationsguide

Hur vi dokumenterar lösningar och beslut i blueprnt. Regeln är enkel: varje
avgjord fråga skrivs ner samma dag den avgörs, i det mest specifika hem den
har. Koden förklarar hur; dokumenten förklarar vad och varför.

## Var saker hör hemma

| Vad | Var | Exempel |
| --- | --- | --- |
| Domäntermer och språkregler | `docs/contexts/*/CONTEXT.md` (ordlistorna) | Bandutfall, Rollfamilj, Betyg kontra Poäng |
| Arkitekturinvarianter och teknikval | `docs/adr/` | EU-residens, live-omräkning utan versionering, AI som inbäddad assistent |
| Scope, byggordning, öppna frågor | `docs/PLAN-V1.md` | Öppna frågor i paragraf 9 flyttas till Avgjort med datum när de avgörs |
| Skivornas design och utförandeplaner | `docs/superpowers/specs/` och `docs/superpowers/plans/` | En spec och en plan per skiva, daterade |
| UI- och animationslärdomar | `docs/ui-animation.md` | Buggar vi inte vill skeppa två gånger |
| Regler för agenter och utvecklare | `CLAUDE.md`, `AGENTS.md` | Konventioner och absoluta regler |
| Domänunderlag | `docs/contexts/*/` | standardmall.md, track-level-band.md |

## Så avgörs en fråga

1. Frågan ställs och får ett förslag: i PLAN-V1 paragraf 9 (öppna frågor)
   eller direkt i en skiv-spec under `docs/superpowers/specs/`.
2. När grundaren avgör den uppdateras källan samma dag:
   - Påverkar den språket: ordlistan (och i18n-tabellen i samma fil).
   - Påverkar den en invariant: ny eller ändrad ADR.
   - Påverkar den scope eller datamodell: PLAN-V1 (stryk frågan, skriv
     Avgjort med datum).
3. Ett beslut som ändrar ett tidigare beslut raderar aldrig historiken:
   skriv det nya beslutet med datum och låt det gamla stå kvar
   överstruket eller refererat. Exempel: rollfamilj som entitet
   (2026-06-06) ändrade 9.14-beslutet från juni 2026.

## Språk

Domändokument skrivs på svenska och får behålla svenska filnamn. Kod,
kommentarer, commit-meddelanden och processdokument (specs, plans) skrivs
på engelska. Tankstreck används aldrig i text vi skriver; använd punkt,
komma, kolon eller parentes.
```

- [x] **Step 2: Update the glossary Rollfamilj entry** (`docs/contexts/evaluation-model/CONTEXT.md`)

In the Rollfamilj definition (around line 10), replace the final sentence
`V1 modellerar inte rollfamilj som egen entitet; gruppering fångas via rollernas titlar (se PLAN-V1 §9.14).` with:

```
Sedan 2026-06-06 modelleras rollfamiljen som egen entitet: organisationen skapar familjer och en roll kan tillhöra högst en familj (tillhörigheten är frivillig). Familjer påverkar aldrig poäng eller band; de grupperar rollistan, filtrerar resultatvyn och ger progressionsvyn per familj (se PLAN-V1 §9.14).
```

In the "Rollfamiljens granularitet" note (around line 109), replace the final sentence `V1 modellerar inte rollfamilj som egen entitet.` with:

```
Sedan 2026-06-06 är rollfamiljen en egen entitet med frivillig tillhörighet per roll.
```

- [x] **Step 3: Update PLAN-V1 9.14** (`docs/PLAN-V1.md`, the item at line ~133)

Append to the existing 9.14 item (keep the existing text; history is never erased):

```
**Uppdaterat 2026-06-06:** rollfamilj modelleras nu som egen entitet: frivillig tillhörighet per roll, högst en familj, namn unika per organisation. Gruppering i rollistan, familjeväljare vid skapa/redigera, filter i resultatvyn och progressionsvy per familj levererades i role-families-skivan (docs/superpowers/specs/2026-06-06-role-families-design.md). Familjer påverkar aldrig poäng eller band. Fritextfältet funktion/avdelning kvarstår som organisatorisk hemvist.
```

- [x] **Step 4: Commit**

```bash
git add docs/README.md docs/contexts/evaluation-model/CONTEXT.md docs/PLAN-V1.md
git commit -m "docs: role family entity decision and documentation guide"
```

---

## Task 2: Schema + groundwork (table, familyId, audit events, error code)

**Files:**
- Modify: `packages/backend/convex/assessment/tables.ts`
- Modify: `packages/backend/convex/schema.ts`
- Modify: `packages/backend/convex/lib/audit.ts`
- Modify: `packages/backend/convex/lib/errors.ts`

- [x] **Step 1: Add the roleFamilies table and roles.familyId** (in `assessment/tables.ts`)

Add above the `roles` table:

```ts
// Role families (rollfamilj): content grouping of roles, e.g. "Software
// Engineering" or as broad as the organization wants. Families never affect
// scoring (presentation and organization only); membership is optional and
// a role belongs to at most one family.
export const roleFamilies = defineTable({
  orgId: v.string(),
  name: v.string(),
}).index("by_org", ["orgId"])
```

In the `roles` table definition, after `levelId`, add:

```ts
  familyId: v.optional(v.id("roleFamilies")),
```

- [x] **Step 2: Register the table** (in `schema.ts`: extend the assessment import with `roleFamilies` and add it to defineSchema)

- [x] **Step 3: Add audit events** (extend `AUDIT_EVENTS` in `lib/audit.ts`)

```ts
  roleFamilyCreated: "roleFamily.created",
  roleFamilyRenamed: "roleFamily.renamed",
  roleFamilyRemoved: "roleFamily.removed",
```

- [x] **Step 4: Add the error code** (extend `ERROR_CODES` in `lib/errors.ts`)

```ts
  roleFamilyExists: "errors.roleFamilyExists",
```

- [x] **Step 5: Run the backend tests (no regression), commit**

Run: `cd packages/backend && bun run test`

```bash
git add packages/backend/convex/assessment/tables.ts packages/backend/convex/schema.ts packages/backend/convex/lib/audit.ts packages/backend/convex/lib/errors.ts packages/backend/convex/_generated/api.d.ts
git commit -m "feat(assessment): role family schema, audit events, error code"
```

(Drop api.d.ts from the list if codegen did not change it.)

---

## Task 3: families.ts (create, rename, remove, list)

**Files:**
- Create: `packages/backend/convex/assessment/families.ts`
- Create: `packages/backend/convex/assessment/families.test.ts`

- [x] **Step 1: Write the failing tests** (create `families.test.ts`; reuse the template seed idiom from roles.test.ts)

```ts
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedTemplateOrganization(t: ReturnType<typeof initConvexTest>) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@acme.se", name: "HR Person", role: "admin" }
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
  await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("model not seeded")
  const track = model.tracks[0]
  const level = track?.levels[0]
  if (track === undefined || level === undefined) throw new Error("seed")
  return { orgId, asAdmin, track, level }
}

describe("role families", () => {
  it("creates, lists with role counts, and rejects duplicate names", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track, level } = await seedTemplateOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "  Software Engineering  " }
    )
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackId: track.trackId,
      levelId: level.levelId,
      familyId,
    })
    // Case-insensitive duplicate is rejected.
    await expect(
      asAdmin.mutation(api.assessment.families.createRoleFamily, {
        orgId,
        name: "software engineering",
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)

    const families = await asAdmin.query(
      api.assessment.families.listRoleFamilies,
      { orgId }
    )
    expect(families).toEqual([
      { familyId, name: "Software Engineering", roleCount: 1 },
    ])
    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "roleFamily.created")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })
  })

  it("renames with validation and a no-op short-circuit", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedTemplateOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Tech" }
    )
    const otherId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Sales" }
    )
    // Renaming to another family's name (case-insensitive) is rejected.
    await expect(
      asAdmin.mutation(api.assessment.families.renameRoleFamily, {
        orgId,
        familyId,
        name: "sales",
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)
    // Unchanged name is a silent no-op (no audit row).
    await asAdmin.mutation(api.assessment.families.renameRoleFamily, {
      orgId,
      familyId,
      name: "Tech",
    })
    await asAdmin.mutation(api.assessment.families.renameRoleFamily, {
      orgId,
      familyId,
      name: "Teknik",
    })
    await t.run(async (ctx) => {
      const family = await ctx.db.get(familyId)
      expect(family?.name).toBe("Teknik")
      const other = await ctx.db.get(otherId)
      expect(other?.name).toBe("Sales")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "roleFamily.renamed")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })
  })

  it("removal clears membership from roles and audits the cleared ids", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track, level } = await seedTemplateOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Tech" }
    )
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackId: track.trackId,
      levelId: level.levelId,
      familyId,
    })
    await asAdmin.mutation(api.assessment.families.removeRoleFamily, {
      orgId,
      familyId,
    })
    await t.run(async (ctx) => {
      expect(await ctx.db.get(familyId)).toBeNull()
      const role = await ctx.db.get(roleId)
      // The role row survives; only the membership is cleared.
      expect(role).not.toBeNull()
      expect(role?.familyId).toBeUndefined()
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "roleFamily.removed")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0]?.payload).toEqual({
        familyId,
        name: "Tech",
        clearedRoleIds: [roleId],
      })
    })
  })
})
```

NOTE: the create/listRoleFamilies test passes `familyId` to createRole, which Task 4 adds. To keep THIS task self-contained and green, implement Tasks 3 and 4's backend changes in the order written but commit them separately ONLY if the tests pass per commit; if the familyId arg does not exist yet, this test cannot pass. Therefore: write families.ts in this task WITHOUT the createRole-dependent assertions, OR (simpler, chosen here) implement Task 3 and Task 4 against the SAME test file and commit Task 3 with the families.ts tests that do not touch createRole, then extend in Task 4. Concretely: in THIS task, replace the `createRole` call in test 1 with a direct insert via t.run:

```ts
    await t.run(async (ctx) => {
      const docId = ctx.db.normalizeId("roleFamilies", familyId)
      if (docId === null) throw new Error("bad family id")
      await ctx.db.insert("roles", {
        orgId,
        title: "Developer",
        function: "Engineering",
        team: "Core",
        trackId: ctx.db.normalizeId("tracks", track.trackId) ?? (() => { throw new Error("bad track") })(),
        levelId: ctx.db.normalizeId("levels", level.levelId) ?? (() => { throw new Error("bad level") })(),
        purpose: "p",
        responsibilities: "r",
        status: "draft",
        familyId: docId,
      })
    })
```

and the same direct-insert approach in the removal test. (Task 4 then adds proper createRole coverage.) If the normalizeId inline throws read poorly, restructure with named consts; behavior over form.

- [x] **Step 2: Run to verify failure** (`cd packages/backend && bun run test -- families`)

- [x] **Step 3: Implement** (create `families.ts`)

```ts
import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { clampLocale } from "../evaluationModel/localize"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"

const MAX_NAME_LENGTH = 100

// Trimmed, non-empty, bounded family name or errors.invalidInput.
function normalizeName(raw: string): string {
  const name = raw.trim()
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    throw appError(ERROR_CODES.invalidInput)
  }
  return name
}

// Family names are unique per organization, case-insensitively, so two
// spellings of the same family cannot drift apart. Org family counts are
// tiny; a by_org collect is fine.
async function assertUniqueName(
  ctx: MutationCtx & { orgId: string },
  name: string,
  exceptId?: Id<"roleFamilies">
): Promise<void> {
  const families = await ctx.db
    .query("roleFamilies")
    .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
    .collect()
  const lowered = name.toLowerCase()
  const clash = families.some(
    (family) =>
      family._id !== exceptId && family.name.toLowerCase() === lowered
  )
  if (clash) throw appError(ERROR_CODES.roleFamilyExists)
}

// Families never affect scoring: no band-shift wraps anywhere in this module
// (ADR-0002 untouched). Member scope: families are role content, like roles.
export const createRoleFamily = orgMutation({
  args: { name: v.string() },
  returns: v.id("roleFamilies"),
  handler: async (ctx, args) => {
    const name = normalizeName(args.name)
    await assertUniqueName(ctx, name)
    const familyId = await ctx.db.insert("roleFamilies", {
      orgId: ctx.orgId,
      name,
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleFamilyCreated,
      actorId: ctx.authUserId,
      payload: { familyId, name },
    })
    return familyId
  },
})

export const renameRoleFamily = orgMutation({
  args: { familyId: v.id("roleFamilies"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const family = await ctx.db.get(args.familyId)
    if (family === null || family.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    const name = normalizeName(args.name)
    // Unchanged name is a no-op: no write, no audit row.
    if (name === family.name) return null
    await assertUniqueName(ctx, name, args.familyId)
    await ctx.db.patch(args.familyId, { name })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleFamilyRenamed,
      actorId: ctx.authUserId,
      payload: { familyId: args.familyId, name },
    })
    return null
  },
})

// Hard delete is safe for families (unlike roles, whose ids are permanent):
// nothing derived hangs off a family. Membership is cleared from the org's
// roles in the same transaction and the cleared ids are audited.
export const removeRoleFamily = orgMutation({
  args: { familyId: v.id("roleFamilies") },
  returns: v.null(),
  handler: async (ctx, { familyId }) => {
    const family = await ctx.db.get(familyId)
    if (family === null || family.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const clearedRoleIds: Id<"roles">[] = []
    for (const role of roles) {
      if (role.familyId !== familyId) continue
      // Patching to undefined removes the field.
      await ctx.db.patch(role._id, { familyId: undefined })
      clearedRoleIds.push(role._id)
    }
    await ctx.db.delete(familyId)
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleFamilyRemoved,
      actorId: ctx.authUserId,
      payload: { familyId, name: family.name, clearedRoleIds },
    })
    return null
  },
})

export const listRoleFamilies = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.array(
    v.object({
      familyId: v.id("roleFamilies"),
      name: v.string(),
      roleCount: v.number(),
    })
  ),
  handler: async (ctx, { locale }) => {
    const families = await ctx.db
      .query("roleFamilies")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const counts = new Map<string, number>()
    for (const role of roles) {
      if (role.familyId === undefined || role.archivedAt !== undefined) {
        continue
      }
      const key = role.familyId as string
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const sortLocale = clampLocale(locale)
    families.sort((a, b) => a.name.localeCompare(b.name, sortLocale))
    return families.map((family) => ({
      familyId: family._id,
      name: family.name,
      roleCount: counts.get(family._id as string) ?? 0,
    }))
  },
})
```

- [x] **Step 4: Regenerate the typed api map** (families.ts is a BRAND-NEW module; the static `_generated/api.d.ts` map must gain its entry or `api.assessment.families.*` fails every typecheck)

Run: `cd packages/backend && bun x convex codegen`
Expected: `convex/_generated/api.d.ts` now imports `assessment/families` and lists it in fullApi. (This command contacts the dev deployment to resolve components but only writes local files; it does not deploy functions.)

- [x] **Step 5: Run tests, commit**

Run: `cd packages/backend && bun run test -- families` then the full suite.

```bash
git add packages/backend/convex/assessment/families.ts packages/backend/convex/assessment/families.test.ts packages/backend/convex/_generated/api.d.ts
git commit -m "feat(assessment): role family CRUD with audited removal"
```

---

## Task 4: roles.ts + results.ts carry the family

**Files:**
- Modify: `packages/backend/convex/assessment/names.ts`
- Modify: `packages/backend/convex/assessment/roles.ts`
- Modify: `packages/backend/convex/assessment/results.ts`
- Modify: `packages/backend/convex/assessment/roles.test.ts`

- [x] **Step 1: Write the failing tests** (append to `roles.test.ts`)

```ts
describe("role family membership", () => {
  it("creates with a family, moves, clears, and rejects foreign families", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, track, level } = await seedTemplateOrganization(t)
    const techId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Tech" }
    )
    const salesId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Sales" }
    )
    const roleId = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "Engineering",
      team: "Core",
      trackId: track.trackId,
      levelId: level.levelId,
      familyId: techId,
    })

    // listRoles carries the family and the track/level orders.
    const list = await asAdmin.query(api.assessment.roles.listRoles, {
      orgId,
      locale: "sv",
    })
    expect(list[0]).toMatchObject({
      familyId: techId,
      familyName: "Tech",
      trackOrder: 1,
      levelOrder: level.order,
    })

    // Move to another family.
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      familyId: salesId,
    })
    // Clear with the null sentinel.
    await asAdmin.mutation(api.assessment.roles.updateRole, {
      orgId,
      roleId,
      familyId: null,
    })
    await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId)
      expect(role?.familyId).toBeUndefined()
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "role.updated")
        )
        .collect()
      expect(updated.map((row) => row.payload)).toContainEqual({
        roleId,
        fields: ["familyId"],
      })
    })

    // A family from another organization is rejected.
    const foreign = await seedTemplateOrganization(t)
    const foreignFamilyId = await foreign.asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId: foreign.orgId, name: "Foreign" }
    )
    await expect(
      asAdmin.mutation(api.assessment.roles.updateRole, {
        orgId,
        roleId,
        familyId: foreignFamilyId,
      })
    ).rejects.toThrow(/errors.notFound/)

    const role = await asAdmin.query(api.assessment.roles.getRole, {
      orgId,
      roleId: roleId as string,
    })
    expect(role?.familyId).toBeNull()
    expect(role?.familyName).toBeNull()
  })
})
```

NOTE: `seedTemplateOrganization` in roles.test.ts uses a fixed email; seeding it twice in one test creates a second org with the same email, which the component seed allows (it inserts rows directly). If it collides, give the helper an optional email parameter and pass a different one for the foreign org.

- [x] **Step 2: Run to verify failure**

- [x] **Step 3: Extend names.ts with order + a family map**

In `names.ts`: extend the map value types to `{ key: string; name: string; order: number }` and set `order: track.order` / `order: level.order` in the two set() calls. Add below `trackLevelNames`:

```ts
// Family name lookup for the org. Families are user-entered names, stored
// as written; no localization applies.
export async function familyNames(
  ctx: QueryCtx,
  orgId: string
): Promise<Map<string, string>> {
  const families = await ctx.db
    .query("roleFamilies")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  return new Map(
    families.map((family) => [family._id as string, family.name])
  )
}
```

- [x] **Step 4: Extend roles.ts**

createRole: add `familyId: v.optional(v.id("roleFamilies"))` to args; before the insert validate ownership when given:

```ts
    if (args.familyId !== undefined) {
      const family = await ctx.db.get(args.familyId)
      if (family === null || family.orgId !== ctx.orgId) {
        throw appError(ERROR_CODES.notFound)
      }
    }
```

and include `...(args.familyId !== undefined ? { familyId: args.familyId } : {})` in the insert.

updateRole: add `familyId: v.optional(v.union(v.id("roleFamilies"), v.null()))` to args; in the handler (before the PROFILE_TEXT_FIELDS loop):

```ts
    if (args.familyId !== undefined) {
      if (args.familyId === null) {
        // The null sentinel clears membership (patching undefined removes
        // the field); undefined in args means "leave unchanged".
        patch.familyId = undefined
      } else {
        const family = await ctx.db.get(args.familyId)
        if (family === null || family.orgId !== ctx.orgId) {
          throw appError(ERROR_CODES.notFound)
        }
        patch.familyId = args.familyId
      }
    }
```

listRoles: add to the returns object validator:

```ts
      familyId: v.union(v.id("roleFamilies"), v.null()),
      familyName: v.union(v.string(), v.null()),
      trackOrder: v.number(),
      levelOrder: v.number(),
```

In the handler: `const families = await familyNames(ctx, ctx.orgId)` (import from ./names) and per row:

```ts
        familyId: role.familyId ?? null,
        familyName:
          role.familyId !== undefined
            ? (families.get(role.familyId as string) ?? null)
            : null,
        trackOrder: track?.order ?? 0,
        levelOrder: level?.order ?? 0,
```

getRole: add `familyId: v.union(v.id("roleFamilies"), v.null())` and `familyName: v.union(v.string(), v.null())` to the returns validator and the same mapping in the return (one familyNames call).

- [x] **Step 5: Extend results.ts** (getResults rows gain the same `familyId`/`familyName` validator fields and mapping via familyNames; one call before the role loop)

- [x] **Step 6: Run the full backend suite, commit**

```bash
git add packages/backend/convex/assessment packages/backend/convex/_generated/api.d.ts
git commit -m "feat(assessment): roles and results carry family membership"
```

## Task 5: i18n keys

**Files:** `packages/i18n/messages/{en,sv,nb,da,fi}.json`

- [x] **Step 1: Add to en.json**

Under `dashboard.roles`, add a `family` object (sibling of `create`):

```json
      "family": {
        "none": "No family",
        "all": "All families",
        "createNew": "New family",
        "nameLabel": "Family name",
        "createCta": "Create family",
        "cancel": "Cancel",
        "renameCta": "Rename",
        "saveCta": "Save",
        "removeCta": "Remove family",
        "removeConfirm": "Yes, remove",
        "removeHint": "Roles keep all their data; they just leave the family.",
        "error": "Something went wrong. Try again.",
        "rolesHeading": "Roles in the family",
        "notFound": "This family does not exist.",
        "roleCount": "{count, plural, =1 {1 role} other {# roles}}"
      },
```

Add to `errors`:

```json
    "roleFamilyExists": "A family with that name already exists."
```

- [x] **Step 2: Mirror to sv.json**

```json
      "family": {
        "none": "Ingen familj",
        "all": "Alla familjer",
        "createNew": "Ny familj",
        "nameLabel": "Familjens namn",
        "createCta": "Skapa familj",
        "cancel": "Avbryt",
        "renameCta": "Byt namn",
        "saveCta": "Spara",
        "removeCta": "Ta bort familj",
        "removeConfirm": "Ja, ta bort",
        "removeHint": "Rollerna behåller alla sina data; de lämnar bara familjen.",
        "error": "Något gick fel. Försök igen.",
        "rolesHeading": "Roller i familjen",
        "notFound": "Den här familjen finns inte.",
        "roleCount": "{count, plural, =1 {1 roll} other {# roller}}"
      },
```

```json
    "roleFamilyExists": "En familj med det namnet finns redan."
```

- [x] **Step 3: Mirror to nb/da/fi** as machine drafts from the Swedish (keys identical; placeholders and ICU verbatim).

- [x] **Step 4: Verify + commit**

Run: `cd packages/i18n && bun run test` then `bun run typecheck` from the root.

```bash
git add packages/i18n/messages
git commit -m "feat(i18n): role family strings (en + sv, machine drafts for nb/da/fi)

nb/da/fi values are machine-translated drafts for native review."
```

---

## Task 6: Family picker component

**Files:**
- Create: `apps/dashboard/components/roles/family-picker.tsx`
- Create: `apps/dashboard/components/roles/family-picker.test.tsx`

- [x] **Step 1: Write the failing tests** (mock idiom as in create-role-dialog.test.tsx)

```tsx
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const useQueryMock = vi.fn()
const createFamilyMock = vi.fn()

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: () => createFamilyMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      families: {
        listRoleFamilies: "families.list",
        createRoleFamily: "families.create",
      },
    },
  },
}))

import { FamilyPicker } from "@/components/roles/family-picker"

const labels = messages.dashboard.roles.family

const FAMILIES = [
  { familyId: "f-sales", name: "Sales", roleCount: 1 },
  { familyId: "f-tech", name: "Tech", roleCount: 3 },
]

function renderPicker(value: string | null, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {/* The form wrapper makes Radix render its hidden native select,
          which is the only way to drive a Select under happy-dom (Radix
          opens its portal only on real pointer events). Same pattern as
          the onboarding organization-setup tests. */}
      <form>
        <FamilyPicker orgId="org-1" value={value} onChange={onChange} />
      </form>
    </NextIntlClientProvider>
  )
  return onChange
}

function hiddenSelect(): HTMLSelectElement | null {
  return document.querySelector("select")
}

describe("FamilyPicker", () => {
  beforeEach(() => {
    useQueryMock.mockReturnValue(FAMILIES)
    createFamilyMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("shows none for a null value", () => {
    renderPicker(null)
    expect(screen.getByRole("combobox").textContent).toContain(labels.none)
  })

  it("selecting a family calls onChange with its id", () => {
    const onChange = renderPicker(null)
    const hidden = hiddenSelect()
    // Radix renders the hidden native select only in form contexts; if the
    // environment skips it, interaction coverage is e2e scope (repo idiom).
    if (hidden === null) {
      expect(onChange).toBeDefined()
      return
    }
    fireEvent.change(hidden, { target: { value: "f-tech" } })
    expect(onChange).toHaveBeenCalledWith("f-tech")
  })

  it("create-new swaps to an input and creates, then selects the new family", async () => {
    createFamilyMock.mockResolvedValue("f-new")
    const onChange = renderPicker(null)
    const hidden = hiddenSelect()
    if (hidden === null) {
      expect(onChange).toBeDefined()
      return
    }
    fireEvent.change(hidden, { target: { value: "__create__" } })
    const input = screen.getByLabelText(labels.nameLabel)
    fireEvent.change(input, { target: { value: "Product" } })
    fireEvent.click(screen.getByRole("button", { name: labels.createCta }))
    await waitFor(() => {
      expect(createFamilyMock).toHaveBeenCalledWith({
        orgId: "org-1",
        name: "Product",
      })
    })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("f-new")
    })
  })

  it("shows the translated duplicate error and stays in create mode", async () => {
    createFamilyMock.mockRejectedValue(
      new Error("ConvexError: errors.roleFamilyExists")
    )
    const onChange = renderPicker(null)
    const hidden = hiddenSelect()
    if (hidden === null) {
      expect(onChange).toBeDefined()
      return
    }
    fireEvent.change(hidden, { target: { value: "__create__" } })
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Sales" },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.createCta }))
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(screen.getByLabelText(labels.nameLabel)).toBeDefined()
  })
})
```

(Verified constraint: Radix's trigger opens its portal only on real pointer events, so NEVER drive these tests by clicking the combobox and querying role="option". The hidden native select exists only because renderPicker wraps the picker in a form. Compare the onboarding organization-setup tests for the same idiom, including the `if (hidden === null) return` e2e-scope sentinel. Do not weaken the create-flow and error assertions.)

- [x] **Step 2: Run to verify failure**

- [x] **Step 3: Implement** (create `family-picker.tsx`)

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"

// Sentinel item values: real family ids never collide with these.
const NONE = "__none__"
const CREATE = "__create__"

// Family membership picker: existing families, a none item, and an inline
// create flow (families are born where they are needed; no separate
// management page). value null = no family.
export function FamilyPicker({
  orgId,
  value,
  onChange,
}: {
  orgId: string
  value: string | null
  onChange: (familyId: string | null) => void
}) {
  const t = useTranslations("dashboard.roles.family")
  const tErrors = useTranslations("errors")
  const families = useQuery(api.assessment.families.listRoleFamilies, {
    orgId,
  })
  const createFamily = useMutation(api.assessment.families.createRoleFamily)
  const inputId = useId()

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [duplicate, setDuplicate] = useState(false)

  async function handleCreate() {
    const trimmed = name.trim()
    if (trimmed === "" || pending) return
    setPending(true)
    setDuplicate(false)
    try {
      const familyId = await createFamily({ orgId, name: trimmed })
      setCreating(false)
      setName("")
      onChange(familyId as string)
    } catch {
      setDuplicate(true)
    } finally {
      setPending(false)
    }
  }

  if (creating) {
    return (
      <div className="space-y-2">
        <Label htmlFor={inputId}>{t("nameLabel")}</Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            disabled={name.trim() === "" || pending}
            onClick={handleCreate}
          >
            {t("createCta")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setCreating(false)
              setName("")
              setDuplicate(false)
            }}
          >
            {t("cancel")}
          </Button>
        </div>
        {duplicate && (
          <p role="alert" className="text-destructive text-sm">
            {tErrors("roleFamilyExists")}
          </p>
        )}
      </div>
    )
  }

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => {
        if (next === CREATE) {
          setCreating(true)
          return
        }
        onChange(next === NONE ? null : next)
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("none")}</SelectItem>
        {(families ?? []).map((family) => (
          <SelectItem key={family.familyId} value={family.familyId}>
            {family.name}
          </SelectItem>
        ))}
        <SelectItem value={CREATE}>{t("createNew")}</SelectItem>
      </SelectContent>
    </Select>
  )
}
```

Note: the duplicate error is shown with the SPECIFIC errors.roleFamilyExists message (the only realistic failure here besides transient errors).

- [x] **Step 4: Run, commit**

```bash
git add apps/dashboard/components/roles/family-picker.tsx apps/dashboard/components/roles/family-picker.test.tsx
git commit -m "feat(dashboard): family picker with inline create"
```

---

## Task 7: Picker in the create dialog and the profile card

**Files:**
- Modify: `apps/dashboard/components/roles/create-role-dialog.tsx`
- Modify: `apps/dashboard/components/roles/role-profile-card.tsx`
- Modify: `apps/dashboard/app/(app)/roles/[roleId]/page.tsx` (only if the RoleProfile prop shape needs the new fields passed; the page passes the whole getRole object already)
- Modify: their `.test.tsx` files as needed (mocks gain the families refs)

- [x] **Step 1: Create dialog** (add a `familyId: string | null` state defaulting to null; render the FamilyPicker under the track/level grid with the `model.roleFamily` label from the top-level model namespace via `useTranslations("model")`; include `...(familyId !== null ? { familyId: familyId as never } : {})` in the createRole call; reset it in handleOpenChange)

```tsx
          <div className="space-y-2">
            <Label>{tModel("roleFamily")}</Label>
            <FamilyPicker
              orgId={orgId}
              value={familyId}
              onChange={setFamilyId}
            />
          </div>
```

The existing dialog test mocks `useMutation` by ref and `useQuery` is not mocked there; the FamilyPicker inside will call `useQuery`, so EXTEND the dialog test's convex/react mock with a `useQuery: () => []` and add the families refs to the api mock. Keep all existing assertions; add one asserting createRole is called WITHOUT a familyId key when none picked.

- [x] **Step 2: Profile card** (add `familyId: string | null` and `familyName: string | null` to the RoleProfile interface; add a dedicated hook `const tFamily = useTranslations("dashboard.roles.family")` because the card's `t` is scoped to `dashboard.roles.detail` and `family.*` lives under `dashboard.roles.family`; in READ mode render a family row showing `role.familyName ?? tFamily("none")` with the `model.roleFamily` label (via `useTranslations("model")`); in EDIT mode render the FamilyPicker; track the draft family in its own state `draftFamilyId: string | null` seeded in startEditing; in handleSave include `...(draftFamilyId !== (role.familyId ?? null) ? { familyId: draftFamilyId as never } : {})` in the updateRole call so the null sentinel clears membership)

Update `role-profile-card.test.tsx`: makeRole gains `familyId: null, familyName: null`; extend the convex mock with `useQuery: () => []`; add a test that picking is not required (existing tests keep passing) and, if cheap, one asserting a family change includes `familyId` in the mutation args.

- [x] **Step 3: Run the dashboard suite + typecheck, commit**

```bash
git add apps/dashboard/components/roles apps/dashboard/app
git commit -m "feat(dashboard): family membership on create and edit"
```

---

## Task 8: Roles page grouped by family

**Files:**
- Create: `apps/dashboard/lib/role-groups.ts`
- Create: `apps/dashboard/lib/role-groups.test.ts`
- Modify: `apps/dashboard/app/(app)/roles/page.tsx`

- [x] **Step 1: Pure grouping helper + test (TDD)**

`lib/role-groups.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { groupByFamily } from "./role-groups"

describe("groupByFamily", () => {
  it("groups rows under families sorted by name with the family-less last", () => {
    const rows = [
      { roleId: "r1", familyId: "f-tech", familyName: "Tech" },
      { roleId: "r2", familyId: null, familyName: null },
      { roleId: "r3", familyId: "f-sales", familyName: "Sales" },
      { roleId: "r4", familyId: "f-tech", familyName: "Tech" },
    ]
    const groups = groupByFamily(rows)
    expect(groups.map((group) => group.familyId)).toEqual([
      "f-sales",
      "f-tech",
      null,
    ])
    expect(groups[1]?.rows.map((row) => row.roleId)).toEqual(["r1", "r4"])
  })

  it("omits the family-less group when every row has a family", () => {
    const rows = [{ roleId: "r1", familyId: "f1", familyName: "A" }]
    expect(groupByFamily(rows).map((group) => group.familyId)).toEqual(["f1"])
  })
})
```

`lib/role-groups.ts`:

```ts
// Groups listRoles rows under their families: families sorted by name,
// rows keep their incoming order (the backend sorts by title), and the
// family-less group renders last. Pure so it stays unit-testable.
export interface FamilyGroup<Row> {
  familyId: string | null
  familyName: string | null
  rows: Row[]
}

export function groupByFamily<
  Row extends { familyId: string | null; familyName: string | null },
>(rows: Row[]): FamilyGroup<Row>[] {
  const byFamily = new Map<string | null, FamilyGroup<Row>>()
  for (const row of rows) {
    const key = row.familyId
    const group = byFamily.get(key) ?? {
      familyId: row.familyId,
      familyName: row.familyName,
      rows: [],
    }
    group.rows.push(row)
    byFamily.set(key, group)
  }
  const groups = [...byFamily.values()]
  groups.sort((a, b) => {
    if (a.familyId === null) return 1
    if (b.familyId === null) return -1
    return (a.familyName ?? "").localeCompare(b.familyName ?? "")
  })
  return groups
}
```

- [x] **Step 2: Roles page** (replace the single Table with one section per group: an h3 heading row with the family name as a Link to `/roles/families/${familyId}` plus the count via `dashboard.roles.family.roleCount`, or the plain `t("family.none")` text for the family-less group; then the SAME table markup per group. Keep the empty state and the create dialog untouched.)

- [x] **Step 3: Run, typecheck, commit**

```bash
git add apps/dashboard/lib apps/dashboard/app
git commit -m "feat(dashboard): roles list grouped by family"
```

---

## Task 9: Results page family filter

**Files:**
- Modify: `apps/dashboard/app/(app)/results/page.tsx`

- [x] **Step 1: Add the filter** (a `const [familyFilter, setFamilyFilter] = useState<string | null>(null)` plus a Select above BandOverview listing `t("family.all")` (value sentinel `"__all__"`) and the distinct families present in `results.rows` (id + name); `const filteredRows = familyFilter === null ? results.rows : results.rows.filter((row) => row.familyId === familyFilter)`; pass `filteredRows` to BOTH BandOverview and the table; the empty state stays keyed on the UNfiltered rows)

Use the family namespace: `const tFamily = useTranslations("dashboard.roles.family")`. The Select renders only when at least one row has a family.

- [x] **Step 2: Run, typecheck, commit**

```bash
git add apps/dashboard/app
git commit -m "feat(dashboard): family filter on the results view"
```

---

## Task 10: Family page (progression view)

**Files:**
- Create: `apps/dashboard/app/(app)/roles/families/[familyId]/page.tsx`
- Create: `apps/dashboard/components/roles/family-header.tsx`
- Create: `apps/dashboard/components/roles/family-header.test.tsx`

- [x] **Step 1: Family header component (rename + remove) with tests**

`family-header.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { MorphConfirmButton } from "@/components/morph-confirm-button"

// Family page header: inline rename (member scope) and a confirmed removal
// that clears membership and navigates back to the register.
export function FamilyHeader({
  orgId,
  familyId,
  name,
}: {
  orgId: string
  familyId: string
  name: string
}) {
  const t = useTranslations("dashboard.roles.family")
  const tErrors = useTranslations("errors")
  const renameFamily = useMutation(api.assessment.families.renameRoleFamily)
  const removeFamily = useMutation(api.assessment.families.removeRoleFamily)
  const router = useRouter()
  const inputId = useId()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [pending, setPending] = useState(false)
  const [duplicate, setDuplicate] = useState(false)

  async function handleSave() {
    const trimmed = draft.trim()
    if (trimmed === "" || pending) return
    setPending(true)
    setDuplicate(false)
    try {
      await renameFamily({
        orgId,
        familyId: familyId as never,
        name: trimmed,
      })
      setEditing(false)
    } catch {
      setDuplicate(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        {editing ? (
          <>
            <label htmlFor={inputId} className="sr-only">
              {t("nameLabel")}
            </label>
            <Input
              id={inputId}
              value={draft}
              className="max-w-xs"
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              disabled={draft.trim() === "" || pending}
              onClick={handleSave}
            >
              {t("saveCta")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setDraft(name)
                setDuplicate(false)
              }}
            >
              {t("cancel")}
            </Button>
          </>
        ) : (
          <>
            <h2 className="font-medium text-lg">{name}</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(name)
                setEditing(true)
              }}
            >
              {t("renameCta")}
            </Button>
          </>
        )}
        <MorphConfirmButton
          className="ml-auto"
          variant="label"
          triggerText={t("removeCta")}
          confirmLabel={t("removeConfirm")}
          cancelLabel={t("cancel")}
          disabled={pending}
          onConfirm={async () => {
            await removeFamily({ orgId, familyId: familyId as never })
            router.push("/roles")
          }}
        />
      </div>
      <p className="text-muted-foreground text-sm">{t("removeHint")}</p>
      {duplicate && (
        <p role="alert" className="text-destructive text-sm">
          {tErrors("roleFamilyExists")}
        </p>
      )}
    </div>
  )
}
```

`family-header.test.tsx` (mock idiom as elsewhere; useMutation by ref for rename/remove, next/navigation router): at least 3 tests: rename flow calls renameRoleFamily with the trimmed name and exits edit mode; duplicate rejection shows the translated alert and stays editing; the remove confirm calls removeRoleFamily and navigates to /roles. The remove trigger is the LABEL variant: query it by its visible name, `getByRole("button", { name: labels.removeCta })`, then the armed confirm by `labels.removeConfirm`.

- [x] **Step 2: Family page** (create `app/(app)/roles/families/[familyId]/page.tsx`)

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { use } from "react"
import { useOrganization } from "@/components/org-context"
import { FamilyHeader } from "@/components/roles/family-header"
import { statusBadgeVariant } from "@/lib/role-status"

// Per-family progression: the family's roles grouped per track (track
// order), ordered by level. Band outcomes appear only for complete roles,
// the same visibility rule as the results view.
export default function FamilyPage(props: {
  params: Promise<{ familyId: string }>
}) {
  const { familyId } = use(props.params)
  const t = useTranslations("dashboard.roles")
  const tFamily = useTranslations("dashboard.roles.family")
  const tStatus = useTranslations("assessment.status")
  const tAssessment = useTranslations("assessment")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const families = useQuery(api.assessment.families.listRoleFamilies, {
    orgId,
    locale,
  })
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const results = useQuery(api.assessment.results.getResults, {
    orgId,
    locale,
  })

  if (families === undefined || roles === undefined || results === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={tFamily("rolesHeading")} />
      </main>
    )
  }
  const family = families.find((entry) => entry.familyId === familyId)
  if (family === undefined) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{tFamily("notFound")}</p>
        <Link href="/roles" className="text-sm underline underline-offset-4">
          {t("detail.backToRoles")}
        </Link>
      </div>
    )
  }

  const bandByRole = new Map(
    results.rows.map((row) => [row.roleId as string, row])
  )
  const familyRoles = roles.filter((role) => role.familyId === familyId)
  const trackKeys = [
    ...new Map(
      familyRoles.map((role) => [
        role.trackKey,
        { key: role.trackKey, name: role.trackName, order: role.trackOrder },
      ])
    ).values(),
  ].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-6">
      <FamilyHeader orgId={orgId} familyId={familyId} name={family.name} />
      {trackKeys.map((track) => {
        const trackRoles = familyRoles
          .filter((role) => role.trackKey === track.key)
          .sort((a, b) => a.levelOrder - b.levelOrder)
        return (
          <div key={track.key} className="space-y-2">
            <h3 className="font-medium text-sm">{track.name}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.title")}</TableHead>
                  <TableHead>{t("table.trackLevel")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead className="text-right">
                    {tAssessment("band")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackRoles.map((role) => {
                  const result = bandByRole.get(role.roleId as string)
                  return (
                    <TableRow key={role.roleId}>
                      <TableCell>
                        <Link
                          href={`/roles/${role.roleId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {role.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {role.levelKey}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(role.status)}>
                          {tStatus(
                            role.status as "draft" | "inReview" | "approved"
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {result?.band != null ? (
                          <Badge>{result.band}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {t("detail.ratingProgress", {
                              rated: role.ratedCount,
                              total: role.totalCriteria,
                            })}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )
      })}
    </div>
  )
}
```

(listRoleFamilies takes a locale arg per Task 3; passing it is correct. If the query was implemented without locale, drop the arg here instead of changing the backend.)

- [x] **Step 3: Run, typecheck, commit**

```bash
git add apps/dashboard/app apps/dashboard/components/roles
git commit -m "feat(dashboard): family page with per-track progression"
```

---

## Task 11: Final sweep

- [x] **Step 1:** `bun run typecheck && bun run test && bun x biome check apps packages` all green from the repo root.
- [x] **Step 2:** Verify the engine is untouched: `git diff main...HEAD --stat -- packages/core` is EMPTY (spec acceptance criterion 8).
- [x] **Step 3:** Push functions to the dev deployment: `cd packages/backend && bun x convex dev --once` (pkill -f esbuild and retry on EPIPE; never from the repo root).
- [x] **Step 4:** Manual smoke: create a family inline from the role dialog, move a role between families, see the grouped roles list, filter results by family, open the family page, rename it, remove it and confirm the roles drop to "No family" with the audit rows written.
- [x] **Step 5:** Tick this plan's checkboxes and commit docs:

```bash
git add docs/superpowers
git commit -m "docs: tick role-families plan checkboxes"
```

The branch then awaits founder review; the squash merge to main happens only after explicit approval.


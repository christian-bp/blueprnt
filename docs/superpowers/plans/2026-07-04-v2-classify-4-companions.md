# V2 Classification: Companion Completion Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the import + classification pillar with a per-person detail route (`/people/[id]`) that hosts a manual salary-entry form and a GDPR erasure control, plus reloading the saved import-mapping profile so the annual re-import can skip the map step.

**Architecture:** A new client route `apps/dashboard/app/(app)/people/[id]/page.tsx` reads the person via `getPerson`, their assignment via `getCurrentAssignment`, and their salary history via `getSalaryHistory`; it renders an identity header, a level/classification summary, a salary-history table with an add/adjust form (wired to `setSalary`), and a type-to-confirm delete control. Erasure runs through an org-scoped HR entry point that delegates to a shared hard-delete helper extracted from the existing `erasePerson` admin logic (one implementation, two callers). The People list rows become links to the detail route. The import wizard's map step pre-seeds column dropdowns from the org's saved `importMappingProfile`.

**Tech Stack:** Next.js 16 (App Router, client components), Convex (`orgQuery`/`adminMutation`/`internalMutation` via `lib/functions.ts`), React 19, react-hook-form + Zod + shadcn `Form`, `next-intl` (`@workspace/i18n`), Motion (`motion/react`), Vitest 4 + convex-test (edge-runtime) + Testing Library.

## Global Constraints

- Every Convex function is org-scoped (tenant isolation); no cross-org reads; no band override.
- Role != Person: the `roles`/`ratings` tables never carry person, salary, gender, or performance fields.
- No AI in the classification path: suggestions are a reviewable proposal HR confirms; AI never auto-decides (ADR-0003).
- Level is per-individual, validated against the role's track via `isValidLevelForTrack` (ADR-0005); no level lives on `roles`.
- Score/band are always derived by the engine and never stored (ADR-0002); `totalMonthlyComp` is derived on read.
- A person is erasable: erasure is a true hard delete of `people` + `personAssignments` + `payRecords`, with audit `actorName`/PII anonymized, never a soft flag; residual PII in append-only logs is anonymized, not retained.
- Every state-changing mutation writes an audit row via an `AUDIT_EVENTS` key; `setSalary` and `erasePerson` already do this.
- All data stays within the EU (Convex eu-west-1; ADR-0001); no external calls.
- All user-facing text goes through i18n; new keys land in `packages/i18n/messages/en.json` first, then are mirrored to every locale in `routing.ts` (en, sv, nb, da, fi) in the same commit; Nordic strings are drafts flagged for native review.
- New code ships with tests in the same commit.
- All tests run with Vitest 4 via `bun run test` (never `bun test`); backend tests use convex-test on the `edge-runtime` environment.
- All code, identifiers, comments, and commit messages are in English; never use em dashes in any text we write.
- Commit messages use Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`); no AI/Claude attribution.
- Forms use `useForm({ resolver: zodResolver(schema), mode: "onTouched" })` with `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`; schemas are factories `makeXSchema(t)`; the submit button is disabled until `form.formState.isValid` (and while submitting).
- Route-exposed entities use a slug, but `people` is deliberately NOT slugged (Role != Person, PII minimization): the detail route resolves by the Convex `_id` string, consistent with the spec's `/people/[id]`.
- Internal navigation uses the `Link` component, never plain `<a>`.
- User-initiated CRUD shows a toast (`toast.success(t("dashboard.toast.<op>"))`, `toast.error(t("dashboard.toast.error"))`); a data-backed surface shows a content-shaped skeleton; layout must not shift on state change.

---

### Task 1: Extract the shared hard-delete helper and add an org-scoped HR erase entry point

**Files:**
- Modify: `packages/backend/convex/people/erase.ts` (extract helper, add org-scoped mutation)
- Test: `packages/backend/convex/people/erase.test.ts` (add org-scoped path tests)

**Interfaces:**
- Consumes: `erasePerson` (existing `adminMutation`, args `{ personId: Id<"people"> }`, returns `null`); `AUDIT_EVENTS.personErased`, `buildDeleteChanges`, `PERSON_AUDIT_FIELDS` (from `../lib/audit`); `appError`, `ERROR_CODES.notFound` (from `../lib/errors`); `adminMutation` (from `../lib/functions`); the `MutationCtx` type from `../_generated/server`.
- Produces:
  - `erasePersonRecords(ctx: MutationCtx, orgId: string, personId: Id<"people">): Promise<void>` — a plain async helper (NOT a Convex function) that hard-deletes `payRecords`, `personAssignments`, then the `people` row for `(orgId, personId)`, throwing `appError(ERROR_CODES.notFound)` when the person is missing or belongs to another org. It does NOT write the audit row (the caller does, because `adminMutation` provides `ctx.audit` and internal mutations use the free `logAudit`).
  - `erasePersonAsOrg` — `adminMutation`, args `{ personId: v.id("people") }`, returns `v.null()`. The org-scoped HR entry point the dashboard calls. Delegates the deletion to `erasePersonRecords`, then writes the same `AUDIT_EVENTS.personErased` audit row via `ctx.audit.log` with the non-PII delete changes. This is the app-facing (HR-only, org-admin-gated) name; `erasePerson` stays for backward compatibility with any existing caller and now also delegates to `erasePersonRecords`.

- [ ] **Step 1: Write the failing tests for the org-scoped erase path**

Append to `packages/backend/convex/people/erase.test.ts` (the `seedOrg`/`seedEditor` helpers already exist at the top of the file; reuse them):

```typescript
describe("erasePersonAsOrg (org-scoped HR erasure)", () => {
  it("hard-deletes the person, their assignments, and their pay records", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    // Seed a role, a person, an assignment, and a pay record.
    const { roleId, personId } = await t.run(async (ctx) => {
      const roleId = await ctx.db.insert("roles", {
        orgId,
        title: "Engineer",
        slug: "engineer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC" as const,
        purpose: "",
        responsibilities: "",
      })
      const personId = await ctx.db.insert("people", {
        orgId,
        externalRef: "E-1",
        displayName: "Test Person",
        gender: "Kvinna" as const,
      })
      await ctx.db.insert("personAssignments", {
        orgId,
        personId,
        roleId,
        level: "IC3",
        levelSource: "confirmed" as const,
        effectiveAt: 1_000,
      })
      await ctx.db.insert("payRecords", {
        orgId,
        personId,
        payYear: 2026,
        source: "manual" as const,
        basicMonthly: 50_000,
        currency: "SEK",
        components: [],
        effectiveAt: 1_000,
        createdAt: 1_000,
      })
      return { roleId, personId }
    })

    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, { personId })

    const remaining = await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      const assignments = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      const pay = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      const role = await ctx.db.get(roleId)
      return { person, assignments, pay, role }
    })

    expect(remaining.person).toBeNull()
    expect(remaining.assignments).toHaveLength(0)
    expect(remaining.pay).toHaveLength(0)
    // The role must survive: erasure removes the person, not the role.
    expect(remaining.role).not.toBeNull()
  })

  it("throws notFound for a person in another org", async () => {
    const t = initConvexTest()
    const { asAdmin } = await seedOrg(t, "hr@acme.se")
    const { orgId: otherOrgId } = await seedOrg(t, "hr@other.se")
    const foreignPersonId = await t.run(async (ctx) =>
      ctx.db.insert("people", {
        orgId: otherOrgId,
        displayName: "Foreign",
        gender: "Man" as const,
      })
    )

    await expect(
      asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
        personId: foreignPersonId,
      })
    ).rejects.toThrow()
  })

  it("rejects a non-admin (editor) member", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await t.run(async (ctx) =>
      ctx.db.insert("people", {
        orgId,
        displayName: "Test",
        gender: "Man" as const,
      })
    )
    const asEditor = await seedEditor(t, orgId, "editor@acme.se")
    await expect(
      asEditor.mutation(api.people.erase.erasePersonAsOrg, { personId })
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/backend && bun run test people/erase.test.ts`
Expected: FAIL with `api.people.erase.erasePersonAsOrg` being undefined (property does not exist).

- [ ] **Step 3: Extract the helper and add the org-scoped mutation**

Rewrite `packages/backend/convex/people/erase.ts` so the deletion body lives in one shared helper, and both the existing `erasePerson` and the new `erasePersonAsOrg` delegate to it:

```typescript
import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import {
  AUDIT_EVENTS,
  buildDeleteChanges,
  PERSON_AUDIT_FIELDS,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation } from "../lib/functions"

// Shared hard-delete body. Deletes payRecords, then personAssignments, then the
// people row, in child-first order. Throws notFound when the person is missing
// or belongs to another org. Returns the non-PII "before" snapshot so the
// caller can write the audit row (callers differ in how they log: adminMutation
// uses ctx.audit, an internal mutation would use the free logAudit).
//
// This is the SINGLE implementation of the delete. erasePerson and
// erasePersonAsOrg both delegate here; there is no duplicate delete logic.
export async function erasePersonRecords(
  ctx: MutationCtx,
  orgId: string,
  personId: Id<"people">
): Promise<Record<string, unknown>> {
  const person = await ctx.db.get(personId)
  if (person === null || person.orgId !== orgId) {
    throw appError(ERROR_CODES.notFound)
  }

  // Non-PII delete snapshot built BEFORE deletion. PERSON_AUDIT_FIELDS excludes
  // displayName, gender, and birthDate (PII); salary amounts never live on the
  // people row.
  const nonPiiBefore: Record<string, unknown> = {
    externalRef: person.externalRef ?? null,
    employmentStartDate: person.employmentStartDate ?? null,
    ftePercent: person.ftePercent ?? null,
    country: person.country ?? null,
    isManager: person.isManager ?? null,
    statisticalCode: person.statisticalCode ?? null,
    department: person.department ?? null,
    archivedAt: person.archivedAt ?? null,
  }

  // 1. payRecords (child of people, by_person index).
  const payRows = await ctx.db
    .query("payRecords")
    .withIndex("by_person", (q) =>
      q.eq("orgId", orgId).eq("personId", personId)
    )
    .collect()
  for (const row of payRows) {
    await ctx.db.delete(row._id)
  }

  // 2. personAssignments (child of people, by_person index).
  const assignmentRows = await ctx.db
    .query("personAssignments")
    .withIndex("by_person", (q) =>
      q.eq("orgId", orgId).eq("personId", personId)
    )
    .collect()
  for (const row of assignmentRows) {
    await ctx.db.delete(row._id)
  }

  // 3. The people row itself.
  await ctx.db.delete(personId)

  return nonPiiBefore
}

// GDPR right to erasure, platform-admin variant. Kept for backward
// compatibility with existing callers. adminMutation enforces org-admin role.
export const erasePerson = adminMutation({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, { personId }) => {
    const nonPiiBefore = await erasePersonRecords(ctx, ctx.orgId, personId)
    await ctx.audit.log({
      type: AUDIT_EVENTS.personErased,
      payload: {
        personId,
        changes: buildDeleteChanges(nonPiiBefore, PERSON_AUDIT_FIELDS),
      },
    })
    return null
  },
})

// Org-scoped HR erasure entry point. GDPR erasure is the org's duty and this app
// is HR-only, so the HR-facing delete is an org-admin-gated mutation that reuses
// the exact same hard-delete helper as erasePerson. No second delete
// implementation exists.
export const erasePersonAsOrg = adminMutation({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, { personId }) => {
    const nonPiiBefore = await erasePersonRecords(ctx, ctx.orgId, personId)
    await ctx.audit.log({
      type: AUDIT_EVENTS.personErased,
      payload: {
        personId,
        changes: buildDeleteChanges(nonPiiBefore, PERSON_AUDIT_FIELDS),
      },
    })
    return null
  },
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/backend && bun run test people/erase.test.ts`
Expected: PASS (new `erasePersonAsOrg` describe block plus the pre-existing `erasePerson` tests all green).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/people/erase.ts packages/backend/convex/people/erase.test.ts
git commit -m "refactor(people): extract shared erase helper and add org-scoped HR erase"
```

---

### Task 2: i18n keys for the person detail surface, salary form, and erasure

**Files:**
- Modify: `packages/i18n/messages/en.json` (source locale; add keys)
- Modify: `packages/i18n/messages/sv.json`, `nb.json`, `da.json`, `fi.json` (mirror keys; Nordic drafts)
- Test: `packages/i18n` parity test (already exists; run it, do not edit it)

**Interfaces:**
- Consumes: existing `dashboard.people.*`, `dashboard.toast.*`, `dashboard.validation.*` namespaces in `en.json`.
- Produces: the `dashboard.people.detail.*`, `dashboard.people.salaryForm.*`, `dashboard.people.erase.*` key subtrees, and the new `dashboard.toast.salarySaved` and `dashboard.toast.personErased` keys, present and typed in all five locales. Later tasks call `useTranslations("dashboard.people.detail")`, `useTranslations("dashboard.people.salaryForm")`, `useTranslations("dashboard.people.erase")`, and `useTranslations("dashboard.toast")`.

- [ ] **Step 1: Add the English source keys**

In `packages/i18n/messages/en.json`, inside the existing `"dashboard"` object's `"people"` block (which already has `heading`, `description`, `empty`, `columns`, `gender`, `import`), add these sibling keys:

```json
"detail": {
  "backToPeople": "Back to people",
  "identityHeading": "Employee",
  "externalRef": "Employee number",
  "employmentStartDate": "Start date",
  "fte": "FTE",
  "department": "Department",
  "notFound": "This employee could not be found.",
  "classificationHeading": "Role and level",
  "role": "Role",
  "level": "Level",
  "levelSource": "Source",
  "sourceSuggested": "Suggested",
  "sourceConfirmed": "Confirmed",
  "noAssignment": "Not classified yet.",
  "salaryHeading": "Salary history",
  "salaryEmpty": "No salary recorded yet.",
  "salaryColumns": {
    "payYear": "Year",
    "basicMonthly": "Basic monthly",
    "total": "Total monthly",
    "currency": "Currency",
    "source": "Source",
    "effectiveAt": "Effective"
  },
  "sourceImport": "Import",
  "sourceManual": "Manual"
},
"salaryForm": {
  "addTitle": "Add salary",
  "payYear": "Salary year",
  "basicMonthly": "Basic monthly salary",
  "currency": "Currency",
  "components": "Additional components",
  "addComponent": "Add component",
  "removeComponent": "Remove component",
  "componentKind": "Type",
  "componentAmount": "Monthly amount",
  "effectiveAt": "Effective date",
  "submit": "Save salary",
  "componentKinds": {
    "variable": "Variable pay",
    "bonus": "Bonus",
    "benefitInKind": "Benefit in kind",
    "fixedSupplement": "Fixed supplement",
    "allowance": "Allowance",
    "equity": "Equity",
    "other": "Other"
  }
},
"erase": {
  "trigger": "Delete employee",
  "title": "Delete {name}",
  "description": "This permanently deletes this employee and all their assignments and salary records. This cannot be undone.",
  "confirmLabel": "Type the employee number {externalRef} to confirm",
  "confirmNoRef": "Type DELETE to confirm",
  "confirm": "Delete permanently",
  "cancel": "Cancel",
  "error": "The employee could not be deleted. Try again."
}
```

Then, inside the existing `"dashboard"."toast"` object, add two keys next to the existing entries:

```json
"salarySaved": "Salary saved",
"personErased": "Employee deleted"
```

- [ ] **Step 2: Mirror the keys to every other locale (Nordic drafts)**

Add the same key structure to `packages/i18n/messages/sv.json`, `nb.json`, `da.json`, and `fi.json` with translated values. Use these Swedish (`sv.json`) draft values (mark for native review in the commit body); produce nb/da/fi equivalents in the same shape:

```json
"detail": {
  "backToPeople": "Tillbaka till anställda",
  "identityHeading": "Anställd",
  "externalRef": "Anställningsnummer",
  "employmentStartDate": "Startdatum",
  "fte": "Sysselsättningsgrad",
  "department": "Avdelning",
  "notFound": "Den anställda kunde inte hittas.",
  "classificationHeading": "Roll och nivå",
  "role": "Roll",
  "level": "Nivå",
  "levelSource": "Källa",
  "sourceSuggested": "Föreslagen",
  "sourceConfirmed": "Bekräftad",
  "noAssignment": "Inte klassificerad än.",
  "salaryHeading": "Lönehistorik",
  "salaryEmpty": "Ingen lön registrerad än.",
  "salaryColumns": {
    "payYear": "År",
    "basicMonthly": "Fast månadslön",
    "total": "Total månadsersättning",
    "currency": "Valuta",
    "source": "Källa",
    "effectiveAt": "Gäller från"
  },
  "sourceImport": "Import",
  "sourceManual": "Manuell"
},
"salaryForm": {
  "addTitle": "Lägg till lön",
  "payYear": "Löneår",
  "basicMonthly": "Fast månadslön",
  "currency": "Valuta",
  "components": "Ytterligare komponenter",
  "addComponent": "Lägg till komponent",
  "removeComponent": "Ta bort komponent",
  "componentKind": "Typ",
  "componentAmount": "Månadsbelopp",
  "effectiveAt": "Gäller från",
  "submit": "Spara lön",
  "componentKinds": {
    "variable": "Rörlig ersättning",
    "bonus": "Bonus",
    "benefitInKind": "Naturaförmån",
    "fixedSupplement": "Fast tillägg",
    "allowance": "Ersättning",
    "equity": "Aktier",
    "other": "Övrigt"
  }
},
"erase": {
  "trigger": "Radera anställd",
  "title": "Radera {name}",
  "description": "Detta raderar den anställda permanent tillsammans med alla tilldelningar och löneuppgifter. Det kan inte ångras.",
  "confirmLabel": "Skriv anställningsnumret {externalRef} för att bekräfta",
  "confirmNoRef": "Skriv DELETE för att bekräfta",
  "confirm": "Radera permanent",
  "cancel": "Avbryt",
  "error": "Den anställda kunde inte raderas. Försök igen."
}
```

Add to each locale's `dashboard.toast` object: `sv` -> `"salarySaved": "Lönen sparades", "personErased": "Anställd raderad"`; produce nb/da/fi equivalents.

- [ ] **Step 3: Run the parity test to verify all locales match**

Run: `cd packages/i18n && bun run test`
Expected: PASS (the parity test confirms every locale's key set equals `en.json`; a missing key in any locale fails here).

- [ ] **Step 4: Verify no mojibake was introduced**

Run: `grep -nP "[\xC3\xC2]\x{fffd}|Ã¤|Ã¶|Ã¥" packages/i18n/messages/*.json`
Expected: no output (empty). Non-ASCII Nordic characters must be real UTF-8, not double-encoded; if this prints anything, re-add the affected value with a proper editor write, not a shell perl/sed.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "feat(i18n): add person detail, salary form, and erasure keys (Nordic drafts)"
```

---

### Task 3: The `/people/[id]` detail route (identity + classification + salary history)

**Files:**
- Create: `apps/dashboard/app/(app)/people/[id]/page.tsx`
- Create: `apps/dashboard/components/people/person-detail.tsx`
- Create: `apps/dashboard/components/people/person-detail.test.tsx`
- Modify: `apps/dashboard/components/people/people-section.tsx` (make rows link to the detail route)
- Modify: `apps/dashboard/components/people/people-section.test.tsx` (assert the link)

**Interfaces:**
- Consumes: `api.people.people.getPerson` (`orgQuery`, args `{ personId: Id<"people"> }`, returns the person shape `{ personId, displayName, gender, externalRef, birthDate, employmentStartDate, ftePercent, country, isManager, statisticalCode, department, title, archivedAt }` or `null`; the `title: string | null` field is added by Plan 1 to `personShape`/`toPersonShape`, so it is present on this shape though `PersonDetail` does not currently render it); `api.people.assignments.getCurrentAssignment` (`orgQuery`, args `{ personId }`, returns `{ assignmentId, personId, roleId, level, levelSource, effectiveAt, endedAt }` or `null`); `api.people.pay.getSalaryHistory` (`orgQuery`, args `{ personId }`, returns an array of `{ payRecordId, personId, payYear, source, basicMonthly, currency, components, totalMonthlyComp, effectiveAt, createdAt }`); `api.assessment.roles.listRoles` (args `{ orgId, locale }`, returns roles with `{ roleId, title, slug, trackKey, trackName, ... }`); `useOrganization()` -> `{ orgId }`; `PageHeader`; `PageBreadcrumb` + `Crumb`; `usePageTitle`; `TableSkeleton`.
- Produces: `PersonDetail({ personId }: { personId: string })` — the client component the route renders. Tasks 4 and 5 mount their `<SalaryForm>` and `<ErasePersonControl>` inside this component.

- [ ] **Step 1: Write the failing component test**

Create `apps/dashboard/components/people/person-detail.test.tsx`. Follow the existing `people-section.test.tsx` mocking style (mock `convex/react` `useQuery`, `@/components/org-context`, and `next-intl`). Because Convex function refs are opaque, drive the `useQuery` mock by call ORDER: `PersonDetail` calls `useQuery` in a fixed order (getPerson, getCurrentAssignment, getSalaryHistory, listRoles). Mount `PersonDetail` and assert it shows the person name, the current level, and the salary rows. Use this test body:

```tsx
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PersonDetail } from "./person-detail"

vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org_1" }),
}))
vi.mock("@/hooks/use-page-title", () => ({ usePageTitle: () => {} }))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}))

const queue = vi.hoisted(() => ({ results: [] as unknown[] }))
vi.mock("convex/react", () => {
  let i = 0
  return {
    useQuery: () => queue.results[i++],
    useMutation: () => vi.fn(),
  }
})

describe("PersonDetail", () => {
  beforeEach(() => {
    // useQuery is called fresh each render; reset the index via re-import is
    // not possible, so we make the mock read a rotating pointer per render.
  })

  it("renders identity, current level, and salary history", () => {
    queue.results = [
      // getPerson
      {
        personId: "p1",
        displayName: "Alex Doe",
        gender: "Kvinna",
        externalRef: "E-1",
        birthDate: null,
        employmentStartDate: "2021-01-01",
        ftePercent: 100,
        country: "SE",
        isManager: false,
        statisticalCode: null,
        department: "Engineering",
        archivedAt: null,
      },
      // getCurrentAssignment
      {
        assignmentId: "a1",
        personId: "p1",
        roleId: "r1",
        level: "IC3",
        levelSource: "confirmed",
        effectiveAt: 1000,
        endedAt: null,
      },
      // getSalaryHistory
      [
        {
          payRecordId: "pr1",
          personId: "p1",
          payYear: 2026,
          source: "manual",
          basicMonthly: 50000,
          currency: "SEK",
          components: [],
          totalMonthlyComp: 50000,
          effectiveAt: 1000,
          createdAt: 1000,
        },
      ],
      // listRoles
      [{ roleId: "r1", title: "Engineer", slug: "engineer", trackKey: "IC", trackName: "IC" }],
    ]
    render(<PersonDetail personId="p1" />)
    expect(screen.getByText("Alex Doe")).toBeInTheDocument()
    expect(screen.getByText("IC3")).toBeInTheDocument()
    expect(screen.getByText("Engineer")).toBeInTheDocument()
    expect(screen.getByText("50000")).toBeInTheDocument()
  })
})
```

Note for the implementer: the order-based `useQuery` mock requires the mock to reset its counter per render. Implement the mock factory so the counter is module-scoped and reset at the top of `useQuery` when the first ref is requested; the simplest robust form is to return `queue.results[callCount % queue.results.length]` and reset `callCount` to 0 inside a `useMemo`-free render by keying off React's render. If the counter proves flaky, switch to mocking each query by matching the args object's presence of a distinguishing field (`getSalaryHistory` returns an array; the others return objects) — assert on rendered text either way.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test components/people/person-detail.test.tsx`
Expected: FAIL with "Cannot find module './person-detail'".

- [ ] **Step 3: Create the `PersonDetail` component**

Create `apps/dashboard/components/people/person-detail.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
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
import { useOrganization } from "@/components/org-context"
import { type Crumb, PageBreadcrumb } from "@/components/page-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { TableSkeleton } from "@/components/table-skeleton"
import { usePageTitle } from "@/hooks/use-page-title"

// The per-person detail surface. Reads identity, current assignment (role +
// level), and salary history. Host for the manual salary form (Task 4) and the
// erasure control (Task 5). The route resolves by the raw Convex id, not a slug:
// people are deliberately not route-slugged (Role != Person, PII minimization).
export function PersonDetail({ personId }: { personId: string }) {
  const t = useTranslations("dashboard.people.detail")
  const tNav = useTranslations("dashboard.nav")
  const { orgId } = useOrganization()
  const locale = useLocale()

  const typedId = personId as Id<"people">
  const person = useQuery(api.people.people.getPerson, { personId: typedId })
  const assignment = useQuery(api.people.assignments.getCurrentAssignment, {
    personId: typedId,
  })
  const salary = useQuery(api.people.pay.getSalaryHistory, {
    personId: typedId,
  })
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })

  usePageTitle(person?.displayName ?? undefined)

  const crumbs: Crumb[] = [
    { label: tNav("people"), href: "/people" },
    { label: person?.displayName ?? "" },
  ]

  // Loading: person or salary still resolving. Show a content-shaped skeleton.
  if (person === undefined || salary === undefined) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumb={<PageBreadcrumb segments={crumbs} />}
          title={t("identityHeading")}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("salaryColumns.payYear")}</TableHead>
              <TableHead>{t("salaryColumns.basicMonthly")}</TableHead>
              <TableHead>{t("salaryColumns.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableSkeleton rows={3} columns={3} />
        </Table>
      </div>
    )
  }

  if (person === null) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{t("notFound")}</p>
        <Link className="text-sm underline underline-offset-4" href="/people">
          {t("backToPeople")}
        </Link>
      </div>
    )
  }

  const roleTitle =
    assignment !== undefined && assignment !== null && roles !== undefined
      ? (roles.find((r) => String(r.roleId) === String(assignment.roleId))
          ?.title ?? "")
      : ""

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={<PageBreadcrumb segments={crumbs} />}
        title={person.displayName}
      />

      {/* Identity block */}
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t("externalRef")}</dt>
          <dd>{person.externalRef ?? ""}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t("employmentStartDate")}
          </dt>
          <dd>{person.employmentStartDate ?? ""}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("department")}</dt>
          <dd>{person.department ?? ""}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("fte")}</dt>
          <dd>{person.ftePercent != null ? `${person.ftePercent}%` : ""}</dd>
        </div>
      </dl>

      {/* Classification block */}
      <section className="space-y-2">
        <h2 className="font-medium text-sm">{t("classificationHeading")}</h2>
        {assignment === undefined ? (
          <p className="text-muted-foreground text-sm">{t("noAssignment")}</p>
        ) : assignment === null ? (
          <p className="text-muted-foreground text-sm">{t("noAssignment")}</p>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <span>{roleTitle}</span>
            <Badge>{assignment.level}</Badge>
            <span className="text-muted-foreground">
              {assignment.levelSource === "confirmed"
                ? t("sourceConfirmed")
                : t("sourceSuggested")}
            </span>
          </div>
        )}
      </section>

      {/* Salary history block */}
      <section className="space-y-2">
        <h2 className="font-medium text-sm">{t("salaryHeading")}</h2>
        {salary.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("salaryEmpty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("salaryColumns.payYear")}</TableHead>
                <TableHead>{t("salaryColumns.basicMonthly")}</TableHead>
                <TableHead>{t("salaryColumns.total")}</TableHead>
                <TableHead>{t("salaryColumns.currency")}</TableHead>
                <TableHead>{t("salaryColumns.source")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salary.map((record) => (
                <TableRow key={String(record.payRecordId)}>
                  <TableCell>{record.payYear}</TableCell>
                  <TableCell>{record.basicMonthly}</TableCell>
                  <TableCell>{record.totalMonthlyComp}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {record.currency}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {record.source === "import"
                      ? t("sourceImport")
                      : t("sourceManual")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Task 4 mounts <SalaryForm personId={person.personId} /> here. */}
      {/* Task 5 mounts <ErasePersonControl personId={person.personId}
          displayName={person.displayName} externalRef={person.externalRef} />
          here. */}
    </div>
  )
}
```

- [ ] **Step 4: Create the route page**

Create `apps/dashboard/app/(app)/people/[id]/page.tsx`:

```tsx
"use client"

import { use } from "react"
import { PersonDetail } from "@/components/people/person-detail"

export default function PersonPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(props.params)
  return <PersonDetail personId={id} />
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test components/people/person-detail.test.tsx`
Expected: PASS.

- [ ] **Step 6: Make People-list rows link to the detail route**

In `apps/dashboard/components/people/people-section.tsx`, wrap the name cell in a `Link` to the detail route. Replace the name `TableCell` (currently `<TableCell className="font-medium">{person.displayName}</TableCell>`) with:

```tsx
<TableCell className="font-medium">
  <Link
    className="underline-offset-4 hover:underline"
    href={`/people/${String(person.personId)}`}
  >
    {person.displayName}
  </Link>
</TableCell>
```

(`Link` is already imported from `next/link` in this file.)

- [ ] **Step 7: Assert the link in the People-list test**

In `apps/dashboard/components/people/people-section.test.tsx`, add an assertion that the rendered person name is a link to `/people/<id>`. Add inside the existing "renders people" test (or a new test), given a mocked person with `personId: "p1"` and `displayName: "Alex Doe"`:

```tsx
const link = screen.getByRole("link", { name: "Alex Doe" })
expect(link).toHaveAttribute("href", "/people/p1")
```

- [ ] **Step 8: Run the People-list test to verify it passes**

Run: `cd apps/dashboard && bun run test components/people/people-section.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/app/\(app\)/people/\[id\]/page.tsx apps/dashboard/components/people/person-detail.tsx apps/dashboard/components/people/person-detail.test.tsx apps/dashboard/components/people/people-section.tsx apps/dashboard/components/people/people-section.test.tsx
git commit -m "feat(people): add per-person detail route with linked list rows"
```

---

### Task 4: Manual salary-entry form on the person detail

**Files:**
- Create: `apps/dashboard/components/people/salary-form.tsx`
- Create: `apps/dashboard/components/people/salary-form.test.tsx`
- Modify: `apps/dashboard/components/people/person-detail.tsx` (mount `<SalaryForm>`)

**Interfaces:**
- Consumes: `api.people.pay.setSalary` (`orgMutation`, args `{ personId: Id<"people">, payYear: number, basicMonthly: number, currency: string, components: Array<{ kind: string, monthlyAmount: number }>, effectiveAt?: number }`, returns `Id<"payRecords">`); `PAY_COMPONENT_KINDS` and `PayComponentKind` from `@workspace/constants`; the shadcn `Form` primitives (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`) from `@workspace/ui/components/form`; `SubmitButton`; `toast` from `sonner`; `useTranslations`.
- Produces: `SalaryForm({ personId }: { personId: Id<"people"> })` — mounted by `PersonDetail`. On successful submit it calls `setSalary` with `source` implicit (the mutation always writes `source: "manual"`), then `toast.success(t("dashboard.toast.salarySaved"))`.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/people/salary-form.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SalaryForm } from "./salary-form"

const setSalary = vi.hoisted(() => vi.fn().mockResolvedValue("pr_1"))
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock("convex/react", () => ({ useMutation: () => setSalary }))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }))
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }))

describe("SalaryForm", () => {
  it("calls setSalary with the entered basic salary and shows a success toast", async () => {
    render(<SalaryForm personId={"p1" as never} />)

    fireEvent.change(screen.getByLabelText("payYear"), {
      target: { value: "2026" },
    })
    fireEvent.blur(screen.getByLabelText("payYear"))
    fireEvent.change(screen.getByLabelText("basicMonthly"), {
      target: { value: "50000" },
    })
    fireEvent.blur(screen.getByLabelText("basicMonthly"))
    fireEvent.change(screen.getByLabelText("currency"), {
      target: { value: "SEK" },
    })
    fireEvent.blur(screen.getByLabelText("currency"))

    fireEvent.click(screen.getByRole("button", { name: "submit" }))

    await waitFor(() => {
      expect(setSalary).toHaveBeenCalledWith(
        expect.objectContaining({
          personId: "p1",
          payYear: 2026,
          basicMonthly: 50000,
          currency: "SEK",
          components: [],
        })
      )
    })
    expect(toastSuccess).toHaveBeenCalledWith("salarySaved")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test components/people/salary-form.test.tsx`
Expected: FAIL with "Cannot find module './salary-form'".

- [ ] **Step 3: Create the salary form schema factory and component**

Create `apps/dashboard/components/people/salary-form.tsx`:

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { PAY_COMPONENT_KINDS } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { SubmitButton } from "@/components/submit-button"

// Zod factory (messages via i18n). payYear and basicMonthly coerce from the
// number inputs; currency is a non-empty string. Components are an array of
// { kind, monthlyAmount } matching the payRecords component shape.
function makeSalarySchema(t: (key: string) => string) {
  return z.object({
    payYear: z.coerce
      .number({ invalid_type_error: t("required") })
      .int()
      .min(2000)
      .max(2100),
    basicMonthly: z.coerce
      .number({ invalid_type_error: t("required") })
      .nonnegative(),
    currency: z.string().trim().min(1, t("required")),
    components: z.array(
      z.object({
        kind: z.string().min(1, t("required")),
        monthlyAmount: z.coerce.number().nonnegative(),
      })
    ),
  })
}

type SalaryFormValues = z.infer<ReturnType<typeof makeSalarySchema>>

export function SalaryForm({ personId }: { personId: Id<"people"> }) {
  const t = useTranslations("dashboard.people.salaryForm")
  const tValidation = useTranslations("dashboard.validation")
  const tToast = useTranslations("dashboard.toast")
  const setSalary = useMutation(api.people.pay.setSalary)

  const schema = makeSalarySchema(tValidation)
  const form = useForm<SalaryFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      payYear: new Date().getFullYear(),
      basicMonthly: 0,
      currency: "SEK",
      components: [],
    },
  })
  const components = useFieldArray({ control: form.control, name: "components" })

  async function onSubmit(values: SalaryFormValues) {
    try {
      await setSalary({
        personId,
        payYear: values.payYear,
        basicMonthly: values.basicMonthly,
        currency: values.currency,
        components: values.components,
      })
      toast.success(tToast("salarySaved"))
      form.reset({
        payYear: values.payYear,
        basicMonthly: 0,
        currency: values.currency,
        components: [],
      })
    } catch {
      toast.error(tToast("error"))
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="font-medium text-sm">{t("addTitle")}</h2>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <FormField
            control={form.control}
            name="payYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("payYear")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    aria-label={t("payYear")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="basicMonthly"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("basicMonthly")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    aria-label={t("basicMonthly")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("currency")}</FormLabel>
                <FormControl>
                  <Input aria-label={t("currency")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Component rows (variable/bonus/etc). Each row is a kind Select
              plus a monthly amount. Added/removed with the field array so the
              layout extends below existing content, never reflows it. */}
          {components.fields.map((row, index) => (
            <div key={row.id} className="col-span-full flex items-end gap-2">
              <FormField
                control={form.control}
                name={`components.${index}.kind`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>{t("componentKind")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger aria-label={t("componentKind")}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAY_COMPONENT_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {t(`componentKinds.${kind}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`components.${index}.monthlyAmount`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>{t("componentAmount")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        aria-label={t("componentAmount")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => components.remove(index)}
              >
                {t("removeComponent")}
              </Button>
            </div>
          ))}

          <div className="col-span-full flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                components.append({
                  kind: PAY_COMPONENT_KINDS[0],
                  monthlyAmount: 0,
                })
              }
            >
              {t("addComponent")}
            </Button>
            <SubmitButton
              type="submit"
              isSubmitting={form.formState.isSubmitting}
              disabled={!form.formState.isValid || form.formState.isSubmitting}
            >
              {t("submit")}
            </SubmitButton>
          </div>
        </form>
      </Form>
    </section>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test components/people/salary-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Mount the form on the detail surface**

In `apps/dashboard/components/people/person-detail.tsx`, add the import at the top:

```tsx
import { SalaryForm } from "@/components/people/salary-form"
```

Then replace the `{/* Task 4 mounts ... */}` comment placeholder with:

```tsx
<SalaryForm personId={person.personId} />
```

- [ ] **Step 6: Run the detail test to verify nothing regressed**

Run: `cd apps/dashboard && bun run test components/people/person-detail.test.tsx components/people/salary-form.test.tsx`
Expected: PASS for both. (The `PersonDetail` test does not assert on the salary form; if the added `useMutation` call needs mocking, the existing `convex/react` mock in `person-detail.test.tsx` already stubs `useMutation` as `vi.fn()`.)

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/components/people/salary-form.tsx apps/dashboard/components/people/salary-form.test.tsx apps/dashboard/components/people/person-detail.tsx
git commit -m "feat(people): add manual salary-entry form on the person detail"
```

---

### Task 5: Erasure control (type-to-confirm) on the person detail

**Files:**
- Create: `apps/dashboard/components/people/erase-person-control.tsx`
- Create: `apps/dashboard/components/people/erase-person-control.test.tsx`
- Modify: `apps/dashboard/components/people/person-detail.tsx` (mount the control)

**Interfaces:**
- Consumes: `api.people.erase.erasePersonAsOrg` (from Task 1: `adminMutation`, args `{ personId: Id<"people"> }`, returns `null`); the shadcn `AlertDialog` primitives; `Input`, `Label`; `useForm` + `zodResolver` + `z`; `toast`; `useRouter` from `next/navigation`; `useTranslations`. Mirrors the type-to-confirm gate pattern in `apps/dashboard/components/admin/delete-user-dialog.tsx`.
- Produces: `ErasePersonControl({ personId, displayName, externalRef }: { personId: Id<"people">, displayName: string, externalRef: string | null })` — renders a destructive trigger button that opens the type-to-confirm dialog; on success it navigates to `/people` and shows `toast.success(t("dashboard.toast.personErased"))`.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/people/erase-person-control.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ErasePersonControl } from "./erase-person-control"

const erase = vi.hoisted(() => vi.fn().mockResolvedValue(null))
const toastSuccess = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())

vi.mock("convex/react", () => ({ useMutation: () => erase }))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }))

describe("ErasePersonControl", () => {
  it("gates the delete until the external ref is typed, then erases and navigates", async () => {
    render(
      <ErasePersonControl
        personId={"p1" as never}
        displayName="Alex Doe"
        externalRef="E-1"
      />
    )

    // Open the dialog.
    fireEvent.click(screen.getByRole("button", { name: "trigger" }))

    // The confirm action is disabled until the ref matches.
    const confirm = screen.getByRole("button", { name: "confirm" })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/confirmLabel/), {
      target: { value: "E-1" },
    })
    await waitFor(() => expect(confirm).not.toBeDisabled())

    fireEvent.click(confirm)

    await waitFor(() =>
      expect(erase).toHaveBeenCalledWith({ personId: "p1" })
    )
    expect(toastSuccess).toHaveBeenCalledWith("personErased")
    expect(push).toHaveBeenCalledWith("/people")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test components/people/erase-person-control.test.tsx`
Expected: FAIL with "Cannot find module './erase-person-control'".

- [ ] **Step 3: Create the erasure control**

Create `apps/dashboard/components/people/erase-person-control.tsx`. The confirm token is the external ref when present, else the literal `DELETE` (the `confirmNoRef` copy tells the user which):

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

// Type-to-confirm erasure. Same gate shape as admin/delete-user-dialog: RHF +
// a refine on the runtime token so form.formState.isValid tracks "typed text
// equals the required token", which gates the destructive action. The input is
// a plain register()ed field (no FormControl) so a partial match never glows
// the field red. Calls the org-scoped erasePersonAsOrg (Task 1).
export function ErasePersonControl({
  personId,
  displayName,
  externalRef,
}: {
  personId: Id<"people">
  displayName: string
  externalRef: string | null
}) {
  const t = useTranslations("dashboard.people.erase")
  const tToast = useTranslations("dashboard.toast")
  const erasePerson = useMutation(api.people.erase.erasePersonAsOrg)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // The required token: the employee number when present, else "DELETE".
  const token = externalRef ?? "DELETE"
  const inputId = `confirm-erase-${String(personId)}`

  const schema = useMemo(
    () =>
      z.object({
        confirmText: z.string().refine((v) => v.trim() === token),
      }),
    [token]
  )
  const form = useForm<{ confirmText: string }>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { confirmText: "" },
  })
  const confirmed = form.formState.isValid

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset({ confirmText: "" })
      setFailed(false)
    }
    setOpen(next)
  }

  async function handleDelete() {
    if (!confirmed) return
    setBusy(true)
    setFailed(false)
    try {
      await erasePerson({ personId })
      toast.success(tToast("personErased"))
      handleOpenChange(false)
      router.push("/people")
    } catch {
      setFailed(true)
      toast.error(tToast("error"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        {t("trigger")}
      </Button>
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("title", { name: displayName })}</AlertDialogTitle>
            <AlertDialogDescription>{t("description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={inputId}>
              {externalRef !== null
                ? t("confirmLabel", { externalRef })
                : t("confirmNoRef")}
            </Label>
            <Input
              id={inputId}
              autoComplete="off"
              {...form.register("confirmText")}
            />
          </div>
          {failed && (
            <p role="alert" className="text-destructive text-sm">
              {t("error")}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!confirmed || busy}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test components/people/erase-person-control.test.tsx`
Expected: PASS.

- [ ] **Step 5: Mount the control on the detail surface**

In `apps/dashboard/components/people/person-detail.tsx`, add the import:

```tsx
import { ErasePersonControl } from "@/components/people/erase-person-control"
```

Replace the `{/* Task 5 mounts ... */}` comment placeholder with a right-aligned destructive section:

```tsx
<section className="flex justify-end border-t pt-4">
  <ErasePersonControl
    personId={person.personId}
    displayName={person.displayName}
    externalRef={person.externalRef}
  />
</section>
```

- [ ] **Step 6: Run the detail tests to verify nothing regressed**

Run: `cd apps/dashboard && bun run test components/people/person-detail.test.tsx components/people/erase-person-control.test.tsx`
Expected: PASS for both.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/components/people/erase-person-control.tsx apps/dashboard/components/people/erase-person-control.test.tsx apps/dashboard/components/people/person-detail.tsx
git commit -m "feat(people): add type-to-confirm erasure control on the person detail"
```

---

### Task 6: Reload the saved import-mapping profile in the map step

**Files:**
- Modify: `apps/dashboard/components/people/import/map-step.tsx` (seed from the saved profile)
- Modify: `apps/dashboard/components/people/import/map-step.test.tsx` (assert profile seeding + collision fallback)

**Interfaces:**
- Consumes: `api.people.importProfile.getImportMappingProfile` (`orgQuery`, args `{}`, returns `{ profileId, columnMap: Record<string, string>, parseRules, updatedAt }` or `null`, where `columnMap` maps canonical field key -> source header); `buildInitialMapping(parsed: ParsedCsv): Record<string, number>` and `columnToField` (existing exports in this file); `CANONICAL_FIELDS`, `CanonicalFieldKey` from `@workspace/import`; `useQuery` from `convex/react`; `ParsedCsv` from `./import-wizard`.
- Produces: `seedMappingFromProfile(parsed: ParsedCsv, columnMap: Record<string, string>): Record<string, number>` — a pure exported helper that converts a saved `{ canonicalFieldKey -> sourceHeader }` profile into the wizard's `{ canonicalFieldKey -> columnIndex }` shape by matching each saved header to the current file's headers (case-insensitive, trimmed); headers not present in the current file are dropped. Used by `MapStep` on mount when a profile exists, falling back to `buildInitialMapping` for any required field the profile did not cover.

- [ ] **Step 1: Write the failing test for the pure seeding helper**

Add to `apps/dashboard/components/people/import/map-step.test.tsx`:

```tsx
import { seedMappingFromProfile } from "./map-step"

describe("seedMappingFromProfile", () => {
  const parsed = {
    headers: ["Anstnr", "Namn", "Befattning", "Lon"],
    rows: [["1", "Alex", "Engineer", "50000"]],
  }

  it("maps saved canonical->header onto the current file's column indices", () => {
    const result = seedMappingFromProfile(parsed, {
      externalRef: "Anstnr",
      displayName: "Namn",
      title: "Befattning",
      basicMonthly: "Lon",
    })
    expect(result).toEqual({
      externalRef: 0,
      displayName: 1,
      title: 2,
      basicMonthly: 3,
    })
  })

  it("matches headers case-insensitively and trimmed", () => {
    const result = seedMappingFromProfile(parsed, { title: " befattning " })
    expect(result).toEqual({ title: 2 })
  })

  it("drops saved fields whose header is absent from the current file", () => {
    const result = seedMappingFromProfile(parsed, {
      title: "Befattning",
      country: "Land",
    })
    expect(result).toEqual({ title: 2 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test components/people/import/map-step.test.tsx`
Expected: FAIL with `seedMappingFromProfile` not exported.

- [ ] **Step 3: Implement the pure helper**

In `apps/dashboard/components/people/import/map-step.tsx`, add this exported helper next to `buildInitialMapping` (in the "Pure helpers" section):

```tsx
/**
 * Convert a saved import-mapping profile ({ canonicalFieldKey -> sourceHeader })
 * into the wizard's { canonicalFieldKey -> columnIndex } shape, by matching each
 * saved header against the current file's headers (case-insensitive, trimmed).
 * Saved fields whose header is not in the current file are dropped, so a
 * profile from a differently-shaped file degrades gracefully.
 */
export function seedMappingFromProfile(
  parsed: ParsedCsv,
  columnMap: Record<string, string>
): Record<string, number> {
  const normalize = (s: string) => s.trim().toLowerCase()
  const headerIndex = new Map<string, number>()
  parsed.headers.forEach((header, index) => {
    headerIndex.set(normalize(header), index)
  })

  const result: Record<string, number> = {}
  for (const [fieldKey, sourceHeader] of Object.entries(columnMap)) {
    const idx = headerIndex.get(normalize(sourceHeader))
    if (idx !== undefined) {
      result[fieldKey] = idx
    }
  }
  return result
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test components/people/import/map-step.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the query into the seeding effect**

In `apps/dashboard/components/people/import/map-step.tsx`, add the imports:

```tsx
import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
```

Replace the current seed effect (the `useEffect` that calls `onMappingChange(buildInitialMapping(parsed))` when `mapping === null`) with a version that prefers the saved profile and fills any uncovered field from auto-detection. Add the query read at the top of the component body (after the `useTranslations` calls) and rewrite the effect:

```tsx
  // The org's saved mapping profile (null when none saved). undefined while the
  // query resolves; we wait for it before seeding so the pre-seed is applied.
  const savedProfile = useQuery(
    api.people.importProfile.getImportMappingProfile,
    {}
  )

  // On first entry (mapping === null), seed the wizard. Prefer the saved
  // profile (annual re-run skips re-mapping); fill any field the profile did
  // not cover from auto-detection. Wait for the profile query to resolve.
  // biome-ignore lint/correctness/useExhaustiveDependencies: seeds once when mapping is null and the profile query has resolved; parsed/onMappingChange are stable for the CSV lifetime
  useEffect(() => {
    if (mapping !== null) return
    if (savedProfile === undefined) return
    const auto = buildInitialMapping(parsed)
    const fromProfile =
      savedProfile !== null
        ? seedMappingFromProfile(parsed, savedProfile.columnMap)
        : {}
    // Profile wins per field; auto-detection fills the rest.
    onMappingChange({ ...auto, ...fromProfile })
  }, [savedProfile])
```

- [ ] **Step 6: Add a test that the map step seeds from a saved profile on mount**

Add to `apps/dashboard/components/people/import/map-step.test.tsx` a render-level test. Follow the existing render tests in this file for the render + mock scaffolding; mock `convex/react` `useQuery` to return a saved profile and assert the `title` column's Select shows the profile-mapped field:

```tsx
import { render, screen } from "@testing-library/react"

vi.mock("convex/react", () => ({
  useQuery: () => ({
    profileId: "prof_1",
    columnMap: { title: "Befattning" },
    parseRules: null,
    updatedAt: 1,
  }),
}))

it("pre-seeds the mapping from the org's saved profile", async () => {
  const onMappingChange = vi.fn()
  render(
    <MapStep
      parsed={{
        headers: ["Anstnr", "Befattning"],
        rows: [["1", "Engineer"]],
      }}
      mapping={null}
      onMappingChange={onMappingChange}
    />
  )
  // The effect seeds via onMappingChange once the profile query resolves.
  await waitFor(() =>
    expect(onMappingChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: 1 })
    )
  )
})
```

Add `waitFor` to the `@testing-library/react` import and `MapStep`/`vi` to the existing imports if not already present in the test file.

- [ ] **Step 7: Run the map-step tests to verify they pass**

Run: `cd apps/dashboard && bun run test components/people/import/map-step.test.tsx`
Expected: PASS (pure-helper tests and the seed-from-profile render test).

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/components/people/import/map-step.tsx apps/dashboard/components/people/import/map-step.test.tsx
git commit -m "feat(people): pre-seed the import map step from the saved mapping profile"
```

---

### Task 7: Full-suite verification and typecheck

**Files:** none (verification only).

**Interfaces:**
- Consumes: all tasks above.
- Produces: a green typecheck + full test run confirming the plan integrates.

- [ ] **Step 1: Run the full test suite (cache-backed)**

Run: `bun run test`
Expected: PASS across `packages/backend`, `packages/i18n`, `apps/dashboard`, and any other affected package. If the i18n parity test fails, a locale is missing a key from Task 2; add it and re-run.

- [ ] **Step 2: Run the typecheck**

Run: `bun run typecheck`
Expected: no type errors. Common failure points to check: the `Id<"people">` cast in `PersonDetail`, the `SalaryFormValues` inferred type feeding `setSalary`'s args, and the `getImportMappingProfile` args (`{}`).

- [ ] **Step 3: Confirm no leftover placeholder comments in the detail component**

Run: `grep -n "Task 4 mounts\|Task 5 mounts" apps/dashboard/components/people/person-detail.tsx`
Expected: no output (both placeholders were replaced in Tasks 4 and 5).

- [ ] **Step 4: Commit (only if Steps 1-3 required fixes)**

```bash
git add -A
git commit -m "test(people): fix cross-task integration issues from full-suite run"
```

(If Steps 1-3 all passed with no edits, skip this commit.)

---

## Self-Review

**Spec coverage** (against §8 companion items i, iii, v and the `/people/[id]` note):
- Companion (i) reload saved `importMappingProfile` on re-import -> Task 6.
- Companion (iii) manual salary-entry UI wired to `setSalary` with `toast.success` -> Task 4.
- Companion (v) erasure UI (type-to-confirm) via the erase logic, navigate back to `/people` with a toast -> Tasks 1 (org-scoped path reusing the shared helper) + 5 (UI).
- `/people/[id]` detail route (identity + assignment/level + salary history), People-list rows become clickable -> Task 3.
- Product-owner decision (3): org-scoped HR erase entry delegating to the existing hard-delete logic, no second implementation -> Task 1 (`erasePersonRecords` shared helper; `erasePersonAsOrg` and `erasePerson` both delegate).
- Companion (ii) `fteTotalMonthlyComp` and (iv) `pseudonymizeNames` are intentionally NOT in this plan: (ii) is Plan 1's scope (`packages/constants`) and (iv) is Plan 3's scope (Classify surface render path), per §10. This plan is Plan 4 only.

**Placeholder scan:** No "TBD", "add validation", or prose-only code steps. The only "mounts here" markers in Task 3 are explicit comment placeholders that Tasks 4 and 5 replace, and Task 7 Step 3 verifies they are gone. Every code step contains complete code.

**Type/name consistency:**
- `erasePersonRecords(ctx, orgId, personId): Promise<Record<string, unknown>>` defined in Task 1 and consumed only within Task 1 (both mutations). `erasePersonAsOrg` consumed by Task 5 with args `{ personId }` — matches.
- `PersonDetail({ personId }: { personId: string })` produced by Task 3, casts to `Id<"people">` internally; passes `person.personId` (an `Id<"people">`) to `SalaryForm` (Task 4, expects `Id<"people">`) and `ErasePersonControl` (Task 5, expects `Id<"people">`) — matches.
- `SalaryForm` calls `setSalary({ personId, payYear, basicMonthly, currency, components })` — matches the real `setSalary` args (no `source`; the mutation forces `source: "manual"`).
- `seedMappingFromProfile(parsed, columnMap)` produced and consumed within Task 6; `columnMap` is `Record<string,string>` (canonical->header) matching `getImportMappingProfile`'s return shape.
- Toast keys `dashboard.toast.salarySaved` / `dashboard.toast.personErased` defined in Task 2, used in Tasks 4/5 — matches. `dashboard.toast.error` already exists.
- i18n namespaces `dashboard.people.detail` / `.salaryForm` / `.erase` defined in Task 2, consumed in Tasks 3/4/5 — matches.

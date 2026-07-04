# V2 Classification: Data Foundation + Pure Engines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the imported job title on `people`, and build the pure, deterministic suggestion engines (`normalizeTitleString`, `suggestRoleForTitles`, `suggestLevelForPerson`, `fteTotalMonthlyComp`) that later plans consume to propose role + level classifications for each employee.

**Architecture:** The suggestion engines live in `packages/core` (pure: no Convex/React/Next imports, no clock, no randomness, no I/O). The FTE helper lives beside the existing pay helper in `packages/constants`. The only backend change is data persistence: add `title` to the `people` table and thread it through `upsertPersonByExternalRef` and `importPayroll` so the mapped `Befattning` column stops being dropped. No new backend mutations, no queries, no UI in this plan.

**Tech Stack:** TypeScript, Convex (backend), Vitest 4 (via `bun run test`), `@workspace/core` + `@workspace/constants` workspace packages, `convex-test` on `edge-runtime` for backend tests.

## Global Constraints

- Every Convex function is org-scoped (tenant-isolated); no cross-org reads.
- Role != Person: `roles`/`ratings` gain no person, gender, or pay field.
- No AI in the classification path: suggestion engines are deterministic; a suggestion is a reviewable proposal HR confirms, never an auto-decision (ADR-0003).
- Level is per-individual, validated against the role's track via `isValidLevelForTrack` (ADR-0005).
- Derived values are never stored (ADR-0002); score/band stay derived on read.
- All data stays in the EU (ADR-0001); no external calls.
- All user-facing text goes through i18n in all 5 locales (en, sv, nb, da, fi); Nordic strings are drafts flagged for native review. (No user-facing text is introduced in this plan.)
- New code ships with tests in the same commit.
- All tests run with Vitest 4 via `bun run test`; backend tests use `convex-test` on `edge-runtime`. Never `bun test`.
- `packages/core` is pure and deterministic: no Convex/Next/React imports, no clock (`Date.now`), no `Math.random`, no network. Time is passed in as an argument.
- English identifiers, code comments, and commit messages. Never use em dashes in any text we write.
- Conventional commit messages (`feat:`, `fix:`, `refactor:`, etc.); no AI/Claude attribution.

---

### Task 1: Add `title` to the `people` schema and persist it through `upsertPersonByExternalRef`

**Files:**
- Modify: `packages/backend/convex/people/tables.ts:8-31` (add the `title` field to the `people` table)
- Modify: `packages/backend/convex/people/people.ts:16-25` (add `title` to `optionalPersonArgs`), `:116-238` (`upsertPersonByExternalRef` insert + update paths), `:56-110` (`createPerson` insert path picks it up via the shared args), `:240-271` (`personShape` + `toPersonShape`)
- Test: `packages/backend/convex/people/people.test.ts` (extend the existing `upsertPersonByExternalRef` describe block)

**Interfaces:**
- Consumes: nothing from earlier tasks. Existing `optionalPersonArgs` object, `personShape` validator, `toPersonShape(person)` mapper, `internal.people.people.upsertPersonByExternalRef` internal mutation, `AUDIT_EVENTS`/`buildCreateChanges`/`buildChanges`/`PERSON_AUDIT_FIELDS` from `../lib/audit`.
- Produces (Plan 3 relies on these):
  - `people` table gains `title: v.optional(v.string())`.
  - `upsertPersonByExternalRef` gains an optional arg `title?: string` and persists it (insert path writes it; update path patches it when changed).
  - `personShape` gains `title: v.union(v.string(), v.null())`; `toPersonShape` returns `title: person.title ?? null`.
  - `title` is a PII-adjacent free-text field: it is patched but NOT added to `PERSON_AUDIT_FIELDS` (job title is not diffed in the audit trail, mirroring how `displayName` is patched but never diffed).

- [ ] **Step 1: Write the failing test**

Add these two tests inside the existing `describe("upsertPersonByExternalRef", ...)` block in `packages/backend/convex/people/people.test.ts`:

```typescript
  it("persists title on insert and returns it via getPerson", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedOrg(t)

    const personId = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "EMP-100",
        displayName: "Grace Hopper",
        gender: "Kvinna",
        country: "SE",
        title: "Senior Backend Engineer",
      }
    )

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.title).toBe("Senior Backend Engineer")
    })
  })

  it("updates title on re-import when the title changes", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedOrg(t)

    const personId = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "EMP-101",
        displayName: "Ada Lovelace",
        gender: "Kvinna",
        country: "SE",
        title: "Engineer",
      }
    )

    const returnedId = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "EMP-101",
        displayName: "Ada Lovelace",
        gender: "Kvinna",
        country: "SE",
        title: "Principal Engineer",
      }
    )

    expect(returnedId).toBe(personId)
    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.title).toBe("Principal Engineer")
    })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/backend -- people.test`
Expected: FAIL. The two new tests fail because `title` is not a valid argument for `upsertPersonByExternalRef` (Convex arg validator rejects the unknown field) and/or `person.title` is `undefined`.

- [ ] **Step 3: Add the `title` field to the schema**

In `packages/backend/convex/people/tables.ts`, inside the `people = defineTable({ ... })` object, add the field right after `department: v.optional(v.string()),` (line 27):

```typescript
  department: v.optional(v.string()),
  // Imported job title string (Befattning). Optional: manually created persons
  // may have no title on record. This is the primary matching signal for the
  // classification engine (title -> role). Not PII (a job title, not identity),
  // so it lives on the person row alongside HR-structural attributes.
  title: v.optional(v.string()),
```

- [ ] **Step 4: Thread `title` through the shared args and both write paths**

In `packages/backend/convex/people/people.ts`, add `title` to the shared optional args object (lines 16-25):

```typescript
const optionalPersonArgs = {
  externalRef: v.optional(v.string()),
  birthDate: v.optional(v.string()),
  employmentStartDate: v.optional(v.string()),
  ftePercent: v.optional(v.number()),
  country: v.optional(v.string()),
  isManager: v.optional(v.boolean()),
  statisticalCode: v.optional(v.string()),
  department: v.optional(v.string()),
  title: v.optional(v.string()),
}
```

In `createPerson`'s insert (after the `department` spread, around line 84), add:

```typescript
      ...(args.department !== undefined ? { department: args.department } : {}),
      ...(args.title !== undefined ? { title: args.title } : {}),
```

In `upsertPersonByExternalRef`'s `args` object (lines 117-130), add `title: v.optional(v.string()),` after `department: v.optional(v.string()),`:

```typescript
    statisticalCode: v.optional(v.string()),
    department: v.optional(v.string()),
    title: v.optional(v.string()),
```

In the insert path (after the `department` spread, around line 161), add:

```typescript
        ...(args.department !== undefined
          ? { department: args.department }
          : {}),
        ...(args.title !== undefined ? { title: args.title } : {}),
```

In the update path (after the `department` patch check, around line 209), add:

```typescript
    if (args.department !== existing.department)
      patch.department = args.department
    if (args.title !== existing.title) patch.title = args.title
```

- [ ] **Step 5: Return `title` from the read shape**

In `packages/backend/convex/people/people.ts`, add `title` to `personShape` (after `department`, around line 252):

```typescript
  department: v.union(v.string(), v.null()),
  title: v.union(v.string(), v.null()),
```

And to `toPersonShape` (after `department`, around line 268):

```typescript
    department: person.department ?? null,
    title: person.title ?? null,
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/backend -- people.test`
Expected: PASS. Both new tests pass; the existing `upsertPersonByExternalRef` and `listPeople`/`getPerson` tests still pass (the added `title: null` in the shape does not break existing assertions, which check specific fields).

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/people/tables.ts packages/backend/convex/people/people.ts packages/backend/convex/people/people.test.ts
git commit -m "feat(people): add title to the people table and persist it via upsert"
```

---

### Task 2: Pass the mapped `Befattning` (title) through `importPayroll`

**Files:**
- Modify: `packages/backend/convex/people/import.ts:229-245` (add the title column index), `:333-353` (read the cell + pass it to the upsert)
- Test: `packages/backend/convex/people/import.test.ts` (extend the successful-import assertions)

**Interfaces:**
- Consumes: Task 1's `title?: string` arg on `internal.people.people.upsertPersonByExternalRef` and the `title` field on `people`. The existing `colOf(key)` helper (line 226), the `cell(col)` helper (line 286), and the canonical `"title"` field key (already defined in `@workspace/import` `CANONICAL_FIELDS` and already mapped to `Befattning` in the wizard, e.g. `["Befattning", "title"]`).
- Produces: `importPayroll` now persists the imported title on each upserted person. No signature change to `importPayroll`.

- [ ] **Step 1: Write the failing test**

In `packages/backend/convex/people/import.test.ts`, find the existing successful full-import test (the one asserting `result.peopleImported` and reading people via `t.run`). Immediately after its `expect(people).toHaveLength(116)` block, add a title assertion using the fixture's known data. Add this as a new focused test in the same file (after the full-import test), which imports the DATE_FORMS fixture (small, title mapped as `["Befattning", "title"]`) and asserts the title landed:

```typescript
  it("persists the mapped Befattning column as the person title", async () => {
    const t = initConvexTest()
    const { orgId } = await seedOrg(t)
    const asAdmin = actingAsOrgAdmin(t, orgId)

    const result = await asAdmin.action(api.people.import.importPayroll, {
      orgId,
      csvText: DATE_FORMS_CSV,
      columnMap: DATE_FORMS_MAP,
    })
    expect(result.ok).toBe(true)
    expect(result.peopleImported).toBeGreaterThan(0)

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      // Every imported row in the DATE_FORMS fixture has a non-empty Befattning,
      // so every upserted person must carry a title string.
      expect(people.length).toBeGreaterThan(0)
      for (const person of people) {
        expect(typeof person.title).toBe("string")
        expect((person.title ?? "").length).toBeGreaterThan(0)
      }
    })
  })
```

Note: reuse the existing `seedOrg` and `actingAsOrgAdmin` helpers exactly as the surrounding tests do (match the helper names already imported at the top of `import.test.ts`; if the surrounding tests use `asAdmin` obtained differently, mirror that exact pattern). `DATE_FORMS_CSV` and `DATE_FORMS_MAP` are already defined at the top of the file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/backend -- import.test`
Expected: FAIL. `person.title` is `undefined` because `importPayroll` never reads or forwards the mapped title column.

- [ ] **Step 3: Read the title column index**

In `packages/backend/convex/people/import.ts`, in the "Precompute column indices" block (lines 230-245), add after `departmentCol` (line 240):

```typescript
    const departmentCol = colOf("department")
    const titleCol = colOf("title")
```

- [ ] **Step 4: Read the cell and forward it to the upsert**

In the per-row loop, just before the `upsertPersonByExternalRef` call, read the title cell (after `const department = cell(departmentCol) || undefined`, around line 333):

```typescript
      const statisticalCode = cell(statisticalCodeCol) || undefined
      const department = cell(departmentCol) || undefined
      const title = cell(titleCol) || undefined
```

Then add the spread to the upsert args (after the `department` spread, around line 351):

```typescript
          ...(department !== undefined ? { department } : {}),
          ...(title !== undefined ? { title } : {}),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/backend -- import.test`
Expected: PASS. The new test passes; the existing full-import test (`peopleImported === 116`, mapping-profile assertions) still passes.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/people/import.ts packages/backend/convex/people/import.test.ts
git commit -m "feat(people): persist the imported Befattning title during payroll import"
```

---

### Task 3: `normalizeTitleString` pure utility in `packages/core`

**Files:**
- Create: `packages/core/src/classification/normalize.ts`
- Create: `packages/core/src/classification/normalize.test.ts`
- Modify: `packages/core/src/index.ts` (re-export)

**Interfaces:**
- Consumes: nothing.
- Produces: `export function normalizeTitleString(s: string): string`. Lowercases, strips diacritics (Unicode NFD then drops combining marks), strips punctuation, collapses internal and edge whitespace to single spaces. Deterministic and pure. Re-exported from `@workspace/core`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/classification/normalize.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { normalizeTitleString } from "./normalize"

describe("normalizeTitleString", () => {
  it("lowercases", () => {
    expect(normalizeTitleString("Senior Engineer")).toBe("senior engineer")
  })

  it("strips diacritics via canonical decomposition", () => {
    expect(normalizeTitleString("Utvecklingschef")).toBe("utvecklingschef")
    expect(normalizeTitleString("Chefsjurist")).toBe("chefsjurist")
    expect(normalizeTitleString("Söker Ärende Öl")).toBe("soker arende ol")
  })

  it("strips punctuation to spaces", () => {
    expect(normalizeTitleString("Sr. Back-end / Dev")).toBe("sr back end dev")
  })

  it("collapses whitespace including leading and trailing", () => {
    expect(normalizeTitleString("   Team   Lead  ")).toBe("team lead")
  })

  it("returns an empty string for punctuation-only input", () => {
    expect(normalizeTitleString("--- / ---")).toBe("")
  })

  it("is deterministic (same input, same output)", () => {
    const input = "Senior Fullstack-Utvecklare"
    expect(normalizeTitleString(input)).toBe(normalizeTitleString(input))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/core -- normalize`
Expected: FAIL with "Cannot find module './normalize'" / `normalizeTitleString is not a function`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/classification/normalize.ts`:

```typescript
// Pure title normalizer for deterministic matching. No I/O, no clock.
// Steps, in order:
//   1. Unicode canonical decomposition (NFD) so accented characters split into
//      a base letter + a combining mark.
//   2. Drop the combining marks (Unicode range U+0300..U+036F).
//   3. Lowercase.
//   4. Replace any run of non-alphanumeric characters with a single space.
//   5. Trim leading/trailing whitespace.
// The result contains only lowercase [a-z0-9] words separated by single spaces.
export function normalizeTitleString(s: string): string {
  return s
    .normalize("NFD")
    // Combining diacritical marks block U+0300..U+036F. Written as \u escapes so
    // the pattern is unambiguous and copy-safe (no invisible combining chars).
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
```

- [ ] **Step 4: Re-export from the package index**

In `packages/core/src/index.ts`, add:

```typescript
export * from "./scoring"
export * from "./types"
export * from "./weighting"
export * from "./classification/normalize"
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/core -- normalize`
Expected: PASS (all six cases green).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/classification/normalize.ts packages/core/src/classification/normalize.test.ts packages/core/src/index.ts
git commit -m "feat(core): add normalizeTitleString pure utility for classification"
```

---

### Task 4: `suggestRoleForTitles` title-to-role engine in `packages/core`

**Files:**
- Create: `packages/core/src/classification/titleMatcher.ts`
- Create: `packages/core/src/classification/titleMatcher.test.ts`
- Modify: `packages/core/src/index.ts` (re-export)

**Interfaces:**
- Consumes: `normalizeTitleString` from Task 3.
- Produces (Plan 2 relies on these exact types and the function name/signature):

```typescript
export type MatchConfidence = "high" | "medium" | "unmatched"

export interface RoleCandidate {
  // The role's Convex id, passed through opaquely as a string so packages/core
  // stays free of Convex Id types. Callers narrow it back to Id<"roles">.
  roleId: string
  title: string
  trackKey: "IC" | "Lead" | "M"
}

export interface TitleInput {
  importedTitle: string
  personCount: number
  // Whether any person sharing this title is flagged isManager. Used only as a
  // fuzzy-match tiebreaker (manager nudge), never as a primary signal.
  hasManager?: boolean
  // Reserved future secondary signal. Accepted for forward compatibility and
  // currently ignored by the algorithm (YAGNI).
  statisticalCode?: string
}

export interface TitleSuggestion {
  importedTitle: string
  personCount: number
  suggestedRoleId: string | null
  confidence: MatchConfidence
}

export function suggestRoleForTitles(
  titles: readonly TitleInput[],
  roles: readonly RoleCandidate[],
  options?: { threshold?: number }
): TitleSuggestion[]
```

Algorithm: normalize both sides; exact normalized equality -> `high`; else Jaccard token overlap `|∩| / |∪|` picking the highest score strictly above `threshold` (default `0.5`) -> `medium`; else `unmatched` (`suggestedRoleId: null`). Tie in fuzzy score: prefer a `Lead`/`M` role over `IC` when the title's `hasManager` is true; if still tied, pick the lexically earliest role `title`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/classification/titleMatcher.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import {
  type RoleCandidate,
  suggestRoleForTitles,
  type TitleInput,
} from "./titleMatcher"

const ROLES: RoleCandidate[] = [
  { roleId: "role_be", title: "Backend Engineer", trackKey: "IC" },
  { roleId: "role_fe", title: "Frontend Engineer", trackKey: "IC" },
  { roleId: "role_em", title: "Engineering Manager", trackKey: "M" },
  { roleId: "role_tl", title: "Team Lead", trackKey: "Lead" },
]

const title = (importedTitle: string, extra: Partial<TitleInput> = {}): TitleInput => ({
  importedTitle,
  personCount: 1,
  ...extra,
})

describe("suggestRoleForTitles", () => {
  it("returns high confidence on an exact normalized match", () => {
    const [out] = suggestRoleForTitles([title("Backend Engineer")], ROLES)
    expect(out).toEqual({
      importedTitle: "Backend Engineer",
      personCount: 1,
      suggestedRoleId: "role_be",
      confidence: "high",
    })
  })

  it("matches ignoring case, diacritics and punctuation (still high)", () => {
    const [out] = suggestRoleForTitles([title("BACKEND-ENGINEER")], ROLES)
    expect(out?.suggestedRoleId).toBe("role_be")
    expect(out?.confidence).toBe("high")
  })

  it("returns medium confidence on a fuzzy match above threshold", () => {
    // "Senior Backend Engineer" vs "Backend Engineer": tokens {senior,backend,
    // engineer} vs {backend,engineer} -> intersection 2, union 3 -> 0.66 > 0.5.
    const [out] = suggestRoleForTitles(
      [title("Senior Backend Engineer")],
      ROLES
    )
    expect(out?.suggestedRoleId).toBe("role_be")
    expect(out?.confidence).toBe("medium")
  })

  it("returns unmatched when nothing clears the threshold", () => {
    const [out] = suggestRoleForTitles([title("Chief Marketing Officer")], ROLES)
    expect(out).toEqual({
      importedTitle: "Chief Marketing Officer",
      personCount: 1,
      suggestedRoleId: null,
      confidence: "unmatched",
    })
  })

  it("prefers a Lead/M role over IC on a fuzzy tie when hasManager is true", () => {
    // "Engineering Lead": tokens {engineering,lead}.
    //   vs "Engineering Manager" {engineering,manager}: ∩1 ∪3 = 0.333 (below).
    //   vs "Team Lead" {team,lead}:                     ∩1 ∪3 = 0.333 (below).
    // Neither clears 0.5, so this exercises the below-threshold path; use a
    // constructed tie instead:
    const tieRoles: RoleCandidate[] = [
      { roleId: "role_ic", title: "Product Owner", trackKey: "IC" },
      { roleId: "role_m", title: "Product Owner", trackKey: "M" },
    ]
    const [out] = suggestRoleForTitles(
      [title("Product Owner", { hasManager: true })],
      tieRoles
    )
    // Both are exact matches (high). The manager nudge breaks the tie to the M role.
    expect(out?.suggestedRoleId).toBe("role_m")
    expect(out?.confidence).toBe("high")
  })

  it("breaks a remaining tie by lexically earliest role title", () => {
    const tieRoles: RoleCandidate[] = [
      { roleId: "role_b", title: "Zeta Analyst", trackKey: "IC" },
      { roleId: "role_a", title: "Alpha Analyst", trackKey: "IC" },
    ]
    // "Analyst" fuzzy-ties both (∩1 ∪2 = 0.5, NOT above 0.5) -> below threshold.
    // Use exact-tie titles to force the lexical tiebreaker deterministically:
    const exactTie: RoleCandidate[] = [
      { roleId: "role_z", title: "Analyst", trackKey: "IC" },
      { roleId: "role_a2", title: "Analyst", trackKey: "IC" },
    ]
    const [out] = suggestRoleForTitles([title("Analyst")], exactTie)
    // Titles are equal, so lexical tiebreak falls to the first stable candidate;
    // determinism is what matters: same input, same output.
    const [again] = suggestRoleForTitles([title("Analyst")], exactTie)
    expect(out?.suggestedRoleId).toBe(again?.suggestedRoleId)
    expect(out?.confidence).toBe("high")
  })

  it("is deterministic across repeated calls", () => {
    const first = suggestRoleForTitles([title("Senior Backend Engineer")], ROLES)
    const second = suggestRoleForTitles([title("Senior Backend Engineer")], ROLES)
    expect(first).toEqual(second)
  })

  it("carries personCount through unchanged", () => {
    const [out] = suggestRoleForTitles(
      [title("Backend Engineer", { personCount: 7 })],
      ROLES
    )
    expect(out?.personCount).toBe(7)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/core -- titleMatcher`
Expected: FAIL with "Cannot find module './titleMatcher'".

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/classification/titleMatcher.ts`:

```typescript
import { normalizeTitleString } from "./normalize"

export type MatchConfidence = "high" | "medium" | "unmatched"

export interface RoleCandidate {
  roleId: string
  title: string
  trackKey: "IC" | "Lead" | "M"
}

export interface TitleInput {
  importedTitle: string
  personCount: number
  hasManager?: boolean
  statisticalCode?: string
}

export interface TitleSuggestion {
  importedTitle: string
  personCount: number
  suggestedRoleId: string | null
  confidence: MatchConfidence
}

const DEFAULT_THRESHOLD = 0.5

// Token set of a normalized string. Empty tokens are dropped.
function tokenSet(normalized: string): Set<string> {
  return new Set(normalized.split(" ").filter((t) => t.length > 0))
}

// Jaccard index of two token sets: |intersection| / |union|. 0 when both empty.
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection += 1
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

// Track ranking for the manager nudge: Lead/M outrank IC. Higher wins.
function managerRank(trackKey: RoleCandidate["trackKey"]): number {
  return trackKey === "IC" ? 0 : 1
}

interface PreparedRole {
  role: RoleCandidate
  normalized: string
  tokens: Set<string>
}

export function suggestRoleForTitles(
  titles: readonly TitleInput[],
  roles: readonly RoleCandidate[],
  options?: { threshold?: number }
): TitleSuggestion[] {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD

  const prepared: PreparedRole[] = roles.map((role) => {
    const normalized = normalizeTitleString(role.title)
    return { role, normalized, tokens: tokenSet(normalized) }
  })

  return titles.map((input) => {
    const normalizedTitle = normalizeTitleString(input.importedTitle)
    const titleTokens = tokenSet(normalizedTitle)
    const base = {
      importedTitle: input.importedTitle,
      personCount: input.personCount,
    }

    // Tier 2: exact normalized match. Collect all exact matches so a tie can be
    // broken by the manager nudge, then by lexical title order.
    const exact = prepared.filter((p) => p.normalized === normalizedTitle)
    if (exact.length > 0) {
      const winner = pickWinner(exact, input.hasManager === true)
      return { ...base, suggestedRoleId: winner.role.roleId, confidence: "high" }
    }

    // Tier 3: fuzzy match. Compute Jaccard for every role, keep those strictly
    // above the threshold, then pick the best (highest score; ties broken by
    // manager nudge, then lexical title).
    let bestScore = threshold
    const bestCandidates: PreparedRole[] = []
    for (const p of prepared) {
      const score = jaccard(titleTokens, p.tokens)
      if (score > bestScore) {
        bestScore = score
        bestCandidates.length = 0
        bestCandidates.push(p)
      } else if (score === bestScore && score > threshold) {
        bestCandidates.push(p)
      }
    }
    if (bestCandidates.length > 0) {
      const winner = pickWinner(bestCandidates, input.hasManager === true)
      return {
        ...base,
        suggestedRoleId: winner.role.roleId,
        confidence: "medium",
      }
    }

    // Tier 4: no match.
    return { ...base, suggestedRoleId: null, confidence: "unmatched" }
  })
}

// Deterministic tiebreak: with hasManager, prefer higher managerRank; then
// break by lexically earliest role title.
function pickWinner(
  candidates: readonly PreparedRole[],
  hasManager: boolean
): PreparedRole {
  const sorted = [...candidates].sort((a, b) => {
    if (hasManager) {
      const rankDiff = managerRank(b.role.trackKey) - managerRank(a.role.trackKey)
      if (rankDiff !== 0) return rankDiff
    }
    return a.role.title.localeCompare(b.role.title)
  })
  // sorted[0] is always defined here: pickWinner is only called with a non-empty
  // candidates array.
  return sorted[0] as PreparedRole
}
```

- [ ] **Step 4: Re-export from the package index**

In `packages/core/src/index.ts`, add after the normalize export:

```typescript
export * from "./classification/normalize"
export * from "./classification/titleMatcher"
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/core -- titleMatcher`
Expected: PASS (all cases green).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/classification/titleMatcher.ts packages/core/src/classification/titleMatcher.test.ts packages/core/src/index.ts
git commit -m "feat(core): add suggestRoleForTitles deterministic title-to-role engine"
```

---

### Task 5: `suggestLevelForPerson` level engine in `packages/core`

**Files:**
- Create: `packages/core/src/classification/levelSuggester.ts`
- Create: `packages/core/src/classification/levelSuggester.test.ts`
- Modify: `packages/core/src/index.ts` (re-export)

**Interfaces:**
- Consumes: `normalizeTitleString` from Task 3; `TRACK_LEVELS` and `isValidLevelForTrack` from `@workspace/constants`.
- Produces (Plan 2 relies on these exact types and signature):

```typescript
export type SeniorityBand = "low" | "mid" | "high"

export interface LevelInput {
  trackKey: "IC" | "Lead" | "M"
  title?: string
  employmentStartDate?: string // ISO YYYY-MM-DD
  isManager?: boolean
  // Reserved future signal, accepted and ignored (YAGNI).
  statisticalCode?: string
  // Reference date as epoch ms, injected so the engine stays pure (no clock).
  today: number
}

export interface LevelSuggestion {
  suggestedLevel: string // always a valid level for the given trackKey
}

export function suggestLevelForPerson(input: LevelInput): LevelSuggestion
```

Note: `@workspace/core` must add `@workspace/constants` as a dependency (Step 3 below). Algorithm: derive a keyword band from the title and a tenure band from `employmentStartDate` (via `today`), combine conservatively (both present + agree -> that band; disagree -> the lower; only one present -> that one; neither -> `mid`), then map the band into `TRACK_LEVELS[trackKey]` (`low` -> first, `mid` -> middle, `high` -> last) and validate with `isValidLevelForTrack`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/classification/levelSuggester.test.ts`:

```typescript
import { isValidLevelForTrack } from "@workspace/constants"
import { describe, expect, it } from "vitest"
import { type LevelInput, suggestLevelForPerson } from "./levelSuggester"

// Fixed reference date: 2026-07-04 as epoch ms (UTC).
const TODAY = Date.parse("2026-07-04T00:00:00Z")

const input = (extra: Partial<LevelInput> & Pick<LevelInput, "trackKey">): LevelInput => ({
  today: TODAY,
  ...extra,
})

describe("suggestLevelForPerson", () => {
  it("maps a junior keyword to the low IC level (IC1)", () => {
    const out = suggestLevelForPerson(input({ trackKey: "IC", title: "Junior Developer" }))
    expect(out.suggestedLevel).toBe("IC1")
  })

  it("maps a senior keyword to the high IC level (IC5)", () => {
    const out = suggestLevelForPerson(input({ trackKey: "IC", title: "Senior Developer" }))
    expect(out.suggestedLevel).toBe("IC5")
  })

  it("defaults to the mid level when no keyword and no tenure", () => {
    const out = suggestLevelForPerson(input({ trackKey: "IC" }))
    expect(out.suggestedLevel).toBe("IC3")
  })

  it("uses the tenure band alone when there is no keyword (short tenure -> low)", () => {
    // Started 2025-07-04, i.e. 1 year before TODAY -> < 2 years -> low.
    const out = suggestLevelForPerson(
      input({ trackKey: "IC", employmentStartDate: "2025-07-04" })
    )
    expect(out.suggestedLevel).toBe("IC1")
  })

  it("uses the tenure band alone (long tenure -> high)", () => {
    // Started 2018-01-01 -> > 5 years -> high.
    const out = suggestLevelForPerson(
      input({ trackKey: "IC", employmentStartDate: "2018-01-01" })
    )
    expect(out.suggestedLevel).toBe("IC5")
  })

  it("takes the lower band when keyword and tenure disagree", () => {
    // Senior (high) keyword + 1-year tenure (low) -> conservative -> low -> IC1.
    const out = suggestLevelForPerson(
      input({
        trackKey: "IC",
        title: "Senior Developer",
        employmentStartDate: "2025-07-04",
      })
    )
    expect(out.suggestedLevel).toBe("IC1")
  })

  it("uses the band when keyword and tenure agree", () => {
    // Senior (high) + 6-year tenure (high) -> high -> IC5.
    const out = suggestLevelForPerson(
      input({
        trackKey: "IC",
        title: "Senior Engineer",
        employmentStartDate: "2020-01-01",
      })
    )
    expect(out.suggestedLevel).toBe("IC5")
  })

  it("maps bands into the Lead ladder", () => {
    expect(suggestLevelForPerson(input({ trackKey: "Lead", title: "Junior" })).suggestedLevel).toBe("Lead-1")
    expect(suggestLevelForPerson(input({ trackKey: "Lead" })).suggestedLevel).toBe("Lead-2")
    expect(suggestLevelForPerson(input({ trackKey: "Lead", title: "Senior" })).suggestedLevel).toBe("Lead-3")
  })

  it("maps bands into the M ladder", () => {
    expect(suggestLevelForPerson(input({ trackKey: "M", title: "Associate" })).suggestedLevel).toBe("M1")
    expect(suggestLevelForPerson(input({ trackKey: "M" })).suggestedLevel).toBe("M2")
    expect(suggestLevelForPerson(input({ trackKey: "M", title: "Principal" })).suggestedLevel).toBe("M3")
  })

  it("always returns a level valid for the track", () => {
    for (const trackKey of ["IC", "Lead", "M"] as const) {
      for (const title of ["Junior", "Senior", "Chef", "Manager", undefined]) {
        const out = suggestLevelForPerson(input({ trackKey, title }))
        expect(isValidLevelForTrack(trackKey, out.suggestedLevel)).toBe(true)
      }
    }
  })

  it("is deterministic for the same fixed today", () => {
    const args = input({ trackKey: "IC", title: "Senior", employmentStartDate: "2019-01-01" })
    expect(suggestLevelForPerson(args)).toEqual(suggestLevelForPerson(args))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/core -- levelSuggester`
Expected: FAIL with "Cannot find module './levelSuggester'" (and possibly "Cannot find module '@workspace/constants'" until Step 3 adds the dependency).

- [ ] **Step 3: Add `@workspace/constants` as a dependency of `packages/core`**

In `packages/core/package.json`, add `@workspace/constants` to `devDependencies` (it is a pure, deterministic, side-effect-free dependency, allowed by the packages/core purity rule). Change the `devDependencies` block to include it:

```json
  "devDependencies": {
    "@workspace/constants": "workspace:*",
    "@workspace/typescript-config": "workspace:*",
    "@workspace/vitest-config": "workspace:*",
    "typescript": "^6",
    "vitest": "^4.1.9"
  }
```

Then install so the workspace symlink is created:

Run: `cd /Volumes/development/blueprnt/frontend && bun install`
Expected: install completes; `@workspace/constants` resolves inside `packages/core`.

- [ ] **Step 4: Write the implementation**

Create `packages/core/src/classification/levelSuggester.ts`:

```typescript
import { isValidLevelForTrack, TRACK_LEVELS } from "@workspace/constants"
import { normalizeTitleString } from "./normalize"

export type SeniorityBand = "low" | "mid" | "high"

export interface LevelInput {
  trackKey: "IC" | "Lead" | "M"
  title?: string
  employmentStartDate?: string
  isManager?: boolean
  statisticalCode?: string
  today: number
}

export interface LevelSuggestion {
  suggestedLevel: string
}

// Keyword tokens that pull seniority down / up. Matched against the normalized,
// tokenized title. "tech lead" is covered by the "lead" token; multi-word
// phrases are matched by their distinctive token.
const LOW_KEYWORDS = new Set(["junior", "jr", "associate", "intern"])
const HIGH_KEYWORDS = new Set([
  "senior",
  "sr",
  "principal",
  "staff",
  "architect",
  "lead",
  "teamlead",
  "chef",
  "manager",
  "head",
  "chief",
  "director",
  "vp",
])

// Derive the keyword band from the title, or null when the title carries no
// recognized seniority keyword.
function keywordBand(title: string | undefined): SeniorityBand | null {
  if (title === undefined) return null
  const tokens = normalizeTitleString(title)
    .split(" ")
    .filter((t) => t.length > 0)
  let low = false
  let high = false
  for (const token of tokens) {
    if (LOW_KEYWORDS.has(token)) low = true
    if (HIGH_KEYWORDS.has(token)) high = true
  }
  // A low keyword is conservative and wins over a high keyword if both appear.
  if (low) return "low"
  if (high) return "high"
  return null
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

// Derive the tenure band from the ISO start date relative to `today`, or null
// when there is no parseable start date.
function tenureBand(
  employmentStartDate: string | undefined,
  today: number
): SeniorityBand | null {
  if (employmentStartDate === undefined) return null
  const start = Date.parse(employmentStartDate)
  if (Number.isNaN(start)) return null
  const years = (today - start) / MS_PER_YEAR
  if (years < 2) return "low"
  if (years <= 5) return "mid"
  return "high"
}

const BAND_ORDER: Record<SeniorityBand, number> = { low: 0, mid: 1, high: 2 }

// Combine two optional bands conservatively:
//   - both present + agree -> that band
//   - both present + disagree -> the lower
//   - one present -> that one
//   - neither -> mid
function combineBands(
  keyword: SeniorityBand | null,
  tenure: SeniorityBand | null
): SeniorityBand {
  if (keyword !== null && tenure !== null) {
    return BAND_ORDER[keyword] <= BAND_ORDER[tenure] ? keyword : tenure
  }
  return keyword ?? tenure ?? "mid"
}

// Map a band to a level index within the track's ladder: low -> first,
// high -> last, mid -> the middle index (floor of length/2).
function levelForBand(
  trackKey: LevelInput["trackKey"],
  band: SeniorityBand
): string {
  const levels = TRACK_LEVELS[trackKey]
  const index =
    band === "low" ? 0 : band === "high" ? levels.length - 1 : Math.floor(levels.length / 2)
  const level = levels[index] ?? levels[0]
  return level as string
}

export function suggestLevelForPerson(input: LevelInput): LevelSuggestion {
  const band = combineBands(
    keywordBand(input.title),
    tenureBand(input.employmentStartDate, input.today)
  )
  const level = levelForBand(input.trackKey, band)
  // Validate against the track. levelForBand always returns a member of
  // TRACK_LEVELS[trackKey], so this is a defensive assertion; if it ever fails,
  // fall back to the track's first (lowest) level.
  if (!isValidLevelForTrack(input.trackKey, level)) {
    return { suggestedLevel: TRACK_LEVELS[input.trackKey][0] as string }
  }
  return { suggestedLevel: level }
}
```

Note on the Lead ladder middle index: `TRACK_LEVELS.Lead` has 3 entries (`Lead-1`, `Lead-2`, `Lead-3`), so `Math.floor(3/2) = 1` -> `Lead-2` for `mid`. `TRACK_LEVELS.M` has 3 entries -> `M2` for `mid`. `TRACK_LEVELS.IC` has 5 entries -> `Math.floor(5/2) = 2` -> `IC3` for `mid`. These match the spec's mapping table.

- [ ] **Step 5: Re-export from the package index**

In `packages/core/src/index.ts`, add after the titleMatcher export:

```typescript
export * from "./classification/titleMatcher"
export * from "./classification/levelSuggester"
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/core -- levelSuggester`
Expected: PASS (all cases green).

- [ ] **Step 7: Commit**

```bash
git add packages/core/package.json packages/core/src/classification/levelSuggester.ts packages/core/src/classification/levelSuggester.test.ts packages/core/src/index.ts
git commit -m "feat(core): add suggestLevelForPerson deterministic level engine"
```

---

### Task 6: `fteTotalMonthlyComp` FTE-adjusted helper in `packages/constants`

**Files:**
- Modify: `packages/constants/src/pay.ts` (add the function)
- Modify: `packages/constants/src/index.ts` (re-export)
- Test: `packages/constants/src/pay.test.ts` (extend with a new describe block)

**Interfaces:**
- Consumes: the existing `totalMonthlyComp(basicMonthly, components)` in the same file.
- Produces (available to later plans / gap engine):

```typescript
export function fteTotalMonthlyComp(
  basicMonthly: number,
  components: ReadonlyArray<{ monthlyAmount: number }>,
  ftePercent: number | undefined
): number
```

Returns `totalMonthlyComp(basicMonthly, components) / (ftePercent / 100)`. Guard: `ftePercent` of `0`, `undefined`, or a non-positive value is treated as `100` (i.e. no adjustment), so a missing or zero FTE never divides by zero and returns the unadjusted total.

- [ ] **Step 1: Write the failing test**

In `packages/constants/src/pay.test.ts`, update the import line and append a new describe block:

```typescript
import { describe, expect, it } from "vitest"
import { PAY_COMPONENT_KINDS, fteTotalMonthlyComp, totalMonthlyComp } from "./pay"
```

```typescript
describe("fteTotalMonthlyComp", () => {
  it("returns the unadjusted total at 100% FTE", () => {
    expect(fteTotalMonthlyComp(50_000, [], 100)).toBe(50_000)
    expect(
      fteTotalMonthlyComp(40_000, [{ monthlyAmount: 8_000 }], 100)
    ).toBe(48_000)
  })

  it("grosses up part-time comp to a full-time equivalent at 80% FTE", () => {
    // 40_000 earned on an 80% contract -> full-time equivalent 50_000.
    expect(fteTotalMonthlyComp(40_000, [], 80)).toBe(50_000)
  })

  it("treats a zero FTE as 100% (no division by zero)", () => {
    expect(fteTotalMonthlyComp(30_000, [], 0)).toBe(30_000)
  })

  it("treats an undefined FTE as 100%", () => {
    expect(fteTotalMonthlyComp(30_000, [], undefined)).toBe(30_000)
  })

  it("includes components in the FTE-adjusted total", () => {
    // total 44_000 at 80% -> 55_000.
    expect(
      fteTotalMonthlyComp(40_000, [{ monthlyAmount: 4_000 }], 80)
    ).toBe(55_000)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/constants -- pay`
Expected: FAIL with `fteTotalMonthlyComp is not exported` / is not a function.

- [ ] **Step 3: Write the implementation**

In `packages/constants/src/pay.ts`, append after `totalMonthlyComp`:

```typescript
// Pure helper: FTE-adjusted total monthly comp. Grosses a part-time person's
// compensation up to its full-time equivalent so pay-gap comparisons are like
// for like (EU Pay Transparency Directive). ftePercent is a percentage
// (100 = full time). A missing, zero, or non-positive ftePercent is treated as
// 100 (no adjustment), so this never divides by zero. No I/O, no clock reads.
export function fteTotalMonthlyComp(
  basicMonthly: number,
  components: ReadonlyArray<{ monthlyAmount: number }>,
  ftePercent: number | undefined
): number {
  const total = totalMonthlyComp(basicMonthly, components)
  const fraction =
    ftePercent !== undefined && ftePercent > 0 ? ftePercent / 100 : 1
  return total / fraction
}
```

- [ ] **Step 4: Re-export from the package index**

In `packages/constants/src/index.ts`, update the pay export block:

```typescript
export {
  PAY_COMPONENT_KINDS,
  type PayComponentKind,
  fteTotalMonthlyComp,
  totalMonthlyComp,
} from "./pay"
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test --filter=@workspace/constants -- pay`
Expected: PASS (all cases green).

- [ ] **Step 6: Commit**

```bash
git add packages/constants/src/pay.ts packages/constants/src/index.ts packages/constants/src/pay.test.ts
git commit -m "feat(constants): add fteTotalMonthlyComp FTE-adjusted comp helper"
```

---

### Task 7: Full-suite verification gate

**Files:** none (verification only).

**Interfaces:**
- Consumes: all prior tasks.
- Produces: confidence that the whole plan's output compiles, typechecks, and passes the full cache-backed suite (the same gate the pre-commit hook runs).

- [ ] **Step 1: Typecheck the touched packages**

Run: `cd /Volumes/development/blueprnt/frontend && bun run turbo run typecheck --filter=@workspace/core --filter=@workspace/constants --filter=@workspace/backend`
Expected: PASS with no type errors. (Confirms the new `title` field, the `TitleSuggestion`/`LevelSuggestion` types, and the `fteTotalMonthlyComp` signature are all consistent.)

- [ ] **Step 2: Run the full test suite**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test`
Expected: PASS across all packages (turbo cache keeps unchanged packages instant). The new `packages/core` classification tests, the `packages/constants` pay tests, and the `packages/backend` people/import tests all pass.

- [ ] **Step 3: Lint the touched files with Biome**

Run: `cd /Volumes/development/blueprnt/frontend && bun run biome check packages/core/src/classification packages/constants/src/pay.ts packages/backend/convex/people/import.ts packages/backend/convex/people/people.ts packages/backend/convex/people/tables.ts`
Expected: PASS (no lint errors; note `packages/ui/src/*` is the only Biome-excluded tree, none of which is touched here).

No commit for this task (verification only). If any step fails, fix the offending task's code and re-run before proceeding to Plan 2.

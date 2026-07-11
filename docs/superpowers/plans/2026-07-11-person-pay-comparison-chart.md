# Person Pay-Comparison Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Pay compared with the role" dot plot on the person detail page: same-role peers on FTE-adjusted total monthly pay, levels as rows, the viewed person highlighted.

**Architecture:** One new org-scoped Convex query (`getRolePayComparison`) returns a PII-minimal discriminated union. A pure row-building helper in `apps/dashboard/lib` maps levels to ordered chart rows. A new `PayComparisonSection` component renders five states (skeleton, two preconditions, only-person, chart) inside the person page's left profile card.

**Tech Stack:** Convex (convex-test), recharts via `@workspace/ui/components/chart`, next-intl, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-07-11-person-pay-comparison-chart-design.md`

## Global Constraints

- **NEVER COMMIT.** Project rule overrides this skill's commit steps: leave all work uncommitted for review; the user commits after approval. Skip every "commit" step.
- Tests always run with `bun run test` (Vitest 4). NEVER `bun test`.
- Backend tests use convex-test (edge-runtime env, already configured).
- All user-facing text via i18n: `packages/i18n/messages/en.json` first, then mirrored to `sv.json`, `nb.json`, `da.json`, `fi.json` in the same change. Non-English strings are drafts; the final report must flag them for native review.
- Never use em dashes in any copy or comments. Use commas, colons, periods, or parentheses.
- No new schema fields, no new audit events (read-only query).
- Return shape is PII-minimal: points carry ONLY `level`, `amount`, `isSelf`. No names, no person ids, no gender.
- Lint is Biome: `bunx biome check <files>` from the repo root must pass.
- Before writing any chart JSX (Task 4), read the dataviz skill (Skill tool: `dataviz`).

---

### Task 1: Convex query `getRolePayComparison`

**Files:**
- Modify: `packages/backend/convex/people/pay.ts` (append at end of file)
- Test: `packages/backend/convex/people/pay.test.ts` (append a new `describe`)

**Interfaces:**
- Consumes: `fteTotalMonthlyComp(basicMonthly, components, ftePercent)` from `@workspace/constants` (exists, `packages/constants/src/pay.ts:31`); `orgQuery` from `../lib/functions`; indexes `personAssignments.by_person`, `personAssignments.by_role`, `payRecords.by_person`.
- Produces: `api.people.pay.getRolePayComparison({ orgId, personId })` returning
  `{ status: "unclassified" } | { status: "noSalary" } | { status: "ready", currency: string, excludedCount: number, points: Array<{ level: string, amount: number, isSelf: boolean }> }`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/backend/convex/people/pay.test.ts`. The file already imports `describe, expect, it` from vitest, `api, components, internal` from `../_generated/api`, `initConvexTest` from `../testing.helpers`, and defines `seedOrg` and `seedPerson` helpers. Add this helper next to `seedPerson` (same pattern as `assignments.test.ts`):

```ts
// Seeds a role and assigns the given person to it at the given level.
async function seedRoleWithAssignment(
  orgId: string,
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
  personId: Awaited<ReturnType<typeof seedPerson>>,
  level = "IC3"
) {
  const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Software Engineer",
    function: "Engineering",
    team: "Platform",
    trackKey: "IC",
  })
  await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
    orgId,
    personId,
    roleId,
    level,
    levelSource: "confirmed",
  })
  return roleId
}
```

Then append the describe block:

```ts
describe("getRolePayComparison", () => {
  it("returns unclassified when the person has no active assignment", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const result = await asAdmin.query(api.people.pay.getRolePayComparison, {
      orgId,
      personId,
    })
    expect(result).toEqual({ status: "unclassified" })
  })

  it("returns noSalary when classified but without any pay record", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    await seedRoleWithAssignment(orgId, asAdmin, personId)

    const result = await asAdmin.query(api.people.pay.getRolePayComparison, {
      orgId,
      personId,
    })
    expect(result).toEqual({ status: "noSalary" })
  })

  it("returns FTE-adjusted points for self and peers with PII-free shape", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const roleId = await seedRoleWithAssignment(orgId, asAdmin, personId)

    // Peer on the same role at 80% FTE: 40000 basic + 0 components
    // grosses up to 50000. levelSource "suggested" must still count.
    const { personId: peerId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Berg", gender: "Man", ftePercent: 80 }
    )
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: peerId,
      roleId,
      level: "IC2",
      levelSource: "suggested",
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId: peerId,
      payYear: 2026,
      basicMonthly: 40000,
      currency: "SEK",
      components: [],
    })

    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basicMonthly: 55000,
      currency: "SEK",
      components: [{ kind: "variable", monthlyAmount: 5000 }],
    })

    const result = await asAdmin.query(api.people.pay.getRolePayComparison, {
      orgId,
      personId,
    })
    if (result.status !== "ready") throw new Error("expected ready")
    expect(result.currency).toBe("SEK")
    expect(result.excludedCount).toBe(0)
    expect(result.points).toHaveLength(2)

    const self = result.points.find((p) => p.isSelf)
    const peer = result.points.find((p) => !p.isSelf)
    // Self: full time, 55000 + 5000 component = 60000.
    expect(self).toEqual({ level: "IC3", amount: 60000, isSelf: true })
    // Peer: (40000 / 0.8) = 50000, suggested level included.
    expect(peer).toEqual({ level: "IC2", amount: 50000, isSelf: false })

    // PII-minimal: no extra keys beyond the contract.
    for (const point of result.points) {
      expect(Object.keys(point).sort()).toEqual(["amount", "isSelf", "level"])
    }
  })

  it("uses each person's latest payYear record", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    await seedRoleWithAssignment(orgId, asAdmin, personId)

    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 40000,
      currency: "SEK",
      components: [],
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basicMonthly: 48000,
      currency: "SEK",
      components: [],
    })

    const result = await asAdmin.query(api.people.pay.getRolePayComparison, {
      orgId,
      personId,
    })
    if (result.status !== "ready") throw new Error("expected ready")
    expect(result.points[0]?.amount).toBe(48000)
  })

  it("excludes other-currency peers with a count and skips archived peers", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const roleId = await seedRoleWithAssignment(orgId, asAdmin, personId)
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2026,
      basicMonthly: 50000,
      currency: "SEK",
      components: [],
    })

    // Peer paid in EUR: excluded, counted.
    const { personId: eurPeer } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Eva Euro", gender: "Kvinna" }
    )
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: eurPeer,
      roleId,
      level: "IC2",
      levelSource: "confirmed",
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId: eurPeer,
      payYear: 2026,
      basicMonthly: 4000,
      currency: "EUR",
      components: [],
    })

    // Archived peer: skipped silently (not part of the active population).
    const { personId: archivedPeer } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Ola Old", gender: "Man" }
    )
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: archivedPeer,
      roleId,
      level: "IC4",
      levelSource: "confirmed",
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId: archivedPeer,
      payYear: 2026,
      basicMonthly: 70000,
      currency: "SEK",
      components: [],
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(archivedPeer, { archivedAt: 1_700_000_000_000 })
    })

    const result = await asAdmin.query(api.people.pay.getRolePayComparison, {
      orgId,
      personId,
    })
    if (result.status !== "ready") throw new Error("expected ready")
    expect(result.excludedCount).toBe(1)
    expect(result.points).toHaveLength(1)
    expect(result.points[0]?.isSelf).toBe(true)
  })

  it("is org-isolated: another org's caller gets unclassified", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "a@a.se")
    const personId = await seedPerson(orgA, asAdminA)
    await seedRoleWithAssignment(orgA, asAdminA, personId)

    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "b@b.se")
    const result = await asAdminB.query(api.people.pay.getRolePayComparison, {
      orgId: orgB,
      personId,
    })
    expect(result).toEqual({ status: "unclassified" })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `packages/backend`: `bun run test pay.test`
Expected: the new describe FAILS with "Could not find public function for 'people.pay:getRolePayComparison'". Pre-existing tests still pass.

- [ ] **Step 3: Implement the query**

Append to `packages/backend/convex/people/pay.ts`. Also add `fteTotalMonthlyComp` to the existing `@workspace/constants` import on line 2.

```ts
// The person page's pay-comparison payload. PII-minimal BY CONSTRUCTION:
// a point carries only level, FTE-adjusted amount, and the isSelf flag;
// never a name, person id, or gender. With isSelf present the points are
// otherwise unattributable, which is the whole contract of this chart.
const payComparisonShape = v.union(
  v.object({ status: v.literal("unclassified") }),
  v.object({ status: v.literal("noSalary") }),
  v.object({
    status: v.literal("ready"),
    currency: v.string(),
    excludedCount: v.number(),
    points: v.array(
      v.object({
        level: v.string(),
        amount: v.number(),
        isSelf: v.boolean(),
      })
    ),
  })
)

// A person's most recent pay record: greatest payYear, ties broken by
// effectiveAt (a correction within the same year wins over the original).
async function latestPayRecord(
  ctx: QueryCtx & { orgId: string },
  personId: Id<"people">
): Promise<Doc<"payRecords"> | null> {
  const rows = await ctx.db
    .query("payRecords")
    .withIndex("by_person", (q) =>
      q.eq("orgId", ctx.orgId).eq("personId", personId)
    )
    .collect()
  let latest: Doc<"payRecords"> | null = null
  for (const row of rows) {
    if (
      latest === null ||
      row.payYear > latest.payYear ||
      (row.payYear === latest.payYear && row.effectiveAt > latest.effectiveAt)
    ) {
      latest = row
    }
  }
  return latest
}

// Comparison data for the person page's "Pay compared with the role" chart:
// everyone with an active assignment on the same role, on FTE-adjusted total
// monthly pay (fteTotalMonthlyComp, the V2 salary spec's canonical metric),
// each person contributing their latest payYear record. Peers paid in another
// currency than the viewed person are excluded and counted (not comparable);
// archived peers are excluded; the viewed person is included archived or not.
// Derived on read, nothing stored. Read-only, so no audit row.
export const getRolePayComparison = orgQuery({
  args: { personId: v.id("people") },
  returns: payComparisonShape,
  handler: async (ctx, { personId }) => {
    const person = await ctx.db.get(personId)
    if (person === null || person.orgId !== ctx.orgId) {
      // Same silent empty as getSalaryHistory for a foreign person: reveal
      // nothing about other orgs' data.
      return { status: "unclassified" as const }
    }

    const ownAssignments = await ctx.db
      .query("personAssignments")
      .withIndex("by_person", (q) =>
        q.eq("orgId", ctx.orgId).eq("personId", personId)
      )
      .collect()
    const active = ownAssignments.find((a) => a.endedAt === undefined)
    if (active === undefined) return { status: "unclassified" as const }

    const ownRecord = await latestPayRecord(ctx, personId)
    if (ownRecord === null) return { status: "noSalary" as const }

    const roleAssignments = await ctx.db
      .query("personAssignments")
      .withIndex("by_role", (q) =>
        q.eq("orgId", ctx.orgId).eq("roleId", active.roleId)
      )
      .collect()

    const points: Array<{ level: string; amount: number; isSelf: boolean }> =
      []
    let excludedCount = 0
    for (const assignment of roleAssignments) {
      if (assignment.endedAt !== undefined) continue
      if (assignment.personId === personId) {
        points.push({
          level: assignment.level,
          amount: Math.round(
            fteTotalMonthlyComp(
              ownRecord.basicMonthly,
              ownRecord.components,
              person.ftePercent
            )
          ),
          isSelf: true,
        })
        continue
      }
      const peer = await ctx.db.get(assignment.personId)
      if (peer === null || peer.archivedAt !== undefined) continue
      const record = await latestPayRecord(ctx, assignment.personId)
      if (record === null) continue
      if (record.currency !== ownRecord.currency) {
        excludedCount += 1
        continue
      }
      points.push({
        level: assignment.level,
        amount: Math.round(
          fteTotalMonthlyComp(
            record.basicMonthly,
            record.components,
            peer.ftePercent
          )
        ),
        isSelf: false,
      })
    }

    return { status: "ready" as const, currency: ownRecord.currency, excludedCount, points }
  },
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `packages/backend`: `bun run test pay.test`
Expected: PASS, all tests including the six new ones.

- [ ] **Step 5: Verify lint and types (no commit, per Global Constraints)**

Run from repo root: `bunx biome check packages/backend/convex/people/pay.ts packages/backend/convex/people/pay.test.ts && bun run typecheck`
Expected: both clean.

---

### Task 2: Pure row-building helper `buildPayComparisonRows`

**Files:**
- Create: `apps/dashboard/lib/pay-comparison.ts`
- Test: `apps/dashboard/lib/pay-comparison.test.ts`

**Interfaces:**
- Consumes: `TRACK_LEVELS` from `@workspace/constants` (`{ IC: ["IC1".."IC5"], Lead: [...], M: [...] }`, ordered lowest to highest).
- Produces: `buildPayComparisonRows(trackKey: string | undefined, points: ReadonlyArray<PayComparisonPoint>): { levels: string[]; data: Array<PayComparisonPoint & { row: number }> }` and the type `PayComparisonPoint = { level: string; amount: number; isSelf: boolean }`. `levels[0]` is the TOP row (highest ladder level); `row` is each point's index into `levels`.

- [ ] **Step 1: Write the failing tests**

Create `apps/dashboard/lib/pay-comparison.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { buildPayComparisonRows } from "./pay-comparison"

describe("buildPayComparisonRows", () => {
  it("orders the track ladder highest-first and maps points to rows", () => {
    const { levels, data } = buildPayComparisonRows("IC", [
      { level: "IC2", amount: 40000, isSelf: false },
      { level: "IC5", amount: 90000, isSelf: true },
    ])
    expect(levels).toEqual(["IC5", "IC4", "IC3", "IC2", "IC1"])
    expect(data).toEqual([
      { level: "IC2", amount: 40000, isSelf: false, row: 3 },
      { level: "IC5", amount: 90000, isSelf: true, row: 0 },
    ])
  })

  it("appends off-ladder levels below the ladder instead of dropping them", () => {
    const { levels, data } = buildPayComparisonRows("M", [
      { level: "M1", amount: 50000, isSelf: true },
      { level: "Legacy-9", amount: 45000, isSelf: false },
    ])
    expect(levels).toEqual(["M3", "M2", "M1", "Legacy-9"])
    expect(data[1]?.row).toBe(3)
  })

  it("treats an unknown track as all off-ladder in encounter order", () => {
    const { levels } = buildPayComparisonRows(undefined, [
      { level: "B", amount: 1, isSelf: false },
      { level: "A", amount: 2, isSelf: true },
    ])
    expect(levels).toEqual(["B", "A"])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `apps/dashboard`: `bun run test pay-comparison`
Expected: FAIL, cannot resolve `./pay-comparison`.

- [ ] **Step 3: Implement the helper**

Create `apps/dashboard/lib/pay-comparison.ts`:

```ts
import { TRACK_LEVELS } from "@workspace/constants"

export type PayComparisonPoint = {
  level: string
  amount: number
  isSelf: boolean
}

// Orders the pay-comparison chart's level rows. levels[0] is the TOP row:
// the track ladder reversed (TRACK_LEVELS is lowest-first), then any
// off-ladder level strings (data drift) appended in encounter order so no
// point is silently dropped. Each point gets its row index for the chart's
// numeric y axis.
export function buildPayComparisonRows(
  trackKey: string | undefined,
  points: ReadonlyArray<PayComparisonPoint>
): { levels: string[]; data: Array<PayComparisonPoint & { row: number }> } {
  const ladder =
    trackKey !== undefined
      ? (TRACK_LEVELS[trackKey as keyof typeof TRACK_LEVELS] ?? [])
      : []
  const levels = [...ladder].reverse()
  for (const point of points) {
    if (!levels.includes(point.level)) levels.push(point.level)
  }
  return {
    levels,
    data: points.map((point) => ({
      ...point,
      row: levels.indexOf(point.level),
    })),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `apps/dashboard`: `bun run test pay-comparison`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify lint (no commit)**

Run from repo root: `bunx biome check apps/dashboard/lib/pay-comparison.ts apps/dashboard/lib/pay-comparison.test.ts`
Expected: clean.

---

### Task 3: i18n keys in all five locales

**Files:**
- Modify: `packages/i18n/messages/en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json`

**Interfaces:**
- Produces: `dashboard.people.payComparison.*` (heading, scopeRole, peers, self, precondition, onlyPerson, footnote, excluded) and `dashboard.help.fteAdjustedLabel` / `fteAdjustedBody`, consumed by Task 4.

Notes: edit the JSON with the Edit tool only, never shell perl/sed (non-ASCII double-encoding hazard). Insert `payComparison` inside `dashboard.people` after the `"detail"` object (same nesting level). Insert the two help keys at the end of the `dashboard.help` object. The key ORDER must be identical in every locale file only for readability; the parity test compares key sets.

- [ ] **Step 1: Add the English keys to `en.json`**

Inside `dashboard.people`, after the `"detail": { ... }` object:

```json
"payComparison": {
  "heading": "Pay compared with the role",
  "scopeRole": "Same role",
  "peers": "Colleagues",
  "self": "This person",
  "precondition": "The comparison appears once the person is classified and has a recorded salary.",
  "onlyPerson": "The only person in this role with a recorded salary.",
  "footnote": "FTE-adjusted total monthly pay, latest recorded year per person.",
  "excluded": "{count, plural, one {# colleague not shown (pay in another currency)} other {# colleagues not shown (pay in another currency)}}"
},
```

At the end of `dashboard.help`:

```json
"fteAdjustedLabel": "What does FTE-adjusted mean?",
"fteAdjustedBody": "Part-time pay is scaled up to its full-time equivalent before comparing. A person working 80% with a monthly pay of 40,000 is shown as 50,000, so everyone is compared on full-time terms."
```

- [ ] **Step 2: Mirror to Swedish (`sv.json`)**

```json
"payComparison": {
  "heading": "Lön jämfört med rollen",
  "scopeRole": "Samma roll",
  "peers": "Kollegor",
  "self": "Denna person",
  "precondition": "Jämförelsen visas när personen är klassificerad och har en registrerad lön.",
  "onlyPerson": "Den enda personen i rollen med registrerad lön.",
  "footnote": "Heltidsjusterad total månadslön, senast registrerade år per person.",
  "excluded": "{count, plural, one {# kollega visas inte (lön i annan valuta)} other {# kollegor visas inte (lön i annan valuta)}}"
},
```

```json
"fteAdjustedLabel": "Vad betyder heltidsjusterad?",
"fteAdjustedBody": "Deltidslön räknas upp till heltid innan jämförelsen. En person som arbetar 80% med 40 000 i månadslön visas som 50 000, så att alla jämförs på heltidsvillkor."
```

- [ ] **Step 3: Mirror to Norwegian (`nb.json`)**

```json
"payComparison": {
  "heading": "Lønn sammenlignet med rollen",
  "scopeRole": "Samme rolle",
  "peers": "Kolleger",
  "self": "Denne personen",
  "precondition": "Sammenligningen vises når personen er klassifisert og har en registrert lønn.",
  "onlyPerson": "Den eneste personen i rollen med registrert lønn.",
  "footnote": "Heltidsjustert total månedslønn, siste registrerte år per person.",
  "excluded": "{count, plural, one {# kollega vises ikke (lønn i annen valuta)} other {# kolleger vises ikke (lønn i annen valuta)}}"
},
```

```json
"fteAdjustedLabel": "Hva betyr heltidsjustert?",
"fteAdjustedBody": "Deltidslønn regnes opp til heltid før sammenligningen. En person som jobber 80% med 40 000 i månedslønn vises som 50 000, slik at alle sammenlignes på heltidsvilkår."
```

- [ ] **Step 4: Mirror to Danish (`da.json`)**

```json
"payComparison": {
  "heading": "Løn sammenlignet med rollen",
  "scopeRole": "Samme rolle",
  "peers": "Kolleger",
  "self": "Denne person",
  "precondition": "Sammenligningen vises, når personen er klassificeret og har en registreret løn.",
  "onlyPerson": "Den eneste person i rollen med registreret løn.",
  "footnote": "Fuldtidsjusteret samlet månedsløn, seneste registrerede år pr. person.",
  "excluded": "{count, plural, one {# kollega vises ikke (løn i anden valuta)} other {# kolleger vises ikke (løn i anden valuta)}}"
},
```

```json
"fteAdjustedLabel": "Hvad betyder fuldtidsjusteret?",
"fteAdjustedBody": "Deltidsløn omregnes til fuld tid før sammenligningen. En person, der arbejder 80% med 40.000 i månedsløn, vises som 50.000, så alle sammenlignes på fuldtidsvilkår."
```

- [ ] **Step 5: Mirror to Finnish (`fi.json`)**

```json
"payComparison": {
  "heading": "Palkka verrattuna rooliin",
  "scopeRole": "Sama rooli",
  "peers": "Kollegat",
  "self": "Tämä henkilö",
  "precondition": "Vertailu näytetään, kun henkilö on luokiteltu ja hänellä on kirjattu palkka.",
  "onlyPerson": "Roolin ainoa henkilö, jolla on kirjattu palkka.",
  "footnote": "Kokoaikaiseksi muunnettu kokonaiskuukausipalkka, viimeisin kirjattu vuosi henkilöä kohden.",
  "excluded": "{count, plural, one {# kollegaa ei näytetä (palkka eri valuutassa)} other {# kollegaa ei näytetä (palkka eri valuutassa)}}"
},
```

```json
"fteAdjustedLabel": "Mitä kokoaikaiseksi muunnettu tarkoittaa?",
"fteAdjustedBody": "Osa-aikainen palkka muunnetaan kokoaikaiseksi ennen vertailua. Henkilö, joka työskentelee 80% ja ansaitsee 40 000 kuukaudessa, näytetään arvolla 50 000, jotta kaikkia verrataan kokoaikaisin ehdoin."
```

- [ ] **Step 6: Run the parity test and mojibake check**

Run from `packages/i18n`: `bun run test`
Expected: PASS (key sets identical across locales).
Run from repo root: `grep -rn "Ã\|Â" packages/i18n/messages/*.json | head -3`
Expected: no output (no mojibake).

---

### Task 4: `PayComparisonSection` component

**Files:**
- Create: `apps/dashboard/components/people/pay-comparison-section.tsx`
- Test: `apps/dashboard/components/people/pay-comparison-section.test.tsx`

**Interfaces:**
- Consumes: `api.people.pay.getRolePayComparison` (Task 1 shape), `buildPayComparisonRows` + `PayComparisonPoint` (Task 2), i18n keys (Task 3), `ChartContainer/ChartTooltip` from `@workspace/ui/components/chart`, `HelpMorphButton` (`{ label, children }`), `useOrganization` (`{ orgId }`), the convex-mocks test scaffolding (`@/test/convex-mocks`, routes queries by stringified ref, e.g. `"people.pay.getRolePayComparison"`).
- Produces: `<PayComparisonSection personId={Id<"people">} trackKey={string | undefined} />` consumed by Task 5.

- [ ] **Step 0: Read the dataviz skill**

Invoke the Skill tool with `dataviz` before writing any chart JSX, per its trigger rule. Apply its guidance within the constraints already fixed by the spec (muted peers, `var(--brand)` self, one categorical axis).

- [ ] **Step 1: Write the failing tests**

Create `apps/dashboard/components/people/pay-comparison-section.test.tsx` (same mock scaffolding as `person-detail.test.tsx`):

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org_1", name: "Acme", role: "admin" }),
}))

import { PayComparisonSection } from "./pay-comparison-section"

const m = messages.dashboard.people.payComparison

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayComparisonSection
        personId={"p1" as never}
        trackKey="IC"
      />
    </NextIntlClientProvider>
  )
}

function onComparison(value: unknown) {
  onQuery((ref) =>
    ref === "people.pay.getRolePayComparison" ? value : undefined
  )
}

describe("PayComparisonSection", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows the heading chrome and a skeleton while loading", () => {
    onComparison(undefined)
    renderSection()
    expect(screen.getByText(m.heading)).toBeDefined()
    expect(screen.getByText(m.scopeRole)).toBeDefined()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it("shows the precondition line for unclassified and noSalary", () => {
    onComparison({ status: "unclassified" })
    renderSection()
    expect(screen.getByText(m.precondition)).toBeDefined()
    cleanup()
    onComparison({ status: "noSalary" })
    renderSection()
    expect(screen.getByText(m.precondition)).toBeDefined()
  })

  it("shows the only-person line when self is the only point", () => {
    onComparison({
      status: "ready",
      currency: "SEK",
      excludedCount: 0,
      points: [{ level: "IC3", amount: 50000, isSelf: true }],
    })
    renderSection()
    expect(screen.getByText(m.onlyPerson)).toBeDefined()
  })

  it("renders the chart, footnote, and exclusion line for 2+ points", () => {
    onComparison({
      status: "ready",
      currency: "SEK",
      excludedCount: 2,
      points: [
        { level: "IC3", amount: 50000, isSelf: true },
        { level: "IC2", amount: 42000, isSelf: false },
      ],
    })
    renderSection()
    expect(screen.getByText(m.footnote)).toBeDefined()
    expect(
      screen.getByText("2 colleagues not shown (pay in another currency)")
    ).toBeDefined()
    expect(document.querySelector("[data-chart]")).not.toBeNull()
    // Anonymous by construction: nothing but chart text renders, so no
    // name-like strings can appear. Guard the fixture's absence explicitly.
    expect(screen.queryByText(/Anna|Alex|Bo /)).toBeNull()
  })

  it("hides the exclusion line when excludedCount is 0", () => {
    onComparison({
      status: "ready",
      currency: "SEK",
      excludedCount: 0,
      points: [
        { level: "IC3", amount: 50000, isSelf: true },
        { level: "IC2", amount: 42000, isSelf: false },
      ],
    })
    renderSection()
    expect(screen.queryByText(/not shown/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `apps/dashboard`: `bun run test pay-comparison-section`
Expected: FAIL, cannot resolve `./pay-comparison-section`.

- [ ] **Step 3: Implement the component**

Create `apps/dashboard/components/people/pay-comparison-section.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@workspace/ui/components/chart"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import {
  buildPayComparisonRows,
  type PayComparisonPoint,
} from "@/lib/pay-comparison"

// "Pay compared with the role" on the person page: same-role peers as a dot
// plot on FTE-adjusted total monthly pay (x) by level (rows), the viewed
// person in brand color, peers muted and anonymous (the query returns no
// identity, so the chart cannot leak any). The single "Same role" chip is
// the seam where the same-band scope joins when the analysis pillar lands.
export function PayComparisonSection({
  personId,
  trackKey,
}: {
  personId: Id<"people">
  trackKey: string | undefined
}) {
  const t = useTranslations("dashboard.people.payComparison")
  const tHelp = useTranslations("dashboard.help")
  const { orgId } = useOrganization()
  const comparison = useQuery(api.people.pay.getRolePayComparison, {
    orgId,
    personId,
  })

  return (
    <section className="space-y-2">
      {/* Static chrome renders during loading (skeleton rule); only the
          chart area is data-shaped. */}
      <div className="flex items-center gap-2">
        <h2 className="font-medium text-sm">{t("heading")}</h2>
        <HelpMorphButton label={tHelp("fteAdjustedLabel")}>
          {tHelp("fteAdjustedBody")}
        </HelpMorphButton>
        <Badge variant="outline" className="ml-auto text-muted-foreground">
          {t("scopeRole")}
        </Badge>
      </div>
      {comparison === undefined ? (
        <Skeleton className="h-48 w-full" />
      ) : comparison.status !== "ready" ? (
        // Preconditions in words, one shared line for both missing pieces
        // (classification and a recorded salary).
        <p className="text-muted-foreground text-sm">{t("precondition")}</p>
      ) : comparison.points.length < 2 ? (
        <p className="text-muted-foreground text-sm">{t("onlyPerson")}</p>
      ) : (
        <PayComparisonChart
          currency={comparison.currency}
          excludedCount={comparison.excludedCount}
          points={comparison.points}
          trackKey={trackKey}
        />
      )}
    </section>
  )
}

function PayComparisonChart({
  currency,
  excludedCount,
  points,
  trackKey,
}: {
  currency: string
  excludedCount: number
  points: PayComparisonPoint[]
  trackKey: string | undefined
}) {
  const t = useTranslations("dashboard.people.payComparison")
  const format = useFormatter()
  const { levels, data } = buildPayComparisonRows(trackKey, points)
  const peers = data.filter((point) => !point.isSelf)
  const self = data.filter((point) => point.isSelf)

  const config = {
    peers: { label: t("peers"), color: "var(--muted-foreground)" },
    self: { label: t("self"), color: "var(--brand)" },
  } satisfies ChartConfig

  const money = (value: number) =>
    format.number(value, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    })

  return (
    <div className="space-y-1">
      {/* aspect-auto overrides the container's default aspect-video so the
          section gets a fixed height matching the loading skeleton. */}
      <ChartContainer config={config} className="aspect-auto h-48 w-full">
        <ScatterChart
          accessibilityLayer
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            type="number"
            dataKey="amount"
            domain={["auto", "auto"]}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={money}
          />
          {/* Levels ride a numeric row axis (reversed: row 0 on top) instead
              of a category axis, so every ladder level shows as a row even
              without a dot. */}
          <YAxis
            type="number"
            dataKey="row"
            reversed
            domain={[-0.5, levels.length - 0.5]}
            ticks={levels.map((_, index) => index)}
            tickFormatter={(row: number) => levels[row] ?? ""}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (active !== true || payload === undefined) return null
              const point = payload[0]?.payload as
                | { level: string; amount: number }
                | undefined
              if (point === undefined) return null
              // Level and amount only: the payload carries no identity.
              return (
                <div className="rounded-md border bg-popover px-2.5 py-1.5 text-popover-foreground text-xs shadow-md">
                  {point.level}: {money(point.amount)}
                </div>
              )
            }}
          />
          <Scatter data={peers} fill="var(--color-peers)" fillOpacity={0.5} />
          <Scatter data={self} fill="var(--color-self)" />
        </ScatterChart>
      </ChartContainer>
      <p className="text-muted-foreground text-xs">{t("footnote")}</p>
      {excludedCount > 0 && (
        <p className="text-muted-foreground text-xs">
          {t("excluded", { count: excludedCount })}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `apps/dashboard`: `bun run test pay-comparison-section`
Expected: PASS (5 tests). If `[data-chart]` is not found: `ChartContainer` renders a `div` with a `data-chart` attribute; verify against `packages/ui/src/components/chart.tsx` and adjust the selector, not the component.

- [ ] **Step 5: Verify lint (no commit)**

Run from repo root: `bunx biome check apps/dashboard/components/people/pay-comparison-section.tsx apps/dashboard/components/people/pay-comparison-section.test.tsx`
Expected: clean.

---

### Task 5: Wire into the person page and full verification

**Files:**
- Modify: `apps/dashboard/components/people/person-detail.tsx` (left card, after the classification `<section>`)
- Modify: `apps/dashboard/components/people/person-detail.test.tsx` (query router + one assertion)

**Interfaces:**
- Consumes: `<PayComparisonSection personId trackKey />` (Task 4). In `person-detail.tsx`, `person.personId` is `Id<"people">` and `role` (resolved from `listRoles`) carries `trackKey`; `role` is `null` when unclassified, so pass `role?.trackKey`.

- [ ] **Step 1: Extend the person-detail test**

In `person-detail.test.tsx`, the `queryRouter` returns `undefined` for unknown refs, which leaves the new section in its skeleton state and breaks nothing. Make the new state explicit: add one line to `queryRouter`:

```ts
  if (ref === "people.pay.getRolePayComparison") return { status: "noSalary" }
```

and in the first test ("renders identity, current level, ..."), assert the section renders its precondition copy:

```ts
    // The pay-comparison section renders its precondition state.
    expect(
      screen.getByText(messages.dashboard.people.payComparison.precondition)
    ).toBeDefined()
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `apps/dashboard`: `bun run test person-detail`
Expected: FAIL on the new assertion (section not rendered yet).

- [ ] **Step 3: Wire the section in**

In `person-detail.tsx`, add the import:

```tsx
import { PayComparisonSection } from "@/components/people/pay-comparison-section"
```

and directly after the closing `</section>` of the classification block (still inside the same `CardContent`), add:

```tsx
              <PayComparisonSection
                personId={person.personId}
                trackKey={role?.trackKey}
              />
```

- [ ] **Step 4: Run the test to verify it passes**

Run from `apps/dashboard`: `bun run test person-detail`
Expected: PASS (all tests).

- [ ] **Step 5: Full verification (no commit)**

From the repo root:
- `bun run test` (turbo, all packages) - expected: all pass.
- `bun run typecheck` - expected: clean.
- `bunx biome check apps/dashboard/components/people/person-detail.tsx apps/dashboard/components/people/person-detail.test.tsx` - expected: clean.

- [ ] **Step 6: Report**

Summarize the diff for review (do not commit) and flag the sv/nb/da/fi strings for native review.

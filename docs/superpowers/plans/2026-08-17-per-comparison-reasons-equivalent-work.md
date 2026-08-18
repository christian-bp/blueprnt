# Per-Comparison Objective Reasons for Equivalent Work

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the equivalent-work chapter (kapitel 4, kvinnodominerade grupper), an objective reason is recorded per COMPARISON (women-dominated group vs one higher-paid comparator), not once for the whole group.

**Architecture:** `payMappingGroupAnalyses` gains an optional `comparisonKey`. A row without it stays the group's row (klarmarkering + summary note); a row with it is a pair row carrying that comparison's own `reasons`. The completion gate for a women-dominated group requires every comparison to carry at least one reason, made workable by one bulk mutation that fills every still-unexplained comparison with the same reasons. Equal work (kapitel 3) is untouched: there the group IS the unit of comparison.

**Tech Stack:** Convex (backend, `packages/backend/convex`), React 19 + Next.js 16 + Tailwind v4 (`apps/dashboard`), next-intl, Vitest 4.

**Spec:** This document. The design decisions were taken in conversation on 2026-08-17 and are restated under "Decisions" below, with the domain argument that produced them.

## Decisions

1. **Reasons live per comparison**, with a "gäller alla återstående" bulk control. The group's row keeps `done` and a summary note. Rejected: keeping group-level reasons as an inherited default with per-row overrides, because the report would then have to explain which rows inherited and which deviated, which is harder for a granskare to read than one explanation per pair.
2. **The chapter is documented when every comparison row has at least one reason.** The comparator table by construction lists only jobs that out-earn the women-dominated group, so every row is itself a finding that DL 3 kap. 9 § asks to be assessed.

## Domain argument (why this change exists)

DL 3 kap. 8 § p3 requires comparing a women-dominated group against (a) a non-women-dominated group performing work of equal value and (b) a group whose work is valued LOWER but paid MORE. DL 3 kap. 9 § asks, for each such difference, whether it has a direct or indirect connection to sex, and what explains it if not. The unit of assessment is therefore the PAIR.

Today the reasons sit on the group. A real group in the app is compared against four jobs at +13.6%, +7.1%, +2.4% and +1.8%, one of them a LOWER-valued level 6 out-earning a level 5 women-dominated group (the sharpest case in law). Those four differences cannot share one explanation.

**Recorded tension, resolved:** `apps/dashboard/components/pay-mapping/comparator-table.tsx` already argues this exact point in the `documentation` prop's comment, and then concludes that requiring all rows "would be unworkable at 21 groups". That note predates the bulk control this plan adds. With "gäller alla återstående", one explanation covering many comparators is one interaction, so the strict gate becomes workable. Anyone revisiting this decision should read that comment first and update it (Task 5 does).

## Global Constraints

- **Language:** all code, comments, commit messages, filenames in English. Domain docs in Swedish.
- **Never use em dashes** in any text we write.
- **All user-facing text goes through i18n**, added to `packages/i18n/messages/en.json` first, then mirrored to `sv`, `nb`, `da`, `fi`. New non-English strings are machine drafts and must be flagged for native review in the final report.
- **Tests run with Vitest 4 via `bun run test`**, never `bun test`.
- **New code ships with tests in the same commit.** The pre-commit hook runs Biome (`--error-on-warnings`), a full typecheck and the full test suite; never bypass with `--no-verify`.
- **Biome ends at zero errors and zero warnings.**
- **Every state-changing mutation writes an audit row** via `logAudit` with an `AUDIT_EVENTS` key; every payload field resolves to a `dashboard.auditLog.fields.*` label in every locale.
- **Role != Person:** nothing in this feature may carry person identity. Group keys and role titles only.
- **Leave completed work uncommitted for review** unless told otherwise; commit as focused single-concern commits on main after approval.
- **Schema change:** this plan changes the Convex schema, so it ends with a dev-deployment migration and a browser pass against real data (Task 7).

---

### Task 1: The pair key and the gate's required set

**Files:**
- Modify: `packages/backend/convex/payMapping/tables.ts` (the `payMappingGroupAnalyses` table)
- Modify: `packages/backend/convex/payMapping/gap.ts` (`requiredDocumentationKeys`, around line 412)
- Test: `packages/backend/convex/payMapping/gap.test.ts`

**Interfaces:**
- Produces: `comparisonDocumentationKey(groupKey: string, comparisonKey: string): string` exported from `gap.ts`; `requiredDocumentationKeys(rows)` gains two Set fields, `womenDominatedComparisonsAll` and `womenDominatedComparisonsRequired`, both holding composite keys built by that helper.
- Consumes: the existing `buildGapAggregates(rows)` and its `womenDominated[].comparisons[].key`.

- [ ] **Step 1: Write the failing test**

In `packages/backend/convex/payMapping/gap.test.ts`, add:

```ts
describe("comparisonDocumentationKey", () => {
  // Both halves are group keys and both can contain the "|" the group-key
  // format already uses, so a plain string join would be ambiguous: JSON
  // gives an unambiguous composite with no escaping rules of our own.
  it("composes a key that cannot collide with a group key's own separator", () => {
    expect(comparisonDocumentationKey("Nurse|3", "Controller|6")).not.toBe(
      comparisonDocumentationKey("Nurse|3|Controller", "6")
    )
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/backend && bun run test gap`
Expected: FAIL, `comparisonDocumentationKey is not defined`.

- [ ] **Step 3: Add the helper and the field**

In `gap.ts`, above `requiredDocumentationKeys`:

```ts
// The composite key identifying ONE documented comparison (a women-dominated
// group against one higher-paid comparator). Both halves are group keys and
// both can contain the "|" the group-key format uses, so this is JSON rather
// than a join: unambiguous, with no escaping rules of our own to get wrong.
// Storage keeps the two halves in their own columns; this shape exists only
// for the gate's Set lookups.
export function comparisonDocumentationKey(
  groupKey: string,
  comparisonKey: string
): string {
  return JSON.stringify([groupKey, comparisonKey])
}
```

In `packages/backend/convex/payMapping/tables.ts`, add to `payMappingGroupAnalyses` after `groupKey`:

```ts
  // Set only on an equivalentWork row that documents ONE comparison: the
  // comparator group's own key. Absent on the group's own row, which carries
  // the klarmarkering and the summary note, and on every equalWork row, where
  // the group IS the unit of comparison (DL 3 kap. 8 § p2) and one set of
  // reasons per group is correct.
  comparisonKey: v.optional(v.string()),
```

- [ ] **Step 4: Extend the gate's return**

In `requiredDocumentationKeys`, after `womenDominatedRequired`:

```ts
  const womenDominatedComparisonsAll = new Set<string>()
  const womenDominatedComparisonsRequired = new Set<string>()
  for (const group of womenDominated) {
    for (const comparison of group.comparisons) {
      const key = comparisonDocumentationKey(group.key, comparison.key)
      womenDominatedComparisonsAll.add(key)
      // Every comparator in this table out-earns the women-dominated group,
      // so every row is a finding DL 3 kap. 9 § asks to be assessed. There is
      // no materiality threshold: introducing one would be our rule, not the
      // law's, and the metodbilaga would have to defend it.
      womenDominatedComparisonsRequired.add(key)
    }
  }
```

and return both alongside the existing four fields.

- [ ] **Step 5: Test the required set**

Add to `gap.test.ts`, reusing the file's existing snapshot-row fixtures (follow whatever `makeRow`/fixture helper the file already defines; do not invent a new one):

```ts
it("requires a documented reason for every comparator of a women-dominated group", () => {
  const keys = requiredDocumentationKeys(ROWS_WITH_WOMEN_DOMINATED_GROUP)
  const group = buildGapAggregates(ROWS_WITH_WOMEN_DOMINATED_GROUP)
    .womenDominated[0]
  expect(group).toBeDefined()
  if (group === undefined) return
  expect(keys.womenDominatedComparisonsRequired.size).toBe(
    group.comparisons.length
  )
  for (const comparison of group.comparisons) {
    expect(
      keys.womenDominatedComparisonsRequired.has(
        comparisonDocumentationKey(group.key, comparison.key)
      )
    ).toBe(true)
  }
})
```

- [ ] **Step 6: Run the backend tests**

Run: `cd packages/backend && bun run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/payMapping/tables.ts packages/backend/convex/payMapping/gap.ts packages/backend/convex/payMapping/gap.test.ts
git commit -m "feat(pay-mapping): key documentation per equivalent-work comparison"
```

---

### Task 2: Writing and reading a per-comparison row

**Files:**
- Modify: `packages/backend/convex/payMapping/analyses.ts` (`groupAnalysisShape`, `listGroupAnalyses`, `upsertGroupAnalysis`)
- Modify: `packages/backend/convex/lib/auditPayloads.ts` (the `payMappingGroupAnalysisUpdated` payload, around line 332)
- Test: `packages/backend/convex/payMapping/analyses.test.ts`

**Interfaces:**
- Consumes: `comparisonDocumentationKey`, `requiredDocumentationKeys` from Task 1.
- Produces: `upsertGroupAnalysis` accepts `comparisonKey?: string`; `listGroupAnalyses` returns `comparisonKey: string | null` on every row.

- [ ] **Step 1: Write the failing tests**

In `packages/backend/convex/payMapping/analyses.test.ts` (follow the file's existing convex-test setup and helpers):

```ts
it("stores reasons against one comparison, leaving the group's own row alone", async () => {
  // The group row and the pair row are separate documents: the group's
  // klarmarkering must not be overwritten by documenting a comparison.
  await upsert({ scope: "equivalentWork", groupKey: GROUP, reasons: [], done: false })
  await upsert({
    scope: "equivalentWork",
    groupKey: GROUP,
    comparisonKey: COMPARATOR,
    reasons: ["market"],
    done: false,
  })
  const rows = await list()
  expect(rows).toHaveLength(2)
  expect(rows.find((r) => r.comparisonKey === null)?.reasons).toEqual([])
  expect(rows.find((r) => r.comparisonKey === COMPARATOR)?.reasons).toEqual([
    "market",
  ])
})

it("rejects a comparison key on an equal-work row", async () => {
  // Equal work compares within one group, so a comparator key is meaningless
  // there and silently storing it would create a row nothing reads.
  await expect(
    upsert({
      scope: "equalWork",
      groupKey: EQUAL_WORK_GROUP,
      comparisonKey: COMPARATOR,
      reasons: ["market"],
      done: false,
    })
  ).rejects.toThrow()
})

it("rejects a comparison key that is not a comparator of that group", async () => {
  await expect(
    upsert({
      scope: "equivalentWork",
      groupKey: GROUP,
      comparisonKey: "Not|A|Comparator",
      reasons: ["market"],
      done: false,
    })
  ).rejects.toThrow()
})

it("refuses to mark the group done while a comparison has no reason", async () => {
  // The gate is enforced from the frozen snapshot server-side: the client's
  // view of what is documented is never trusted.
  await expect(
    upsert({ scope: "equivalentWork", groupKey: GROUP, reasons: [], done: true })
  ).rejects.toThrow()
})

it("marks the group done once every comparison carries a reason", async () => {
  for (const comparator of COMPARATORS) {
    await upsert({
      scope: "equivalentWork",
      groupKey: GROUP,
      comparisonKey: comparator,
      reasons: ["market"],
      done: false,
    })
  }
  await upsert({ scope: "equivalentWork", groupKey: GROUP, reasons: [], done: true })
  const groupRow = (await list()).find((r) => r.comparisonKey === null)
  expect(groupRow?.done).toBe(true)
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/backend && bun run test analyses`
Expected: FAIL (the argument is not accepted / no rejection happens).

- [ ] **Step 3: Accept and validate the key**

In `upsertGroupAnalysis`, add `comparisonKey: v.optional(v.string())` to `args`, destructure it, and inside the non-praxis branch replace the existing `all.has(groupKey)` block with:

```ts
      if (!all.has(groupKey)) throw appError(ERROR_CODES.notFound)
      if (comparisonKey !== undefined) {
        // Equal work compares within ONE group (DL 3 kap. 8 § p2), so there is
        // no comparator to key a row against.
        if (scope !== "equivalentWork") throw appError(ERROR_CODES.invalidInput)
        if (
          !keys.womenDominatedComparisonsAll.has(
            comparisonDocumentationKey(groupKey, comparisonKey)
          )
        )
          throw appError(ERROR_CODES.notFound)
      }
```

Change the `existing` lookup to match on the comparison key too:

```ts
    ).find(
      (row) =>
        row.scope === scope &&
        row.groupKey === groupKey &&
        (row.comparisonKey ?? null) === (comparisonKey ?? null)
    )
```

and add `...(comparisonKey !== undefined ? { comparisonKey } : {})` to the `insert` call.

- [ ] **Step 4: Enforce the done gate**

Still in the non-praxis branch, replace the existing `done && required.has(groupKey) && ...` check with:

```ts
      if (done && required.has(groupKey)) {
        if (scope === "equivalentWork") {
          // Every comparator out-earns this group, so every one of them is a
          // difference DL 3 kap. 9 § asks about. The group cannot be closed
          // while any of them is unexplained.
          const documented = new Set(
            rowsForRun
              .filter(
                (row) =>
                  row.scope === "equivalentWork" &&
                  row.groupKey === groupKey &&
                  row.comparisonKey !== undefined &&
                  row.reasons.length > 0
              )
              .map((row) =>
                comparisonDocumentationKey(row.groupKey, row.comparisonKey ?? "")
              )
          )
          const missing = [...keys.womenDominatedComparisonsRequired].filter(
            (key) => key.startsWith(`["${groupKey.replaceAll('"', '\\"')}",`) &&
              !documented.has(key)
          )
          if (missing.length > 0)
            throw appError(ERROR_CODES.payMappingDocumentationRequired)
        } else if (reasons.length === 0 && trimmedNote === "") {
          throw appError(ERROR_CODES.payMappingDocumentationRequired)
        }
      }
```

Note for the implementer: `rowsForRun` is the collected `payMappingGroupAnalyses` query the handler already runs for `existing`; hoist that `.collect()` into a named `const rowsForRun` above the `existing` lookup and derive `existing` from it, so the handler reads the table once.

The `startsWith` filter is a prefix test on the JSON composite. If it reads brittle to you, prefer rebuilding the set per group instead: iterate `keys.womenDominatedComparisonsAll` is not needed, since you can recompute the group's own comparators from `buildGapAggregates(snapshotRows).womenDominated.find((g) => g.key === groupKey)?.comparisons ?? []` and key each one. Use whichever the reviewer finds clearer; the test in Step 1 pins the behaviour either way.

- [ ] **Step 5: Return the key on the read path**

Add `comparisonKey: v.union(v.string(), v.null())` to `groupAnalysisShape` and `comparisonKey: row.comparisonKey ?? null` to the `listGroupAnalyses` mapping.

- [ ] **Step 6: Carry the comparison into the audit row**

In the audit call, add a comparator label beside `groupLabel`:

```ts
        ...(comparisonKey !== undefined
          ? { comparisonLabel: groupKeyLabel(comparisonKey) }
          : {}),
```

and add `comparisonLabel?: string` to the `payMappingGroupAnalysisUpdated` payload type in `lib/auditPayloads.ts`.

- [ ] **Step 7: Run the backend tests**

Run: `cd packages/backend && bun run test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/convex/payMapping/analyses.ts packages/backend/convex/payMapping/analyses.test.ts packages/backend/convex/lib/auditPayloads.ts
git commit -m "feat(pay-mapping): document one equivalent-work comparison at a time"
```

---

### Task 3: Filling every remaining comparison in one call

**Files:**
- Modify: `packages/backend/convex/payMapping/analyses.ts` (new mutation)
- Test: `packages/backend/convex/payMapping/analyses.test.ts`

**Interfaces:**
- Produces: `applyReasonsToRemainingComparisons({ runId, groupKey, reasons })`, an `orgMutation` returning `v.null()`.

**Why a mutation rather than a client loop:** one explanation covering many comparators must land as one atomic write, and a group's comparator count is bounded (a handful, at most a couple of dozen), so a single transaction stays inside Convex's document limits. This is the control that makes Task 1's strict gate workable.

- [ ] **Step 1: Write the failing test**

```ts
it("fills only the comparisons that have no reason yet", async () => {
  await upsert({
    scope: "equivalentWork",
    groupKey: GROUP,
    comparisonKey: COMPARATORS[0],
    reasons: ["experience"],
    done: false,
  })
  await applyToRemaining({ groupKey: GROUP, reasons: ["market"] })
  const rows = await list()
  // The already-answered comparison keeps its own reason: a bulk fill is a
  // shortcut for the unanswered ones, never an overwrite of a judgement the
  // user already made.
  expect(rows.find((r) => r.comparisonKey === COMPARATORS[0])?.reasons).toEqual([
    "experience",
  ])
  for (const comparator of COMPARATORS.slice(1)) {
    expect(rows.find((r) => r.comparisonKey === comparator)?.reasons).toEqual([
      "market",
    ])
  }
})

it("refuses an empty reason set", async () => {
  await expect(
    applyToRemaining({ groupKey: GROUP, reasons: [] })
  ).rejects.toThrow()
})
```

- [ ] **Step 2: Run to see it fail**

Run: `cd packages/backend && bun run test analyses`
Expected: FAIL, the mutation does not exist.

- [ ] **Step 3: Implement the mutation**

```ts
// Applies one explanation to every comparison of a women-dominated group that
// has none yet. An employer often has a single objective reason covering
// several comparators, and typing it once per row is what made the per-row
// gate look unworkable; this is that shortcut. It never overwrites a
// comparison that already carries reasons, because that is a judgement the
// user made deliberately.
export const applyReasonsToRemainingComparisons = orgMutation({
  args: {
    runId: v.id("payMappingRuns"),
    groupKey: v.string(),
    reasons: v.array(payGapReasonValidator),
  },
  returns: v.null(),
  handler: async (ctx, { runId, groupKey, reasons }) => {
    if (reasons.length === 0) throw appError(ERROR_CODES.invalidInput)
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)

    const snapshotRows = await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    const keys = requiredDocumentationKeys(snapshotRows)
    if (!keys.womenDominatedAll.has(groupKey))
      throw appError(ERROR_CODES.notFound)

    const rowsForRun = await ctx.db
      .query("payMappingGroupAnalyses")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    const canonical = canonicalReasons(reasons)

    let filled = 0
    for (const key of keys.womenDominatedComparisonsAll) {
      const [rowGroupKey, comparisonKey] = JSON.parse(key) as [string, string]
      if (rowGroupKey !== groupKey) continue
      const existing = rowsForRun.find(
        (row) =>
          row.scope === "equivalentWork" &&
          row.groupKey === groupKey &&
          row.comparisonKey === comparisonKey
      )
      if (existing !== undefined && existing.reasons.length > 0) continue
      filled += 1
      if (existing === undefined) {
        await ctx.db.insert("payMappingGroupAnalyses", {
          orgId: ctx.orgId,
          runId,
          scope: "equivalentWork",
          groupKey,
          comparisonKey,
          reasons: canonical,
          done: false,
        })
      } else {
        await ctx.db.patch(existing._id, { reasons: canonical })
      }
    }

    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingGroupAnalysisUpdated,
      payload: {
        runId,
        scope: "equivalentWork",
        groupLabel: groupKeyLabel(groupKey),
        filledComparisons: filled,
        changes: {},
      },
    })
    return null
  },
})
```

Add `filledComparisons?: number` to the payload type in `lib/auditPayloads.ts`.

- [ ] **Step 4: Run the backend tests**

Run: `cd packages/backend && bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/payMapping/analyses.ts packages/backend/convex/payMapping/analyses.test.ts packages/backend/convex/lib/auditPayloads.ts
git commit -m "feat(pay-mapping): apply one reason to every unexplained comparison"
```

---

### Task 4: Audit labels for the two new payload fields

**Files:**
- Modify: `apps/dashboard/lib/audit-detail.tsx` (the field-label map)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.auditLog.fields.*`)
- Test: `apps/dashboard/components/audit/audit-labels.test.ts` (the existing coverage test must pass unchanged)

**Interfaces:**
- Consumes: the payload fields `comparisonLabel` and `filledComparisons` added in Tasks 2 and 3.

**Why its own task:** the audit-label coverage test fails the build if a payload field has no label, and the log would otherwise print a raw key. This is the repo's rule, not a nicety.

- [ ] **Step 1: Run the coverage test to see it fail**

Run: `cd apps/dashboard && bun run test audit-labels`
Expected: FAIL naming `comparisonLabel` and `filledComparisons` as unlabelled.

- [ ] **Step 2: Add the labels**

In `packages/i18n/messages/en.json` under `dashboard.auditLog.fields`:

```json
"comparisonLabel": "Comparison",
"filledComparisons": "Comparisons filled"
```

Swedish: `"Jämförelse"`, `"Ifyllda jämförelser"`. Norwegian: `"Sammenligning"`, `"Utfylte sammenligninger"`. Danish: `"Sammenligning"`, `"Udfyldte sammenligninger"`. Finnish: `"Vertailu"`, `"Täytetyt vertailut"`.

- [ ] **Step 3: Run the coverage and parity tests**

Run: `cd apps/dashboard && bun run test audit-labels && cd ../../packages/i18n && bun run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/lib/audit-detail.tsx packages/i18n/messages
git commit -m "feat(pay-mapping): label the comparison fields in the audit log"
```

---

### Task 5: The reasons move to the selected comparison

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/review-group-step.tsx` (owns `selectedComparison`, line ~310, and the doc state, lines ~209-290)
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-group-analysis-form.tsx` (the reason chips; takes `scope` already)
- Modify: `apps/dashboard/components/pay-mapping/comparator-table.tsx` (the `reason` column, and its `documentation` prop comment)
- Modify: `packages/i18n/messages/*` (new strings below)
- Test: `apps/dashboard/components/pay-mapping/review-group-step.test.tsx`

**Interfaces:**
- Consumes: `upsertGroupAnalysis({ comparisonKey })` and `applyReasonsToRemainingComparisons` from Tasks 2-3; `analysis.comparisonKey` from the read path.
- Produces: no new exported API; this is the surface.

**Behaviour to build:**

1. In the equivalent-work chapter the reason chips document the SELECTED comparator row. With no row selected, the chips are not shown; the step shows the existing table and a line telling the reader to pick a comparison. Equal work keeps today's behaviour exactly (the group is the unit), so branch on `scope`.
2. The chips' heading names the pair, e.g. "Product Manager mot Strategy Engineer", so the reader can never be unsure which difference they are explaining.
3. A "gäller alla återstående" button beside the chips calls `applyReasonsToRemainingComparisons` with the currently selected reasons, then toasts `dashboard.toast.payMappingReasonsApplied`.
4. The table's `reason` column renders the stored reasons for each row (comma-joined, using the existing `dashboard.payMapping.gap.reasons.*` labels), so the table becomes the chapter's own progress view.
5. The step's "Klarmarkera och gå till nästa" is disabled while any comparison lacks a reason, with the hint text stating what is missing ("3 av 5 jämförelser saknar förklaring"), following the app's rule that a gate is stated in words rather than only disabling a control.

**New i18n keys** under `dashboard.payMapping.review`: `comparisonReasonsHeading` ("{group} compared with {comparator}"), `selectComparison` ("Pick a comparison in the table to explain its difference."), `applyToRemaining` ("Use for all remaining"), `comparisonsMissing` ("{missing} of {total} comparisons still need an explanation."). Plus `dashboard.toast.payMappingReasonsApplied` ("Reasons applied").

- [ ] **Step 1: Write the failing tests**

```ts
it("explains one comparison at a time in the equivalent-work chapter", async () => {
  renderStep({ scope: "equivalentWork" })
  // Nothing to explain until a row is picked: the chips would otherwise look
  // like they answer the whole group, which is the defect this replaces.
  expect(screen.queryByRole("button", { name: t.reasons.market })).toBeNull()
  fireEvent.click(screen.getByRole("row", { name: /Strategy Engineer/ }))
  fireEvent.click(screen.getByRole("button", { name: t.reasons.market }))
  await waitFor(() =>
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "equivalentWork",
        comparisonKey: STRATEGY_ENGINEER_KEY,
        reasons: ["market"],
      })
    )
  )
})

it("keeps equal work documenting the group as a whole", async () => {
  renderStep({ scope: "equalWork" })
  fireEvent.click(screen.getByRole("button", { name: t.reasons.market }))
  await waitFor(() =>
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "equalWork" })
    )
  )
  expect(upsertMock.mock.calls[0]?.[0]).not.toHaveProperty("comparisonKey")
})

it("blocks klarmarkering while a comparison is unexplained, and says how many", () => {
  renderStep({ scope: "equivalentWork", analyses: [reasonFor(COMPARATORS[0])] })
  expect(
    (screen.getByRole("button", { name: t.markDoneNext }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
  expect(screen.getByText(/3 av 4/)).toBeDefined()
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd apps/dashboard && bun run test review-group-step`
Expected: FAIL.

- [ ] **Step 3: Implement the surface**

Follow the behaviour list above. Keep the existing autosave discipline in `PayMappingGroupAnalysisForm` (it already saves on every edit and re-seeds from the subscription with a focus/dirty guard); the only change is which row the save targets.

- [ ] **Step 4: Correct the stale comment**

In `comparator-table.tsx`, the `documentation` prop comment ends "Optional per row, because most comparisons need nothing and requiring all of them would be unworkable at 21 groups." Replace that last sentence with the current rule and why it is now workable:

```
// Every row now carries its own objective reason (DL 3 kap. 9 § asks about
// each difference separately), which is workable because one explanation can
// fill every remaining comparison in a single click. Actions and notes stay
// per row beside it for the work layer.
```

- [ ] **Step 5: Run the tests**

Run: `cd apps/dashboard && bun run test review-group-step comparator-table`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/pay-mapping packages/i18n/messages
git commit -m "feat(pay-mapping): explain each equivalent-work comparison on its own row"
```

---

### Task 6: The report states one explanation per pair (NOT APPLICABLE)

**Status when executed (2026-08-17): no target exists.** The run's Report tab
is still a placeholder ("coming soon"), and the method appendix renders no
documentation rows at all, so there is nothing rendering group-level reasons
to correct. Nothing was written here rather than inventing a renderer the
product has not designed yet.

**Carry-forward requirement:** when the report or the metodbilaga starts
printing the equivalent-work documentation, it must list ONE explanation PER
COMPARISON, reading the rows that carry a `comparisonKey`, and must not
collapse them into one reason for the group. That is the whole point of this
change for a granskare, and a report that reads only the group's own row would
silently undo it.

<details>
<summary>The original task, kept for whoever builds the report</summary>

### Task 6 (original)

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-report.tsx`
- Modify: `packages/i18n/messages/*` if the section needs a new heading
- Test: `apps/dashboard/components/pay-mapping/pay-mapping-report.test.tsx`

**Why:** the whole point of the change is what a granskare reads. A report that still prints one reason per group would leave the new data invisible.

- [ ] **Step 1: Write the failing test**

```ts
it("prints every documented comparison with its own reason", () => {
  renderReport({ analyses: [reasonFor(STRATEGY_ENGINEER, "market"), reasonFor(CONTROLLER, "experience")] })
  const row = screen.getByRole("row", { name: /Strategy Engineer/ })
  expect(within(row).getByText(t.reasons.market)).toBeDefined()
  const other = screen.getByRole("row", { name: /Controller/ })
  expect(within(other).getByText(t.reasons.experience)).toBeDefined()
})
```

- [ ] **Step 2: Run to see it fail**

Run: `cd apps/dashboard && bun run test pay-mapping-report`
Expected: FAIL.

- [ ] **Step 3: Render the per-pair reasons in the equivalent-work section**

- [ ] **Step 4: Run the tests**

Run: `cd apps/dashboard && bun run test pay-mapping-report`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/pay-mapping/pay-mapping-report.tsx apps/dashboard/components/pay-mapping/pay-mapping-report.test.tsx
git commit -m "feat(pay-mapping): report each equivalent-work comparison's own reason"
```

---

</details>

---

### Task 7: Guide, migration and a browser pass

**Files:**
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/equivalent-work.mdx` (the "Documenting a comparison" section, which currently describes the old group-level rule)
- Run: `bun run docs:sync` from `apps/dashboard`

**Why its own task:** the guide is the assistant's only product knowledge beyond its system prompt, and it currently tells the reader something that will no longer be true. The corpus must be re-embedded in the same change or the assistant answers from stale text.

- [ ] **Step 1: Rewrite the section in English first**

State that an objective reason is recorded per comparison, that one explanation can be applied to every remaining comparison at once, and that the group is documented when every comparison carries a reason.

- [ ] **Step 2: Mirror to sv, nb, da, fi**

Every slug exists in every locale and the slug is locale-invariant. Flag the four translations as machine drafts in the final report.

- [ ] **Step 3: Sync the corpus**

Run: `cd apps/dashboard && bun run docs:sync`
Expected: the changed pages re-embed; unchanged pages cost nothing.

- [ ] **Step 4: Run the docs guards**

Run: `cd apps/dashboard && bun run test docs-guards`
Expected: PASS (locale parity, frontmatter, nav, internal links).

- [ ] **Step 5: Migrate the dev deployment and walk the surface**

The schema gained an optional field, so existing rows stay valid and no backfill is required: an equivalent-work group documented under the old rule keeps its group-level reasons, which now read as the group's summary note context and no longer satisfy the gate. Decide with the product owner whether to clear those rows in dev (`devReset`) or leave them; pre-launch, clearing is the honest default.

Then, in the browser against the dev deployment: open a run, go to kapitel 4, pick a women-dominated group, explain one comparison, use "gäller alla återstående", confirm the table's reason column fills, confirm klarmarkering unlocks only when every row is explained, and confirm the audit log's detail shows the comparison label rather than a raw key.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/content/docs
git commit -m "docs: document the per-comparison reason rule for equivalent work"
```

---

## Self-review notes

- **Spec coverage:** Decision 1 is Tasks 1-3 and 5; Decision 2 is Task 1 (required set), Task 2 (server-side gate) and Task 5 (the stated hint). The report and guide follow in Tasks 6-7. The audit rule is Task 4.
- **Equal work stays untouched** in every task; Task 5 asserts it with its own test.
- **Known soft spot:** Task 2 Step 4 offers two ways to find a group's required comparisons (a JSON prefix test, or recomputing from `buildGapAggregates`). The test pins the behaviour, so the implementer may pick either; the reviewer should prefer whichever reads clearer at the call site.
- **Not in scope:** actions and notes keep their existing per-row behaviour (ADR-0015 p7). This plan adds the structured reason beside them, it does not merge the two layers.

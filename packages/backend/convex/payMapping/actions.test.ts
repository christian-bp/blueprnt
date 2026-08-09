import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { onUserCreate } from "../accounts/mirrors"
import type { Id } from "../_generated/dataModel"
import { initConvexTest } from "../testing.helpers"

// Snapshot fixture: one SHOWN equal-work group (Analyst: 1 woman 45k + 1 man
// 50k => elevated), one gender-pure group (Lead: 2 men), and one man on a
// numerically higher (= lower-valued) level out-earning the Analyst woman
// (Support level 3 @ 50k vs w1 level 2 @ 45k: a real tvärnivå pair), so the
// action path (shown only), the note path (excluded groups allowed), and
// pair validation are all exercised against the same run.
const SHOWN_KEY = "Analyst|2"
const GENDER_PURE_KEY = "Lead|1"
const WD_GROUP_KEY = "Nurse|2"
const COMPARISON_KEY = "Support|3"

async function seedRun(
  t: ReturnType<typeof initConvexTest>,
  options: { status?: "active" | "completed" } = {}
): Promise<{
  orgId: string
  userId: string
  runId: Id<"payMappingRuns">
  asHr: ReturnType<typeof t.withIdentity>
}> {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email: "hr@acme.se", name: "HR Person", role: "admin" }
  )
  const asHr = t.withIdentity({ subject: userId })
  // Mirror the operator into the users table so resolveActorName (used at
  // read time by listActions/listNotes) can resolve owners/authors to names.
  await t.run(async (ctx) => {
    await onUserCreate(ctx, {
      _id: userId,
      email: "hr@acme.se",
      name: "HR Person",
    })
  })
  const rows = [
    {
      personPublicId: "w1",
      displayName: "Anna",
      gender: "Kvinna" as const,
      roleTitle: "Analyst",
      seniority: "Mid",
      level: 2,
      basicMonthly: 45000,
    },
    {
      personPublicId: "m1",
      displayName: "Erik",
      gender: "Man" as const,
      roleTitle: "Analyst",
      seniority: "Mid",
      level: 2,
      basicMonthly: 50000,
    },
    {
      personPublicId: "m2",
      displayName: "Lars",
      gender: "Man" as const,
      roleTitle: "Lead",
      seniority: "Staff",
      level: 1,
      basicMonthly: 90000,
    },
    {
      personPublicId: "m3",
      displayName: "Nils",
      gender: "Man" as const,
      roleTitle: "Lead",
      seniority: "Staff",
      level: 1,
      basicMonthly: 95000,
    },
    {
      personPublicId: "m4",
      displayName: "Sven",
      gender: "Man" as const,
      roleTitle: "Support",
      seniority: "Junior",
      level: 3,
      basicMonthly: 50000,
    },
    // A women-dominated group (100% women) out-earned by Support, which
    // sits on a numerically higher = lower-valued level: exactly the 3 kap.
    // 9 § comparison, so a comparison-targeted record has a real target to
    // validate against.
    {
      personPublicId: "w2",
      displayName: "Berit",
      gender: "Kvinna" as const,
      roleTitle: "Nurse",
      seniority: "Mid",
      level: 2,
      basicMonthly: 40000,
    },
    {
      personPublicId: "w3",
      displayName: "Cissi",
      gender: "Kvinna" as const,
      roleTitle: "Nurse",
      seniority: "Mid",
      level: 2,
      basicMonthly: 41000,
    },
  ]
  const runId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("payMappingRuns", {
      orgId,
      slug: "test-run",
      label: "Test run",
      status: options.status ?? "active",
      referenceDate: 1_700_000_000_000,
      initiatedBy: userId,
      initiatedAt: 1_700_000_000_000,
      systemVersion: "test",
      populationCount: rows.length,
      withPayCount: rows.length,
      womenCount: 1,
      menCount: 3,
      orgGapPct: null,
      orgGapFlag: "insufficient",
      frozenModel: { criteria: [], levelThresholds: [] },
    })
    for (const r of rows) {
      await ctx.db.insert("payMappingSnapshotRows", {
        orgId,
        runId: id,
        personPublicId: r.personPublicId,
        displayName: r.displayName,
        erased: false,
        gender: r.gender,
        roleTitle: r.roleTitle,
        trackKey: "engineering",
        seniority: r.seniority,
        level: r.level,
        score: 50,
        basicMonthly: r.basicMonthly,
        components: [],
        currency: "SEK",
      })
    }
    return id
  })
  return { orgId, userId, runId, asHr }
}

const baseAction = (ownerUserId: string) => ({
  target: {
    kind: "group" as const,
    scope: "equalWork" as const,
    groupKey: SHOWN_KEY,
  },
  problem: "Unexplained 10% gap",
  plannedAction: "Salary review in Q4",
  reason: "experience" as const,
  ownerUserId,
  plannedDate: Date.UTC(2026, 11, 1),
  estimatedCost: 42000,
  priority: "high" as const,
})

describe("payMapping actions", () => {
  it("creates a group action, lists it with the owner's name, and audits structured fields only", async () => {
    const t = initConvexTest()
    const { orgId, userId, runId, asHr } = await seedRun(t)

    const actionId = await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
    })

    const list = await asHr.query(api.payMapping.actions.listActions, {
      orgId,
      runId,
    })
    expect(list).toHaveLength(1)
    expect(list[0]?.actionId).toBe(actionId)
    expect(list[0]?.ownerName).toBe("HR Person")
    expect(list[0]?.status).toBe("notStarted")
    expect(list[0]?.estimatedCost).toBe(42000)

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.actionCreated")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
    const payload = audits[0]?.payload as Record<string, unknown>
    expect(payload.targetKind).toBe("group")
    expect(payload.targetLabel).toBe("Analyst")
    const changes = payload.changes as Record<string, { to: unknown }>
    expect(changes.status?.to).toBe("notStarted")
    expect(changes.priority?.to).toBe("high")
    expect(changes.plannedDate?.to).toBe("2026-12-01")
    expect(changes.reason?.to).toBe("experience")
    // Free text, owner, and cost never enter the trail (ADR-0015).
    expect(changes.problem).toBeUndefined()
    expect(changes.ownerUserId).toBeUndefined()
    expect(changes.estimatedCost).toBeUndefined()
    expect(JSON.stringify(payload)).not.toContain("Unexplained")
  })

  it("omits an unset optional field from the create diff", async () => {
    const t = initConvexTest()
    const { orgId, userId, runId, asHr } = await seedRun(t)
    const { reason: _reason, ...withoutReason } = baseAction(userId)
    await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...withoutReason,
    })
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.actionCreated")
        )
        .collect()
    )
    const payload = audits[0]?.payload as
      | { changes: Record<string, unknown> }
      | undefined
    const changes = payload?.changes ?? {}
    // An optional field the user left unset is not a change: including it
    // rendered as an empty-valued "Sakligt skäl: " row in the log.
    expect("reason" in changes).toBe(false)
    expect("status" in changes).toBe(true)
  })

  it("accepts a person target in the group and a valid tvärnivå pair", async () => {
    const t = initConvexTest()
    const { orgId, userId, runId, asHr } = await seedRun(t)

    await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
      target: {
        kind: "person",
        scope: "equalWork",
        groupKey: SHOWN_KEY,
        personPublicId: "w1",
      },
    })
    // m4 (Support, level 3, 50k) out-earns w1 (Analyst, level 2, 45k) from a
    // numerically higher = lower-valued level: the engine's own tvärnivå
    // rule, which pair validation enforces.
    await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
      target: {
        kind: "comparison",
        groupKey: WD_GROUP_KEY,
        comparisonKey: COMPARISON_KEY,
      },
    })

    const list = await asHr.query(api.payMapping.actions.listActions, {
      orgId,
      runId,
    })
    expect(list.map((a) => a.target.kind).sort()).toEqual([
      "comparison",
      "person",
    ])
  })

  it("rejects excluded groups, unknown or out-of-group people, non-pairs, and non-member owners", async () => {
    const t = initConvexTest()
    const { orgId, userId, runId, asHr } = await seedRun(t)

    // A gender-pure group never takes a formal action.
    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        target: {
          kind: "group",
          scope: "equalWork",
          groupKey: GENDER_PURE_KEY,
        },
      })
    ).rejects.toThrow(/errors.notFound/)

    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        target: {
          kind: "person",
          scope: "equalWork",
          groupKey: SHOWN_KEY,
          personPublicId: "ghost",
        },
      })
    ).rejects.toThrow(/errors.notFound/)

    // A person target must belong to the exact group it anchors to: m4 is
    // real but is not a member of the Analyst group.
    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        target: {
          kind: "person",
          scope: "equalWork",
          groupKey: SHOWN_KEY,
          personPublicId: "m4",
        },
      })
    ).rejects.toThrow(/errors.notFound/)

    // womanPublicId must be a woman: m2 is a man.
    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        target: {
          kind: "comparison",
          groupKey: WD_GROUP_KEY,
          comparisonKey: "nope|9",
        },
      })
    ).rejects.toThrow(/errors.notFound/)

    // A real woman + a real man who are NOT a tvärnivå pair: m2 sits on a
    // numerically lower = higher-valued level than w1, so out-earning her
    // is not the statutory warning sign.
    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        target: {
          kind: "comparison",
          groupKey: "nope|9",
          comparisonKey: COMPARISON_KEY,
        },
      })
    ).rejects.toThrow(/errors.notFound/)

    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction("not-a-member"),
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("re-validates numeric content: a non-finite date or a negative cost never lands", async () => {
    const t = initConvexTest()
    const { orgId, userId, runId, asHr } = await seedRun(t)

    // v.number() accepts NaN; without the guard plannedDateIso would throw
    // a raw RangeError after the insert instead of a translatable code.
    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        plannedDate: Number.NaN,
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        estimatedCost: -5000,
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        estimatedCost: Number.POSITIVE_INFINITY,
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("diffs a re-target as an arrow and marks detail-only edits, without leaking the text", async () => {
    const t = initConvexTest()
    const { orgId, userId, runId, asHr } = await seedRun(t)
    const actionId = await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
    })

    // Edit 1: only the free text changes: the diff carries the marker and
    // nothing else, and the text itself stays out of the trail.
    await asHr.mutation(api.payMapping.actions.updateAction, {
      orgId,
      actionId,
      ...baseAction(userId),
      problem: "Rewritten problem description",
    })
    // Edit 2: the target moves from the group to a person in it.
    await asHr.mutation(api.payMapping.actions.updateAction, {
      orgId,
      actionId,
      ...baseAction(userId),
      problem: "Rewritten problem description",
      target: {
        kind: "person",
        scope: "equalWork",
        groupKey: SHOWN_KEY,
        personPublicId: "w1",
      },
    })

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.actionUpdated")
        )
        .collect()
    )
    expect(audits).toHaveLength(2)
    const first = audits[0]?.payload as { changes: Record<string, unknown> }
    expect(first.changes).toEqual({
      detailsChanged: { from: null, to: true },
    })
    expect(JSON.stringify(first)).not.toContain("Rewritten")
    const second = audits[1]?.payload as { changes: Record<string, unknown> }
    expect(second.changes).toEqual({
      targetKind: { from: "group", to: "person" },
    })
  })

  it("locks creation, content edits and deletes on a completed run, but keeps status moves open", async () => {
    const t = initConvexTest()
    const { orgId, userId, runId, asHr } = await seedRun(t)
    const actionId = await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(runId, { status: "completed" })
    })

    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
      })
    ).rejects.toThrow(/errors.payMappingRunCompleted/)
    await expect(
      asHr.mutation(api.payMapping.actions.updateAction, {
        orgId,
        actionId,
        ...baseAction(userId),
      })
    ).rejects.toThrow(/errors.payMappingRunCompleted/)
    await expect(
      asHr.mutation(api.payMapping.actions.deleteAction, { orgId, actionId })
    ).rejects.toThrow(/errors.payMappingRunCompleted/)

    // The follow-up years: status moves stay open (ADR-0015).
    await asHr.mutation(api.payMapping.actions.setActionStatus, {
      orgId,
      actionId,
      status: "inProgress",
    })
    const list = await asHr.query(api.payMapping.actions.listActions, {
      orgId,
      runId,
    })
    expect(list[0]?.status).toBe("inProgress")
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.actionStatusChanged")
        )
        .collect()
    )
    expect(audits).toHaveLength(1)
  })

  it("deletes an action on an active run and audits it", async () => {
    const t = initConvexTest()
    const { orgId, userId, runId, asHr } = await seedRun(t)
    const actionId = await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
    })
    await asHr.mutation(api.payMapping.actions.deleteAction, {
      orgId,
      actionId,
    })
    const list = await asHr.query(api.payMapping.actions.listActions, {
      orgId,
      runId,
    })
    expect(list).toHaveLength(0)
  })

  it("run deletion removes its actions and notes child-first", async () => {
    const t = initConvexTest()
    const { orgId, userId, runId, asHr } = await seedRun(t)
    await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
    })
    await asHr.mutation(api.payMapping.notes.createNote, {
      orgId,
      runId,
      target: { kind: "group", scope: "equalWork", groupKey: SHOWN_KEY },
      text: "Discuss with the union",
      noteType: "discussionNeeded",
    })
    await asHr.mutation(api.payMapping.runs.deletePayMappingRun, {
      orgId,
      runId,
    })
    const leftovers = await t.run(async (ctx) => ({
      actions: (
        await ctx.db
          .query("payMappingActions")
          .withIndex("by_run", (q) => q.eq("orgId", orgId).eq("runId", runId))
          .collect()
      ).length,
      notes: (
        await ctx.db
          .query("payMappingNotes")
          .withIndex("by_run", (q) => q.eq("orgId", orgId).eq("runId", runId))
          .collect()
      ).length,
    }))
    expect(leftovers).toEqual({ actions: 0, notes: 0 })
  })

  it("isolates cross-org access", async () => {
    const t = initConvexTest()
    const { runId } = await seedRun(t)
    const { orgId: otherOrg, userId: otherUser } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "other@beta.se", name: "Other", role: "admin" }
    )
    const asOther = t.withIdentity({ subject: otherUser })
    const list = await asOther.query(api.payMapping.actions.listActions, {
      orgId: otherOrg,
      runId,
    })
    expect(list).toEqual([])
  })
})

describe("payMapping notes", () => {
  it("creates a note on a gender-pure (excluded) group, lists it with the author, and audits without the text", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t)

    const noteId = await asHr.mutation(api.payMapping.notes.createNote, {
      orgId,
      runId,
      target: { kind: "group", scope: "equalWork", groupKey: GENDER_PURE_KEY },
      text: "All-male group; recruitment history explains it",
      noteType: "objectiveReason",
    })

    const list = await asHr.query(api.payMapping.notes.listNotes, {
      orgId,
      runId,
    })
    expect(list).toHaveLength(1)
    expect(list[0]?.noteId).toBe(noteId)
    expect(list[0]?.createdByName).toBe("HR Person")

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.noteCreated")
        )
        .collect()
    )
    const payload = audits[0]?.payload as Record<string, unknown>
    expect(payload.noteType).toBe("objectiveReason")
    expect(payload.targetLabel).toBe("Lead")
    expect(JSON.stringify(payload)).not.toContain("recruitment")
  })

  it("updates the classification with a noteType-only diff, and locks fully on a completed run", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t)
    const noteId = await asHr.mutation(api.payMapping.notes.createNote, {
      orgId,
      runId,
      target: { kind: "group", scope: "equalWork", groupKey: SHOWN_KEY },
      text: "Needs a second look",
      noteType: "discussionNeeded",
    })
    await asHr.mutation(api.payMapping.notes.updateNote, {
      orgId,
      noteId,
      text: "Needs a second look, updated",
      noteType: "noActionNeeded",
    })
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "payMapping.noteUpdated")
        )
        .collect()
    )
    const payload = audits[0]?.payload as
      | { changes: Record<string, unknown> }
      | undefined
    // The classification diffs; the text edit is only a marker, never the
    // text itself.
    expect(Object.keys(payload?.changes ?? {}).sort()).toEqual([
      "detailsChanged",
      "noteType",
    ])
    expect(JSON.stringify(payload)).not.toContain("second look")

    await t.run(async (ctx) => {
      await ctx.db.patch(runId, { status: "completed" })
    })
    await expect(
      asHr.mutation(api.payMapping.notes.updateNote, {
        orgId,
        noteId,
        text: "x",
        noteType: "discussionNeeded",
      })
    ).rejects.toThrow(/errors.payMappingRunCompleted/)
    await expect(
      asHr.mutation(api.payMapping.notes.deleteNote, { orgId, noteId })
    ).rejects.toThrow(/errors.payMappingRunCompleted/)
  })

  it("rejects an unknown group key and empty text", async () => {
    const t = initConvexTest()
    const { orgId, runId, asHr } = await seedRun(t)
    await expect(
      asHr.mutation(api.payMapping.notes.createNote, {
        orgId,
        runId,
        target: { kind: "group", scope: "equalWork", groupKey: "Nope|1" },
        text: "text",
        noteType: "discussionNeeded",
      })
    ).rejects.toThrow(/errors.notFound/)
    await expect(
      asHr.mutation(api.payMapping.notes.createNote, {
        orgId,
        runId,
        target: { kind: "group", scope: "equalWork", groupKey: SHOWN_KEY },
        text: "   ",
        noteType: "discussionNeeded",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })
})

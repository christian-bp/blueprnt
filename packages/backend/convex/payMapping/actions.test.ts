import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { onUserCreate } from "../accounts/mirrors"
import type { Id } from "../_generated/dataModel"
import { initConvexTest } from "../testing.helpers"

// Snapshot fixture: one SHOWN equal-work group (Analyst: 1 woman 45k + 1 man
// 50k => elevated), one gender-pure group (Lead: 2 men), so both the
// action path (shown only) and the note path (excluded groups allowed) are
// exercised against the same run.
const SHOWN_KEY = "Analyst|2|Mid"
const GENDER_PURE_KEY = "Lead|1|Staff"

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
    expect(payload.targetLabel).toBe("Analyst · Mid")
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
    // The woman on level 2 out-earned by the level-1 men is not this
    // fixture's shape, but pair validation only requires a real woman and a
    // real man from the snapshot.
    await asHr.mutation(api.payMapping.actions.createAction, {
      orgId,
      runId,
      ...baseAction(userId),
      target: { kind: "pair", womanPublicId: "w1", manPublicId: "m2" },
    })

    const list = await asHr.query(api.payMapping.actions.listActions, {
      orgId,
      runId,
    })
    expect(list.map((a) => a.target.kind).sort()).toEqual(["pair", "person"])
  })

  it("rejects excluded groups, unknown people, swapped pair genders, and non-member owners", async () => {
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

    // womanPublicId must be a woman: m2 is a man.
    await expect(
      asHr.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        ...baseAction(userId),
        target: { kind: "pair", womanPublicId: "m2", manPublicId: "m3" },
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
    expect(payload.targetLabel).toBe("Lead · Staff")
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
    expect(Object.keys(payload?.changes ?? {})).toEqual(["noteType"])

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
        target: { kind: "group", scope: "equalWork", groupKey: "Nope|1|X" },
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

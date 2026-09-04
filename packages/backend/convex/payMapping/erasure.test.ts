import { TRACK_SENIORITIES } from "@workspace/constants"
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
import { equalWorkGroupKey } from "./gap"

// A fixed past timestamp for the seeded pay record, so its effectiveAt is
// always <= the freeze reference date (Date.now() inside the mutation).
const PAST = 1_700_000_000_000

// Seeds an org with a template model, one fully evaluated role, and one
// classified active person who carries a birthDate and a pay record. Returns
// the org id, an HR (admin) identity wrapper, the person's internal id, and
// its publicId (the key the frozen snapshot rows carry).
async function seedPersonAndFreeze(t: ReturnType<typeof initConvexTest>) {
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

  // Model with criteria + level rules.
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  for (const libraryKey of [
    "knowledge-depth",
    "knowledge-breadth",
    "complexity-ambiguity",
    "communication-effort",
    "scope-impact",
    "autonomy-mandate",
    "risk-consequence",
    "safety-exposure",
  ] as const) {
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey,
    })
  }
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("seed: model")
  // Decide working conditions, approve every criterion, and approve the
  // model itself, all directly (bypassing setWorkingConditionsDecision/
  // setCriterionApproval/approveModel's own checklist re-validation, like
  // the ratings and the completion below): the preconditions gate now also
  // requires a CURRENT approval AND a passing checklist re-check
  // (methodBlockersPass, belt-and-braces) before a run can start, and this
  // fixture is about erasure mechanics, not the approval lifecycle. All
  // three are needed for that re-check to actually pass: the seeded
  // safety-exposure criterion means workingConditionsTested only clears with
  // a decided, active materiality (undecided reads as a blocker failure, not
  // a vacuous pass), and documentationComplete reads each criterion's own
  // `approved` flag directly (buildMethodCheckInput's `documented:
  // row.approved === true`), so a model patched to look approved while its
  // criteria or its materiality decision are not would fail that re-check.
  await t.run(async (ctx) => {
    const modelDocId = ctx.db.normalizeId("models", model.modelId)
    if (modelDocId === null) throw new Error("seed: model id")
    await ctx.db.patch(modelDocId, {
      workingConditions: {
        status: "active",
        motivation: "Rollen exponeras regelbundet for sakerhetsrisker.",
        decidedBy: userId,
        decidedAt: Date.now(),
      },
      approval: { approvedBy: userId, approvedAt: Date.now() },
    })
    for (const criterion of model.criteria) {
      const criterionDocId = ctx.db.normalizeId(
        "criteria",
        criterion.criterionId
      )
      if (criterionDocId === null) throw new Error("seed: criterion id")
      await ctx.db.patch(criterionDocId, {
        approved: true,
        decidedBy: userId,
        decidedAt: Date.now(),
      })
    }
  })
  const track = model.tracks[0]
  if (track === undefined) throw new Error("seed: track")
  const seniority =
    TRACK_SENIORITIES[track.key as keyof typeof TRACK_SENIORITIES][0]
  if (seniority === undefined) throw new Error("seed: seniority")

  // One role, fully evaluated (all criteria rated => complete => level/score).
  const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Software Engineer",
    function: "Engineering",
    team: "Platform",
    trackKey: track.key,
  })
  await t.run(async (ctx) => {
    const roleDocId = ctx.db.normalizeId("roles", roleId as string)
    if (roleDocId === null) throw new Error("seed: role id")
    for (const criterion of model.criteria) {
      const criterionDocId = ctx.db.normalizeId(
        "criteria",
        criterion.criterionId
      )
      if (criterionDocId === null) throw new Error("seed: criterion id")
      await ctx.db.insert("ratings", {
        orgId,
        roleId: roleDocId,
        criterionId: criterionDocId,
        value: 5,
      })
    }
    // Complete directly (bypassing completeAssessment's own gates, like the
    // ratings
    // above bypass setRating): the preconditions gate now requires evaluated
    // AND completed (spec 2.4/6), and this fixture is about erasure
    // mechanics, not the completion lifecycle.
    await ctx.db.patch(roleDocId, {
      assessment: { completedBy: userId, completedAt: Date.now() },
    })
  })

  // One classified person, with a birthDate, open assignment to the
  // evaluated role, and a pay record.
  const { personId, publicId } = await asAdmin.mutation(
    api.people.people.createPerson,
    {
      orgId,
      displayName: "Anna Svensson",
      gender: "Kvinna",
      birthDate: "1990-01-01",
    }
  )
  await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
    orgId,
    personId,
    roleId,
    seniority,
    senioritySource: "confirmed",
  })
  await t.run(async (ctx) => {
    await ctx.db.insert("payRecords", {
      orgId,
      personId,
      payYear: 2026,
      source: "manual",
      basis: "monthly",
      basicAmount: 50000,
      currency: "SEK",
      components: [],
      effectiveAt: PAST,
      createdAt: PAST,
    })
  })

  // A second, male member of the same role: the group becomes mixed-gender,
  // so it is a SHOWN equal-work group and formal actions can target its
  // members (a single-person group is gender-pure and takes notes only).
  const { personId: manId } = await asAdmin.mutation(
    api.people.people.createPerson,
    {
      orgId,
      displayName: "Erik Larsson",
      gender: "Man",
    }
  )
  await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
    orgId,
    personId: manId,
    roleId,
    seniority,
    senioritySource: "confirmed",
  })
  await t.run(async (ctx) => {
    await ctx.db.insert("payRecords", {
      orgId,
      personId: manId,
      payYear: 2026,
      source: "manual",
      basis: "monthly",
      basicAmount: 52000,
      currency: "SEK",
      components: [],
      effectiveAt: PAST,
      createdAt: PAST,
    })
  })

  // Freeze the population into a kartläggning snapshot.
  await asAdmin.mutation(api.payMapping.runs.startPayMappingRun, {
    orgId,
    label: "Test",
  })

  return { orgId, asAdmin, personId, publicId, adminUserId: userId }
}

describe("erasure pseudonymizes snapshot rows", () => {
  it("tombstones name + clears birthDate, keeps gender/level/pay", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, personId, publicId } = await seedPersonAndFreeze(t)

    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
      orgId,
      personId,
    })

    const rows = await t.run((ctx) =>
      ctx.db
        .query("payMappingSnapshotRows")
        .withIndex("by_org_person", (q) =>
          q.eq("orgId", orgId).eq("personPublicId", publicId)
        )
        .collect()
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.erased).toBe(true)
    expect(rows[0]?.displayName).toBe("deleted user")
    expect(rows[0]?.birthDate).toBeUndefined()
    // Aggregate is kept: gender/level/pay survive the erasure untouched.
    expect(rows[0]?.gender).toBe("Kvinna")
    expect(typeof rows[0]?.level).toBe("number")
    expect(rows[0]?.basicMonthly).toBe(50000)

    // The live person row is gone.
    expect(await t.run((ctx) => ctx.db.get(personId))).toBeNull()
  })
})

describe("erasure tombstones the person's work-layer rows (ADR-0027)", () => {
  it("clears free text on person-targeted actions/notes, keeps structure, leaves group rows alone", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, personId, publicId } = await seedPersonAndFreeze(t)

    // Rows are inserted directly (bypassing createAction's target validation):
    // the subject here is the erasure hook's index lookup and patch, not the
    // work-layer mutations' own gates, which their tests already cover.
    const { personActionId, groupActionId, noteId } = await t.run(
      async (ctx) => {
        const run = await ctx.db
          .query("payMappingRuns")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .first()
        if (run === null) throw new Error("seed: run")
        // Keep the run's counter consistent with the two numbers inserted
        // below (direct inserts bypass createAction's own bump).
        await ctx.db.patch(run._id, { actionCounter: 2 })
        const base = {
          orgId,
          runId: run._id,
          reason: undefined,
          ownerUserId: "user-1",
          plannedDate: PAST,
          estimatedCost: 12000,
          priority: "high" as const,
          status: "notStarted" as const,
          createdBy: "user-1",
          createdAt: PAST,
        }
        const personActionId = await ctx.db.insert("payMappingActions", {
          ...base,
          target: {
            kind: "person",
            scope: "equalWork",
            groupKey: "Software Engineer|3",
            personPublicId: publicId,
          },
          number: 1,
          problem: "Anna Svensson ligger efter sin grupp",
          plannedAction: "Justera Annas lon vid revisionen",
        })
        const groupActionId = await ctx.db.insert("payMappingActions", {
          ...base,
          target: {
            kind: "group",
            scope: "equalWork",
            groupKey: "Software Engineer|3",
          },
          number: 2,
          problem: "Gruppens gap over troskeln",
          plannedAction: "Se over gruppens lonesattning",
        })
        const noteId = await ctx.db.insert("payMappingNotes", {
          orgId,
          runId: run._id,
          target: {
            kind: "person",
            scope: "equalWork",
            groupKey: "Software Engineer|3",
            personPublicId: publicId,
          },
          text: "Anna Svensson har ett individuellt tillagg",
          noteType: "objectiveReason",
          createdBy: "user-1",
          createdAt: PAST,
        })
        return { personActionId, groupActionId, noteId }
      }
    )

    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
      orgId,
      personId,
    })

    const personAction = await t.run((ctx) => ctx.db.get(personActionId))
    expect(personAction?.erased).toBe(true)
    expect(personAction?.problem).toBe("")
    expect(personAction?.plannedAction).toBe("")
    // The tombstoned row keeps its number, so a number printed in a document
    // never shifts after an erasure.
    expect(personAction?.number).toBe(1)
    // Structure survives: the statutory evaluation of the plan stays truthful.
    expect(personAction?.status).toBe("notStarted")
    expect(personAction?.estimatedCost).toBe(12000)
    // The pseudonym link is kept: it resolves to the snapshot row whose
    // display value the snapshot hook has already tombstoned.
    expect(
      personAction?.target.kind === "person"
        ? personAction.target.personPublicId
        : null
    ).toBe(publicId)

    const note = await t.run((ctx) => ctx.db.get(noteId))
    expect(note?.erased).toBe(true)
    expect(note?.text).toBe("")

    const groupAction = await t.run((ctx) => ctx.db.get(groupActionId))
    expect(groupAction?.erased).toBeUndefined()
    expect(groupAction?.problem).toBe("Gruppens gap over troskeln")
  })

  it("reaches every run in the org but never another org's rows", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, personId, publicId } = await seedPersonAndFreeze(t)

    const { secondRunActionId, otherOrgActionId } = await t.run(async (ctx) => {
      const run = await ctx.db
        .query("payMappingRuns")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first()
      if (run === null) throw new Error("seed: run")
      const { _id, _creationTime, ...runFields } = run
      // A second run in the same org: the hook rides by_org_person, so rows
      // in EVERY run of the org must be reached.
      const secondRunId = await ctx.db.insert("payMappingRuns", {
        ...runFields,
        slug: "test-2",
        label: "Test 2",
      })
      const rowFields = (runId: typeof secondRunId, org: string) => ({
        orgId: org,
        runId,
        target: {
          kind: "person" as const,
          scope: "equalWork" as const,
          groupKey: "Software Engineer|3",
          personPublicId: publicId,
        },
        number: 1,
        problem: "Namnger Anna Svensson",
        plannedAction: "Justering",
        ownerUserId: "u1",
        plannedDate: PAST,
        priority: "low" as const,
        status: "notStarted" as const,
        createdBy: "u1",
        createdAt: PAST,
      })
      const secondRunActionId = await ctx.db.insert(
        "payMappingActions",
        rowFields(secondRunId, orgId)
      )
      // Another org holding a row with the SAME publicId (synthetic, but it
      // is exactly what the index's orgId prefix must fence off).
      const otherRunId = await ctx.db.insert("payMappingRuns", {
        ...runFields,
        orgId: "other-org",
        slug: "other",
        label: "Other",
      })
      const otherOrgActionId = await ctx.db.insert(
        "payMappingActions",
        rowFields(otherRunId, "other-org")
      )
      return { secondRunActionId, otherOrgActionId }
    })

    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
      orgId,
      personId,
    })

    const secondRunAction = await t.run((ctx) => ctx.db.get(secondRunActionId))
    expect(secondRunAction?.erased).toBe(true)
    expect(secondRunAction?.problem).toBe("")

    const otherOrgAction = await t.run((ctx) => ctx.db.get(otherOrgActionId))
    expect(otherOrgAction?.erased).toBeUndefined()
    expect(otherOrgAction?.problem).toBe("Namnger Anna Svensson")
  })
})

describe("an erased person takes no new work-layer documentation (ADR-0027)", () => {
  it("refuses new person records and content rewrites; status and delete stay open", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, personId, publicId, adminUserId } =
      await seedPersonAndFreeze(t)

    const { runId, groupKey } = await t.run(async (ctx) => {
      const run = await ctx.db
        .query("payMappingRuns")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first()
      if (run === null) throw new Error("seed: run")
      const row = await ctx.db
        .query("payMappingSnapshotRows")
        .withIndex("by_org_person", (q) =>
          q.eq("orgId", orgId).eq("personPublicId", publicId)
        )
        .first()
      if (row === null) throw new Error("seed: snapshot row")
      return { runId: run._id, groupKey: equalWorkGroupKey(row) }
    })
    const target = {
      kind: "person" as const,
      scope: "equalWork" as const,
      groupKey,
      personPublicId: publicId,
    }
    const content = {
      problem: "Gap mot gruppens man",
      plannedAction: "Justering vid revision",
      ownerUserId: adminUserId,
      plannedDate: PAST,
      priority: "medium" as const,
    }
    const actionId = await asAdmin.mutation(
      api.payMapping.actions.createAction,
      { orgId, runId, target, ...content }
    )
    const noteId = await asAdmin.mutation(api.payMapping.notes.createNote, {
      orgId,
      runId,
      target,
      text: "Individuellt tillagg dokumenterat",
      noteType: "objectiveReason",
    })

    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
      orgId,
      personId,
    })

    // A content rewrite of the tombstoned row is refused (the stale-marker
    // trap: new text under a permanent tombstone), and so is any NEW record
    // against the dead pseudonym (the one-time sweep would never scrub it).
    await expect(
      asAdmin.mutation(api.payMapping.actions.updateAction, {
        orgId,
        actionId,
        target,
        ...content,
        problem: "Omskrivet innehall",
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asAdmin.mutation(api.payMapping.actions.createAction, {
        orgId,
        runId,
        target,
        ...content,
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asAdmin.mutation(api.payMapping.notes.createNote, {
        orgId,
        runId,
        target,
        text: "Ny notering",
        noteType: "objectiveReason",
      })
    ).rejects.toThrow(/errors.invalidInput/)
    // The tombstoned note cannot be rewritten either (updateNote never
    // revalidates its target, so this rides the row-level guard).
    await expect(
      asAdmin.mutation(api.payMapping.notes.updateNote, {
        orgId,
        noteId,
        text: "Omskriven notering",
        noteType: "objectiveReason",
      })
    ).rejects.toThrow(/errors.invalidInput/)

    // Follow-up continues and the recovery path stays open.
    await asAdmin.mutation(api.payMapping.actions.setActionStatus, {
      orgId,
      actionId,
      status: "inProgress",
    })
    await asAdmin.mutation(api.payMapping.actions.deleteAction, {
      orgId,
      actionId,
    })
    expect(await t.run((ctx) => ctx.db.get(actionId))).toBeNull()
  })
})

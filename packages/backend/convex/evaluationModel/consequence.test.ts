import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { grantModelApproval, initConvexTest } from "../testing.helpers"
import { buildModelEvidence } from "./evidence"

// The dimension caps bound how many criteria each dimension may carry
// (2/2/3/1), so a seed of eight has to respect them.
const EIGHT_KEYS = [
  "knowledge-depth",
  "knowledge-breadth",
  "complexity-ambiguity",
  "communication-effort",
  "scope-impact",
  "autonomy-mandate",
  "risk-consequence",
  "safety-exposure",
] as const

async function seedOrg(t: ReturnType<typeof initConvexTest>) {
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
  await asAdmin.mutation(api.evaluationModel.model.createDefaultModel, {
    orgId,
  })
  for (const libraryKey of EIGHT_KEYS) {
    await asAdmin.mutation(api.evaluationModel.criteria.activateCriterion, {
      orgId,
      libraryKey,
    })
  }
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("model not seeded")
  await grantModelApproval(t, orgId)
  return { orgId, asAdmin, model, userId }
}

async function lockedRole(args: {
  orgId: string
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>
  model: { criteria: { criterionId: string }[] }
  title: string
  value: number
  // Optional unevenness: the criterion rated at the top of the scale and the
  // one rated at its floor, so a weight moving between them moves the role.
  high?: string
  low?: string
}) {
  const { roleId } = await args.asAdmin.mutation(
    api.assessment.roles.createRole,
    {
      orgId: args.orgId,
      title: args.title,
      function: "engineering",
      team: "Core",
      trackKey: "IC",
      purpose: "Purpose",
      responsibilities: "Responsibilities",
    }
  )
  for (const criterion of args.model.criteria) {
    const value =
      criterion.criterionId === args.high
        ? 5
        : criterion.criterionId === args.low
          ? 1
          : args.value
    await args.asAdmin.mutation(api.assessment.ratings.setRating, {
      orgId: args.orgId,
      roleId,
      criterionId: criterion.criterionId as Id<"criteria">,
      value,
      motivation: "Fixture.",
    })
  }
  await args.asAdmin.mutation(api.assessment.completion.completeAssessment, {
    orgId: args.orgId,
    roleId,
  })
  return roleId
}

// Writes the approval buffer, then moves the live weights so the same ratings
// score differently. This is exactly the shape the panel exists for: a method
// edit after an approval.
async function reweight(
  t: ReturnType<typeof initConvexTest>,
  model: { criteria: { criterionId: string }[] },
  from: number,
  to: number
) {
  const gained = model.criteria[0]
  const lost = model.criteria[1]
  if (gained === undefined || lost === undefined) throw new Error("seed")
  await t.run(async (ctx) => {
    await ctx.db.patch(gained.criterionId as Id<"criteria">, {
      weightPoints: to,
    })
    await ctx.db.patch(lost.criterionId as Id<"criteria">, {
      weightPoints: from,
    })
  })
}

// Writes the approval buffer the way approveModel does, without going through
// the approval gate. approveModel refuses a second approval and requires the
// full method checklist to pass; this file is about the COMPARISON, so it
// stamps the buffer with the real builder and leaves the checklist to
// approval.test.ts.
async function bufferApproval(
  t: ReturnType<typeof initConvexTest>,
  orgId: string
) {
  await t.run(async (ctx) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    if (model === null) throw new Error("no model")
    await ctx.db.patch(model._id, {
      lastApprovedModel: await buildModelEvidence(ctx, model, "sv"),
    })
  })
}

describe("getConsequenceAnalysis", () => {
  it("says nothing when the model has never been approved", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    // grantModelApproval sets the approval but not the buffer.
    const analysis = await asAdmin.query(
      api.evaluationModel.consequence.getConsequenceAnalysis,
      { orgId }
    )
    expect(analysis.comparable).toBe(false)
    expect(analysis.moved).toBe(0)
    expect(analysis.movers).toEqual([])
  })

  it("says nothing when the method has not moved since the approval", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedOrg(t)
    await lockedRole({ orgId, asAdmin, model, title: "Analyst", value: 3 })
    await bufferApproval(t, orgId)

    const analysis = await asAdmin.query(
      api.evaluationModel.consequence.getConsequenceAnalysis,
      { orgId }
    )
    expect(analysis.comparable).toBe(true)
    expect(analysis.moved).toBe(0)
  })

  it("reports the roles a reweighting would move, from and to", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedOrg(t)
    // A UNIFORMLY rated role scores the same under any weighting (5 everywhere
    // is 100 however the points are spread), so moving weight between criteria
    // would change nothing. The mover has to be UNEVEN across the two criteria
    // whose weights swap.
    const top = await lockedRole({
      orgId,
      asAdmin,
      model,
      title: "Uneven",
      value: 3,
      high: model.criteria[0]?.criterionId,
      low: model.criteria[1]?.criterionId,
    })
    await lockedRole({ orgId, asAdmin, model, title: "Low", value: 1 })
    await bufferApproval(t, orgId)
    await reweight(t, model, 1, 5)

    const analysis = await asAdmin.query(
      api.evaluationModel.consequence.getConsequenceAnalysis,
      { orgId }
    )
    expect(analysis.comparable).toBe(true)
    expect(analysis.placed).toBe(2)
    // NON-VACUOUS: something has to actually move, or every assertion below is
    // a loop over an empty list. This is what proves the approved run scores
    // under the BUFFER's weights and not the live ones.
    expect(analysis.moved).toBeGreaterThan(0)
    expect(analysis.movers.length).toBe(analysis.moved)
    for (const mover of analysis.movers) {
      expect(mover.title).not.toBe("")
      expect(mover.from).not.toBe(mover.to)
    }
    // The distribution covers all four zones on both sides.
    expect(analysis.distribution.map((entry) => entry.zone)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ])
    expect(
      analysis.distribution.reduce((sum, entry) => sum + entry.now, 0)
    ).toBeGreaterThan(0)
    expect(top).toBeDefined()
  })

  // The model is at its 8-criterion ceiling, so "added since the approval" is
  // shown by REMOVING one from the buffer: the live model then carries a
  // criterion the approved method did not, which is the same asymmetry.
  it("counts a criterion the approved method did not carry", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedOrg(t)
    await lockedRole({ orgId, asAdmin, model, title: "Analyst", value: 3 })
    await bufferApproval(t, orgId)
    await t.run(async (ctx) => {
      const doc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      const buffer = doc?.lastApprovedModel
      if (doc === null || buffer === undefined) throw new Error("no buffer")
      await ctx.db.patch(doc._id, {
        lastApprovedModel: { ...buffer, criteria: buffer.criteria.slice(1) },
      })
    })

    const analysis = await asAdmin.query(
      api.evaluationModel.consequence.getConsequenceAnalysis,
      { orgId }
    )
    expect(analysis.criteriaAdded).toBe(1)
    expect(analysis.criteriaRemoved).toBe(0)
  })

  // THE PRIVACY RULE. The gender aggregate is counts per ROLE class; no person
  // id, no name, no per-person row may leave the query. Asserted against the
  // whole serialized wire so a future field cannot slip past a key list.
  it("carries no person identifier anywhere on the wire", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedOrg(t)
    // Uneven across the two criteria whose weights swap, or the reweighting
    // moves nothing and the movers list this test is about stays empty.
    const roleId = await lockedRole({
      orgId,
      asAdmin,
      model,
      title: "Analyst",
      value: 3,
      high: model.criteria[0]?.criterionId,
      low: model.criteria[1]?.criterionId,
    })
    await lockedRole({ orgId, asAdmin, model, title: "Low", value: 1 })
    await bufferApproval(t, orgId)
    await reweight(t, model, 1, 5)

    const personId = await asAdmin.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Anna Andersson",
      gender: "Kvinna",
    })
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId: personId.personId,
      roleId,
      seniority: "IC3",
      senioritySource: "confirmed",
    })

    const analysis = await asAdmin.query(
      api.evaluationModel.consequence.getConsequenceAnalysis,
      { orgId }
    )
    // NON-VACUOUS: the only part of the wire that carries role IDENTITY is the
    // movers list, so a privacy pin over an empty one proves nothing. The
    // fixture above is uneven across the reweighted criteria precisely so this
    // is not empty.
    expect(analysis.movers.length).toBeGreaterThan(0)

    // A structural ALLOWLIST, not a substring denylist. A denylist cannot see
    // a field it was not told to look for, and the composition that would
    // actually turn these role-level aggregates into per-role gender data is
    // a new key on a mover (a dominance class, a personId, a headcount). This
    // fails on any key that is not one of the five a mover may carry.
    for (const mover of analysis.movers) {
      expect(Object.keys(mover).sort()).toEqual([
        "from",
        "roleId",
        "slug",
        "title",
        "to",
      ])
    }

    const serialized = JSON.stringify(analysis)
    expect(serialized).not.toContain("Anna")
    expect(serialized).not.toContain("Andersson")
    expect(serialized).not.toContain(personId.personId)
    expect(serialized).not.toContain("Kvinna")
    for (const key of ["personId", "displayName", "gender", "seniority"]) {
      expect(serialized).not.toContain(`"${key}"`)
    }
    // And the aggregate itself is only ever classes and counts.
    for (const group of analysis.genders) {
      expect(["women", "men", "mixed", "unstaffed"]).toContain(group.key)
      expect(group.label).toBeNull()
      expect(Number.isInteger(group.total)).toBe(true)
    }
  })

  it("classes a staffed role by the pay-mapping dominance convention", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedOrg(t)
    const roleId = await lockedRole({
      orgId,
      asAdmin,
      model,
      title: "Analyst",
      value: 5,
    })
    await lockedRole({ orgId, asAdmin, model, title: "Low", value: 1 })
    await bufferApproval(t, orgId)
    await reweight(t, model, 1, 5)

    // Two women and one man: 67 % women, which is women-dominated under the
    // pay-mapping convention's 60 % threshold and mixed under anything
    // stricter. Chosen so the test actually exercises the threshold rather
    // than passing at any value.
    for (const [displayName, gender] of [
      ["A", "Kvinna"],
      ["B", "Kvinna"],
      ["C", "Man"],
    ] as const) {
      const person = await asAdmin.mutation(api.people.people.createPerson, {
        orgId,
        displayName,
        gender,
      })
      await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
        orgId,
        personId: person.personId,
        roleId,
        seniority: "IC3",
        senioritySource: "confirmed",
      })
    }

    const analysis = await asAdmin.query(
      api.evaluationModel.consequence.getConsequenceAnalysis,
      { orgId }
    )
    const women = analysis.genders.find((group) => group.key === "women")
    expect(women?.total).toBe(1)
    // And NOT mixed: a stricter threshold would put it there.
    expect(
      analysis.genders.find((group) => group.key === "mixed")
    ).toBeUndefined()
    // The role nobody is assigned to is its own class, never folded into
    // "mixed", which would claim a balance nobody measured.
    const unstaffed = analysis.genders.find(
      (group) => group.key === "unstaffed"
    )
    expect(unstaffed?.total).toBe(1)
  })

  // THE CRITICAL CASE, in the exact shape the reviewer probed. A criterion
  // added since the approval is unrated on every already-locked role, so the
  // engine returns no level on the LIVE side and the role falls off the
  // ladder. Counting only roles placed on both sides made `moved` 0 and the
  // panel silent about the largest consequence an approval can have.
  it("counts a placement that would DISAPPEAR when a criterion was added", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedOrg(t)
    const roleId = await lockedRole({
      orgId,
      asAdmin,
      model,
      title: "Nurse",
      value: 3,
    })
    await bufferApproval(t, orgId)
    // The real-world shape: the approval was granted, then a criterion joined
    // the model, so the locked role has no rating for it.
    await t.run(async (ctx) => {
      const doc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      const buffer = doc?.lastApprovedModel
      if (doc === null || buffer === undefined) throw new Error("no buffer")
      await ctx.db.patch(doc._id, {
        lastApprovedModel: { ...buffer, criteria: buffer.criteria.slice(1) },
      })
      const dropped = model.criteria[0]
      if (dropped === undefined) throw new Error("seed")
      const rating = await ctx.db
        .query("ratings")
        .withIndex("by_role_criterion", (q) =>
          q
            .eq("roleId", roleId)
            .eq("criterionId", dropped.criterionId as Id<"criteria">)
        )
        .unique()
      if (rating !== null) await ctx.db.delete(rating._id)
    })

    const analysis = await asAdmin.query(
      api.evaluationModel.consequence.getConsequenceAnalysis,
      { orgId }
    )
    expect(analysis.comparable).toBe(true)
    expect(analysis.losing).toBe(1)
    expect(analysis.gaining).toBe(0)
    // The role is counted, named, and its lost side is null rather than a
    // level it no longer has.
    expect(analysis.placed).toBe(1)
    expect(analysis.movers).toHaveLength(1)
    expect(analysis.movers[0]?.title).toBe("Nurse")
    expect(analysis.movers[0]?.to).toBeNull()
    expect(analysis.movers[0]?.from).not.toBeNull()
    // And the group tables count it as moved without claiming a direction: it
    // did not go up or down a ladder, it left one.
    const gender = analysis.genders.find((group) => group.moved > 0)
    expect(gender?.moved).toBe(1)
    expect(gender?.up).toBe(0)
    expect(gender?.down).toBe(0)
  })

  // I4: the level thresholds are the most placement-consequential method
  // change ADR-0022 allows, and the analysis's correctness on them rested on
  // nothing. Only the thresholds differ here; the criteria and weights are
  // identical on both sides.
  it("sees a movement that only the level thresholds cause", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedOrg(t)
    await lockedRole({ orgId, asAdmin, model, title: "Analyst", value: 3 })
    await bufferApproval(t, orgId)
    // Collapse the live ladder so a mid-scoring role lands somewhere else.
    await t.run(async (ctx) => {
      const doc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (doc === null) throw new Error("no model")
      await ctx.db.patch(doc._id, {
        levelRules: doc.levelRules.map((rule) => ({
          level: rule.level,
          minScore: rule.level === 12 ? 0 : Math.max(1, 100 - rule.level * 2),
        })),
      })
    })

    const analysis = await asAdmin.query(
      api.evaluationModel.consequence.getConsequenceAnalysis,
      { orgId }
    )
    expect(analysis.moved).toBeGreaterThan(0)
    expect(analysis.criteriaAdded).toBe(0)
    expect(analysis.criteriaRemoved).toBe(0)
    const mover = analysis.movers[0]
    expect(mover?.from).not.toBe(mover?.to)
  })

  // I4's other axis: the zone profile rules, alone.
  it("sees a movement that only the zone profile rules cause", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedOrg(t)
    const gated = model.criteria[0]
    const donor = model.criteria[1]
    if (gated === undefined || donor === undefined) throw new Error("seed")
    // A real profile criterion, rated at the floor while the rest score top:
    // the role's total lands it high, its profile rating does not.
    await t.run(async (ctx) => {
      await ctx.db.patch(gated.criterionId as Id<"criteria">, {
        weightPoints: 5,
      })
      await ctx.db.patch(donor.criterionId as Id<"criteria">, {
        weightPoints: 1,
      })
    })
    await lockedRole({
      orgId,
      asAdmin,
      model,
      title: "Capped",
      value: 5,
      low: gated.criterionId,
    })
    await bufferApproval(t, orgId)
    // Live now gates every zone hard; the buffer gates only A and B.
    await t.run(async (ctx) => {
      const doc = await ctx.db
        .query("models")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      if (doc === null) throw new Error("no model")
      await ctx.db.patch(doc._id, {
        zoneProfileRules: [
          { zone: "A", minStep: 5 },
          { zone: "B", minStep: 5 },
          { zone: "C", minStep: 5 },
        ],
      })
    })

    const analysis = await asAdmin.query(
      api.evaluationModel.consequence.getConsequenceAnalysis,
      { orgId }
    )
    expect(analysis.moved).toBeGreaterThan(0)
    expect(analysis.criteriaAdded).toBe(0)
  })

  // I1: one population. The distribution used to count every ACTIVE role while
  // everything beside it counted locked ones, so a reader saw "1 of 1 locked
  // placements would move" beside a zone table about two roles.
  it("counts one population: the locked roles, everywhere", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedOrg(t)
    await lockedRole({
      orgId,
      asAdmin,
      model,
      title: "Locked",
      value: 3,
      high: model.criteria[0]?.criterionId,
      low: model.criteria[1]?.criterionId,
    })
    // Fully rated and deliberately NOT completed: it has an engine level and no
    // revealed placement, so it belongs to no part of this panel.
    const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Unlocked",
      function: "engineering",
      team: "Core",
      trackKey: "IC",
      purpose: "Purpose",
      responsibilities: "Responsibilities",
    })
    for (const criterion of model.criteria) {
      await asAdmin.mutation(api.assessment.ratings.setRating, {
        orgId,
        roleId,
        criterionId: criterion.criterionId as Id<"criteria">,
        value: 3,
        motivation: "Fixture.",
      })
    }
    await bufferApproval(t, orgId)
    await reweight(t, model, 1, 5)

    const analysis = await asAdmin.query(
      api.evaluationModel.consequence.getConsequenceAnalysis,
      { orgId }
    )
    const zoneTotal = analysis.distribution.reduce(
      (sum, entry) => sum + entry.now,
      0
    )
    expect(analysis.placed).toBe(1)
    expect(zoneTotal).toBe(1)
    const approvedTotal = analysis.distribution.reduce(
      (sum, entry) => sum + entry.approved,
      0
    )
    expect(approvedTotal).toBe(1)
  })

  it("rejects a caller from another organization", async () => {
    const t = initConvexTest()
    const { orgId } = await seedOrg(t)
    const outsider = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "other@else.se", name: "Other", role: "admin" }
    )
    await expect(
      t
        .withIdentity({ subject: outsider.userId })
        .query(api.evaluationModel.consequence.getConsequenceAnalysis, {
          orgId,
        })
    ).rejects.toThrow(/errors\./)
  })
})

// The org-scale law. The analysis runs the engine TWICE over ONE set of reads,
// and every read is a whole-org indexed scan rather than anything per-role or
// per-person. Pinned against the SOURCE, because a read count is not
// observable from a query's result and the failure this guards against is a
// read appearing inside a loop.
describe("getConsequenceAnalysis reads", () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const sources = [
    {
      name: "consequence.ts",
      body: readFileSync(join(HERE, "consequence.ts"), "utf8"),
    },
    {
      name: "compute.ts",
      body: readFileSync(join(HERE, "..", "assessment", "compute.ts"), "utf8"),
    },
  ]

  // The audited total: 5 in consequence.ts (models, roles, roleFamilies,
  // people, personAssignments) + 4 in readResultInputs (models, criteria,
  // roles, ratings). Both models reads hit the same document; keeping them
  // separate costs one indexed lookup and keeps readResultInputs usable alone.
  //
  // Counted as `ctx.db` OCCURRENCES rather than by matching indentation. The
  // first version of this guard tested for `ctx.db.` at the start of a deeply
  // indented line, which cannot fire here at all: Biome breaks every read as
  // `const x = await ctx.db` + newline + `.query(...)`, so the literal
  // `ctx.db.` appears zero times in either file and a read planted inside the
  // movers loop sailed past it. Counting every `ctx.db` catches a read of any
  // kind, in a loop or out of one, and cannot be defeated by formatting.
  it("touches the database exactly nine times, and nowhere else", () => {
    const total = sources.reduce(
      (sum, source) => sum + (source.body.match(/ctx\.db/g) ?? []).length,
      0
    )
    expect(total).toBe(9)
  })

  // Per query, not in aggregate: one query carrying two withIndex calls used to
  // cover for an unindexed neighbour.
  it("rides an index on every one of them", () => {
    for (const source of sources) {
      const unindexed = source.body
        .split(/ctx\.db/)
        .slice(1)
        .filter((tail) => !/^\s*\.query\([^)]*\)\s*\.withIndex\(/.test(tail))
      expect({ file: source.name, unindexed }).toEqual({
        file: source.name,
        unindexed: [],
      })
    }
  })
})

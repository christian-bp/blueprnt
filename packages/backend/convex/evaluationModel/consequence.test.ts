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
  await args.asAdmin.mutation(api.assessment.locking.lockAssessment, {
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
    readFileSync(join(HERE, "consequence.ts"), "utf8"),
    readFileSync(join(HERE, "..", "assessment", "compute.ts"), "utf8"),
  ]

  it("reads nine org-scoped tables and nothing per row", () => {
    const queries = sources.flatMap(
      (source) => source.match(/\.query\("[a-zA-Z]+"\)/g) ?? []
    )
    // 5 in consequence.ts (models, roles, roleFamilies, people,
    // personAssignments) + 4 in readResultInputs (models, criteria, roles,
    // ratings). Both models reads are the same document; keeping them separate
    // costs one indexed lookup and keeps readResultInputs usable on its own.
    expect(queries).toHaveLength(9)
    // Every one of them rides an index.
    for (const source of sources) {
      const scans = source.match(/\.query\("[a-zA-Z]+"\)/g) ?? []
      const indexed = source.match(/\.withIndex\(/g) ?? []
      expect(indexed.length).toBeGreaterThanOrEqual(scans.length)
    }
  })

  it("makes no read inside a loop", () => {
    for (const source of sources) {
      // A `ctx.db` inside a for/while body is the shape that turns an org-
      // scaled surface into an N-query one.
      for (const line of source.split("\n")) {
        if (/^\s{6,}(await )?ctx\.db\./.test(line)) {
          expect(line).toBe("no read at loop depth")
        }
      }
    }
  })
})

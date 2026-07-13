import { TRACK_LEVELS } from "@workspace/constants"
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

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

  // Model with criteria + band thresholds.
  await asAdmin.mutation(api.evaluationModel.model.createModelFromTemplate, {
    orgId,
  })
  const model = await asAdmin.query(api.evaluationModel.model.getModel, {
    orgId,
  })
  if (model === null) throw new Error("seed: model")
  const track = model.tracks[0]
  if (track === undefined) throw new Error("seed: track")
  const level = TRACK_LEVELS[track.key as keyof typeof TRACK_LEVELS][0]
  if (level === undefined) throw new Error("seed: level")

  // One role, fully evaluated (all criteria rated => complete => band/score).
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
    level,
    levelSource: "confirmed",
  })
  await t.run(async (ctx) => {
    await ctx.db.insert("payRecords", {
      orgId,
      personId,
      payYear: 2026,
      source: "manual",
      basicMonthly: 50000,
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

  return { orgId, asAdmin, personId, publicId }
}

describe("erasure pseudonymizes snapshot rows", () => {
  it("tombstones name + clears birthDate, keeps gender/band/pay", async () => {
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
    // Aggregate is kept: gender/band/pay survive the erasure untouched.
    expect(rows[0]?.gender).toBe("Kvinna")
    expect(typeof rows[0]?.band).toBe("number")
    expect(rows[0]?.basicMonthly).toBe(50000)

    // The live person row is gone.
    expect(await t.run((ctx) => ctx.db.get(personId))).toBeNull()
  })
})

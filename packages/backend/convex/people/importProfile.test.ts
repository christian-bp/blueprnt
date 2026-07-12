import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

// Seeds a minimal org with one admin member and returns helpers for calling
// functions as that admin.
async function seedOrg(
  t: ReturnType<typeof initConvexTest>,
  email = "hr@acme.se"
) {
  const { orgId, userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "HR Person", role: "admin" }
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
  return { orgId, userId, asAdmin }
}

describe("saveImportMappingProfile + getImportMappingProfile", () => {
  it("save then get returns the column map", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const columnMap = { displayName: "Namn", gender: "Kön" }

    await asAdmin.mutation(api.people.importProfile.saveImportMappingProfile, {
      orgId,
      columnMap,
    })

    const profile = await asAdmin.query(
      api.people.importProfile.getImportMappingProfile,
      { orgId }
    )

    expect(profile).not.toBeNull()
    expect(profile?.columnMap).toEqual(columnMap)
    expect(profile?.parseRules).toBeNull()
    expect(profile?.updatedAt).toBeTypeOf("number")
    expect(profile?.profileId).toBeTypeOf("string")
  })

  it("save with parseRules round-trips them", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.mutation(api.people.importProfile.saveImportMappingProfile, {
      orgId,
      columnMap: { displayName: "Name" },
      parseRules: { delimiter: ";" },
    })

    const profile = await asAdmin.query(
      api.people.importProfile.getImportMappingProfile,
      { orgId }
    )

    expect(profile?.parseRules).toEqual({ delimiter: ";" })
  })

  it("saving again UPDATES the same row in place (not a second row)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.mutation(api.people.importProfile.saveImportMappingProfile, {
      orgId,
      columnMap: { displayName: "Namn" },
    })

    const updatedColumnMap = { displayName: "Fullständigt namn", gender: "Kön" }
    await asAdmin.mutation(api.people.importProfile.saveImportMappingProfile, {
      orgId,
      columnMap: updatedColumnMap,
    })

    // Assert exactly ONE row for the org, not two.
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("importMappingProfiles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(rows).toHaveLength(1)
      expect(rows[0]?.columnMap).toEqual(updatedColumnMap)
    })

    const profile = await asAdmin.query(
      api.people.importProfile.getImportMappingProfile,
      { orgId }
    )
    expect(profile?.columnMap).toEqual(updatedColumnMap)
  })

  it("a no-op save writes nothing (no second audit row, row unchanged)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const columnMap = { displayName: "Namn" }

    // First save: creates the row + audit row.
    await asAdmin.mutation(api.people.importProfile.saveImportMappingProfile, {
      orgId,
      columnMap,
    })

    // Capture updatedAt after first save.
    const profileAfterFirst = await asAdmin.query(
      api.people.importProfile.getImportMappingProfile,
      { orgId }
    )
    const firstUpdatedAt = profileAfterFirst?.updatedAt

    // Second save with identical args: no-op.
    await asAdmin.mutation(api.people.importProfile.saveImportMappingProfile, {
      orgId,
      columnMap,
    })

    await t.run(async (ctx) => {
      // Still exactly one row.
      const rows = await ctx.db
        .query("importMappingProfiles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(rows).toHaveLength(1)

      // updatedAt did not change (no write occurred).
      expect(rows[0]?.updatedAt).toBe(firstUpdatedAt)

      // Only one audit row (the insert), not two.
      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "pay.mappingSaved")
        )
        .collect()
      expect(auditRows).toHaveLength(1)
    })
  })

  it("round-trips basisMap on the mapping profile", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.people.importProfile.saveImportMappingProfile, {
      orgId,
      columnMap: { basicMonthly: "Manadslon", bonus: "Arsbonus" },
      basisMap: { basicMonthly: "monthly", bonus: "annual" },
    })
    const profile = await asAdmin.query(
      api.people.importProfile.getImportMappingProfile,
      { orgId }
    )
    expect(profile?.basisMap?.bonus).toBe("annual")
  })

  it("cross-org isolation: org B cannot see org A's profile", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    // Save a profile for org A.
    await asAdminA.mutation(api.people.importProfile.saveImportMappingProfile, {
      orgId: orgA,
      columnMap: { displayName: "Namn" },
    })

    // Org B's query must return null (no profile saved for org B).
    const profileForB = await asAdminB.query(
      api.people.importProfile.getImportMappingProfile,
      { orgId: orgB }
    )
    expect(profileForB).toBeNull()
  })

  it("getImportMappingProfile returns null when no profile exists", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const profile = await asAdmin.query(
      api.people.importProfile.getImportMappingProfile,
      { orgId }
    )
    expect(profile).toBeNull()
  })

  it("insert writes an audit row of type pay.mappingSaved", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.mutation(api.people.importProfile.saveImportMappingProfile, {
      orgId,
      columnMap: { displayName: "Namn" },
    })

    await t.run(async (ctx) => {
      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "pay.mappingSaved")
        )
        .collect()
      expect(auditRows).toHaveLength(1)

      const payload = auditRows[0]?.payload as Record<string, unknown>
      // The payload is lightweight: only orgId + a reference to the profileId.
      expect(payload?.orgId).toBe(orgId)
      // The full column map is not dumped into the audit trail.
      expect(payload).not.toHaveProperty("columnMap")
    })
  })
})

import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedMirroredUser(
  t: ReturnType<typeof initConvexTest>,
  email: string
) {
  const { userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "Operator", role: "admin" }
  )
  await t.mutation(internal.accounts.mirrors.mirrorSeededUser, {
    authId: userId,
    email,
    name: "Operator",
  })
  return userId
}

async function seedPlatformAdmin(t: ReturnType<typeof initConvexTest>) {
  const userId = await seedMirroredUser(t, "operator@blueprnt.se")
  await t.mutation(internal.platform.bootstrap.grantPlatformAdminByEmail, {
    email: "operator@blueprnt.se",
  })
  return userId
}

// Convenience: create an org via the admin mutation (so it is mirrored into
// Better Auth and resolves through orgNameMap) and return its orgId.
async function seedOrg(
  t: ReturnType<typeof initConvexTest>,
  adminId: string,
  name: string,
  slug: string
) {
  const { orgId } = await t
    .withIdentity({ subject: adminId })
    .mutation(api.platform.admin.createOrganization, { name, slug })
  return orgId
}

async function seedMonthly(
  t: ReturnType<typeof initConvexTest>,
  row: {
    orgId: string
    period: string
    callCount: number
    costNanos: number
    totalTokens?: number
    byKind?: Record<string, number>
  }
) {
  await t.run((ctx) =>
    ctx.db.insert("aiUsageMonthly", {
      orgId: row.orgId,
      period: row.period,
      callCount: row.callCount,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: row.totalTokens ?? 0,
      costNanos: row.costNanos,
      byKind: row.byKind ?? {},
    })
  )
}

describe("platform ai usage (access control)", () => {
  it("rejects an unauthenticated caller", async () => {
    const t = initConvexTest()
    await expect(
      t.query(api.platform.aiUsage.usageByOrg, { period: "2026-08" })
    ).rejects.toThrow(/errors.notAuthenticated/)
  })

  it("rejects a signed-in non-platform-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "nobody@blueprnt.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.query(api.platform.aiUsage.usageByOrg, { period: "2026-08" })
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })
})

describe("usageByOrg", () => {
  it("rejects a malformed period", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await expect(
      asAdmin.query(api.platform.aiUsage.usageByOrg, { period: "2026-13" })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asAdmin.query(api.platform.aiUsage.usageByOrg, { period: "not-a-period" })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asAdmin.query(api.platform.aiUsage.usageByOrg, { period: "2026-8" })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("joins period rows with the org's display name", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "Acme AB", "acme-usage-1")
    await seedMonthly(t, {
      orgId,
      period: "2026-08",
      callCount: 3,
      costNanos: 12_345,
      totalTokens: 999,
      byKind: { "model.draft": 2, "role.profile": 1 },
    })

    const rows = await asAdmin.query(api.platform.aiUsage.usageByOrg, {
      period: "2026-08",
    })
    const row = rows.find((r) => r.orgId === orgId)
    expect(row).toMatchObject({
      orgId,
      orgName: "Acme AB",
      costNanos: 12_345,
      callCount: 3,
      totalTokens: 999,
      byKind: { "model.draft": 2, "role.profile": 1 },
      prevCostNanos: 0,
    })
  })

  it("computes the previous-period delta, crossing a year boundary", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "Boundary Org", "boundary-org")
    await seedMonthly(t, {
      orgId,
      period: "2025-12",
      callCount: 1,
      costNanos: 5_000,
    })
    await seedMonthly(t, {
      orgId,
      period: "2026-01",
      callCount: 4,
      costNanos: 20_000,
    })

    const rows = await asAdmin.query(api.platform.aiUsage.usageByOrg, {
      period: "2026-01",
    })
    const row = rows.find((r) => r.orgId === orgId)
    expect(row?.costNanos).toBe(20_000)
    expect(row?.prevCostNanos).toBe(5_000)
  })

  it("still returns an org present only in the previous period, cost 0", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "Went Quiet AB", "went-quiet")
    await seedMonthly(t, {
      orgId,
      period: "2026-07",
      callCount: 2,
      costNanos: 8_000,
    })
    // No row at all for 2026-08: the org used AI last period and stopped.

    const rows = await asAdmin.query(api.platform.aiUsage.usageByOrg, {
      period: "2026-08",
    })
    const row = rows.find((r) => r.orgId === orgId)
    expect(row).toBeDefined()
    expect(row).toMatchObject({
      orgId,
      orgName: "Went Quiet AB",
      costNanos: 0,
      callCount: 0,
      totalTokens: 0,
      byKind: {},
      prevCostNanos: 8_000,
    })
  })

  it("excludes an org with usage in neither the period nor its predecessor", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "Unrelated Org", "unrelated-org")
    await seedMonthly(t, {
      orgId,
      period: "2026-01",
      callCount: 1,
      costNanos: 100,
    })

    const rows = await asAdmin.query(api.platform.aiUsage.usageByOrg, {
      period: "2026-08",
    })
    expect(rows.some((r) => r.orgId === orgId)).toBe(false)
  })

  it("returns an empty array for a period with no usage at all", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const rows = await asAdmin.query(api.platform.aiUsage.usageByOrg, {
      period: "2020-01",
    })
    expect(rows).toEqual([])
  })
})

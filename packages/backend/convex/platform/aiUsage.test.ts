import { describe, expect, it, vi } from "vitest"
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

// Inserts one aiUsageEvents row. The caller controls _creationTime by
// wrapping the call in vi.useFakeTimers/vi.setSystemTime (convex-test stamps
// _creationTime from the same clock Date.now() reads), so a test can place an
// event at an exact instant instead of racing the real clock.
async function seedEvent(
  t: ReturnType<typeof initConvexTest>,
  { orgId, costNanos }: { orgId: string; costNanos: number }
) {
  await t.run((ctx) =>
    ctx.db.insert("aiUsageEvents", {
      orgId,
      kind: "model.weightReview",
      provider: "mistral",
      model: "mistral-large-latest",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedInputTokens: 0,
      estimatedCostNanos: costNanos,
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
      byKind: { "model.weightReview": 2, "role.profile": 1 },
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
      byKind: { "model.weightReview": 2, "role.profile": 1 },
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

describe("usageByOrgDaily", () => {
  it("rejects an unauthenticated caller", async () => {
    const t = initConvexTest()
    await expect(
      t.query(api.platform.aiUsage.usageByOrgDaily, { period: "2026-08" })
    ).rejects.toThrow(/errors.notAuthenticated/)
  })

  it("rejects a signed-in non-platform-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "nobody-daily@blueprnt.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.query(api.platform.aiUsage.usageByOrgDaily, { period: "2026-08" })
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })

  it("rejects a malformed period", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await expect(
      asAdmin.query(api.platform.aiUsage.usageByOrgDaily, {
        period: "2026-13",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("buckets the first and last day of the month correctly and excludes events outside the window", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgId = await seedOrg(t, adminId, "Acme AB", "acme-daily-1")

    // Year 2030, well past the real clock: convex-test clamps a stamp that
    // would otherwise land at or before the last one it issued (so real-time
    // setup calls above must never outrun our fake ones), and every
    // vi.setSystemTime call below moves strictly forward for the same reason.
    try {
      // Jul 31, 23:59:59.999 UTC: one millisecond before the window starts.
      vi.useFakeTimers({ now: Date.UTC(2030, 6, 31, 23, 59, 59, 999) })
      await seedEvent(t, { orgId, costNanos: 50 })

      // Aug 1, 00:00:00.000 UTC: the first instant the window includes.
      vi.setSystemTime(Date.UTC(2030, 7, 1, 0, 0, 0))
      await seedEvent(t, { orgId, costNanos: 100 })

      // Aug 31, 23:59:59.999 UTC: the last instant the window includes.
      vi.setSystemTime(Date.UTC(2030, 7, 31, 23, 59, 59, 999))
      await seedEvent(t, { orgId, costNanos: 200 })

      // Sep 1, 00:00:00.000 UTC: exactly the exclusive end bound.
      vi.setSystemTime(Date.UTC(2030, 8, 1, 0, 0, 0))
      await seedEvent(t, { orgId, costNanos: 999 })
    } finally {
      vi.useRealTimers()
    }

    const result = await asAdmin.query(api.platform.aiUsage.usageByOrgDaily, {
      period: "2030-08",
    })
    expect(result.days).toBe(31)
    const row = result.rows.find((r) => r.orgId === orgId)
    expect(row?.dailyCostNanos).toHaveLength(31)
    expect(row?.dailyCostNanos[0]).toBe(100)
    expect(row?.dailyCostNanos[30]).toBe(200)
    // The out-of-window events (50 and 999) never entered any bucket.
    expect(row?.dailyCostNanos.reduce((sum, v) => sum + v, 0)).toBe(300)
  })

  it("sums same-day cost separately per org and sorts orgs by period total desc", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const orgA = await seedOrg(t, adminId, "Org A", "org-a-daily")
    const orgB = await seedOrg(t, adminId, "Org B", "org-b-daily")

    try {
      // Year 2030, well past the real clock and past the org-seeding calls
      // above, so this single jump forward is never clamped.
      vi.useFakeTimers({ now: Date.UTC(2030, 7, 5, 10, 0, 0) })
      await seedEvent(t, { orgId: orgA, costNanos: 100 })
      await seedEvent(t, { orgId: orgA, costNanos: 50 })
      await seedEvent(t, { orgId: orgB, costNanos: 500 })
    } finally {
      vi.useRealTimers()
    }

    const result = await asAdmin.query(api.platform.aiUsage.usageByOrgDaily, {
      period: "2030-08",
    })
    expect(result.rows.map((r) => r.orgId)).toEqual([orgB, orgA])
    const rowA = result.rows.find((r) => r.orgId === orgA)
    const rowB = result.rows.find((r) => r.orgId === orgB)
    // Aug 5 is day index 4.
    expect(rowA?.dailyCostNanos[4]).toBe(150)
    expect(rowB?.dailyCostNanos[4]).toBe(500)
    expect(rowA?.orgName).toBe("Org A")
  })

  it("returns empty rows for a month with no events", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const result = await asAdmin.query(api.platform.aiUsage.usageByOrgDaily, {
      period: "2020-01",
    })
    expect(result.rows).toEqual([])
    expect(result.days).toBe(31)
  })
})

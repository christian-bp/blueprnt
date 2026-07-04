import { describe, expect, it } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

// Seeds a minimal org (organizations row + people rows) without going through
// the auth component, since this is an internal-mutation-only path.
async function seedOrg(t: ReturnType<typeof initConvexTest>) {
  const orgId = `org_${Math.random().toString(36).slice(2)}`
  const actorId = `user_${Math.random().toString(36).slice(2)}`

  await t.run(async (ctx) => {
    await ctx.db.insert("organizations", {
      orgId,
      country: "SE",
      currency: "SEK",
      language: "sv",
      industry: "itTelecom",
    })
    // Seed a users mirror row so logAudit can resolve the actorName snapshot.
    await ctx.db.insert("users", {
      authId: actorId,
      name: "HR Person",
      email: "hr@acme.se",
    })
  })

  return { orgId, actorId }
}

async function insertPerson(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  opts: { archivedAt?: number } = {}
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("people", {
      orgId,
      displayName: `Person ${Math.random()}`,
      gender: "Man" as const,
      ...(opts.archivedAt !== undefined ? { archivedAt: opts.archivedAt } : {}),
    })
  })
}

describe("setEmployeeCountFromPeople", () => {
  it("counts only non-archived people, patches the org, and writes a settingsUpdated audit row", async () => {
    const t = initConvexTest()
    const { orgId, actorId } = await seedOrg(t)

    // Insert 3 active people and 1 archived leaver.
    await insertPerson(t, orgId)
    await insertPerson(t, orgId)
    await insertPerson(t, orgId)
    await insertPerson(t, orgId, { archivedAt: Date.now() })

    const count = await t.mutation(
      internal.people.employeeCount.setEmployeeCountFromPeople,
      { orgId, actorId }
    )

    expect(count).toBe(3)

    await t.run(async (ctx) => {
      const org = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(org?.employeeCount).toBe(3)

      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.settingsUpdated")
        )
        .collect()
      expect(auditRows).toHaveLength(1)

      const payload = auditRows[0]?.payload as Record<string, unknown>
      const changes = payload?.changes as Record<
        string,
        { from: unknown; to: unknown }
      >
      expect(changes?.employeeCount).toEqual({ from: null, to: 3 })
    })
  })

  it("is a no-op (no patch, no audit row) when the count has not changed", async () => {
    const t = initConvexTest()
    const { orgId, actorId } = await seedOrg(t)

    // Seed two active people.
    await insertPerson(t, orgId)
    await insertPerson(t, orgId)

    // First call: sets employeeCount to 2.
    const firstCount = await t.mutation(
      internal.people.employeeCount.setEmployeeCountFromPeople,
      { orgId, actorId }
    )
    expect(firstCount).toBe(2)

    // Second call with no people change: should be a no-op.
    const secondCount = await t.mutation(
      internal.people.employeeCount.setEmployeeCountFromPeople,
      { orgId, actorId }
    )
    expect(secondCount).toBe(2)

    await t.run(async (ctx) => {
      // Only one settingsUpdated audit row (from the first call).
      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "organization.settingsUpdated")
        )
        .collect()
      expect(auditRows).toHaveLength(1)
    })
  })

  it("throws notFound when the org does not exist", async () => {
    const t = initConvexTest()

    await expect(
      t.mutation(internal.people.employeeCount.setEmployeeCountFromPeople, {
        orgId: "nonexistent_org",
        actorId: "actor_x",
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})

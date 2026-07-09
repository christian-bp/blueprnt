import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

// Seeds a minimal org with one admin member.
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

// Seeds an editor member (non-admin) in the target org for the gate test.
// seedMembership always creates a new org; seedDuplicateMember then adds
// the same user as a member of the target org (the pattern from
// accounts/organization.test.ts lines 383-393).
async function seedEditor(
  t: ReturnType<typeof initConvexTest>,
  orgId: string,
  email: string
) {
  // Create the user (seedMembership also creates a throwaway org -- ignored).
  const { userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "Editor Person", role: "editor" }
  )
  // Attach them as an editor of the target org.
  await t.mutation(components.betterAuth.testing.seedDuplicateMember, {
    orgId,
    userId,
    role: "editor",
  })
  return t.withIdentity({ subject: userId })
}

// Seeds a person in the given org and returns its id.
async function seedPerson(
  orgId: string,
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>
) {
  const { personId } = await asAdmin.mutation(api.people.people.createPerson, {
    orgId,
    displayName: "Anna Svensson",
    gender: "Kvinna",
    country: "SE",
    ftePercent: 100,
    department: "Engineering",
  })
  return personId
}

// Seeds a role in the given org (required to create an assignment).
async function seedRole(
  orgId: string,
  asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>
) {
  const { roleId } = await asAdmin.mutation(api.assessment.roles.createRole, {
    orgId,
    title: "Software Engineer",
    function: "Engineering",
    team: "Platform",
    trackKey: "IC",
  })
  return roleId
}

describe("erasePersonAsOrg", () => {
  it("hard-deletes the person row, all payRecords, and all personAssignments", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const roleId = await seedRole(orgId, asAdmin)

    // Seed a pay record.
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
      components: [],
    })

    // Seed an assignment.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC3",
      levelSource: "confirmed",
    })

    // Confirm rows exist before erasure.
    await t.run(async (ctx) => {
      expect(await ctx.db.get(personId)).not.toBeNull()
      const pays = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      expect(pays).toHaveLength(1)
      const assigns = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      expect(assigns).toHaveLength(1)
    })

    // Erase the person.
    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
      orgId,
      personId,
    })

    // Verify all rows are gone.
    await t.run(async (ctx) => {
      expect(await ctx.db.get(personId)).toBeNull()

      const pays = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      expect(pays).toHaveLength(0)

      const assigns = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      expect(assigns).toHaveLength(0)
    })
  })

  it("writes a person.erased audit row containing personId but NO PII fields", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.erased")
        )
        .collect()
      expect(auditRows).toHaveLength(1)

      const payload = auditRows[0]?.payload as Record<string, unknown>

      // Must carry the personId (the internal key) for traceability.
      expect(payload?.personId).toBe(personId)

      // The changes map must NEVER carry PII: no name, gender, birthDate,
      // email, or salary amount. This is the GDPR-critical assertion.
      const payloadJson = JSON.stringify(payload)
      expect(payloadJson).not.toContain("displayName")
      expect(payloadJson).not.toContain("gender")
      expect(payloadJson).not.toContain("birthDate")
      expect(payloadJson).not.toContain("email")
      // Salary amount: basicMonthly is a pay record field and must NOT appear.
      expect(payloadJson).not.toContain("basicMonthly")
      expect(payloadJson).not.toContain("50000")

      // The changes map should carry the non-PII structural fields as from->null
      // transitions. country and ftePercent were seeded with values above.
      const changes = payload?.changes as Record<
        string,
        { from: unknown; to: unknown }
      >
      expect(changes).toHaveProperty("country")
      expect(changes?.country).toEqual({ from: "SE", to: null })
      expect(changes).toHaveProperty("ftePercent")
      expect(changes?.ftePercent).toEqual({ from: 100, to: null })
    })
  })

  it("throws notFound when the person belongs to a different org (cross-org isolation)", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    // Create a person in org A.
    const personAId = await seedPerson(orgA, asAdminA)

    // Org B's admin tries to erase org A's person: must throw notFound.
    await expect(
      asAdminB.mutation(api.people.erase.erasePersonAsOrg, {
        orgId: orgB,
        personId: personAId,
      })
    ).rejects.toThrow(/errors.notFound/)

    // Person in org A must still exist.
    await t.run(async (ctx) => {
      expect(await ctx.db.get(personAId)).not.toBeNull()
    })
  })

  it("is blocked for a non-admin member (adminMutation gate)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    // Seed an editor and attempt erasure as that editor.
    const asEditor = await seedEditor(t, orgId, "editor@acme.se")
    await expect(
      asEditor.mutation(api.people.erase.erasePersonAsOrg, { orgId, personId })
    ).rejects.toThrow(/errors.adminRequired/)

    // Person must still exist.
    await t.run(async (ctx) => {
      expect(await ctx.db.get(personId)).not.toBeNull()
    })
  })

  it("erases multiple payRecords and assignments for the same person", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const roleId = await seedRole(orgId, asAdmin)

    // Seed two pay records (different years).
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2023,
      basicMonthly: 45000,
      currency: "SEK",
      components: [],
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
      components: [],
    })

    // Seed an assignment.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      level: "IC2",
      levelSource: "confirmed",
    })

    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      expect(await ctx.db.get(personId)).toBeNull()

      const pays = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      expect(pays).toHaveLength(0)

      const assigns = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      expect(assigns).toHaveLength(0)
    })
  })
})

describe("erasePersonAsOrg (org-scoped HR erasure)", () => {
  it("hard-deletes the person, their assignments, and their pay records", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    // Seed a role, a person, an assignment, and a pay record.
    const { roleId, personId } = await t.run(async (ctx) => {
      const roleId = await ctx.db.insert("roles", {
        orgId,
        title: "Engineer",
        slug: "engineer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC" as const,
        purpose: "",
        responsibilities: "",
      })
      const personId = await ctx.db.insert("people", {
        orgId,
        publicId: "pub-test",
        externalRef: "E-1",
        displayName: "Test Person",
        gender: "Kvinna" as const,
      })
      await ctx.db.insert("personAssignments", {
        orgId,
        personId,
        roleId,
        level: "IC3",
        levelSource: "confirmed" as const,
        effectiveAt: 1_000,
      })
      await ctx.db.insert("payRecords", {
        orgId,
        personId,
        payYear: 2026,
        source: "manual" as const,
        basicMonthly: 50_000,
        currency: "SEK",
        components: [],
        effectiveAt: 1_000,
        createdAt: 1_000,
      })
      return { roleId, personId }
    })

    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
      orgId,
      personId,
    })

    const remaining = await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      const assignments = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      const pay = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", personId)
        )
        .collect()
      const role = await ctx.db.get(roleId)
      return { person, assignments, pay, role }
    })

    expect(remaining.person).toBeNull()
    expect(remaining.assignments).toHaveLength(0)
    expect(remaining.pay).toHaveLength(0)
    // The role must survive: erasure removes the person, not the role.
    expect(remaining.role).not.toBeNull()
  })

  it("throws notFound for a person in another org", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t, "hr@acme.se")
    const { orgId: otherOrgId } = await seedOrg(t, "hr@other.se")
    const foreignPersonId = await t.run(async (ctx) =>
      ctx.db.insert("people", {
        orgId: otherOrgId,
        publicId: "pub-foreign",
        displayName: "Foreign",
        gender: "Man" as const,
      })
    )

    await expect(
      asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
        orgId,
        personId: foreignPersonId,
      })
    ).rejects.toThrow()
  })

  it("rejects a non-admin (editor) member", async () => {
    const t = initConvexTest()
    const { orgId } = await seedOrg(t)
    const personId = await t.run(async (ctx) =>
      ctx.db.insert("people", {
        orgId,
        publicId: "pub-test2",
        displayName: "Test",
        gender: "Man" as const,
      })
    )
    const asEditor = await seedEditor(t, orgId, "editor@acme.se")
    await expect(
      asEditor.mutation(api.people.erase.erasePersonAsOrg, { orgId, personId })
    ).rejects.toThrow()
  })
})

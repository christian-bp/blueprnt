import { describe, expect, it } from "vitest"
import { PEOPLE_ARCHIVE_CHUNK_SIZE } from "@workspace/constants"
import { api, internal, components } from "../_generated/api"
import { addEditorMember, initConvexTest } from "../testing.helpers"

// Seeds a minimal org with one admin member. The organizations row is required
// by org-scoped functions (resolveOrgContext reads membership via the auth
// component; the organizations table is the app-side tenant row).
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

describe("createPerson", () => {
  it("inserts a person row and writes a person.created audit row with non-PII changes only", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Anna Svensson",
        gender: "Kvinna",
        country: "SE",
        ftePercent: 100,
        department: "Engineering",
        employmentType: "permanent",
      }
    )

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person).not.toBeNull()
      expect(person?.displayName).toBe("Anna Svensson")
      expect(person?.gender).toBe("Kvinna")
      expect(person?.orgId).toBe(orgId)
      expect(person?.country).toBe("SE")
      expect(person?.ftePercent).toBe(100)

      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.created")
        )
        .collect()
      expect(auditRows).toHaveLength(1)

      const payload = auditRows[0]?.payload as Record<string, unknown>
      expect(payload?.personId).toBe(personId)

      // The create snapshot records every audited field (ADR-0013): the
      // structural ones...
      const changes = payload?.changes as Record<string, unknown>
      expect(changes).toHaveProperty("country")
      expect(changes).toHaveProperty("ftePercent")
      expect(changes).toHaveProperty("department")
      expect(changes).toHaveProperty("employmentType")

      // ...and the identity ones, which erasure tombstones later.
      expect(changes.displayName).toEqual({ from: null, to: "Anna Svensson" })
      expect(changes.gender).toEqual({ from: null, to: "Kvinna" })
      expect(changes).toHaveProperty("birthDate")

      // Indexed by its person so erasure can find every row about them.
      expect(auditRows[0]?.subject).toEqual({ kind: "person", id: personId })
    })
  })

  it("trims displayName and rejects an empty string", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await expect(
      asAdmin.mutation(api.people.people.createPerson, {
        orgId,
        displayName: "   ",
        gender: "Man",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("creates a minimal person (required fields only)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Erik Johansson",
        gender: "Man",
      }
    )

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.displayName).toBe("Erik Johansson")
      expect(person?.externalRef).toBeUndefined()
      expect(person?.archivedAt).toBeUndefined()
    })
  })

  it("returns the publicId matching the stored row (the route handle)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const { personId, publicId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Erik Johansson", gender: "Man" }
    )

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.publicId).toBe(publicId)
    })
  })

  it("rejects a taken employee number and treats a blank one as absent", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Anna Svensson",
      gender: "Kvinna",
      externalRef: "1001",
    })

    // The employee number is the import upsert key: a duplicate would make
    // future imports update one row while the other drifts stale.
    await expect(
      asAdmin.mutation(api.people.people.createPerson, {
        orgId,
        displayName: "Erik Johansson",
        gender: "Man",
        externalRef: " 1001 ",
      })
    ).rejects.toThrow(/errors.personRefExists/)

    // Whitespace-only means "no ref": stored as absent, never colliding.
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Ek", gender: "Man", externalRef: "   " }
    )
    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.externalRef).toBeUndefined()
    })
  })
})

describe("updatePerson", () => {
  it("patches changed fields, clears via empty values, audits every field diff", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Anna Svensson",
        gender: "Kvinna",
        department: "Engineering",
        ftePercent: 100,
      }
    )

    await asAdmin.mutation(api.people.people.updatePerson, {
      orgId,
      personId,
      displayName: "  Anna Karlsson  ",
      department: "",
      ftePercent: 80,
      employmentStartDate: "2024-03-01",
    })

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.displayName).toBe("Anna Karlsson")
      expect(person?.department).toBeUndefined()
      expect(person?.ftePercent).toBe(80)
      expect(person?.employmentStartDate).toBe("2024-03-01")
      // Gender untouched (arg omitted).
      expect(person?.gender).toBe("Kvinna")

      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.updated")
        )
        .collect()
      expect(auditRows).toHaveLength(1)
      const changes = (
        auditRows[0]?.payload as Record<string, unknown> | undefined
      )?.changes as Record<string, unknown>
      // Cleared field diffs to null; the trimmed name is diffed like any other
      // field (ADR-0013), and an untouched field stays out of the diff.
      expect(changes.department).toEqual({ from: "Engineering", to: null })
      expect(changes.ftePercent).toEqual({ from: 100, to: 80 })
      expect(changes.displayName).toEqual({
        from: "Anna Svensson",
        to: "Anna Karlsson",
      })
      expect(changes).not.toHaveProperty("gender")
    })
  })

  // The bug this pins: a name-only edit used to patch the person and then write
  // an audit row whose diff was `{}`, so the log showed "Person updated" with
  // "No field-level changes recorded" and the change was untraceable.
  it("records a rename, a gender change and an employee-number change", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Anna Svensson",
        gender: "Kvinna",
        externalRef: "4711",
      }
    )

    await asAdmin.mutation(api.people.people.updatePerson, {
      orgId,
      personId,
      displayName: "Anna Bergström",
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.updated")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const row = rows[0]
      expect(
        (row?.payload as { changes?: Record<string, unknown> } | undefined)
          ?.changes
      ).toEqual({
        displayName: { from: "Anna Svensson", to: "Anna Bergström" },
      })
      // The row is indexed by its person so erasure can find it later, and the
      // new name is searchable while the person exists.
      expect(row?.subject).toEqual({ kind: "person", id: personId })
      expect(row?.searchText).toContain("anna bergström")
    })

    await asAdmin.mutation(api.people.people.updatePerson, {
      orgId,
      personId,
      gender: "Man",
      externalRef: "4712",
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.updated")
        )
        .collect()
      expect(rows).toHaveLength(2)
      expect(
        (rows[1]?.payload as { changes?: Record<string, unknown> } | undefined)
          ?.changes
      ).toEqual({
        gender: { from: "Kvinna", to: "Man" },
        externalRef: { from: "4711", to: "4712" },
      })
    })
  })

  it("is a no-op (no write, no audit) when nothing changes", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Anna", gender: "Kvinna", department: "Sales" }
    )

    await asAdmin.mutation(api.people.people.updatePerson, {
      orgId,
      personId,
      displayName: "Anna",
      department: "Sales",
    })

    await t.run(async (ctx) => {
      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.updated")
        )
        .collect()
      expect(auditRows).toHaveLength(0)
    })
  })

  it("rejects another person's employee number but keeps its own", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Anna",
      gender: "Kvinna",
      externalRef: "1001",
    })
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Erik", gender: "Man", externalRef: "1002" }
    )

    await expect(
      asAdmin.mutation(api.people.people.updatePerson, {
        orgId,
        personId,
        externalRef: "1001",
      })
    ).rejects.toThrow(/errors.personRefExists/)

    // Re-sending the person's own ref is not a collision.
    await asAdmin.mutation(api.people.people.updatePerson, {
      orgId,
      personId,
      externalRef: "1002",
      department: "Finance",
    })
    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.externalRef).toBe("1002")
      expect(person?.department).toBe("Finance")
    })
  })

  it("rejects an empty displayName", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Anna", gender: "Kvinna" }
    )
    await expect(
      asAdmin.mutation(api.people.people.updatePerson, {
        orgId,
        personId,
        displayName: "   ",
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })
})

describe("listPeople / getPersonByPublicId", () => {
  it("listPeople returns only active people in the org by default", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Alice",
      gender: "Kvinna",
    })
    const { personId: bobId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Bob",
        gender: "Man",
      }
    )

    // Archive Bob.
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId: bobId,
    })

    const list = await asAdmin.query(api.people.people.listPeople, { orgId })
    expect(list).toHaveLength(1)
    expect(list[0]?.displayName).toBe("Alice")
  })

  it("listPeople with includeArchived returns all people", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Alice",
      gender: "Kvinna",
    })
    const { personId: bobId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Bob",
        gender: "Man",
      }
    )
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId: bobId,
    })

    const all = await asAdmin.query(api.people.people.listPeople, {
      orgId,
      includeArchived: true,
    })
    expect(all).toHaveLength(2)
  })

  it("listPeople is scoped to the org (org A cannot see org B people)", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    await asAdminA.mutation(api.people.people.createPerson, {
      orgId: orgA,
      displayName: "Person A",
      gender: "Man",
    })
    await asAdminB.mutation(api.people.people.createPerson, {
      orgId: orgB,
      displayName: "Person B",
      gender: "Kvinna",
    })

    const listA = await asAdminA.query(api.people.people.listPeople, {
      orgId: orgA,
    })
    expect(listA).toHaveLength(1)
    expect(listA[0]?.displayName).toBe("Person A")

    const listB = await asAdminB.query(api.people.people.listPeople, {
      orgId: orgB,
    })
    expect(listB).toHaveLength(1)
    expect(listB[0]?.displayName).toBe("Person B")
  })

  it("createPerson assigns a short publicId, distinct per person", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    await asAdmin.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Alice",
      gender: "Kvinna",
    })
    await asAdmin.mutation(api.people.people.createPerson, {
      orgId,
      displayName: "Bob",
      gender: "Man",
    })

    const list = await asAdmin.query(api.people.people.listPeople, { orgId })
    const publicIds = list.map((p) => p.publicId)
    expect(publicIds).toHaveLength(2)
    for (const publicId of publicIds) {
      expect(publicId).toMatch(/^[0-9a-f]{8}$/)
    }
    expect(new Set(publicIds).size).toBe(2)
  })

  it("getPersonByPublicId returns the person for its own org", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Carla",
        gender: "Kvinna",
        country: "SE",
      }
    )

    const list = await asAdmin.query(api.people.people.listPeople, { orgId })
    const publicId = list[0]?.publicId
    if (publicId === undefined) throw new Error("publicId missing")

    const result = await asAdmin.query(api.people.people.getPersonByPublicId, {
      orgId,
      publicId,
    })
    expect(result).not.toBeNull()
    expect(result?.personId).toBe(personId)
    expect(result?.displayName).toBe("Carla")
    expect(result?.country).toBe("SE")
  })

  it("getPersonByPublicId returns null for a cross-org publicId", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    await asAdminA.mutation(api.people.people.createPerson, {
      orgId: orgA,
      displayName: "Person A",
      gender: "Man",
    })
    const listA = await asAdminA.query(api.people.people.listPeople, {
      orgId: orgA,
    })
    const publicIdA = listA[0]?.publicId
    if (publicIdA === undefined) throw new Error("publicId missing")

    // Org B tries to read org A's person by its public route key.
    const result = await asAdminB.query(api.people.people.getPersonByPublicId, {
      orgId: orgB,
      publicId: publicIdA,
    })
    expect(result).toBeNull()
  })
})

describe("upsertPersonByExternalRef", () => {
  it("inserts on first call and audits person.created", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedOrg(t)

    const { personId, outcome } = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "EMP-001",
        displayName: "Diana Prince",
        gender: "Kvinna",
        country: "SE",
        ftePercent: 100,
      }
    )
    expect(outcome).toBe("created")

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.externalRef).toBe("EMP-001")
      expect(person?.displayName).toBe("Diana Prince")
      expect(person?.country).toBe("SE")

      const auditRows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.created")
        )
        .collect()
      expect(auditRows).toHaveLength(1)
      const payload = auditRows[0]?.payload as Record<string, unknown>
      expect(payload?.personId).toBe(personId)
      // The imported identity values are diffed like every other field
      // (ADR-0013); erasure tombstones them if the person is later deleted.
      const changes = payload?.changes as Record<string, unknown>
      expect(changes.displayName).toEqual({ from: null, to: "Diana Prince" })
      expect(changes.gender).toEqual({ from: null, to: "Kvinna" })
      expect(changes.externalRef).toEqual({ from: null, to: "EMP-001" })
    })
  })

  it("updates changed fields on second call and audits person.updated", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedOrg(t)

    const { personId, outcome } = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "EMP-002",
        displayName: "Eve",
        gender: "Kvinna",
        country: "SE",
        ftePercent: 80,
      }
    )
    expect(outcome).toBe("created")

    // Second call: ftePercent changes.
    const { personId: returnedId, outcome: outcomeAgain } = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "EMP-002",
        displayName: "Eve",
        gender: "Kvinna",
        country: "SE",
        ftePercent: 100,
      }
    )

    expect(returnedId).toBe(personId)
    expect(outcomeAgain).toBe("updated")

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.ftePercent).toBe(100)

      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.updated")
        )
        .collect()
      expect(updated).toHaveLength(1)
      const payload = updated[0]?.payload as Record<string, unknown>
      const changes = payload?.changes as Record<
        string,
        { from: unknown; to: unknown }
      >
      expect(changes?.ftePercent).toEqual({ from: 80, to: 100 })
    })
  })

  it("persists title on insert", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedOrg(t)

    const { personId, outcome } = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "EMP-100",
        displayName: "Grace Hopper",
        gender: "Kvinna",
        country: "SE",
        title: "Senior Backend Engineer",
      }
    )
    expect(outcome).toBe("created")

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.title).toBe("Senior Backend Engineer")
    })
  })

  it("updates title on re-import when the title changes", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedOrg(t)

    const { personId, outcome } = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "EMP-101",
        displayName: "Ada Lovelace",
        gender: "Kvinna",
        country: "SE",
        title: "Engineer",
      }
    )
    expect(outcome).toBe("created")

    const { personId: returnedId, outcome: outcomeAgain } = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "EMP-101",
        displayName: "Ada Lovelace",
        gender: "Kvinna",
        country: "SE",
        title: "Principal Engineer",
      }
    )

    expect(returnedId).toBe(personId)
    expect(outcomeAgain).toBe("updated")
    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.title).toBe("Principal Engineer")
    })
  })

  it("is a no-op (no write, no audit) when nothing changed", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedOrg(t)

    await t.mutation(internal.people.people.upsertPersonByExternalRef, {
      orgId,
      actorId: userId,
      externalRef: "EMP-003",
      displayName: "Frank",
      gender: "Man",
      country: "SE",
    })

    // Identical second call.
    const { outcome: outcomeAgain } = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "EMP-003",
        displayName: "Frank",
        gender: "Man",
        country: "SE",
      }
    )
    expect(outcomeAgain).toBe("unchanged")

    await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      // Still exactly one row.
      expect(people).toHaveLength(1)

      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.updated")
        )
        .collect()
      // No update audit row written.
      expect(updated).toHaveLength(0)
    })
  })

  it("reactivates an archived person with the same employee number and audits it", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    const first = await asAdmin.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "E-7",
        displayName: "Anna Svensson",
        gender: "Kvinna",
      }
    )
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId: first.personId,
    })

    const again = await asAdmin.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "E-7",
        displayName: "Anna Svensson",
        gender: "Kvinna",
      }
    )
    expect(again.personId).toBe(first.personId)
    expect(again.outcome).toBe("unchanged")
    expect(again.reactivated).toBe(true)

    await t.run(async (ctx) => {
      const person = await ctx.db.get(first.personId)
      expect(person?.archivedAt).toBeUndefined()
      const unarchived = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.unarchived")
        )
        .collect()
      expect(unarchived).toHaveLength(1)
      // No field changed, so no person.updated row rides along.
      const updated = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.updated")
        )
        .collect()
      expect(updated).toHaveLength(0)
    })
  })

  it("reports reactivated: false on an active person", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    await asAdmin.mutation(internal.people.people.upsertPersonByExternalRef, {
      orgId,
      actorId: userId,
      externalRef: "E-8",
      displayName: "Bo Karlsson",
      gender: "Man",
    })
    const again = await asAdmin.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "E-8",
        displayName: "Bo Karlsson",
        gender: "Man",
      }
    )
    expect(again.reactivated).toBe(false)
  })
})

describe("archivePerson", () => {
  it("sets archivedAt and writes a person.archived audit row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Grace",
        gender: "Kvinna",
      }
    )

    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.archivedAt).toBeTypeOf("number")

      const archived = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.archived")
        )
        .collect()
      expect(archived).toHaveLength(1)
      const payload = archived[0]?.payload as Record<string, unknown>
      expect(payload?.personId).toBe(personId)
      const changes = payload?.changes as Record<
        string,
        { from: unknown; to: unknown }
      >
      expect(changes?.archivedAt?.from).toBeNull()
      expect(changes?.archivedAt?.to).toBeTypeOf("number")
    })
  })

  it("is a no-op when already archived (no extra audit row)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Hanna",
        gender: "Kvinna",
      }
    )

    // First archive.
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId,
    })
    // Second archive: should be a no-op.
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      const archived = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.archived")
        )
        .collect()
      // Only one audit row despite two calls.
      expect(archived).toHaveLength(1)
    })
  })

  it("is performed by any member of the organization", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)

    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Ingrid",
        gender: "Kvinna",
      }
    )

    const { asEditor } = await addEditorMember(t, orgId, "editor@acme.se")
    await asEditor.mutation(api.people.people.archivePerson, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.archivedAt).toBeTypeOf("number")
    })
  })

  it("throws notFound for a cross-org person", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")

    const { personId: personAId } = await asAdminA.mutation(
      api.people.people.createPerson,
      { orgId: orgA, displayName: "Person A", gender: "Man" }
    )

    // Org B tries to archive org A's person.
    await expect(
      asAdminB.mutation(api.people.people.archivePerson, {
        orgId: orgB,
        personId: personAId,
      })
    ).rejects.toThrow(/errors.notFound/)
  })
})

describe("unarchivePerson", () => {
  it("clears archivedAt and writes a person.unarchived audit row", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Karlsson", gender: "Man" }
    )
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId,
    })

    await asAdmin.mutation(api.people.people.unarchivePerson, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.archivedAt).toBeUndefined()
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.unarchived")
        )
        .collect()
      expect(rows).toHaveLength(1)
      const payload = rows[0]?.payload as {
        personId: string
        changes: { archivedAt: { from: number | null; to: number | null } }
      }
      expect(payload.personId).toBe(personId)
      expect(typeof payload.changes.archivedAt.from).toBe("number")
      expect(payload.changes.archivedAt.to).toBeNull()
    })
  })

  it("is a no-op on an active person (no audit row)", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Karlsson", gender: "Man" }
    )

    await asAdmin.mutation(api.people.people.unarchivePerson, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.unarchived")
        )
        .collect()
      expect(rows).toHaveLength(0)
    })
  })

  it("is performed by an editor", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { asEditor } = await addEditorMember(t, orgId, "editor@acme.se")
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      { orgId, displayName: "Bo Karlsson", gender: "Man" }
    )
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId,
    })

    await asEditor.mutation(api.people.people.unarchivePerson, {
      orgId,
      personId,
    })

    const list = await asAdmin.query(api.people.people.listPeople, { orgId })
    expect(list.map((p) => p.displayName)).toEqual(["Bo Karlsson"])
  })
})

describe("archivePeople", () => {
  async function createMany(
    asAdmin: Awaited<ReturnType<typeof seedOrg>>["asAdmin"],
    orgId: string,
    count: number
  ) {
    const ids = []
    for (let i = 0; i < count; i++) {
      const { personId } = await asAdmin.mutation(
        api.people.people.createPerson,
        { orgId, displayName: `Person ${i}`, gender: "Man" }
      )
      ids.push(personId)
    }
    return ids
  }

  it("archives every active id, skips already-archived ones, one audit row each", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const ids = await createMany(asAdmin, orgId, 3)
    await asAdmin.mutation(api.people.people.archivePerson, {
      orgId,
      personId: ids[0] as (typeof ids)[number],
    })

    const result = await asAdmin.mutation(api.people.people.archivePeople, {
      orgId,
      personIds: ids,
    })
    expect(result).toEqual({ archived: 2 })

    await t.run(async (ctx) => {
      for (const id of ids) {
        const person = await ctx.db.get(id)
        expect(typeof person?.archivedAt).toBe("number")
      }
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "person.archived")
        )
        .collect()
      // One from the single archive above, two from the batch.
      expect(rows).toHaveLength(3)
    })
  })

  it("rejects more ids than the chunk bound", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const ids = await createMany(asAdmin, orgId, PEOPLE_ARCHIVE_CHUNK_SIZE + 1)

    await expect(
      asAdmin.mutation(api.people.people.archivePeople, {
        orgId,
        personIds: ids,
      })
    ).rejects.toThrow(/errors.invalidInput/)

    await t.run(async (ctx) => {
      const person = await ctx.db.get(ids[0] as (typeof ids)[number])
      expect(person?.archivedAt).toBeUndefined()
    })
  })

  it("throws notFound for a cross-org id and archives nothing", async () => {
    const t = initConvexTest()
    const { orgId: orgA, asAdmin: asAdminA } = await seedOrg(t, "hr-a@acme.se")
    const { orgId: orgB, asAdmin: asAdminB } = await seedOrg(t, "hr-b@beta.se")
    const [ownId] = await createMany(asAdminA, orgA, 1)
    const [foreignId] = await createMany(asAdminB, orgB, 1)

    await expect(
      asAdminA.mutation(api.people.people.archivePeople, {
        orgId: orgA,
        personIds: [
          ownId as NonNullable<typeof ownId>,
          foreignId as NonNullable<typeof foreignId>,
        ],
      })
    ).rejects.toThrow(/errors.notFound/)

    await t.run(async (ctx) => {
      const own = await ctx.db.get(ownId as NonNullable<typeof ownId>)
      expect(own?.archivedAt).toBeUndefined()
    })
  })
})

describe("upsert absent-field semantics", () => {
  it("leaves a stored field untouched when the re-import does not carry it", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedOrg(t)
    const { personId } = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "77",
        displayName: "Anna Svensson",
        gender: "Kvinna",
        department: "Ekonomi",
        title: "Controller",
      }
    )

    // Re-import from a narrower file (e.g. salary-only export): no department
    // or title columns. The stored values must survive, and the person counts
    // as unchanged.
    const { outcome } = await t.mutation(
      internal.people.people.upsertPersonByExternalRef,
      {
        orgId,
        actorId: userId,
        externalRef: "77",
        displayName: "Anna Svensson",
        gender: "Kvinna",
      }
    )
    expect(outcome).toBe("unchanged")
    await t.run(async (ctx) => {
      const person = await ctx.db.get(personId)
      expect(person?.department).toBe("Ekonomi")
      expect(person?.title).toBe("Controller")
    })
  })
})

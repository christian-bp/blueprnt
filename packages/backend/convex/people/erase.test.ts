import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import {
  anonymizePersonAuditRows,
  PERSON_ERASURE_AUDIT_FIELDS,
} from "../lib/audit"
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
      seniority: "IC3",
      senioritySource: "confirmed",
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
    // Seed WITH an employee number: it is a person identifier and must not
    // survive in the append-only trail after erasure (GDPR).
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Anna Svensson",
        gender: "Kvinna",
        externalRef: "E-4711",
        country: "SE",
        ftePercent: 100,
        department: "Engineering",
      }
    )

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
      // Employee number (externalRef) is a person identifier: neither the key
      // nor the value may survive, in the payload or its derived searchText.
      expect(payloadJson).not.toContain("externalRef")
      expect(payloadJson).not.toContain("E-4711")
      expect(auditRows[0]?.searchText ?? "").not.toContain("e-4711")

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

  // person.* diffs record the employee's own identity values (ADR-0013), so
  // erasure has to reach back into the EARLIER rows and tombstone them. Without
  // this the right to erasure would be broken: the name, employee number and
  // birth date would survive forever in the retained trail, and (worse) stay
  // full-text searchable through the denormalized searchText.
  it("tombstones the person's identity values across their whole retained trail", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: "Anna Svensson",
        gender: "Kvinna",
        externalRef: "E-4711",
        birthDate: "1985-04-12",
        country: "SE",
        department: "Engineering",
      }
    )
    // A rename, so the trail holds an identity before->after diff too.
    await asAdmin.mutation(api.people.people.updatePerson, {
      orgId,
      personId,
      displayName: "Anna Bergström",
      department: "Marketing",
    })

    // Precondition: while the person exists, the trail really does carry the
    // names (otherwise this test could pass against a trail that never had
    // them, the exact bug being fixed).
    const actorNamesBefore = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const dump = JSON.stringify(rows)
      expect(dump).toContain("Anna Svensson")
      expect(dump).toContain("Anna Bergström")
      expect(dump).toContain("E-4711")
      expect(dump).toContain("1985-04-12")
      return rows.map((row) => row.actorName)
    })

    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()

      // Nothing about the person survives anywhere: payloads or searchText.
      const dump = JSON.stringify(rows)
      expect(dump).not.toContain("Anna Svensson")
      expect(dump).not.toContain("Anna Bergström")
      expect(dump).not.toContain("Svensson")
      expect(dump).not.toContain("Bergström")
      expect(dump).not.toContain("E-4711")
      expect(dump).not.toContain("1985-04-12")
      expect(dump).not.toContain("Kvinna")

      // The rows themselves are KEPT (legitimate interest) and still say which
      // fields changed and when: pseudonymized, not deleted.
      const updated = rows.filter((row) => row.type === "person.updated")
      expect(updated).toHaveLength(1)
      const changes = (
        updated[0]?.payload as { changes?: Record<string, unknown> } | undefined
      )?.changes as Record<string, unknown>
      expect(changes.displayName).toEqual({ from: "erased", to: "erased" })
      // A structural field is not personal data once the person row is gone, so
      // it survives intact and the trail stays useful.
      expect(changes.department).toEqual({
        from: "Engineering",
        to: "Marketing",
      })

      // The created row's identity fields are tombstoned the same way, with the
      // "no value before" side left as null rather than invented.
      const created = rows.filter((row) => row.type === "person.created")
      expect(created).toHaveLength(1)
      const createdChanges = (
        created[0]?.payload as { changes?: Record<string, unknown> } | undefined
      )?.changes as Record<string, unknown>
      expect(createdChanges.displayName).toEqual({ from: null, to: "erased" })
      expect(createdChanges.externalRef).toEqual({ from: null, to: "erased" })
      expect(createdChanges.birthDate).toEqual({ from: null, to: "erased" })

      // The operator who made the edits keeps their snapshotted name untouched:
      // accountability for the action is not the erased person's personal data
      // (only anonymizeAuthoredAuditRows, for an erased OPERATOR, rewrites it).
      expect(
        rows.slice(0, actorNamesBefore.length).map((row) => row.actorName)
      ).toEqual(actorNamesBefore)
    })
  })

  // The sweep above drives two writers. This one drives EVERY writer that can
  // touch a person before erasure, then asserts absence over the whole trail
  // without naming event types. It is the test that fails if a new row class
  // ever carries identity outside the `person`-subject rows the scrub sweeps,
  // or outside the top-level `changes` map it walks.
  it("leaves no identity value in any audit row, whichever writer wrote it", async () => {
    const t = initConvexTest()
    const { orgId, userId, asAdmin } = await seedOrg(t)
    const roleId = await seedRole(orgId, asAdmin)

    const IDENTITY = {
      displayName: "Anna Svensson",
      renamed: "Anna Bergström",
      externalRef: "E-4711",
      birthDate: "1985-04-12",
      title: "Ekonomiassistent",
      importedTitle: "Ekonomichef",
    }

    const { personId } = await asAdmin.mutation(
      api.people.people.createPerson,
      {
        orgId,
        displayName: IDENTITY.displayName,
        gender: "Kvinna",
        externalRef: IDENTITY.externalRef,
        birthDate: IDENTITY.birthDate,
        title: IDENTITY.title,
        country: "SE",
        department: "Engineering",
      }
    )
    // Manual edit path.
    await asAdmin.mutation(api.people.people.updatePerson, {
      orgId,
      personId,
      displayName: IDENTITY.renamed,
    })
    // Import upsert path (a payroll file correcting the job title).
    await t.mutation(internal.people.people.upsertPersonByExternalRef, {
      orgId,
      actorId: userId,
      externalRef: IDENTITY.externalRef,
      displayName: IDENTITY.renamed,
      gender: "Kvinna",
      title: IDENTITY.importedTitle,
    })
    // The person's other writers: assignment, salary, archive.
    await asAdmin.mutation(api.people.assignments.assignPersonToRole, {
      orgId,
      personId,
      roleId,
      seniority: "IC3",
      senioritySource: "confirmed",
    })
    await asAdmin.mutation(api.people.pay.setSalary, {
      orgId,
      personId,
      payYear: 2024,
      basicMonthly: 50000,
      currency: "SEK",
      components: [],
    })
    await asAdmin.mutation(api.people.people.archivePerson, { orgId, personId })

    const identityValues = Object.values(IDENTITY)

    // Precondition: the trail really holds each of them somewhere.
    await t.run(async (ctx) => {
      const dump = JSON.stringify(
        await ctx.db
          .query("auditLog")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      )
      for (const value of identityValues) {
        expect(dump, value).toContain(value)
      }
    })

    await asAdmin.mutation(api.people.erase.erasePersonAsOrg, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const dump = JSON.stringify(rows)
      for (const value of identityValues) {
        expect(dump, value).not.toContain(value)
      }
      // Case-insensitively too: searchText is lowercased.
      for (const value of identityValues) {
        expect(dump.toLowerCase(), value).not.toContain(value.toLowerCase())
      }

      // The row written AT erasure snapshots exactly the identity-free list, so
      // a call site passing the wrong field list would fail here.
      const erased = rows.filter((row) => row.type === "person.erased")
      expect(erased).toHaveLength(1)
      const erasedChanges = (
        erased[0]?.payload as { changes?: Record<string, unknown> } | undefined
      )?.changes as Record<string, unknown>
      expect(Object.keys(erasedChanges).sort()).toEqual(
        [...PERSON_ERASURE_AUDIT_FIELDS].sort()
      )

      // Re-running the scrub is a no-op: erasure never rewrites clean rows.
      const contentBefore = rows.map((row) => [row.payload, row.searchText])
      await anonymizePersonAuditRows(ctx, orgId, personId)
      const after = await ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(after.map((row) => [row.payload, row.searchText])).toEqual(
        contentBefore
      )
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

  // ADMIN-ONLY, the one product function outside org administration that is:
  // least privilege for irreversible destruction. An editor is refused, and
  // the person is still there afterwards, so the refusal is the gate answering
  // rather than the call failing somewhere inside.
  it("refuses an editor, and leaves the person untouched", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)

    const asEditor = await seedEditor(t, orgId, "editor@acme.se")
    await expect(
      asEditor.mutation(api.people.erase.erasePersonAsOrg, {
        orgId,
        personId,
      })
    ).rejects.toThrow(/errors.adminRequired/)

    await t.run(async (ctx) => {
      expect(await ctx.db.get(personId)).not.toBeNull()
    })
  })

  // The boundary from the other side. Everything AROUND the erasure is
  // everyday person work and stays member-level, so an editor archiving
  // someone who has left is not blocked by the gate on destroying them.
  it("leaves the everyday person work open to an editor", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedOrg(t)
    const personId = await seedPerson(orgId, asAdmin)
    const asEditor = await seedEditor(t, orgId, "editor2@acme.se")

    await asEditor.mutation(api.people.people.archivePerson, {
      orgId,
      personId,
    })

    await t.run(async (ctx) => {
      expect((await ctx.db.get(personId))?.archivedAt).toBeTypeOf("number")
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
      seniority: "IC2",
      senioritySource: "confirmed",
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
        seniority: "IC3",
        senioritySource: "confirmed" as const,
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

  // Membership is the gate, not the role: an editor erases, a stranger cannot.
  it("rejects a caller who is not a member at all", async () => {
    const t = initConvexTest()
    const { orgId } = await seedOrg(t, "hr@acme.se")
    const personId = await t.run(async (ctx) =>
      ctx.db.insert("people", {
        orgId,
        publicId: "pub-test2",
        displayName: "Test",
        gender: "Man" as const,
      })
    )
    const { orgId: otherOrgId } = await seedOrg(t, "hr@other.se")
    const outsider = await seedEditor(t, otherOrgId, "editor@other.se")
    await expect(
      outsider.mutation(api.people.erase.erasePersonAsOrg, { orgId, personId })
    ).rejects.toThrow(/errors\.notAMember/)
  })
})

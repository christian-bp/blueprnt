import { describe, expect, it } from "vitest"
import { formatAuditDetail, formatChanges } from "./audit-detail"

const labels = {
  deletedRole: "Deleted role",
  deletedFamily: "Deleted family",
  deletedUser: "Deleted user",
}

// Stub resolver: upper-cases the field name so tests can tell labels apart from
// raw field keys without depending on the i18n catalog.
const fieldLabel = (f: string) => f.charAt(0).toUpperCase() + f.slice(1)

describe("formatChanges", () => {
  it("renders a real change as 'label: from -> to'", () => {
    expect(
      formatChanges({ country: { from: "se", to: "no" } }, fieldLabel)
    ).toBe("Country: se → no")
  })

  it("renders a set (from null) as just 'label: to'", () => {
    expect(
      formatChanges({ country: { from: null, to: "se" } }, fieldLabel)
    ).toBe("Country: se")
  })

  it("treats an empty/blank from as a set (no leading arrow)", () => {
    expect(
      formatChanges(
        { responsibilities: { from: "", to: "Lead the team" } },
        fieldLabel
      )
    ).toBe("Responsibilities: Lead the team")
  })

  it("joins multiple entries with '; '", () => {
    expect(
      formatChanges(
        {
          country: { from: "se", to: "no" },
          currency: { from: null, to: "SEK" },
        },
        fieldLabel
      )
    ).toBe("Country: se → no; Currency: SEK")
  })

  it("treats undefined like null on either side", () => {
    expect(
      formatChanges({ team: { from: undefined, to: "Core" } }, fieldLabel)
    ).toBe("Team: Core")
    expect(
      formatChanges({ team: { from: "Core", to: undefined } }, fieldLabel)
    ).toBe("Team: Core → ")
  })
})

describe("formatAuditDetail", () => {
  it("resolves a role id to its title", () => {
    const names = { r1: "System Developer" }
    expect(
      formatAuditDetail(
        "role.created",
        { roleId: "r1", source: "starter" },
        names,
        labels
      )
    ).toBe("System Developer")
  })

  it("renders role.updated as 'title: <changes>'", () => {
    const names = { r1: "System Developer" }
    expect(
      formatAuditDetail(
        "role.updated",
        {
          roleId: "r1",
          changes: {
            title: { from: "Dev", to: "Senior Dev" },
            team: { from: "Core", to: "Platform" },
          },
        },
        names,
        labels,
        fieldLabel
      )
    ).toBe("System Developer: Title: Dev → Senior Dev; Team: Core → Platform")
  })

  it("falls back to the deleted-role label when the role id is unknown", () => {
    expect(
      formatAuditDetail(
        "role.updated",
        { roleId: "gone", changes: { title: { from: "a", to: "b" } } },
        {},
        labels,
        fieldLabel
      )
    ).toBe("Deleted role: Title: a → b")
  })

  it("uses the family name from the payload", () => {
    expect(
      formatAuditDetail(
        "roleFamily.created",
        { familyId: "f1", name: "Engineering" },
        {},
        labels
      )
    ).toBe("Engineering")
  })

  it("resolves a family id to its name when no name is in the payload", () => {
    const names = { f1: "Engineering" }
    expect(
      formatAuditDetail("roleFamily.removed", { familyId: "f1" }, names, labels)
    ).toBe("Engineering")
  })

  it("renders roleFamily.renamed as 'family: <changes>'", () => {
    const names = { f1: "Engineering" }
    expect(
      formatAuditDetail(
        "roleFamily.renamed",
        {
          familyId: "f1",
          changes: { name: { from: "Eng", to: "Engineering" } },
        },
        names,
        labels,
        fieldLabel
      )
    ).toBe("Engineering: Name: Eng → Engineering")
  })

  it("renders member.added as name (role)", () => {
    const names = { u1: "Jane Doe" }
    expect(
      formatAuditDetail(
        "member.added",
        { memberUserId: "u1", role: "editor" },
        names,
        labels
      )
    ).toBe("Jane Doe (editor)")
  })

  it("renders member.roleChanged as 'name: <changes>'", () => {
    const names = { u1: "Jane Doe" }
    expect(
      formatAuditDetail(
        "member.roleChanged",
        {
          memberUserId: "u1",
          changes: { role: { from: "editor", to: "admin" } },
        },
        names,
        labels,
        fieldLabel
      )
    ).toBe("Jane Doe: Role: editor → admin")
  })

  it("renders band.shift as title (expected -> computed)", () => {
    const names = { r1: "System Developer" }
    expect(
      formatAuditDetail(
        "band.shift",
        { roleId: "r1", expectedBand: 3, computedBand: 2 },
        names,
        labels
      )
    ).toBe("System Developer (3 → 2)")
  })

  it("renders settingsUpdated changes", () => {
    expect(
      formatAuditDetail(
        "organization.settingsUpdated",
        {
          changes: {
            currency: { from: "SEK", to: "NOK" },
            country: { from: null, to: "no" },
          },
        },
        {},
        labels,
        fieldLabel
      )
    ).toBe("Currency: SEK → NOK; Country: no")
  })

  it("falls back cleanly, dropping *Id and source", () => {
    expect(
      formatAuditDetail(
        "future.event",
        { roleId: "r1", source: "starter", status: "active", count: 3 },
        {},
        labels
      )
    ).toBe("status: active, count: 3")
  })
})

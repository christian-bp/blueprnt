import { describe, expect, it } from "vitest"
import { formatAuditDetail } from "./audit-detail"

const labels = {
  deletedRole: "Deleted role",
  deletedFamily: "Deleted family",
  deletedUser: "Deleted user",
}

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

  it("falls back to the deleted-role label when the role id is unknown", () => {
    expect(
      formatAuditDetail("role.updated", { roleId: "gone" }, {}, labels)
    ).toBe("Deleted role")
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

  it("renders member.roleChanged as name: from -> to", () => {
    const names = { u1: "Jane Doe" }
    expect(
      formatAuditDetail(
        "member.roleChanged",
        { memberUserId: "u1", from: "editor", to: "admin" },
        names,
        labels
      )
    ).toBe("Jane Doe: editor → admin")
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

  it("joins the changed fields for settingsUpdated", () => {
    expect(
      formatAuditDetail(
        "organization.settingsUpdated",
        { changed: ["currency", "country"] },
        {},
        labels
      )
    ).toBe("currency, country")
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

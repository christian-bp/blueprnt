import { describe, expect, it } from "vitest"
import {
  type DraftFamily,
  findFamilyIdByRole,
  moveRoleToFamily,
  reorderRoleWithinFamily,
} from "@/lib/family-dnd"

function fixture(): DraftFamily[] {
  return [
    {
      id: 1,
      name: "Engineering",
      roles: [
        { id: 10, title: "Developer", trackKey: "IC" },
        { id: 11, title: "Tech Lead", trackKey: "Lead" },
      ],
    },
    {
      id: 2,
      name: "Sales",
      roles: [{ id: 20, title: "Account Executive", trackKey: "IC" }],
    },
    { id: 3, name: "Empty", roles: [] },
  ]
}

function titles(families: DraftFamily[], familyId: number): string[] {
  return (
    families
      .find((family) => family.id === familyId)
      ?.roles.map((role) => role.title) ?? []
  )
}

describe("findFamilyIdByRole", () => {
  it("finds the family holding the role, or null", () => {
    expect(findFamilyIdByRole(fixture(), 20)).toBe(2)
    expect(findFamilyIdByRole(fixture(), 99)).toBeNull()
  })
})

describe("moveRoleToFamily", () => {
  it("appends to the target family when no anchor role is given", () => {
    const result = moveRoleToFamily(fixture(), 10, 2)
    expect(titles(result, 1)).toEqual(["Tech Lead"])
    expect(titles(result, 2)).toEqual(["Account Executive", "Developer"])
  })

  it("inserts in front of the anchor role", () => {
    const result = moveRoleToFamily(fixture(), 10, 2, 20)
    expect(titles(result, 2)).toEqual(["Developer", "Account Executive"])
  })

  it("moves into an empty family", () => {
    const result = moveRoleToFamily(fixture(), 10, 3)
    expect(titles(result, 3)).toEqual(["Developer"])
  })

  it("moves backwards to a family earlier in the list", () => {
    const result = moveRoleToFamily(fixture(), 20, 1, 11)
    expect(titles(result, 1)).toEqual([
      "Developer",
      "Account Executive",
      "Tech Lead",
    ])
    expect(titles(result, 2)).toEqual([])
  })

  it("no-ops return the input reference so setState can bail out", () => {
    const families = fixture()
    expect(moveRoleToFamily(families, 10, 1)).toBe(families)
    expect(moveRoleToFamily(families, 99, 2)).toBe(families)
    expect(moveRoleToFamily(families, 10, 99)).toBe(families)
  })
})

describe("reorderRoleWithinFamily", () => {
  it("moves the role to the anchor position", () => {
    const result = reorderRoleWithinFamily(fixture(), 11, 10)
    expect(titles(result, 1)).toEqual(["Tech Lead", "Developer"])
  })

  it("no-ops (cross-family, same id, unknown ids) return the input reference", () => {
    const families = fixture()
    expect(reorderRoleWithinFamily(families, 10, 20)).toBe(families)
    expect(reorderRoleWithinFamily(families, 10, 10)).toBe(families)
    expect(reorderRoleWithinFamily(families, 99, 10)).toBe(families)
  })
})

import { describe, expect, it } from "vitest"
import { groupByFamily } from "./role-groups"

describe("groupByFamily", () => {
  it("groups rows under families sorted by name with the family-less last", () => {
    const rows = [
      { roleId: "r1", familyId: "f-tech", familyName: "Tech" },
      { roleId: "r2", familyId: null, familyName: null },
      { roleId: "r3", familyId: "f-sales", familyName: "Sales" },
      { roleId: "r4", familyId: "f-tech", familyName: "Tech" },
    ]
    const groups = groupByFamily(rows)
    expect(groups.map((group) => group.familyId)).toEqual([
      "f-sales",
      "f-tech",
      null,
    ])
    expect(groups[1]?.rows.map((row) => row.roleId)).toEqual(["r1", "r4"])
  })

  it("omits the family-less group when every row has a family", () => {
    const rows = [{ roleId: "r1", familyId: "f1", familyName: "A" }]
    expect(groupByFamily(rows).map((group) => group.familyId)).toEqual(["f1"])
  })
})

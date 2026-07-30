import { describe, expect, it } from "vitest"
import { countUnevaluated } from "./evaluation-summary"

describe("countUnevaluated", () => {
  it("counts roles without a band in the results", () => {
    expect(
      countUnevaluated(
        [{ roleId: "r1" }, { roleId: "r2" }, { roleId: "r3" }],
        [
          { roleId: "r1", band: 3 },
          { roleId: "r2", band: null },
        ]
      )
    ).toBe(2)
  })

  it("counts a role with no result row at all", () => {
    expect(countUnevaluated([{ roleId: "r1" }], [])).toBe(1)
  })

  it("returns zero when every role has a band", () => {
    expect(
      countUnevaluated([{ roleId: "r1" }], [{ roleId: "r1", band: 1 }])
    ).toBe(0)
  })

  it("returns zero for no roles", () => {
    expect(countUnevaluated([], [{ roleId: "ghost", band: 2 }])).toBe(0)
  })
})

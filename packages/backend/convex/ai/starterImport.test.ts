import { describe, expect, it } from "vitest"
import { sanitizeStarterImport } from "./starterImport"

function role(title: string, trackKey = "IC") {
  return { title, trackKey }
}

describe("sanitizeStarterImport", () => {
  it("trims names and titles and drops empty entries", () => {
    const result = sanitizeStarterImport([
      {
        name: "  Engineering  ",
        roles: [role("  Developer "), role("   ")],
      },
      { name: "   ", roles: [role("Orphan")] },
      { name: "Empty", roles: [] },
    ])
    expect(result).toEqual([
      { name: "Engineering", roles: [role("Developer")] },
    ])
  })

  it("falls back to IC for unknown track keys and keeps valid ones", () => {
    const result = sanitizeStarterImport([
      {
        name: "Engineering",
        roles: [
          role("Dev", "IC"),
          role("Manager", "Boss"),
          role("Lead", "Lead"),
        ],
      },
    ])
    expect(result[0]?.roles.map((item) => item.trackKey)).toEqual([
      "IC",
      "IC",
      "Lead",
    ])
  })

  it("merges duplicate family names case-insensitively, first name wins", () => {
    const result = sanitizeStarterImport([
      { name: "Sales", roles: [role("AE")] },
      { name: "sales", roles: [role("SDR")] },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe("Sales")
    expect(result[0]?.roles.map((item) => item.title)).toEqual(["AE", "SDR"])
  })

  it("clamps to the starter-set limits (20 families, 100 roles)", () => {
    const manyFamilies = Array.from({ length: 25 }, (_, index) => ({
      name: `Family ${index}`,
      roles: [role(`Role ${index}`)],
    }))
    expect(sanitizeStarterImport(manyFamilies)).toHaveLength(20)

    const manyRoles = [
      {
        name: "Big",
        roles: Array.from({ length: 120 }, (_, index) => role(`Role ${index}`)),
      },
      { name: "After", roles: [role("Starved")] },
    ]
    const clamped = sanitizeStarterImport(manyRoles)
    expect(clamped).toHaveLength(1)
    expect(clamped[0]?.roles).toHaveLength(100)
  })

  it("slices overlong names and titles to the contract lengths", () => {
    const result = sanitizeStarterImport([
      { name: "n".repeat(150), roles: [role("t".repeat(250))] },
    ])
    expect(result[0]?.name).toHaveLength(100)
    expect(result[0]?.roles[0]?.title).toHaveLength(200)
  })
})

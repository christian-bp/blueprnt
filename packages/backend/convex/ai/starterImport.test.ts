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
    expect(result.families).toEqual([
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
    expect(result.families[0]?.roles.map((item) => item.trackKey)).toEqual([
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
    expect(result.families).toHaveLength(1)
    expect(result.families[0]?.name).toBe("Sales")
    expect(result.families[0]?.roles.map((item) => item.title)).toEqual([
      "AE",
      "SDR",
    ])
  })

  it("clamps to the starter-set limits (20 families, 100 roles)", () => {
    const manyFamilies = Array.from({ length: 25 }, (_, index) => ({
      name: `Family ${index}`,
      roles: [role(`Role ${index}`)],
    }))
    expect(sanitizeStarterImport(manyFamilies).families).toHaveLength(20)

    const manyRoles = [
      {
        name: "Big",
        roles: Array.from({ length: 120 }, (_, index) => role(`Role ${index}`)),
      },
      { name: "After", roles: [role("Starved")] },
    ]
    const clamped = sanitizeStarterImport(manyRoles)
    expect(clamped.families).toHaveLength(1)
    expect(clamped.families[0]?.roles).toHaveLength(100)
  })

  // The clamp used to be silent: 150 roles in, 100 out, and the review showed
  // only the survivors, so the user learned about the loss (if ever) from the
  // register. The flag is what lets the review say so.
  it("reports truncation when the role budget drops titles", () => {
    const manyRoles = [
      {
        name: "Big",
        roles: Array.from({ length: 120 }, (_, index) => role(`Role ${index}`)),
      },
    ]
    expect(sanitizeStarterImport(manyRoles).truncated).toBe(true)
  })

  it("reports truncation when a family past the cap holds real titles", () => {
    const manyFamilies = Array.from({ length: 25 }, (_, index) => ({
      name: `Family ${index}`,
      roles: [role(`Role ${index}`)],
    }))
    expect(sanitizeStarterImport(manyFamilies).truncated).toBe(true)
  })

  // Truncation means the CAPS cost the user roles. The trust-boundary drops (a
  // blank name, a blank title, an empty family) remove nothing that was
  // written, so flagging them would put a "some roles were left out" notice on
  // a perfectly complete import.
  it("does not report truncation for blank entries or a within-limits import", () => {
    expect(
      sanitizeStarterImport([
        { name: "Engineering", roles: [role("Developer"), role("  ")] },
        { name: "  ", roles: [role("Orphan")] },
        { name: "Empty", roles: [] },
      ]).truncated
    ).toBe(false)
  })

  // A family past the cap that carries nothing loses nothing.
  it("does not report truncation for an empty family past the family cap", () => {
    const families = [
      ...Array.from({ length: 20 }, (_, index) => ({
        name: `Family ${index}`,
        roles: [role(`Role ${index}`)],
      })),
      { name: "Twenty-first", roles: [] },
    ]
    const result = sanitizeStarterImport(families)
    expect(result.families).toHaveLength(20)
    expect(result.truncated).toBe(false)
  })

  it("slices overlong names and titles to the contract lengths", () => {
    const result = sanitizeStarterImport([
      { name: "n".repeat(150), roles: [role("t".repeat(250))] },
    ])
    expect(result.families[0]?.name).toHaveLength(100)
    expect(result.families[0]?.roles[0]?.title).toHaveLength(200)
  })
})

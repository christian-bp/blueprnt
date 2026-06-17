import { describe, expect, it } from "vitest"
import { resolveActiveOrgId } from "./active-org"

const orgs = [
  { id: "a", name: "Acme" },
  { id: "b", name: "Beta" },
]

describe("resolveActiveOrgId", () => {
  it("returns null while the company list is loading", () => {
    expect(resolveActiveOrgId(undefined, undefined)).toBeNull()
    expect(resolveActiveOrgId(null, null)).toBeNull()
  })

  it("returns null when the user has no companies", () => {
    expect(resolveActiveOrgId(null, [])).toBeNull()
  })

  it("uses the active company when it is one of the memberships", () => {
    expect(resolveActiveOrgId("b", orgs)).toBe("b")
  })

  it("falls back to the first company when no active is set", () => {
    expect(resolveActiveOrgId(null, orgs)).toBe("a")
  })

  it("falls back to the first company when the active id is stale", () => {
    expect(resolveActiveOrgId("gone", orgs)).toBe("a")
  })
})

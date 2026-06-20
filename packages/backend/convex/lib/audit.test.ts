import { describe, expect, it } from "vitest"
import { AUDIT_EVENTS, buildChanges, PLATFORM_AUDIT_EVENTS } from "./audit"

describe("admin audit vocabulary", () => {
  it("defines the platform event keys", () => {
    expect(PLATFORM_AUDIT_EVENTS.userCreated).toBe("platform.userCreated")
    expect(PLATFORM_AUDIT_EVENTS.userDeleted).toBe("platform.userDeleted")
    expect(PLATFORM_AUDIT_EVENTS.orgCreated).toBe("platform.orgCreated")
    expect(PLATFORM_AUDIT_EVENTS.orgUpdated).toBe("platform.orgUpdated")
    expect(PLATFORM_AUDIT_EVENTS.membershipGranted).toBe(
      "platform.membershipGranted"
    )
    expect(PLATFORM_AUDIT_EVENTS.membershipRoleChanged).toBe(
      "platform.membershipRoleChanged"
    )
    expect(PLATFORM_AUDIT_EVENTS.membershipRevoked).toBe(
      "platform.membershipRevoked"
    )
  })

  it("keeps the admin and org vocabularies disjoint", () => {
    const orgValues = new Set<string>(Object.values(AUDIT_EVENTS))
    for (const value of Object.values(PLATFORM_AUDIT_EVENTS)) {
      expect(orgValues.has(value)).toBe(false)
      expect(value.startsWith("platform.")).toBe(true)
    }
  })
})

describe("buildChanges", () => {
  it("includes only fields that actually changed", () => {
    const changes = buildChanges(
      { country: "se", currency: "SEK", language: "sv" },
      { country: "no", currency: "SEK", language: "nb" },
      ["country", "currency", "language"]
    )
    expect(changes).toEqual({
      country: { from: "se", to: "no" },
      language: { from: "sv", to: "nb" },
    })
  })

  it("collapses undefined to null on both sides", () => {
    expect(buildChanges({}, { country: "se" }, ["country"])).toEqual({
      country: { from: null, to: "se" },
    })
    expect(buildChanges({ country: "se" }, {}, ["country"])).toEqual({})
    expect(
      buildChanges({ country: "se" }, { country: undefined }, ["country"])
    ).toEqual({ country: { from: "se", to: null } })
  })

  it("ignores fields absent from the after object", () => {
    expect(
      buildChanges({ country: "se", currency: "SEK" }, { country: "no" }, [
        "country",
        "currency",
      ])
    ).toEqual({ country: { from: "se", to: "no" } })
  })

  it("yields an empty object when nothing changed", () => {
    expect(
      buildChanges({ country: "se" }, { country: "se" }, ["country"])
    ).toEqual({})
  })
})

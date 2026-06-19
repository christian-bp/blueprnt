import { describe, expect, it } from "vitest"
import { AUDIT_EVENTS, PLATFORM_AUDIT_EVENTS } from "./audit"

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

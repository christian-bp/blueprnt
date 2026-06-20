import { describe, expect, it } from "vitest"
import {
  AUDIT_EVENTS,
  buildChanges,
  buildSearchText,
  categoryForEvent,
  PLATFORM_AUDIT_EVENTS,
} from "./audit"

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

describe("categoryForEvent", () => {
  it("maps representative events to the right category", () => {
    expect(categoryForEvent("model.created")).toBe("model")
    expect(categoryForEvent("role.updated")).toBe("role")
    expect(categoryForEvent("roleFamily.renamed")).toBe("role")
    expect(categoryForEvent("rating.change")).toBe("role")
    expect(categoryForEvent("band.shift")).toBe("role")
    expect(categoryForEvent("anchorRole.designated")).toBe("role")
    expect(categoryForEvent("organization.settingsUpdated")).toBe(
      "organization"
    )
    expect(categoryForEvent("member.added")).toBe("member")
    expect(categoryForEvent("invitation.created")).toBe("member")
    expect(categoryForEvent("ai.suggestionConfirmed")).toBe("ai")
  })

  it("returns undefined for an unknown type", () => {
    expect(categoryForEvent("something.else")).toBeUndefined()
    expect(categoryForEvent("platform.userCreated")).toBeUndefined()
  })

  it("covers every AUDIT_EVENTS value with a category", () => {
    for (const type of Object.values(AUDIT_EVENTS)) {
      expect(categoryForEvent(type)).toBeDefined()
    }
  })
})

describe("buildSearchText", () => {
  it("joins actor, type, and payload scalars, lowercased", () => {
    const text = buildSearchText("Admin Person", "role.created", {
      roleId: "abc123",
      source: "starter",
      count: 3,
    })
    expect(text).toBe("admin person role.created abc123 starter 3")
  })

  it("includes nested changes from/to values", () => {
    const text = buildSearchText(
      "Admin Person",
      "organization.settingsUpdated",
      {
        changes: {
          country: { from: "SE", to: "NO" },
          language: { from: "sv", to: "nb" },
        },
      }
    )
    expect(text).toContain("se")
    expect(text).toContain("no")
    expect(text).toContain("sv")
    expect(text).toContain("nb")
    expect(text).toContain("organization.settingsupdated")
    expect(text).toContain("admin person")
  })

  it("ignores non-scalar leaves and null changes", () => {
    const text = buildSearchText("Sys", "model.updated", {
      flag: true,
      nothing: null,
      tags: ["a", "b"],
      changes: {
        name: { from: null, to: "New Model" },
        bad: null,
      },
    })
    expect(text).toBe("sys model.updated new model")
  })
})

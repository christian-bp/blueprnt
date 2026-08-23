import messages from "@workspace/i18n/messages/en.json"
import { describe, expect, it } from "vitest"
import {
  areaForPathname,
  areasFor,
  deepestMatch,
  innerNavFor,
  NAV_AREAS,
  settingsHrefFor,
} from "@/lib/navigation"

const area = (id: string) => {
  const found = NAV_AREAS.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`no area ${id}`)
  return found
}

// The label keys are relative to the `dashboard` namespace, so resolve them
// against that subtree the way t() does.
function resolve(key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      messages.dashboard
    )
}

describe("registry invariants", () => {
  it("keeps area ids, hrefs and label keys unique", () => {
    const ids = NAV_AREAS.map((candidate) => candidate.id)
    expect(new Set(ids).size).toBe(ids.length)
    const hrefs = NAV_AREAS.map((candidate) => candidate.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    const labels = NAV_AREAS.map((candidate) => candidate.labelKey)
    expect(new Set(labels).size).toBe(labels.length)
    // Within one area the inner hrefs are unique too (an inner row may repeat
    // the AREA's href, the way Overview repeats /work, but never a sibling's).
    for (const candidate of NAV_AREAS) {
      const inner = candidate.innerNav.flatMap((group) =>
        group.entries.map((entry) => entry.href)
      )
      expect(new Set(inner).size, candidate.id).toBe(inner.length)
    }
  })

  it("names an existing message for every area, group and entry", () => {
    for (const candidate of NAV_AREAS) {
      expect(typeof resolve(candidate.labelKey), candidate.labelKey).toBe(
        "string"
      )
      for (const group of candidate.innerNav) {
        if (group.labelKey !== undefined) {
          expect(typeof resolve(group.labelKey), group.labelKey).toBe("string")
        }
        for (const entry of group.entries) {
          expect(typeof resolve(entry.labelKey), entry.labelKey).toBe("string")
        }
      }
    }
  })

  it("carries icon data rather than a rendered element", () => {
    // Icon data keeps the registry framework free: a rendered element would
    // make every consumer, including a server one, pull in React.
    for (const candidate of NAV_AREAS) {
      expect(Array.isArray(candidate.icon), candidate.labelKey).toBe(true)
    }
  })
})

describe("areaForPathname", () => {
  it("maps the root to home and only the root", () => {
    expect(areaForPathname("/")?.id).toBe("home")
    expect(areaForPathname("/roles")?.id).not.toBe("home")
  })

  it("maps /work and /roles to the work area", () => {
    expect(areaForPathname("/work")?.id).toBe("work")
    expect(areaForPathname("/roles")?.id).toBe("work")
    expect(areaForPathname("/roles/senior-engineer")?.id).toBe("work")
  })

  it("does not swallow sibling routes that share a prefix", () => {
    expect(areaForPathname("/workspace")).toBeUndefined()
  })

  it("maps the settings constellation to settings", () => {
    for (const path of [
      "/organization/general",
      "/organization/members",
      "/account/profile",
      "/account/security",
      "/audit-log",
    ]) {
      expect(areaForPathname(path)?.id).toBe("settings")
    }
  })

  it("maps a run path to payMappings and admin paths to admin", () => {
    expect(
      areaForPathname("/pay-mappings/run-2026/analysis/equal-work")?.id
    ).toBe("payMappings")
    expect(areaForPathname("/admin/email-log")?.id).toBe("admin")
  })
})

describe("gating", () => {
  it("hides the admin-gated settings rows from editors but keeps the area", () => {
    const groups = innerNavFor(area("settings"), "editor")
    const hrefs = groups.flatMap((group) =>
      group.entries.map((entry) => entry.href)
    )
    expect(hrefs).toEqual(["/account/profile", "/account/security"])
    // The emptied organization group dropped its heading with it.
    expect(groups).toHaveLength(1)
  })

  it("gives admins the full settings nav including the audit log", () => {
    const hrefs = innerNavFor(area("settings"), "admin").flatMap((group) =>
      group.entries.map((entry) => entry.href)
    )
    expect(hrefs).toContain("/organization/general")
    expect(hrefs).toContain("/audit-log")
  })

  it("keeps the platform admin area out of areasFor entirely", () => {
    expect(
      areasFor("admin").some((candidate) => candidate.id === "admin")
    ).toBe(false)
    expect(
      areasFor("editor").some((candidate) => candidate.id === "admin")
    ).toBe(false)
  })

  it("lands admins on the organization and editors on their account", () => {
    expect(settingsHrefFor("admin")).toBe("/organization/general")
    expect(settingsHrefFor("editor")).toBe("/account/profile")
  })
})

describe("deepestMatch", () => {
  const hrefs = ["/people", "/people/classify"]

  it("prefers the deeper sibling", () => {
    expect(deepestMatch(hrefs, "/people/classify")).toBe("/people/classify")
  })

  it("keeps a detail page on its register", () => {
    expect(deepestMatch(hrefs, "/people/abc123")).toBe("/people")
  })
})

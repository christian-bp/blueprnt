import messages from "@workspace/i18n/messages/en.json"
import { describe, expect, it } from "vitest"
import {
  canSeeNavEntry,
  isNavActive,
  NAV_DOCS,
  NAV_GROUPS,
  navEntriesFor,
  navGroupsFor,
} from "@/lib/navigation"

const ALL_ENTRIES = [...NAV_GROUPS.flatMap((group) => group.entries), NAV_DOCS]

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

describe("navigation registry", () => {
  it("keeps every destination and label key unique", () => {
    const hrefs = ALL_ENTRIES.map((entry) => entry.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    const labelKeys = ALL_ENTRIES.map((entry) => entry.labelKey)
    expect(new Set(labelKeys).size).toBe(labelKeys.length)
    const groupKeys = NAV_GROUPS.map((group) => group.labelKey)
    expect(new Set(groupKeys).size).toBe(groupKeys.length)
  })

  it("names an existing message for every entry and group", () => {
    for (const entry of ALL_ENTRIES) {
      expect(typeof resolve(entry.labelKey), entry.labelKey).toBe("string")
    }
    for (const group of NAV_GROUPS) {
      expect(typeof resolve(group.labelKey), group.labelKey).toBe("string")
    }
  })

  it("carries icon data rather than a rendered element", () => {
    // Icon data keeps the registry framework free: a rendered element would
    // make every consumer, including a server one, pull in React.
    for (const entry of ALL_ENTRIES) {
      expect(Array.isArray(entry.icon), entry.labelKey).toBe(true)
    }
  })

  it("keeps the guide in the footer, out of the groups", () => {
    expect(
      NAV_GROUPS.some((group) =>
        group.entries.some((entry) => entry.href === NAV_DOCS.href)
      )
    ).toBe(false)
    expect(NAV_DOCS.href).toBe("/docs")
  })
})

describe("role filtering", () => {
  it("hides an admin-only entry from an editor", () => {
    const auditLog = ALL_ENTRIES.find((entry) => entry.href === "/audit-log")
    if (auditLog === undefined) throw new Error("no /audit-log entry")
    expect(auditLog.adminOnly).toBe(true)
    expect(canSeeNavEntry(auditLog, "editor")).toBe(false)
    expect(canSeeNavEntry(auditLog, "admin")).toBe(true)
  })

  it("drops a group an editor may not see any entry of", () => {
    const editorGroups = navGroupsFor("editor").map((g) => g.labelKey)
    expect(editorGroups).not.toContain("nav.groups.administration")
    const adminGroups = navGroupsFor("admin").map((g) => g.labelKey)
    expect(adminGroups).toContain("nav.groups.administration")
  })

  it("keeps the non-admin groups identical for both roles", () => {
    const hrefsOf = (role: string) =>
      navGroupsFor(role).flatMap((group) =>
        group.entries.map((entry) => entry.href)
      )
    const editor = hrefsOf("editor")
    expect(hrefsOf("admin")).toEqual([...editor, "/organization", "/audit-log"])
  })

  it("flattens to every visible destination, the guide last", () => {
    const editor = navEntriesFor("editor")
    expect(editor.every((entry) => !entry.adminOnly)).toBe(true)
    expect(editor.at(-1)?.href).toBe("/docs")
    expect(navEntriesFor("admin").length).toBe(editor.length + 2)
  })
})

describe("isNavActive", () => {
  it("marks the root only on the root", () => {
    expect(isNavActive("/", "/")).toBe(true)
    expect(isNavActive("/model", "/")).toBe(false)
  })

  it("marks a section on its own path and below it", () => {
    expect(isNavActive("/model", "/model")).toBe(true)
    expect(isNavActive("/model/weighting", "/model")).toBe(true)
  })

  it("matches whole path segments, not string prefixes", () => {
    expect(isNavActive("/workspace", "/work")).toBe(false)
  })

  it("extends the match with the entry's extra prefixes", () => {
    expect(isNavActive("/roles/r1", "/work", ["/roles"])).toBe(true)
    expect(isNavActive("/people", "/work", ["/roles"])).toBe(false)
  })

  it("keeps the registry's own match prefixes working", () => {
    const work = NAV_GROUPS.flatMap((group) => group.entries).find(
      (entry) => entry.href === "/work"
    )
    expect(isNavActive("/roles", work?.href ?? "", work?.match)).toBe(true)
  })
})

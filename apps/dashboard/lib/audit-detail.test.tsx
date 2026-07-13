import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import {
  aiAuditDetail,
  changeEntries,
  formatAuditDetail as rawFormatAuditDetail,
  formatChanges as rawFormatChanges,
  formatAuditValue,
  formatStats,
  orderEntries,
  payloadChanges,
  payloadItems,
  payloadMoves,
  payloadProvenance,
  payloadStats,
  payloadSuggestions,
  sectionKind,
} from "./audit-detail"

// formatChanges/formatAuditDetail now return ReactNode (the before->after arrow
// is a ChangeArrow icon, not a "→" glyph). Render the node to its visible text,
// rewriting each arrow icon back to " → ", so the one-line expectations below
// read exactly like the summary a user sees. The icon contributes no text of its
// own, so without this rewrite "se → no" would collapse to "seno".
function arrowToText(node: Node): string {
  let out = ""
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent ?? ""
    } else if (
      child.nodeType === Node.ELEMENT_NODE &&
      (child as Element).tagName.toLowerCase() === "svg"
    ) {
      out += " → "
    } else {
      out += arrowToText(child)
    }
  }
  return out
}

function summaryText(node: ReactNode): string {
  const { container } = render(<span>{node}</span>)
  const text = arrowToText(container)
  cleanup()
  return text
}

// Test-only wrappers that render the node formatters to text, so every existing
// one-line assertion keeps working unchanged. The other helpers are pure and
// imported directly.
const formatChanges = (...args: Parameters<typeof rawFormatChanges>): string =>
  summaryText(rawFormatChanges(...args))
const formatAuditDetail = (
  ...args: Parameters<typeof rawFormatAuditDetail>
): string => summaryText(rawFormatAuditDetail(...args))

const labels = {
  deletedRole: "Deleted role",
  deletedFamily: "Deleted family",
  deletedUser: "Deleted user",
  // Stub count formatters: echo "<count> items"/"<count> fields" so tests can
  // assert the summary without the i18n catalog.
  itemsChanged: (count: number) => `${count} items`,
  fieldsChanged: (count: number) => `${count} fields`,
  createdMarker: "Created",
}

// Stub resolver: upper-cases the field name so tests can tell labels apart from
// raw field keys without depending on the i18n catalog.
const fieldLabel = (f: string) => f.charAt(0).toUpperCase() + f.slice(1)

describe("formatAuditValue", () => {
  it("passes scalars through as strings", () => {
    expect(formatAuditValue("se")).toBe("se")
    expect(formatAuditValue(3)).toBe("3")
    expect(formatAuditValue(true)).toBe("true")
  })

  it("collapses null and undefined to an empty string", () => {
    expect(formatAuditValue(null)).toBe("")
    expect(formatAuditValue(undefined)).toBe("")
  })

  it("compact-JSON stringifies objects and arrays (never [object Object])", () => {
    expect(formatAuditValue({ band: 2, score: 88 })).toBe(
      '{"band":2,"score":88}'
    )
    expect(formatAuditValue([1, 2, 3])).toBe("[1,2,3]")
    expect(formatAuditValue({ a: 1 })).not.toContain("[object Object]")
  })

  it("returns an empty string when stringify throws (circular)", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(formatAuditValue(circular)).toBe("")
  })
})

describe("formatChanges", () => {
  it("renders a real change as 'label: from -> to'", () => {
    expect(
      formatChanges({ country: { from: "se", to: "no" } }, fieldLabel)
    ).toBe("Country: se → no")
  })

  it("renders a set (from null) as just 'label: to'", () => {
    expect(
      formatChanges({ country: { from: null, to: "se" } }, fieldLabel)
    ).toBe("Country: se")
  })

  it("treats an empty/blank from as a set (no leading arrow)", () => {
    expect(
      formatChanges(
        { responsibilities: { from: "", to: "Lead the team" } },
        fieldLabel
      )
    ).toBe("Responsibilities: Lead the team")
  })

  it("joins multiple entries with '; '", () => {
    expect(
      formatChanges(
        {
          country: { from: "se", to: "no" },
          currency: { from: null, to: "SEK" },
        },
        fieldLabel
      )
    ).toBe("Country: se → no; Currency: SEK")
  })

  it("treats undefined like null on either side", () => {
    expect(
      formatChanges({ team: { from: undefined, to: "Core" } }, fieldLabel)
    ).toBe("Team: Core")
    expect(
      formatChanges({ team: { from: "Core", to: undefined } }, fieldLabel)
    ).toBe("Team: Core → ")
  })

  it("renders a complex value as label + placeholder, never [object Object]", () => {
    const out = formatChanges(
      { anchors: { from: null, to: [{ level: 0, text: "x" }] } },
      fieldLabel,
      "…"
    )
    expect(out).toBe("Anchors: …")
    expect(out).not.toContain("[object Object]")
  })

  it("localizes booleans via boolLabel instead of 'true'/'false'", () => {
    const boolLabel = (value: boolean) => (value ? "Yes" : "No")
    expect(
      formatChanges(
        { isManager: { from: false, to: true } },
        fieldLabel,
        "…",
        boolLabel
      )
    ).toBe("IsManager: No → Yes")
  })
})

describe("formatAuditDetail", () => {
  it("resolves a role id to its title", () => {
    const names = { r1: "System Developer" }
    expect(
      formatAuditDetail(
        "role.created",
        { roleId: "r1", source: "starter" },
        names,
        labels
      )
    ).toBe("System Developer")
  })

  it("renders role.updated as 'title: <changes>'", () => {
    const names = { r1: "System Developer" }
    expect(
      formatAuditDetail(
        "role.updated",
        {
          roleId: "r1",
          changes: {
            title: { from: "Dev", to: "Senior Dev" },
            team: { from: "Core", to: "Platform" },
          },
        },
        names,
        labels,
        fieldLabel
      )
    ).toBe("System Developer: Title: Dev → Senior Dev; Team: Core → Platform")
  })

  it("summarizes a role.updated with only complex diffs as a field count", () => {
    const names = { r1: "System Developer" }
    const out = formatAuditDetail(
      "role.updated",
      {
        roleId: "r1",
        changes: {
          anchors: { from: null, to: [{ level: 0, text: "x" }] },
          bandThresholds: { from: [{ band: 1 }], to: [{ band: 2 }] },
        },
      },
      names,
      labels,
      fieldLabel
    )
    expect(out).toBe("System Developer: 2 fields")
    expect(out).not.toContain("[object Object]")
  })

  it("falls back to the deleted-role label when the role id is unknown", () => {
    expect(
      formatAuditDetail(
        "role.updated",
        { roleId: "gone", changes: { title: { from: "a", to: "b" } } },
        {},
        labels,
        fieldLabel
      )
    ).toBe("Deleted role: Title: a → b")
  })

  it("uses the family name from the payload", () => {
    expect(
      formatAuditDetail(
        "roleFamily.created",
        { familyId: "f1", name: "Engineering" },
        {},
        labels
      )
    ).toBe("Engineering")
  })

  it("resolves a family id to its name when no name is in the payload", () => {
    const names = { f1: "Engineering" }
    expect(
      formatAuditDetail("roleFamily.removed", { familyId: "f1" }, names, labels)
    ).toBe("Engineering")
  })

  it("renders roleFamily.renamed as 'family: <changes>'", () => {
    const names = { f1: "Engineering" }
    expect(
      formatAuditDetail(
        "roleFamily.renamed",
        {
          familyId: "f1",
          changes: { name: { from: "Eng", to: "Engineering" } },
        },
        names,
        labels,
        fieldLabel
      )
    ).toBe("Engineering: Name: Eng → Engineering")
  })

  it("renders member.added as name (role)", () => {
    const names = { u1: "Jane Doe" }
    expect(
      formatAuditDetail(
        "member.added",
        { memberUserId: "u1", role: "editor" },
        names,
        labels
      )
    ).toBe("Jane Doe (editor)")
  })

  it("renders member.roleChanged as 'name: <changes>'", () => {
    const names = { u1: "Jane Doe" }
    expect(
      formatAuditDetail(
        "member.roleChanged",
        {
          memberUserId: "u1",
          changes: { role: { from: "editor", to: "admin" } },
        },
        names,
        labels,
        fieldLabel
      )
    ).toBe("Jane Doe: Role: editor → admin")
  })

  it("renders band.shift from the changes.band from/to", () => {
    const names = { r1: "System Developer" }
    expect(
      formatAuditDetail(
        "band.shift",
        { roleId: "r1", changes: { band: { from: 3, to: 2 } } },
        names,
        labels,
        fieldLabel
      )
    ).toBe("System Developer (3 → 2)")
  })

  it("renders band.shift with just the role when no band change is present", () => {
    const names = { r1: "System Developer" }
    expect(
      formatAuditDetail(
        "band.shift",
        { roleId: "r1", changes: { score: { from: 80, to: 90 } } },
        names,
        labels,
        fieldLabel
      )
    ).toBe("System Developer")
  })

  it("renders organization.created as the created marker, not an id row", () => {
    expect(
      formatAuditDetail("organization.created", { orgId: "org_1" }, {}, labels)
    ).toBe("Created")
  })

  it("summarizes a bulk model.created as an item count", () => {
    expect(
      formatAuditDetail(
        "model.created",
        { modelId: "m1", count: 9, items: [] },
        {},
        labels
      )
    ).toBe("9 items")
  })

  it("summarizes a bulk model.updated (rebalanced) as an item count", () => {
    const out = formatAuditDetail(
      "model.updated",
      {
        modelId: "m1",
        count: 2,
        items: [
          { criterionId: "c1", label: "Scope", changes: {} },
          { criterionId: "c2", label: "Impact", changes: {} },
        ],
      },
      {},
      labels,
      fieldLabel
    )
    expect(out).toBe("2 items")
    expect(out).not.toContain("[object Object]")
  })

  it("renders a non-bulk model.updated as criterion label + field count", () => {
    const names = { c1: "Scope of responsibility" }
    expect(
      formatAuditDetail(
        "model.updated",
        {
          modelId: "m1",
          criterionId: "c1",
          change: "criterion.updated",
          changes: {
            weightPoints: { from: 3, to: 4 },
            order: { from: 0, to: 1 },
          },
        },
        names,
        labels,
        fieldLabel
      )
    ).toBe("Scope of responsibility: 2 fields")
  })

  it("renders a non-bulk model.updated using changes.name when no id resolves", () => {
    expect(
      formatAuditDetail(
        "model.updated",
        {
          modelId: "m1",
          change: "criterion.added",
          changes: { name: { from: null, to: "New criterion" } },
        },
        {},
        labels,
        fieldLabel
      )
    ).toBe("New criterion: 1 fields")
  })

  it("renders settingsUpdated changes", () => {
    expect(
      formatAuditDetail(
        "organization.settingsUpdated",
        {
          changes: {
            currency: { from: "SEK", to: "NOK" },
            country: { from: null, to: "no" },
          },
        },
        {},
        labels,
        fieldLabel
      )
    ).toBe("Currency: SEK → NOK; Country: no")
  })

  it("falls back cleanly, dropping *Id and source", () => {
    expect(
      formatAuditDetail(
        "future.event",
        { roleId: "r1", source: "starter", status: "active", count: 3 },
        {},
        labels
      )
      // count is present so this is treated as a bulk event.
    ).toBe("3 items")
  })

  it("falls back to scalar fields when there is no bulk count", () => {
    expect(
      formatAuditDetail(
        "future.event",
        { roleId: "r1", source: "starter", status: "active" },
        {},
        labels
      )
    ).toBe("status: active")
  })

  it("renders people.imported as labeled stats, ordered, never raw keys", () => {
    expect(
      formatAuditDetail(
        "people.imported",
        {
          peopleCreated: 118,
          peopleUpdated: 0,
          peopleUnchanged: 0,
          salariesImported: 118,
          skippedRows: 0,
        },
        {},
        labels,
        fieldLabel
      )
    ).toBe(
      "PeopleCreated: 118 · PeopleUpdated: 0 · PeopleUnchanged: 0 · SalariesImported: 118 · SkippedRows: 0"
    )
  })

  it("renders classification.suggested as labeled stats", () => {
    expect(
      formatAuditDetail(
        "classification.suggested",
        { suggested: 112, skipped: 6, unmatchedTitles: 5 },
        {},
        labels,
        fieldLabel
      )
    ).toBe("Suggested: 112 · Skipped: 6 · UnmatchedTitles: 5")
  })

  it("renders a changes-bearing event with no explicit case inline (person.updated)", () => {
    expect(
      formatAuditDetail(
        "person.updated",
        { personId: "p1", changes: { title: { from: "Dev", to: "Lead" } } },
        {},
        labels,
        fieldLabel
      )
    ).toBe("Title: Dev → Lead")
  })

  it("renders assignment.set as the assigned role name (never the raw id)", () => {
    expect(
      formatAuditDetail(
        "assignment.set",
        {
          personId: "p1",
          roleId: "r1",
          changes: {
            roleId: { from: null, to: "r1" },
            level: { from: null, to: "IC3" },
            levelSource: { from: null, to: "suggested" },
          },
        },
        { r1: "Analyst" },
        labels,
        fieldLabel
      )
    ).toBe("Analyst")
  })
})

describe("changeEntries", () => {
  it("localizes boolean values via boolLabel", () => {
    const boolLabel = (value: boolean) => (value ? "Yes" : "No")
    expect(
      changeEntries(
        { isCustom: { from: true, to: false } },
        fieldLabel,
        undefined,
        boolLabel
      )
    ).toEqual([
      {
        field: "isCustom",
        label: "IsCustom",
        from: "Yes",
        to: "No",
        isSet: false,
        isComplex: false,
      },
    ])
  })

  it("renders a real change as { from, to, isSet: false, isComplex: false }", () => {
    expect(
      changeEntries({ country: { from: "se", to: "no" } }, fieldLabel)
    ).toEqual([
      {
        field: "country",
        label: "Country",
        from: "se",
        to: "no",
        isSet: false,
        isComplex: false,
      },
    ])
  })

  it("marks a null/empty from as isSet: true", () => {
    expect(
      changeEntries({ country: { from: null, to: "se" } }, fieldLabel)
    ).toEqual([
      {
        field: "country",
        label: "Country",
        from: "",
        to: "se",
        isSet: true,
        isComplex: false,
      },
    ])
    expect(
      changeEntries({ team: { from: "", to: "Core" } }, fieldLabel)
    ).toEqual([
      {
        field: "team",
        label: "Team",
        from: "",
        to: "Core",
        isSet: true,
        isComplex: false,
      },
    ])
  })

  it("treats undefined from as isSet: true and undefined to as empty", () => {
    expect(
      changeEntries({ team: { from: undefined, to: undefined } }, fieldLabel)
    ).toEqual([
      {
        field: "team",
        label: "Team",
        from: "",
        to: "",
        isSet: true,
        isComplex: false,
      },
    ])
  })

  it("marks isComplex true when either side is a non-null object", () => {
    const out = changeEntries(
      {
        anchors: { from: null, to: [{ level: 0, text: "x" }] },
        title: { from: "a", to: "b" },
      },
      fieldLabel
    )
    expect(out[0]?.isComplex).toBe(true)
    expect(out[0]?.to).toBe('[{"level":0,"text":"x"}]')
    expect(out[0]?.to).not.toContain("[object Object]")
    expect(out[1]?.isComplex).toBe(false)
  })

  it("preserves multiple fields in order", () => {
    expect(
      changeEntries(
        {
          title: { from: "Dev", to: "Senior Dev" },
          team: { from: "Core", to: "Platform" },
        },
        fieldLabel
      )
    ).toEqual([
      {
        field: "title",
        label: "Title",
        from: "Dev",
        to: "Senior Dev",
        isSet: false,
        isComplex: false,
      },
      {
        field: "team",
        label: "Team",
        from: "Core",
        to: "Platform",
        isSet: false,
        isComplex: false,
      },
    ])
  })
})

describe("payloadStats", () => {
  it("returns scalar fields, excluding changes, ids, and source", () => {
    expect(
      payloadStats({
        personId: "p1",
        roleId: "r1",
        source: "import",
        changes: { title: { from: "a", to: "b" } },
        skipped: 6,
        note: "hi",
      })
    ).toEqual([
      { field: "skipped", value: "6" },
      { field: "note", value: "hi" },
    ])
  })

  it("orders by FIELD_DISPLAY_ORDER regardless of stored key order", () => {
    // Given out-of-order keys, the identity-first order is imposed.
    expect(
      payloadStats({
        skippedRows: 0,
        peopleCreated: 118,
        salariesImported: 118,
      }).map((s) => s.field)
    ).toEqual(["peopleCreated", "salariesImported", "skippedRows"])
  })

  it("excludes booleans (a provenance flag is not a stat)", () => {
    expect(payloadStats({ seeded: true, orgCount: 3 })).toEqual([
      { field: "orgCount", value: "3" },
    ])
  })

  it("is empty for a payload with no stats", () => {
    expect(payloadStats({ personId: "p1", changes: {} })).toEqual([])
    expect(payloadStats(null)).toEqual([])
  })
})

describe("formatStats", () => {
  it("joins labeled stats with ' · '", () => {
    expect(
      formatStats(
        { suggested: 112, skipped: 6, unmatchedTitles: 5 },
        fieldLabel
      )
    ).toBe("Suggested: 112 · Skipped: 6 · UnmatchedTitles: 5")
  })

  it("returns an empty string when there are no stats", () => {
    expect(formatStats({ personId: "p1" }, fieldLabel)).toBe("")
  })
})

describe("payloadChanges", () => {
  it("returns the changes map when present and non-empty", () => {
    expect(
      payloadChanges({
        roleId: "r1",
        changes: { title: { from: "a", to: "b" } },
      })
    ).toEqual({ title: { from: "a", to: "b" } })
  })

  it("returns null when there is no changes field or it is empty", () => {
    expect(payloadChanges({ roleId: "r1" })).toBeNull()
    expect(payloadChanges({ changes: {} })).toBeNull()
    expect(payloadChanges(null)).toBeNull()
    expect(payloadChanges(undefined)).toBeNull()
  })
})

describe("payloadItems", () => {
  it("narrows the items array into render-ready entries", () => {
    const out = payloadItems(
      {
        count: 2,
        items: [
          {
            criterionId: "c1",
            label: "Scope",
            changes: { weightPoints: { from: 3, to: 4 } },
          },
          { roleId: "r1", label: "Dev", changes: {} },
        ],
      },
      fieldLabel
    )
    expect(out?.count).toBe(2)
    expect(out?.items).toHaveLength(2)
    expect(out?.items[0]).toEqual({
      key: "c1",
      title: "Scope",
      entries: [
        {
          field: "weightPoints",
          label: "WeightPoints",
          from: "3",
          to: "4",
          isSet: false,
          isComplex: false,
        },
      ],
    })
    expect(out?.items[1]).toEqual({ key: "r1", title: "Dev", entries: [] })
  })

  it("defaults count to the item count and title to '' when absent", () => {
    const out = payloadItems(
      { items: [{ familyId: "f1", changes: {} }] },
      fieldLabel
    )
    expect(out?.count).toBe(1)
    expect(out?.items[0]?.title).toBe("")
    expect(out?.items[0]?.key).toBe("f1")
  })

  it("returns null when there is no items array", () => {
    expect(payloadItems({ count: 3 }, fieldLabel)).toBeNull()
    expect(payloadItems(null, fieldLabel)).toBeNull()
  })
})

describe("payloadMoves", () => {
  it("narrows the moves array, defaulting applied to true", () => {
    const out = payloadMoves({
      moves: [
        {
          criterionId: "c1",
          fromLabel: "3",
          toLabel: "4",
          points: 4,
          motivation: "More scope",
        },
        {
          criterionId: "c2",
          fromLabel: "3",
          toLabel: "2",
          points: 2,
          applied: false,
          motivation: "Breaches budget",
        },
      ],
    })
    expect(out?.count).toBe(2)
    expect(out?.moves[0]).toEqual({
      key: "c1",
      fromLabel: "3",
      toLabel: "4",
      points: "4",
      applied: true,
      motivation: "More scope",
    })
    expect(out?.moves[1]?.applied).toBe(false)
  })

  it("returns null when there is no moves array", () => {
    expect(payloadMoves({ count: 1 })).toBeNull()
    expect(payloadMoves(null)).toBeNull()
  })
})

describe("payloadSuggestions", () => {
  it("narrows the suggestions array into id/kind/status entries", () => {
    const out = payloadSuggestions({
      suggestions: [
        { suggestionId: "s1", kind: "model.draft", status: "open" },
        { suggestionId: "s2", kind: "role.profile", status: "dismissed" },
      ],
    })
    expect(out?.count).toBe(2)
    expect(out?.items[0]).toEqual({
      key: "s1",
      kind: "model.draft",
      status: "open",
    })
  })

  it("returns null when there is no suggestions array", () => {
    expect(payloadSuggestions({ count: 1 })).toBeNull()
    expect(payloadSuggestions(null)).toBeNull()
  })
})

describe("payloadProvenance", () => {
  it("reads present meta keys in order, unwrapping cause to its event", () => {
    expect(
      payloadProvenance({
        source: "ai",
        via: "onboardingPrefill",
        seeded: true,
        batchId: "batch-1",
        cause: { event: "rating.change", roleId: "r1" },
      })
    ).toEqual([
      { key: "source", value: "ai" },
      { key: "via", value: "onboardingPrefill" },
      { key: "seeded", value: "true" },
      { key: "batchId", value: "batch-1" },
      { key: "cause", value: "rating.change" },
    ])
  })

  it("skips absent and nullish meta keys", () => {
    expect(payloadProvenance({ source: "template", via: null })).toEqual([
      { key: "source", value: "template" },
    ])
  })

  it("returns an empty array when no meta keys are present", () => {
    expect(payloadProvenance({ roleId: "r1" })).toEqual([])
    expect(payloadProvenance(null)).toEqual([])
  })
})

describe("aiAuditDetail", () => {
  // Stub translator: echoes the key + the JSON params so tests can assert the
  // exact i18n key and the params it would be called with, without the catalog.
  const t = (key: string, params?: Record<string, string | number>) =>
    `${key} ${JSON.stringify(params ?? {})}`

  it("renders a confirmed model.draft with its accepted count", () => {
    expect(
      aiAuditDetail(
        "ai.suggestionConfirmed",
        { suggestionId: "s1", kind: "model.draft", acceptedCount: 4 },
        t
      )
    ).toBe('ai.modelDraft {"count":4}')
  })

  it("renders a confirmed model.weightReview with its applied count", () => {
    expect(
      aiAuditDetail(
        "ai.suggestionConfirmed",
        { suggestionId: "s1", kind: "model.weightReview", appliedCount: 2 },
        t
      )
    ).toBe('ai.weightReview {"count":2}')
  })

  it("renders a confirmed starter.import with family and role counts", () => {
    expect(
      aiAuditDetail(
        "ai.suggestionConfirmed",
        {
          suggestionId: "s1",
          kind: "starter.import",
          familyCount: 5,
          roleCount: 12,
        },
        t
      )
    ).toBe('ai.starterImport {"families":5,"roles":12}')
  })

  it("falls back to 0 counts when the payload is missing them", () => {
    expect(
      aiAuditDetail(
        "ai.suggestionConfirmed",
        { suggestionId: "s1", kind: "model.draft" },
        t
      )
    ).toBe('ai.modelDraft {"count":0}')
  })

  it("returns empty for an unknown kind", () => {
    expect(
      aiAuditDetail(
        "ai.suggestionConfirmed",
        { suggestionId: "s1", kind: "mystery.thing" },
        t
      )
    ).toBe("")
    expect(
      aiAuditDetail("ai.suggestionRejected", { suggestionId: "s1" }, t)
    ).toBe("")
  })
})

describe("changeEntries resolveName", () => {
  const fieldLabel = (f: string) => f

  it("resolves an id-valued field to its name", () => {
    const [entry] = changeEntries(
      { familyId: { from: null, to: "fam1" } },
      fieldLabel,
      (id) => (id === "fam1" ? "Product" : undefined)
    )
    expect(entry?.to).toBe("Product")
    expect(entry?.isSet).toBe(true)
  })

  it("falls back to the raw value when no name resolves", () => {
    const [entry] = changeEntries(
      { trackKey: { from: null, to: "IC" } },
      fieldLabel,
      () => undefined
    )
    expect(entry?.to).toBe("IC")
  })

  it("resolves both sides of a real change", () => {
    const [entry] = changeEntries(
      { familyId: { from: "fam1", to: "fam2" } },
      fieldLabel,
      (id) => ({ fam1: "Old", fam2: "New" })[id]
    )
    expect(entry?.from).toBe("Old")
    expect(entry?.to).toBe("New")
    expect(entry?.isSet).toBe(false)
  })
})

describe("orderEntries", () => {
  const make = (fields: string[]) =>
    fields.map((field) => ({ field, label: field }))

  it("sorts known fields into the display order (identity first)", () => {
    const ordered = orderEntries(
      make(["responsibilities", "familyId", "title", "trackKey"])
    )
    expect(ordered.map((e) => e.field)).toEqual([
      "title",
      "trackKey",
      "familyId",
      "responsibilities",
    ])
  })

  it("keeps unknown fields after known ones, in their original order", () => {
    const ordered = orderEntries(make(["zeta", "title", "alpha"]))
    expect(ordered.map((e) => e.field)).toEqual(["title", "zeta", "alpha"])
  })
})

describe("sectionKind", () => {
  const created = [
    { isSet: true, to: "x" },
    { isSet: true, to: "y" },
  ]
  const updated = [{ isSet: false, to: "y" }]
  const removed = [{ isSet: false, to: "" }]

  it("uses the event type for unambiguous create/remove events", () => {
    expect(sectionKind("role.created", updated)).toBe("create")
    expect(sectionKind("member.added", updated)).toBe("create")
    expect(sectionKind("anchorRole.designated", updated)).toBe("create")
    expect(sectionKind("roleFamily.removed", created)).toBe("remove")
    expect(sectionKind("model.discarded", created)).toBe("remove")
  })

  it("treats role.archived as an update, not a creation", () => {
    // Its only change is archivedAt set from null, which would otherwise infer
    // as a creation.
    expect(
      sectionKind("role.archived", [{ isSet: true, to: "2026-01-01" }])
    ).toBe("update")
  })

  it("infers from the entries for other events", () => {
    expect(sectionKind("organization.settingsUpdated", created)).toBe("create")
    expect(sectionKind("organization.settingsUpdated", updated)).toBe("update")
    expect(sectionKind("rating.change", removed)).toBe("remove")
    expect(sectionKind("rating.change", [])).toBe("update")
  })
})

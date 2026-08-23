import { cleanup, render } from "@testing-library/react"
import { SUGGESTION_KINDS } from "@workspace/constants"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import {
  AI_KIND_KEY,
  AI_KIND_VALUE_KEYS,
  BIAS_RISK_VALUE_KEYS,
  COUNTRY_VALUE_KEYS,
  EMPLOYMENT_TYPE_VALUE_KEYS,
  ERASED_AUDIT_VALUE,
  FINDING_VALUE_KEYS,
  GENDER_VALUE_KEYS,
  INDUSTRY_VALUE_KEYS,
  MEMBER_ROLE_VALUE_KEYS,
  PAY_GAP_REASON_VALUE_KEYS,
  PRAXIS_AREA_VALUE_KEYS,
  resolveCodedValue,
  SALARY_SOURCE_VALUE_KEYS,
  SCOPE_VALUE_KEYS,
  SENIORITY_SOURCE_VALUE_KEYS,
  STATUS_VALUE_KEYS,
  TRACK_VALUE_KEYS,
} from "./audit-constants"
import { LANGUAGE_LABEL_KEYS } from "./locales"
import {
  aiAuditDetail,
  auditContextParts,
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
  weightingConfirmed: "Weighting confirmed",
}

// Stub resolver: upper-cases the field name so tests can tell labels apart from
// raw field keys without depending on the i18n catalog.
const fieldLabel = (f: string) => f.charAt(0).toUpperCase() + f.slice(1)

// Stub value-label resolver: a deterministic "translate" that upper-cases the
// resolved i18n key, mirroring how fieldLabel/boolLabel stub away the real
// i18n catalog above. Assertions below reference the exported *_VALUE_KEYS
// constants (never a hardcoded key string), so they track a key rename
// automatically instead of silently going stale. Returns undefined (NOT the
// raw value) when unresolved, exactly like the real caller: formatChanges/
// changeEntries treat undefined as "try the next resolver", so a stub that
// fell back to the raw value here would hide a shadowing bug (see the
// "does not let valueLabel shadow resolveName" test below).
const valueLabel = (field: string, value: string): string | undefined =>
  resolveCodedValue(field, value, (key) => key.toUpperCase())

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
    expect(formatAuditValue({ level: 2, score: 88 })).toBe(
      '{"level":2,"score":88}'
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

describe("resolveCodedValue", () => {
  // Echoes the key back unchanged so assertions can compare directly against
  // the exported *_VALUE_KEYS constants without a stub transform in the way.
  const translate = (key: string) => key

  it("resolves a scope code to its key", () => {
    expect(resolveCodedValue("scope", "equalWork", translate)).toBe(
      SCOPE_VALUE_KEYS.equalWork
    )
    expect(resolveCodedValue("scope", "praxis", translate)).toBe(
      SCOPE_VALUE_KEYS.praxis
    )
  })

  it("resolves a finding verdict to its key", () => {
    expect(resolveCodedValue("finding", "none", translate)).toBe(
      FINDING_VALUE_KEYS.none
    )
    expect(resolveCodedValue("finding", "found", translate)).toBe(
      FINDING_VALUE_KEYS.found
    )
  })

  it("resolves a groupLabel that is a praxis area key", () => {
    expect(resolveCodedValue("groupLabel", "payPolicy", translate)).toBe(
      PRAXIS_AREA_VALUE_KEYS.payPolicy
    )
  })

  it("returns undefined for a groupLabel that is not a praxis area key (an equalWork/equivalentWork display string)", () => {
    expect(
      resolveCodedValue("groupLabel", "Engineer · L3", translate)
    ).toBeUndefined()
  })

  it("resolves a single reason code", () => {
    expect(resolveCodedValue("reasons", "experience", translate)).toBe(
      PAY_GAP_REASON_VALUE_KEYS.experience
    )
  })

  it("resolves and rejoins multiple ', '-joined reason codes", () => {
    expect(
      resolveCodedValue("reasons", "experience, competence", translate)
    ).toBe(
      `${PAY_GAP_REASON_VALUE_KEYS.experience}, ${PAY_GAP_REASON_VALUE_KEYS.competence}`
    )
  })

  it("falls back to the raw token within a reasons list when one token is unmapped", () => {
    expect(resolveCodedValue("reasons", "experience, mystery", translate)).toBe(
      `${PAY_GAP_REASON_VALUE_KEYS.experience}, mystery`
    )
  })

  it("returns undefined for an empty reasons string", () => {
    expect(resolveCodedValue("reasons", "", translate)).toBeUndefined()
  })

  it("resolves every non-pay-mapping coded domain to its key", () => {
    expect(resolveCodedValue("senioritySource", "suggested", translate)).toBe(
      SENIORITY_SOURCE_VALUE_KEYS.suggested
    )
    expect(resolveCodedValue("role", "admin", translate)).toBe(
      MEMBER_ROLE_VALUE_KEYS.admin
    )
    expect(resolveCodedValue("status", "canceled", translate)).toBe(
      STATUS_VALUE_KEYS.canceled
    )
    expect(resolveCodedValue("country", "se", translate)).toBe(
      COUNTRY_VALUE_KEYS.se
    )
    // A person's country is an imported uppercase ISO code; same label.
    expect(resolveCodedValue("country", "SE", translate)).toBe(
      COUNTRY_VALUE_KEYS.se
    )
    expect(resolveCodedValue("language", "sv", translate)).toBe(
      LANGUAGE_LABEL_KEYS.sv
    )
    expect(resolveCodedValue("biasRisk", "medium", translate)).toBe(
      BIAS_RISK_VALUE_KEYS.medium
    )
    expect(resolveCodedValue("employmentType", "fixedTerm", translate)).toBe(
      EMPLOYMENT_TYPE_VALUE_KEYS.fixedTerm
    )
    expect(resolveCodedValue("industry", "itTelecom", translate)).toBe(
      INDUSTRY_VALUE_KEYS.itTelecom
    )
    expect(resolveCodedValue("source", "import", translate)).toBe(
      SALARY_SOURCE_VALUE_KEYS.import
    )
    expect(resolveCodedValue("trackKey", "IC", translate)).toBe(
      TRACK_VALUE_KEYS.IC
    )
    // A person diff's gender must never render the raw Swedish wire code.
    expect(resolveCodedValue("gender", "Kvinna", translate)).toBe(
      GENDER_VALUE_KEYS.Kvinna
    )
    expect(resolveCodedValue("gender", "Man", translate)).toBe(
      GENDER_VALUE_KEYS.Man
    )
  })

  it("labels the erased tombstone on an identity field, before the per-field domains", () => {
    // Written over an erased person's identity values (ADR-0013). Resolves on
    // any of them, including gender, whose own coded domain it must pre-empt.
    for (const field of ["displayName", "gender", "externalRef", "birthDate"]) {
      expect(resolveCodedValue(field, ERASED_AUDIT_VALUE, translate)).toBe(
        "auditLog.values.erased"
      )
    }
  })

  it("does not label a non-identity field that legitimately holds the word", () => {
    // "erased" is a real English word, so a department, role family or note a
    // customer actually named that must render as itself, not as scrubbed data.
    expect(
      resolveCodedValue("department", ERASED_AUDIT_VALUE, translate)
    ).toBeUndefined()
    expect(
      resolveCodedValue("note", ERASED_AUDIT_VALUE, translate)
    ).toBeUndefined()
  })

  it("returns undefined for a field with no coded domain", () => {
    expect(resolveCodedValue("note", "anything", translate)).toBeUndefined()
  })

  it("returns undefined for a value outside its domain (scope)", () => {
    expect(resolveCodedValue("scope", "mystery", translate)).toBeUndefined()
  })

  it("returns undefined when the translator has no string for the resolved key", () => {
    expect(
      resolveCodedValue("scope", "equalWork", () => undefined)
    ).toBeUndefined()
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
      { anchors: { from: null, to: [{ step: 0, text: "x" }] } },
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

  it("localizes a coded field value via valueLabel instead of the raw code", () => {
    expect(
      formatChanges(
        { finding: { from: "none", to: "found" } },
        fieldLabel,
        "…",
        undefined,
        valueLabel
      )
    ).toBe(
      `Finding: ${FINDING_VALUE_KEYS.none.toUpperCase()} → ${FINDING_VALUE_KEYS.found.toUpperCase()}`
    )
  })

  it("falls back to the raw value when valueLabel does not recognize the field", () => {
    expect(
      formatChanges(
        { team: { from: "Platform", to: "Core" } },
        fieldLabel,
        "…",
        undefined,
        valueLabel
      )
    ).toBe("Team: Platform → Core")
  })

  it("resolves country codes through the coded-value domain", () => {
    expect(
      formatChanges(
        { country: { from: "se", to: "no" } },
        fieldLabel,
        "…",
        undefined,
        valueLabel
      )
    ).toBe(
      `Country: ${COUNTRY_VALUE_KEYS.se.toUpperCase()} → ${COUNTRY_VALUE_KEYS.no.toUpperCase()}`
    )
  })

  it("formats an AUDIT_DATE_FIELDS epoch-ms value via dateLabel, never as raw milliseconds", () => {
    expect(
      formatChanges(
        { archivedAt: { from: null, to: 1753776000000 } },
        fieldLabel,
        "…",
        undefined,
        valueLabel,
        (epochMs) => `DATE(${epochMs})`
      )
    ).toBe("ArchivedAt: DATE(1753776000000)")
  })

  it("formats an ISO-date field via dateLabel too, so one sheet never mixes date formats", () => {
    expect(
      formatChanges(
        { employmentStartDate: { from: null, to: "2024-01-15" } },
        fieldLabel,
        "…",
        undefined,
        valueLabel,
        (epochMs) => `DATE(${epochMs})`
      )
    ).toBe(`EmploymentStartDate: DATE(${Date.parse("2024-01-15")})`)
  })

  // birthDate is BOTH an ISO-date field and an identity field an erasure
  // tombstones, and the date branch runs before the coded-value branch. It works
  // only because Date.parse("erased") is NaN and falls through, so pin it: a
  // more lenient date path would otherwise render an erased person's birth date
  // as "Invalid Date" on a GDPR-visible surface with the suite still green.
  it("renders a tombstoned ISO-date field as the erased marker, never a date", () => {
    const out = formatChanges(
      { birthDate: { from: ERASED_AUDIT_VALUE, to: ERASED_AUDIT_VALUE } },
      fieldLabel,
      "…",
      undefined,
      valueLabel,
      (epochMs) => `DATE(${epochMs})`
    )
    expect(out).toBe(
      "BirthDate: AUDITLOG.VALUES.ERASED → AUDITLOG.VALUES.ERASED"
    )
    expect(out).not.toContain("DATE(")
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

  // A restore to the last approved model can move criteria, the model's own
  // rules and decisions, or both, so the cell must state whichever halves are
  // present. The generic bulk branch would state only the count, and would
  // read "0 items" for a restore that only put the rules back.
  it("renders model.restored as both halves when it moved criteria and rules", () => {
    expect(
      formatAuditDetail(
        "model.restored",
        {
          modelId: "m1",
          count: 2,
          items: [{ libraryKey: "a", label: "A", changes: {} }],
          changes: {
            levelRules: { from: "12 rules, top 97", to: "12 rules, top 90" },
          },
        },
        {},
        labels,
        fieldLabel
      )
    ).toBe("2 items; LevelRules: 12 rules, top 97 → 12 rules, top 90")
  })

  // A deactivation's row used to fall to the generic bulk branch, whose count
  // is the REPAIRED SURVIVORS: "0 items changed" whenever the removed
  // criterion stood at the neutral 3, and never a word about what was removed.
  it("names the removed criterion and the budget it shrank", () => {
    expect(
      formatAuditDetail(
        "criterion.deactivated",
        {
          criterionId: "c1",
          modelId: "m1",
          libraryKey: "scope-impact",
          dimensionKey: "responsibility",
          weightPoints: 3,
          deletedRatingCount: 0,
          changes: { budget: { from: 24, to: 21 } },
          count: 0,
          items: [],
        },
        {},
        labels,
        fieldLabel,
        undefined,
        // The criterion row is deleted, so its name comes from the library key,
        // the way the sheet already resolves it.
        (field, value) =>
          field === "libraryKey" && value === "scope-impact"
            ? "Scope and impact"
            : undefined
      )
    ).toBe("Scope and impact: Budget: 24 → 21")
  })

  it("adds the repaired survivors when the removal moved other weights", () => {
    expect(
      formatAuditDetail(
        "criterion.deactivated",
        {
          criterionId: "c1",
          modelId: "m1",
          libraryKey: "scope-impact",
          dimensionKey: "responsibility",
          weightPoints: 5,
          deletedRatingCount: 2,
          changes: { budget: { from: 24, to: 21 } },
          count: 2,
          items: [
            { criterionId: "c2", label: "B", changes: {} },
            { criterionId: "c3", label: "C", changes: {} },
          ],
        },
        {},
        labels,
        fieldLabel,
        undefined,
        (field, value) =>
          field === "libraryKey" && value === "scope-impact"
            ? "Scope and impact"
            : undefined
      )
    ).toBe("Scope and impact: Budget: 24 → 21; 2 items")
  })

  it("renders a rules-only model.restored without a zero item count", () => {
    expect(
      formatAuditDetail(
        "model.restored",
        {
          modelId: "m1",
          count: 0,
          items: [],
          changes: {
            levelRules: { from: "12 rules, top 97", to: "12 rules, top 90" },
          },
        },
        {},
        labels,
        fieldLabel
      )
    ).toBe("LevelRules: 12 rules, top 97 → 12 rules, top 90")
  })

  it("renders a criteria-only model.restored as the item count alone", () => {
    expect(
      formatAuditDetail(
        "model.restored",
        {
          modelId: "m1",
          count: 3,
          items: [{ libraryKey: "a", label: "A", changes: {} }],
          changes: {},
        },
        {},
        labels,
        fieldLabel
      )
    ).toBe("3 items")
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
          tags: { from: null, to: [{ step: 0, text: "x" }] },
          milestones: { from: [{ level: 1 }], to: [{ level: 2 }] },
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

  it("renders member.added as name (role) from the changes diff", () => {
    // The writer (onMemberCreate) logs the granted role only inside changes;
    // there is never a top-level role.
    const names = { u1: "Jane Doe" }
    expect(
      formatAuditDetail(
        "member.added",
        { memberUserId: "u1", changes: { role: { from: null, to: "editor" } } },
        names,
        labels
      )
    ).toBe("Jane Doe (editor)")
    expect(
      formatAuditDetail(
        "member.added",
        { memberUserId: "u1", changes: { role: { from: null, to: "editor" } } },
        names,
        labels,
        fieldLabel,
        undefined,
        valueLabel
      )
    ).toBe(`Jane Doe (${MEMBER_ROLE_VALUE_KEYS.editor.toUpperCase()})`)
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

  it("renders level.shift from the changes.level from/to", () => {
    const names = { r1: "System Developer" }
    expect(
      formatAuditDetail(
        "level.shift",
        { roleId: "r1", changes: { level: { from: 3, to: 2 } } },
        names,
        labels,
        fieldLabel
      )
    ).toBe("System Developer (3 → 2)")
  })

  it("renders level.shift with just the role when no level change is present", () => {
    const names = { r1: "System Developer" }
    expect(
      formatAuditDetail(
        "level.shift",
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
            seniority: { from: null, to: "IC3" },
            senioritySource: { from: null, to: "suggested" },
          },
        },
        { r1: "Analyst" },
        labels,
        fieldLabel
      )
    ).toBe("Analyst")
  })

  it("renders role.assessmentLocked as the role name", () => {
    expect(
      formatAuditDetail(
        "role.assessmentLocked",
        { roleId: "r1", ratedCount: 8 },
        { r1: "Analyst" },
        labels,
        fieldLabel
      )
    ).toBe("Analyst")
  })

  it("renders role.assessmentUnlocked as the role name, never blank (payloadStats alone would drop the id-only payload entirely)", () => {
    expect(
      formatAuditDetail(
        "role.assessmentUnlocked",
        { roleId: "r1" },
        { r1: "Analyst" },
        labels,
        fieldLabel
      )
    ).toBe("Analyst")
  })

  // A rebalance that moved no points is the organization confirming the
  // weighting it already has, which is one of the approval checklist's own
  // obligations. Reading it as "0 items changed" says the opposite of what
  // happened.
  it("names a zero-move rebalance as a confirmation, not as an empty change", () => {
    expect(
      formatAuditDetail(
        "model.updated",
        { change: "weights.rebalanced", modelId: "m1", count: 0, items: [] },
        {},
        labels,
        fieldLabel
      )
    ).toBe("Weighting confirmed")
  })

  it("still counts the items of a rebalance that moved points", () => {
    expect(
      formatAuditDetail(
        "model.updated",
        {
          change: "weights.rebalanced",
          modelId: "m1",
          count: 2,
          items: [{ criterionId: "c1" }, { criterionId: "c2" }],
        },
        {},
        labels,
        fieldLabel
      )
    ).toBe("2 items")
  })

  // Scoped to the rebalance: another bulk model.updated with nothing in it is
  // not a weighting confirmation and must not borrow its words.
  it("leaves other zero-count bulk model.updated events on the count", () => {
    expect(
      formatAuditDetail(
        "model.updated",
        { change: "criterion.removed", modelId: "m1", count: 0, items: [] },
        {},
        labels,
        fieldLabel
      )
    ).toBe("0 items")
  })

  it("renders role.assessmentCalibrated as the role name, never blank (payloadStats alone would drop the boolean noteProvided too)", () => {
    expect(
      formatAuditDetail(
        "role.assessmentCalibrated",
        { roleId: "r1", noteProvided: true },
        { r1: "Analyst" },
        labels,
        fieldLabel
      )
    ).toBe("Analyst")
  })

  it("renders payMapping.groupAnalysisUpdated with group label, scope, and changes, resolving scope and reasons via valueLabel", () => {
    expect(
      formatAuditDetail(
        "payMapping.groupAnalysisUpdated",
        {
          runId: "run1",
          scope: "equalWork",
          // groupLabel is already a real "roleTitle · seniority" display string
          // for equalWork/equivalentWork, so valueLabel must pass it through
          // unchanged (it is not a praxis area key).
          groupLabel: "PM · Mid",
          changes: {
            reasons: { from: null, to: "experience, competence" },
            done: { from: null, to: true },
          },
        },
        {},
        labels,
        fieldLabel,
        (value) => (value ? "Yes" : "No"),
        valueLabel
      )
    ).toBe(
      `PM · Mid (Scope: ${SCOPE_VALUE_KEYS.equalWork.toUpperCase()}): Reasons: ${PAY_GAP_REASON_VALUE_KEYS.experience.toUpperCase()}, ${PAY_GAP_REASON_VALUE_KEYS.competence.toUpperCase()}; Done: Yes`
    )
  })

  it("renders payMapping.groupAnalysisUpdated with just the group context when there are no changes", () => {
    expect(
      formatAuditDetail(
        "payMapping.groupAnalysisUpdated",
        { runId: "run1", scope: "equivalentWork", groupLabel: "Nurse · Mid" },
        {},
        labels,
        fieldLabel,
        undefined,
        valueLabel
      )
    ).toBe(
      `Nurse · Mid (Scope: ${SCOPE_VALUE_KEYS.equivalentWork.toUpperCase()})`
    )
  })

  it("resolves a praxis row's groupLabel (the raw area key), scope, and finding verdicts, never the raw codes", () => {
    expect(
      formatAuditDetail(
        "payMapping.groupAnalysisUpdated",
        {
          runId: "run1",
          scope: "praxis",
          groupLabel: "payPolicy",
          changes: { finding: { from: "none", to: "found" } },
        },
        {},
        labels,
        fieldLabel,
        undefined,
        valueLabel
      )
    ).toBe(
      `${PRAXIS_AREA_VALUE_KEYS.payPolicy.toUpperCase()} (Scope: ${SCOPE_VALUE_KEYS.praxis.toUpperCase()}): Finding: ${FINDING_VALUE_KEYS.none.toUpperCase()} → ${FINDING_VALUE_KEYS.found.toUpperCase()}`
    )
  })

  it("falls back to the raw scope/groupLabel/reasons codes when no valueLabel is wired", () => {
    // Guards that a caller which omits valueLabel (there should be none
    // left in the app, but the parameter is optional) degrades to the raw
    // code rather than throwing.
    expect(
      formatAuditDetail(
        "payMapping.groupAnalysisUpdated",
        {
          runId: "run1",
          scope: "praxis",
          groupLabel: "payPolicy",
          changes: { finding: { from: "none", to: "found" } },
        },
        {},
        labels,
        fieldLabel
      )
    ).toBe("payPolicy (Scope: praxis): Finding: none → found")
  })
})

describe("changeEntries", () => {
  it("localizes boolean values via boolLabel", () => {
    const boolLabel = (value: boolean) => (value ? "Yes" : "No")
    expect(
      changeEntries(
        { approved: { from: true, to: false } },
        fieldLabel,
        undefined,
        boolLabel
      )
    ).toEqual([
      {
        field: "approved",
        label: "Approved",
        from: "Yes",
        to: "No",
        isSet: false,
        isComplex: false,
      },
    ])
  })

  it("localizes a coded field value via valueLabel instead of the raw code", () => {
    const [entry] = changeEntries(
      { scope: { from: null, to: "praxis" } },
      fieldLabel,
      undefined,
      undefined,
      valueLabel
    )
    expect(entry?.to).toBe(SCOPE_VALUE_KEYS.praxis.toUpperCase())
    expect(entry?.isSet).toBe(true)
  })

  it("does not let valueLabel shadow resolveName for an id field", () => {
    const [entry] = changeEntries(
      { familyId: { from: null, to: "fam1" } },
      fieldLabel,
      (id) => (id === "fam1" ? "Product" : undefined),
      undefined,
      valueLabel
    )
    expect(entry?.to).toBe("Product")
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
        anchors: { from: null, to: [{ step: 0, text: "x" }] },
        title: { from: "a", to: "b" },
      },
      fieldLabel
    )
    expect(out[0]?.isComplex).toBe(true)
    expect(out[0]?.to).toBe('[{"step":0,"text":"x"}]')
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

  // The ai.suggestionConfirmed import payloads carry no `changes` map, so the
  // sheet and the table cell render them through payloadStats/formatStats.
  // Every field must resolve to a label and the coded `kind` to a value label,
  // never the raw payload keys ("kind: role.import · familyCount: 1").
  it("labels every field of a role.import confirm, kind included", () => {
    expect(
      formatStats(
        {
          suggestionId: "s1",
          kind: "role.import",
          familyCount: 1,
          roleCount: 2,
          skippedCount: 1,
          families: [{ familyId: "f1", name: "Legal", roles: [] }],
        },
        fieldLabel,
        valueLabel
      )
    ).toBe(
      `Kind: ${AI_KIND_VALUE_KEYS["role.import"].toUpperCase()} · FamilyCount: 1 · RoleCount: 2 · SkippedCount: 1`
    )
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

  // The detail SHEET renders each item's diff through this, so a coded value
  // inside an item has to resolve here too. Without the threaded valueLabel a
  // model.restored criterion showed "medium -> low" in the sheet while the
  // restore dialog, reading the same diff, showed "Medium -> Low".
  it("resolves a coded value inside an item's own changes", () => {
    const out = payloadItems(
      {
        count: 1,
        items: [
          {
            libraryKey: "knowledge-breadth",
            label: "Knowledge breadth",
            changes: { biasRisk: { from: "medium", to: "low" } },
          },
        ],
      },
      fieldLabel,
      undefined,
      valueLabel
    )
    const entry = out?.items[0]?.entries[0]
    expect(entry?.from).toBe(BIAS_RISK_VALUE_KEYS.medium.toUpperCase())
    expect(entry?.to).toBe(BIAS_RISK_VALUE_KEYS.low.toUpperCase())
  })

  // Boolean and coded resolution compose: the restore's `selected` row reads
  // Yes/No in the same item whose biasRisk reads its label. Both resolvers are
  // asserted on their own row, because the two run through separate branches of
  // changeEntries' display() and a test carrying only one of the fields would
  // pass while the other resolver was never threaded at all.
  it("resolves booleans and coded values in the same item", () => {
    const out = payloadItems(
      {
        count: 1,
        items: [
          {
            libraryKey: "risk-consequence",
            label: "Risk and consequence",
            changes: {
              selected: { from: true, to: false },
              biasRisk: { from: "medium", to: "low" },
            },
          },
        ],
      },
      fieldLabel,
      (value) => (value ? "Yes" : "No"),
      valueLabel
    )
    const entries = out?.items[0]?.entries ?? []
    const byField = (field: string) =>
      entries.find((entry) => entry.field === field)
    expect(byField("selected")?.from).toBe("Yes")
    expect(byField("selected")?.to).toBe("No")
    expect(byField("biasRisk")?.from).toBe(
      BIAS_RISK_VALUE_KEYS.medium.toUpperCase()
    )
    expect(byField("biasRisk")?.to).toBe(BIAS_RISK_VALUE_KEYS.low.toUpperCase())
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
        { suggestionId: "s1", kind: "model.weightReview", status: "open" },
        { suggestionId: "s2", kind: "role.profile", status: "dismissed" },
      ],
    })
    expect(out?.count).toBe(2)
    expect(out?.items[0]).toEqual({
      key: "s1",
      kind: "model.weightReview",
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

  it("renders a confirmed role.import with family and role counts", () => {
    expect(
      aiAuditDetail(
        "ai.suggestionConfirmed",
        {
          suggestionId: "s1",
          kind: "role.import",
          familyCount: 3,
          roleCount: 8,
        },
        t
      )
    ).toBe('ai.roleImport {"families":3,"roles":8}')
  })

  it("renders a rejected role.import as its kind label", () => {
    expect(
      aiAuditDetail(
        "ai.suggestionRejected",
        { suggestionId: "s1", kind: "role.import" },
        t
      )
    ).toBe("ai.kind.roleImport {}")
  })

  it("falls back to 0 counts when the payload is missing them", () => {
    expect(
      aiAuditDetail(
        "ai.suggestionConfirmed",
        { suggestionId: "s1", kind: "model.weightReview" },
        t
      )
    ).toBe('ai.weightReview {"count":0}')
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

describe("AI_KIND_KEY", () => {
  it("covers every kind in SUGGESTION_KINDS, so a new kind without a label fails here", () => {
    expect(Object.keys(AI_KIND_KEY).sort()).toEqual(
      Object.values(SUGGESTION_KINDS).sort()
    )
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

describe("auditContextParts", () => {
  const contextLabels = {
    deletedRun: "Deleted pay mapping",
    scopeFieldLabel: "Scope",
  }
  const parts = (
    type: string,
    payload: unknown,
    names: Record<string, string> = {}
  ) => auditContextParts(type, payload, names, contextLabels, valueLabel)

  it("leads with the resolved run label for a payMapping row", () => {
    expect(
      parts(
        "payMapping.runCompleted",
        { runId: "run1", equalWorkDone: 3, equivalentWorkDone: 2 },
        { run1: "Lönekartläggning 2026" }
      )
    ).toEqual(["Lönekartläggning 2026"])
  })

  it("falls back to the captured label on the runDeleted row once the run is gone", () => {
    expect(
      parts("payMapping.runDeleted", {
        runId: "run1",
        label: "Lönekartläggning 2026",
        populationCount: 10,
      })
    ).toEqual(["Lönekartläggning 2026"])
  })

  it("marks a deleted run's other rows with the localized marker", () => {
    expect(parts("payMapping.runReopened", { runId: "run1" })).toEqual([
      "Deleted pay mapping",
    ])
  })

  it("names the documented group with its comparison scope, so equal and equivalent work stay distinguishable", () => {
    const payload = (scope: string) => ({
      runId: "run1",
      scope,
      groupLabel: "PM · Mid",
      changes: { done: { from: null, to: true } },
    })
    const names = { run1: "Lönekartläggning 2026" }
    // Run and group join into ONE ": "-separated part: a group label is
    // itself "roleTitle · seniority", so a " · " list join would blur where the
    // run ends and the group begins.
    expect(
      parts("payMapping.groupAnalysisUpdated", payload("equalWork"), names)
    ).toEqual([
      `Lönekartläggning 2026: PM · Mid (Scope: ${SCOPE_VALUE_KEYS.equalWork.toUpperCase()})`,
    ])
    expect(
      parts("payMapping.groupAnalysisUpdated", payload("equivalentWork"), names)
    ).toEqual([
      `Lönekartläggning 2026: PM · Mid (Scope: ${SCOPE_VALUE_KEYS.equivalentWork.toUpperCase()})`,
    ])
  })

  it("resolves a praxis area key through the value label, never the raw slug", () => {
    expect(
      parts(
        "payMapping.groupAnalysisUpdated",
        { runId: "run1", scope: "praxis", groupLabel: "payPolicy" },
        { run1: "Lönekartläggning 2026" }
      )
    ).toEqual([
      `Lönekartläggning 2026: ${PRAXIS_AREA_VALUE_KEYS.payPolicy.toUpperCase()} (Scope: ${SCOPE_VALUE_KEYS.praxis.toUpperCase()})`,
    ])
  })

  it("skips an empty group label without leaving a dangling part", () => {
    expect(
      parts(
        "payMapping.groupAnalysisUpdated",
        { runId: "run1", scope: "equalWork", groupLabel: "" },
        { run1: "Lönekartläggning 2026" }
      )
    ).toEqual(["Lönekartläggning 2026"])
  })

  it("resolves role and criterion for a rating row, in that order", () => {
    expect(
      parts(
        "rating.change",
        { roleId: "r1", criterionId: "c1", created: true, changes: {} },
        { r1: "Analyst", c1: "Scope" }
      )
    ).toEqual(["Analyst", "Scope"])
  })

  it("uses the captured name for a removed family whose id resolves nothing", () => {
    expect(
      parts("roleFamily.removed", { familyId: "f1", name: "Product" })
    ).toEqual(["Product"])
  })

  it("gives invitation rows no subject (the invitee is PII; the diff carries the rest)", () => {
    // The real writer shape: role/status/expiry live only in the changes map.
    expect(
      parts("invitation.created", {
        invitationId: "i1",
        changes: {
          role: { from: null, to: "editor" },
          status: { from: null, to: "pending" },
          expiresAt: { from: null, to: 1000 },
        },
      })
    ).toEqual([])
  })
})

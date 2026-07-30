import { describe, expect, it } from "vitest"
import type { Doc } from "../_generated/dataModel"
import {
  AUDIT_EVENTS,
  type AuditEvent,
  type AuditSubject,
  anchorDiff,
  buildChanges,
  buildCreateChanges,
  buildDeleteChanges,
  buildSearchText,
  categoryForEvent,
  criterionCreateItem,
  criterionDeleteItem,
  PLATFORM_AUDIT_EVENTS,
  subjectForEvent,
} from "./audit"
import type { AuditPayloads } from "./auditPayloads"

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

describe("buildCreateChanges", () => {
  it("records every present field as from null to value", () => {
    expect(
      buildCreateChanges({ name: "Scope", weightPoints: 3 }, [
        "name",
        "weightPoints",
      ])
    ).toEqual({
      name: { from: null, to: "Scope" },
      weightPoints: { from: null, to: 3 },
    })
  })

  it("retains an empty string as a created value", () => {
    expect(buildCreateChanges({ description: "" }, ["description"])).toEqual({
      description: { from: null, to: "" },
    })
  })

  it("skips fields absent from after", () => {
    expect(buildCreateChanges({ name: "Scope" }, ["name", "helpText"])).toEqual(
      {
        name: { from: null, to: "Scope" },
      }
    )
  })

  it("collapses nullish values to to null", () => {
    expect(
      buildCreateChanges({ templateKey: undefined, order: null }, [
        "templateKey",
        "order",
      ])
    ).toEqual({
      templateKey: { from: null, to: null },
      order: { from: null, to: null },
    })
  })
})

describe("buildDeleteChanges", () => {
  it("records every present field as from value to null", () => {
    expect(
      buildDeleteChanges({ name: "Scope", weightPoints: 3 }, [
        "name",
        "weightPoints",
      ])
    ).toEqual({
      name: { from: "Scope", to: null },
      weightPoints: { from: 3, to: null },
    })
  })

  it("retains an empty string as a removed value", () => {
    expect(buildDeleteChanges({ description: "" }, ["description"])).toEqual({
      description: { from: "", to: null },
    })
  })

  it("skips fields absent from before", () => {
    expect(buildDeleteChanges({ name: "Scope" }, ["name", "helpText"])).toEqual(
      {
        name: { from: "Scope", to: null },
      }
    )
  })

  it("collapses nullish values to from null", () => {
    expect(
      buildDeleteChanges({ templateKey: undefined, order: null }, [
        "templateKey",
        "order",
      ])
    ).toEqual({
      templateKey: { from: null, to: null },
      order: { from: null, to: null },
    })
  })
})

describe("anchorDiff", () => {
  const anchors = (texts: string[]) =>
    texts.map((text, level) => ({ level, text }))

  it("returns {} when every level-ordered anchor text is identical", () => {
    const before = anchors(["a", "b", "c"])
    const after = anchors(["a", "b", "c"])
    expect(anchorDiff(before, after)).toEqual({})
  })

  it("returns the full from/to arrays when one text differs", () => {
    const before = anchors(["a", "b", "c"])
    const after = anchors(["a", "B", "c"])
    expect(anchorDiff(before, after)).toEqual({
      anchors: { from: before, to: after },
    })
  })

  it("flags a length change as differing", () => {
    const before = anchors(["a", "b"])
    const after = anchors(["a", "b", "c"])
    expect(anchorDiff(before, after)).toEqual({
      anchors: { from: before, to: after },
    })
  })

  it("flags a level reorder as differing", () => {
    const before = [
      { level: 0, text: "a" },
      { level: 1, text: "b" },
    ]
    const after = [
      { level: 1, text: "a" },
      { level: 0, text: "b" },
    ]
    expect(anchorDiff(before, after)).toEqual({
      anchors: { from: before, to: after },
    })
  })
})

describe("criterionCreateItem", () => {
  it("uses the name as label and records every field as from null", () => {
    const item = criterionCreateItem({
      criterionId: "crit-1",
      templateKey: "scope",
      name: "Scope",
      order: 0,
      description: "desc",
      helpText: "help",
      weightPoints: 3,
      isCustom: false,
      anchors: [{ level: 0, text: "low" }],
    })
    expect(item.criterionId).toBe("crit-1")
    expect(item.label).toBe("Scope")
    expect(Object.keys(item.changes).sort()).toEqual([
      "anchors",
      "description",
      "helpText",
      "isCustom",
      "name",
      "order",
      "templateKey",
      "weightPoints",
    ])
    for (const change of Object.values(item.changes)) {
      expect(change.from).toBeNull()
    }
    expect(item.changes.name?.to).toBe("Scope")
    expect(item.changes.templateKey?.to).toBe("scope")
    expect(item.changes.anchors?.to).toEqual([{ level: 0, text: "low" }])
  })

  it("defaults optional fields and a missing templateKey to null", () => {
    const item = criterionCreateItem({
      name: "Custom",
      order: 2,
      weightPoints: 3,
      isCustom: true,
    })
    expect(item.criterionId).toBeUndefined()
    expect(item.label).toBe("Custom")
    expect(item.changes.templateKey).toEqual({ from: null, to: null })
    expect(item.changes.description).toEqual({ from: null, to: "" })
    expect(item.changes.helpText).toEqual({ from: null, to: "" })
    expect(item.changes.anchors).toEqual({ from: null, to: [] })
    expect(item.changes.isCustom).toEqual({ from: null, to: true })
  })
})

describe("criterionDeleteItem", () => {
  it("uses the name as label and records every field as to null", () => {
    const criterion = {
      _id: "crit-9",
      _creationTime: 0,
      orgId: "org-1",
      modelId: "model-1",
      name: "Scope",
      description: "desc",
      helpText: "help",
      anchors: [{ level: 0, text: "low" }],
      templateKey: "scope",
      weightPoints: 4,
      order: 1,
      isCustom: false,
    } as unknown as Doc<"criteria">
    const item = criterionDeleteItem(criterion)
    expect(item.criterionId).toBe("crit-9")
    expect(item.label).toBe("Scope")
    expect(Object.keys(item.changes).sort()).toEqual([
      "anchors",
      "description",
      "helpText",
      "isCustom",
      "name",
      "order",
      "templateKey",
      "weightPoints",
    ])
    for (const change of Object.values(item.changes)) {
      expect(change.to).toBeNull()
    }
    expect(item.changes.name?.from).toBe("Scope")
    expect(item.changes.templateKey?.from).toBe("scope")
    expect(item.changes.weightPoints?.from).toBe(4)
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

// One minimal, contract-valid payload per event. The mapped type makes this
// map total AND shape-checked: a new AUDIT_EVENTS value without a fixture, or
// a fixture drifting from its AuditPayloads entry, is a compile error.
const SUBJECT_FIXTURES: { [E in AuditEvent]: AuditPayloads[E] } = {
  "organization.created": { changes: {} },
  "organization.settingsUpdated": { changes: {} },
  "organization.onboardingCompleted": { changes: {} },
  "organization.logoUpdated": {},
  "organization.logoRemoved": {},
  "organization.nameUpdated": { changes: {} },
  "member.added": { memberUserId: "user-1", changes: {} },
  "member.roleChanged": { memberUserId: "user-1", changes: {} },
  "member.removed": { memberUserId: "user-1", changes: {} },
  "invitation.created": { invitationId: "inv-1", changes: {} },
  "invitation.accepted": {
    invitationId: "inv-1",
    status: "accepted",
    changes: {},
  },
  "invitation.revoked": {
    invitationId: "inv-1",
    status: "revoked",
    changes: {},
  },
  "model.created": {
    modelId: "model-1",
    source: "template",
    name: "Standard",
    changes: {},
    count: 0,
    items: [],
  },
  "model.updated": {
    change: "criterion.updated",
    criterionId: "crit-1",
    modelId: "model-1",
    changes: {},
  },
  "model.discarded": {
    modelId: "model-1",
    name: "Standard",
    changes: {},
    count: 0,
    items: [],
    suggestionCount: 0,
    suggestions: [],
  },
  "ai.suggestionConfirmed": {
    suggestionId: "sug-1",
    kind: "model.draft",
    modelId: "model-1",
    acceptedCount: 2,
    totalProposed: 3,
    count: 2,
    items: [],
  },
  "ai.suggestionRejected": {
    suggestionId: "sug-1",
    kind: "role.profile",
    changes: {},
    roleId: "role-1",
  },
  "role.created": { roleId: "role-1", changes: {} },
  "role.updated": { roleId: "role-1", changes: {} },
  "role.archived": {
    roleId: "role-1",
    title: "Developer",
    trackKey: "IC",
    function: "engineering",
    team: "Platform",
    familyId: null,
    anchorRetired: false,
    changes: {},
  },
  "rating.change": {
    roleId: "role-1",
    criterionId: "crit-1",
    created: true,
    changes: {},
  },
  "band.shift": {
    roleId: "role-1",
    cause: { event: "rating.change", roleId: "role-1" },
    changes: {},
  },
  "anchorRole.designated": {
    roleId: "role-1",
    computedBand: 2,
    changes: {},
  },
  "anchorRole.updated": { roleId: "role-1", changes: {} },
  "roleFamily.created": { familyId: "fam-1", changes: {} },
  "roleFamily.renamed": { familyId: "fam-1", changes: {} },
  "roleFamily.removed": {
    familyId: "fam-1",
    name: "Product",
    changes: {},
    count: 0,
    items: [],
  },
  "criterion.approved": { criterionId: "crit-1", modelId: "model-1" },
  "criterion.reopened": { criterionId: "crit-1", modelId: "model-1" },
  "person.created": { personId: "person-1", changes: {} },
  "person.updated": { personId: "person-1", changes: {} },
  "person.archived": { personId: "person-1", changes: {} },
  "person.erased": { personId: "person-1", changes: {} },
  "assignment.set": { personId: "person-1", roleId: "role-1", changes: {} },
  "classification.suggested": {
    suggested: 1,
    skipped: 0,
    unmatchedTitles: 0,
  },
  "pay.salarySet": { personId: "person-1", changes: {} },
  "pay.salaryDeleted": { personId: "person-1", changes: {} },
  "pay.mappingSaved": { orgId: "org-1", changes: {} },
  "people.imported": {
    peopleCreated: 1,
    peopleUpdated: 0,
    peopleUnchanged: 0,
    salariesImported: 0,
    skippedRows: 0,
  },
  "payMapping.runStarted": {
    runId: "run-1",
    populationCount: 10,
    withPayCount: 9,
  },
  "payMapping.groupAnalysisUpdated": {
    runId: "run-1",
    scope: "equalWork",
    groupLabel: "Developer · L3",
    changes: {},
  },
  "payMapping.runCompleted": {
    runId: "run-1",
    equalWorkDone: 3,
    equivalentWorkDone: 2,
  },
  "payMapping.runReopened": { runId: "run-1" },
  "payMapping.collaborationUpdated": { runId: "run-1" },
  "payMapping.runRenamed": { runId: "run-1", changes: {} },
  "payMapping.runDeleted": {
    runId: "run-1",
    label: "Lönekartläggning 2026",
    populationCount: 10,
  },
}

// The expected subject per fixture above: the canonical primary entity, or
// undefined for events with no single-entity subject. Total over AuditEvent so
// a new event must state its expectation here, mirroring the deriver map.
const EXPECTED_SUBJECTS: { [E in AuditEvent]: AuditSubject | undefined } = {
  "organization.created": undefined,
  "organization.settingsUpdated": undefined,
  "organization.onboardingCompleted": undefined,
  "organization.logoUpdated": undefined,
  "organization.logoRemoved": undefined,
  "organization.nameUpdated": undefined,
  "member.added": undefined,
  "member.roleChanged": undefined,
  "member.removed": undefined,
  "invitation.created": undefined,
  "invitation.accepted": undefined,
  "invitation.revoked": undefined,
  "model.created": undefined,
  "model.updated": undefined,
  "model.discarded": undefined,
  "ai.suggestionConfirmed": undefined,
  "ai.suggestionRejected": { kind: "role", id: "role-1" },
  "role.created": { kind: "role", id: "role-1" },
  "role.updated": { kind: "role", id: "role-1" },
  "role.archived": { kind: "role", id: "role-1" },
  "rating.change": { kind: "role", id: "role-1" },
  "band.shift": { kind: "role", id: "role-1" },
  "anchorRole.designated": { kind: "role", id: "role-1" },
  "anchorRole.updated": { kind: "role", id: "role-1" },
  "roleFamily.created": undefined,
  "roleFamily.renamed": undefined,
  "roleFamily.removed": undefined,
  "criterion.approved": undefined,
  "criterion.reopened": undefined,
  "person.created": undefined,
  "person.updated": undefined,
  "person.archived": undefined,
  "person.erased": undefined,
  "assignment.set": { kind: "role", id: "role-1" },
  "classification.suggested": undefined,
  "pay.salarySet": undefined,
  "pay.salaryDeleted": undefined,
  "pay.mappingSaved": undefined,
  "people.imported": undefined,
  "payMapping.runStarted": { kind: "payMappingRun", id: "run-1" },
  "payMapping.groupAnalysisUpdated": { kind: "payMappingRun", id: "run-1" },
  "payMapping.runCompleted": { kind: "payMappingRun", id: "run-1" },
  "payMapping.runReopened": { kind: "payMappingRun", id: "run-1" },
  "payMapping.collaborationUpdated": { kind: "payMappingRun", id: "run-1" },
  "payMapping.runRenamed": { kind: "payMappingRun", id: "run-1" },
  "payMapping.runDeleted": { kind: "payMappingRun", id: "run-1" },
}

describe("subjectForEvent", () => {
  it("derives the expected subject (or none) for every audit event", () => {
    for (const type of Object.values(AUDIT_EVENTS)) {
      expect(subjectForEvent(type, SUBJECT_FIXTURES[type]), type).toEqual(
        EXPECTED_SUBJECTS[type]
      )
    }
  })

  it("skips an ai.suggestionRejected without a roleId", () => {
    expect(
      subjectForEvent("ai.suggestionRejected", {
        suggestionId: "sug-1",
        kind: "model.draft",
        changes: {},
        modelId: "model-1",
      })
    ).toBeUndefined()
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

  it("indexes bulk items labels and their changes from/to", () => {
    const text = buildSearchText("Sys", "model.updated", {
      count: 2,
      items: [
        {
          criterionId: "c1",
          label: "Scope",
          changes: { name: { from: "Old", to: "Scope" } },
        },
        {
          criterionId: "c2",
          label: "Impact",
          changes: { weightPoints: { from: 3, to: 4 } },
        },
      ],
    })
    expect(text).toContain("scope")
    expect(text).toContain("impact")
    expect(text).toContain("old")
    expect(text).toContain("4")
  })

  it("indexes dropped suggestion scalars and move rationales", () => {
    const text = buildSearchText("Sys", "model.discarded", {
      suggestions: [{ suggestionId: "s1", kind: "modelDraft", status: "open" }],
      moves: [
        {
          fromLabel: "Scope",
          toLabel: "Impact",
          motivation: "rebalance toward impact",
        },
      ],
    })
    expect(text).toContain("modeldraft")
    expect(text).toContain("open")
    expect(text).toContain("scope")
    expect(text).toContain("impact")
    expect(text).toContain("rebalance toward impact")
  })

  it("ignores object-valued items changes from/to without throwing", () => {
    expect(() =>
      buildSearchText("Sys", "model.discarded", {
        items: [
          {
            criterionId: "c1",
            label: "Scope",
            changes: {
              anchors: {
                from: [{ level: 0, text: "low" }],
                to: [{ level: 0, text: "high" }],
              },
            },
          },
        ],
      })
    ).not.toThrow()
    const text = buildSearchText("Sys", "model.discarded", {
      items: [
        {
          label: "Scope",
          changes: {
            anchors: { from: [{ level: 0, text: "low" }], to: null },
          },
        },
      ],
    })
    // The object-valued from/to are skipped; only the scalar label survives.
    expect(text).toBe("sys model.discarded scope")
  })
})

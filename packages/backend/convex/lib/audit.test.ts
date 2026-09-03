import { describe, expect, it } from "vitest"
import { COMPLIANCE_AUDIT_FIELDS } from "../evaluationModel/method"
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
  ACTION_AUDIT_FIELDS,
  ACTION_UPDATE_AUDIT_FIELDS,
  ANCHOR_AUDIT_FIELDS,
  ASSIGNMENT_AUDIT_FIELDS,
  ERASED_FIELD_VALUE,
  GROUP_ANALYSIS_AUDIT_FIELDS,
  isPersonIdentityField,
  MODEL_AUDIT_FIELDS,
  NOTE_AUDIT_FIELDS,
  PAY_AUDIT_FIELDS,
  PERSON_AUDIT_FIELDS,
  PERSON_ERASURE_AUDIT_FIELDS,
  PERSON_IDENTITY_AUDIT_FIELDS,
  PLATFORM_AUDIT_EVENTS,
  ROLE_CREATE_FIELDS,
  scrubPersonIdentityChanges,
  SETTINGS_AUDIT_FIELDS,
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
      buildCreateChanges({ decidedBy: undefined, order: null }, [
        "decidedBy",
        "order",
      ])
    ).toEqual({
      decidedBy: { from: null, to: null },
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
      buildDeleteChanges({ decidedBy: undefined, order: null }, [
        "decidedBy",
        "order",
      ])
    ).toEqual({
      decidedBy: { from: null, to: null },
      order: { from: null, to: null },
    })
  })
})

describe("anchorDiff", () => {
  const anchors = (texts: string[]) =>
    texts.map((text, step) => ({ step, text }))

  it("returns {} when every step-ordered anchor text is identical", () => {
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

  it("flags a step reorder as differing", () => {
    const before = [
      { step: 0, text: "a" },
      { step: 1, text: "b" },
    ]
    const after = [
      { step: 1, text: "a" },
      { step: 0, text: "b" },
    ]
    expect(anchorDiff(before, after)).toEqual({
      anchors: { from: before, to: after },
    })
  })
})

describe("categoryForEvent", () => {
  it("maps representative events to the right category", () => {
    expect(categoryForEvent("model.created")).toBe("model")
    expect(categoryForEvent("role.updated")).toBe("role")
    expect(categoryForEvent("roleFamily.renamed")).toBe("role")
    expect(categoryForEvent("rating.change")).toBe("role")
    expect(categoryForEvent("level.shift")).toBe("role")
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
    source: "default",
    name: "Standard",
    changes: {},
    count: 0,
    items: [],
  },
  "model.updated": {
    change: "criterion.complianceUpdated",
    criterionId: "crit-1",
    modelId: "model-1",
    changes: {},
  },
  "criterion.activated": {
    criterionId: "crit-1",
    modelId: "model-1",
    libraryKey: "scope-impact",
    dimensionKey: "responsibility",
    weightPoints: 3,
  },
  "criterion.deactivated": {
    criterionId: "crit-1",
    modelId: "model-1",
    libraryKey: "scope-impact",
    dimensionKey: "responsibility",
    weightPoints: 3,
    deletedRatingCount: 0,
    changes: { budget: { from: 24, to: 21 } },
    count: 0,
    items: [],
  },
  "model.approved": {
    modelId: "model-1",
    criteriaCount: 8,
    checksPassed: 12,
    competenceShare: 25,
    effortShare: 29,
    responsibilityShare: 42,
    workingConditionsShare: 4,
  },
  "model.workingConditionsDecided": {
    modelId: "model-1",
    status: "active",
    changes: {},
  },
  "model.approvalReopened": {
    modelId: "model-1",
    causeEvent: "criterion.activated",
  },
  "model.restored": {
    modelId: "model-1",
    changes: {},
    count: 1,
    items: [
      {
        libraryKey: "knowledge-breadth",
        label: "Knowledge breadth",
        changes: { selected: { from: true, to: false } },
      },
    ],
  },
  "role.assessmentCompleted": { roleId: "role-1", ratedCount: 8 },
  "role.assessmentReopened": { roleId: "role-1" },
  "role.assessmentCalibrated": { roleId: "role-1", noteProvided: true },
  "ai.suggestionConfirmed": {
    suggestionId: "sug-1",
    kind: "model.weightReview",
    modelId: "model-1",
    appliedCount: 2,
    totalMoves: 3,
    skippedCount: 1,
    appliedMoveIndexes: [0, 1],
    count: 2,
    items: [],
    moves: [],
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
  "level.shift": {
    roleId: "role-1",
    cause: { event: "rating.change", roleId: "role-1" },
    changes: {},
  },
  "anchorRole.designated": {
    roleId: "role-1",
    computedLevel: 2,
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
  "person.unarchived": { personId: "person-1", changes: {} },
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
    peopleArchived: 0,
    peopleReactivated: 0,
    hourlyPay: 0,
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
  "payMapping.actionCreated": {
    runId: "run-1",
    actionId: "action-1",
    targetKind: "group",
    targetLabel: "SWE · Senior",
    changes: {},
  },
  "payMapping.actionUpdated": {
    runId: "run-1",
    actionId: "action-1",
    targetLabel: "SWE · Senior",
    changes: {},
  },
  "payMapping.actionStatusChanged": {
    runId: "run-1",
    actionId: "action-1",
    targetLabel: "SWE · Senior",
    changes: {},
  },
  "payMapping.actionDeleted": {
    runId: "run-1",
    actionId: "action-1",
    targetKind: "person",
    targetLabel: "SWE · Senior",
  },
  "payMapping.noteCreated": {
    runId: "run-1",
    noteId: "note-1",
    targetKind: "group",
    targetLabel: "SWE · Senior",
    noteType: "discussionNeeded",
  },
  "payMapping.noteUpdated": {
    runId: "run-1",
    noteId: "note-1",
    targetLabel: "SWE · Senior",
    changes: {},
  },
  "payMapping.noteDeleted": {
    runId: "run-1",
    noteId: "note-1",
    targetKind: "group",
    targetLabel: "SWE · Senior",
  },
  "payMapping.reportExported": { runId: "run-1" },
  "payMapping.metricsExported": { runId: "run-1" },
  "payMapping.unionReportExported": { runId: "run-1" },
  "payMapping.archiveExported": { runId: "run-1" },
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
  "ai.suggestionConfirmed": undefined,
  "ai.suggestionRejected": { kind: "role", id: "role-1" },
  "role.created": { kind: "role", id: "role-1" },
  "role.updated": { kind: "role", id: "role-1" },
  "role.archived": { kind: "role", id: "role-1" },
  "rating.change": { kind: "role", id: "role-1" },
  "level.shift": { kind: "role", id: "role-1" },
  "anchorRole.designated": { kind: "role", id: "role-1" },
  "anchorRole.updated": { kind: "role", id: "role-1" },
  "roleFamily.created": undefined,
  "roleFamily.renamed": undefined,
  "roleFamily.removed": undefined,
  "criterion.approved": undefined,
  "criterion.reopened": undefined,
  "criterion.activated": undefined,
  "criterion.deactivated": undefined,
  "model.approved": undefined,
  "model.workingConditionsDecided": undefined,
  "model.approvalReopened": undefined,
  "model.restored": undefined,
  "role.assessmentCompleted": { kind: "role", id: "role-1" },
  "role.assessmentReopened": { kind: "role", id: "role-1" },
  "role.assessmentCalibrated": { kind: "role", id: "role-1" },
  "person.created": { kind: "person", id: "person-1" },
  "person.updated": { kind: "person", id: "person-1" },
  "person.archived": { kind: "person", id: "person-1" },
  "person.unarchived": { kind: "person", id: "person-1" },
  "person.erased": { kind: "person", id: "person-1" },
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
  "payMapping.actionCreated": { kind: "payMappingRun", id: "run-1" },
  "payMapping.actionUpdated": { kind: "payMappingRun", id: "run-1" },
  "payMapping.actionStatusChanged": { kind: "payMappingRun", id: "run-1" },
  "payMapping.actionDeleted": { kind: "payMappingRun", id: "run-1" },
  "payMapping.noteCreated": { kind: "payMappingRun", id: "run-1" },
  "payMapping.noteUpdated": { kind: "payMappingRun", id: "run-1" },
  "payMapping.noteDeleted": { kind: "payMappingRun", id: "run-1" },
  "payMapping.reportExported": { kind: "payMappingRun", id: "run-1" },
  "payMapping.metricsExported": { kind: "payMappingRun", id: "run-1" },
  "payMapping.unionReportExported": { kind: "payMappingRun", id: "run-1" },
  "payMapping.archiveExported": { kind: "payMappingRun", id: "run-1" },
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
        kind: "model.weightReview",
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
                from: [{ step: 0, text: "low" }],
                to: [{ step: 0, text: "high" }],
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
            anchors: { from: [{ step: 0, text: "low" }], to: null },
          },
        },
      ],
    })
    // The object-valued from/to are skipped; only the scalar label survives.
    expect(text).toBe("sys model.discarded scope")
  })
})

// The person diff records the employee's own identity values (ADR-0013), which
// is only lawful because erasure can take them back out again. These tests pin
// both halves: the field lists that decide what is identity, and the scrub that
// tombstones it.
describe("person audit field lists", () => {
  it("classifies every audited field as exactly one of identity or structural", () => {
    // The classification Record is compile-time-total, so this pins the derived
    // halves: every field lands in exactly one list, and neither list invents a
    // field that is not audited.
    for (const field of PERSON_AUDIT_FIELDS) {
      const inIdentity = PERSON_IDENTITY_AUDIT_FIELDS.includes(field)
      const inErasure = PERSON_ERASURE_AUDIT_FIELDS.includes(field)
      expect(inIdentity !== inErasure, field).toBe(true)
    }
    expect(
      PERSON_IDENTITY_AUDIT_FIELDS.length + PERSON_ERASURE_AUDIT_FIELDS.length
    ).toBe(PERSON_AUDIT_FIELDS.length)
    expect(isPersonIdentityField("displayName")).toBe(true)
    expect(isPersonIdentityField("department")).toBe(false)
  })

  it("keeps the row written AT erasure free of every identity field", () => {
    for (const field of PERSON_IDENTITY_AUDIT_FIELDS) {
      expect(PERSON_ERASURE_AUDIT_FIELDS).not.toContain(field)
    }
  })

  // anonymizePersonAuditRows only reaches rows carrying a `person` subject, i.e.
  // the person.* events. If an identity field ever entered ANOTHER event's diff
  // (a pay row, an assignment, a role snapshot), those rows have a different
  // subject, the scrub would never find them, and the leak would be silent and
  // unbackfillable. This is the guard that makes that a test failure.
  it("keeps identity fields out of every other event's diff", () => {
    const otherFieldSets = {
      COMPLIANCE_AUDIT_FIELDS,
      ANCHOR_AUDIT_FIELDS,
      MODEL_AUDIT_FIELDS,
      SETTINGS_AUDIT_FIELDS,
      PAY_AUDIT_FIELDS,
      ASSIGNMENT_AUDIT_FIELDS,
      GROUP_ANALYSIS_AUDIT_FIELDS,
      ACTION_AUDIT_FIELDS,
      ACTION_UPDATE_AUDIT_FIELDS,
      NOTE_AUDIT_FIELDS,
    }
    for (const [name, fields] of Object.entries(otherFieldSets)) {
      for (const field of fields as readonly string[]) {
        expect(isPersonIdentityField(field), `${name}.${field}`).toBe(false)
      }
    }
    // ROLE_CREATE_FIELDS is the documented exception: a ROLE's `title` collides
    // by name with a person's job title. Roles are never created from a person's
    // imported Befattning, so a role row carries no person data; asserted here so
    // the collision stays a known, single case rather than a surprise.
    expect(
      (ROLE_CREATE_FIELDS as readonly string[]).filter(isPersonIdentityField)
    ).toEqual(["title"])
  })
})

describe("scrubPersonIdentityChanges", () => {
  it("tombstones identity values and leaves structural ones", () => {
    const scrubbed = scrubPersonIdentityChanges({
      personId: "person-1",
      changes: {
        displayName: { from: "Anna Andersson", to: "Anna Bergström" },
        externalRef: { from: "4711", to: "4712" },
        gender: { from: "Man", to: "Kvinna" },
        birthDate: { from: "1980-05-01", to: "1980-06-01" },
        title: { from: "Utvecklare", to: "Senior utvecklare" },
        department: { from: "Sales", to: "Marketing" },
        ftePercent: { from: 80, to: 100 },
      },
    })
    expect(scrubbed).toEqual({
      personId: "person-1",
      changes: {
        displayName: { from: ERASED_FIELD_VALUE, to: ERASED_FIELD_VALUE },
        externalRef: { from: ERASED_FIELD_VALUE, to: ERASED_FIELD_VALUE },
        gender: { from: ERASED_FIELD_VALUE, to: ERASED_FIELD_VALUE },
        birthDate: { from: ERASED_FIELD_VALUE, to: ERASED_FIELD_VALUE },
        title: { from: ERASED_FIELD_VALUE, to: ERASED_FIELD_VALUE },
        department: { from: "Sales", to: "Marketing" },
        ftePercent: { from: 80, to: 100 },
      },
    })
  })

  it("keeps a null side null instead of inventing a value", () => {
    const scrubbed = scrubPersonIdentityChanges({
      changes: { displayName: { from: null, to: "Anna Andersson" } },
    })
    expect(scrubbed).toEqual({
      changes: { displayName: { from: null, to: ERASED_FIELD_VALUE } },
    })
  })

  it("returns null when there is nothing to scrub, and is idempotent", () => {
    // No diff at all.
    expect(scrubPersonIdentityChanges({ personId: "person-1" })).toBeNull()
    // A diff with no identity fields.
    expect(
      scrubPersonIdentityChanges({
        changes: { department: { from: "Sales", to: "Marketing" } },
      })
    ).toBeNull()
    // Already scrubbed: a second pass must not report work to do, so erasure
    // never rewrites (and re-searchTexts) rows it has already cleaned.
    const once = scrubPersonIdentityChanges({
      changes: { displayName: { from: "Anna", to: "Anna B" } },
    })
    expect(once).not.toBeNull()
    expect(
      scrubPersonIdentityChanges(once as Record<string, unknown>)
    ).toBeNull()
  })

  it("removes every identity value from the rebuilt search text", () => {
    const payload = {
      personId: "person-1",
      changes: {
        displayName: { from: "Anna Andersson", to: "Anna Bergström" },
        externalRef: { from: "4711", to: "4712" },
        birthDate: { from: "1985-04-12", to: "1985-04-13" },
        gender: { from: "Kvinna", to: "Man" },
        title: { from: "Ekonomiassistent", to: "Ekonom" },
        department: { from: "Ekonomi", to: "Finans" },
      },
    }
    // Before: every identity value is full-text searchable. Asserted so this
    // test cannot pass vacuously against a trail that never held them.
    const before = buildSearchText("HR Admin", "person.updated", payload)
    for (const value of [
      "anna andersson",
      "4711",
      "1985-04-12",
      "kvinna",
      "ekonomiassistent",
    ]) {
      expect(before, value).toContain(value)
    }

    const scrubbed = scrubPersonIdentityChanges(payload) as Record<
      string,
      unknown
    >
    const text = buildSearchText("HR Admin", "person.updated", scrubbed)
    // After: none of them are, in either direction of any identity diff.
    for (const value of [
      "anna",
      "andersson",
      "bergström",
      "4711",
      "4712",
      "1985",
      "kvinna",
      "ekonomiassistent",
      "ekonom ",
    ]) {
      expect(text, value).not.toContain(value)
    }
    // The structural diff and the operator's own name stay: neither is the
    // erased person's identity, and both carry the trail's remaining value.
    expect(text).toContain("ekonomi")
    expect(text).toContain("finans")
    expect(text).toContain("hr admin")
  })
})

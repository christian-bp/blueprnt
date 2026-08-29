import { MODEL_MAX_CRITERIA, MODEL_MIN_CRITERIA } from "@workspace/core"
import { describe, expect, it } from "vitest"
import {
  buildOverviewStats,
  buildTodo,
  type BuildTodoInput,
  MAX_ITEMS,
} from "./todo"

const role = (
  over: Partial<Parameters<typeof buildTodo>[0]["roles"][number]> = {}
) => ({
  roleId: "r1",
  title: "Backend Engineer",
  slug: "backend-engineer",
  ratedCount: 0,
  totalCriteria: 9,
  profileComplete: true,
  // Open by default (spec 2.4/6: completing is the reveal); tests representing
  // a genuinely finished role override this explicitly.
  completed: false,
  // Calibration facts: an unflagged role by default, so a fixture is one
  // nobody has to look at unless a test says otherwise.
  level: null,
  calibrated: false,
  methodDrift: false,
  profileLimited: false,
  anchorExpectedLevel: null,
  familyName: "Engineering",
  ...over,
})

// modelApproved defaults true, and criteria is padded with neutral APPROVED
// filler (a status excluded from every derived count, so document/approve
// counts never move) up to MODEL_MIN_CRITERIA by default, so the many
// fixtures below that are not about the buildModel group never sprout it
// unasked and desync their total/groups assertions (mirrors role()'s completed
// default). Tests about buildModel's own criteria-incomplete state pass
// pad: false to keep an exact, intentionally-short list.
//
// Returns BOTH `method` and `methodChecks`, spread into buildTodo's input at
// the call site (`...method(...)`): the two describe the same model, so one
// factory builds them together rather than risking two independently
// hand-written fixtures drifting apart. methodChecks' three station checks
// (criterionCount, dimensionCaps, dimensionCoverage -- model-chapters.ts's
// CRITERIA_STATION_CHECKS) read "ok" exactly when the criteria count sits
// within [MODEL_MIN_CRITERIA, MODEL_MAX_CRITERIA] by default (stationOk:
// true), matching the naive count boundary every fixture below that is not
// about the chapter-progress boundary itself already assumes; stationOk:
// false fails dimensionCaps/dimensionCoverage while leaving criterionCount's
// own count untouched, for exercising the coverage-failing-but-count-passing
// state (a selection of six or more that still reads incomplete).
function method(
  criteria: {
    criterionId: string
    name: string
    status: "notStarted" | "inProgress" | "documented" | "approved"
  }[],
  modelApproved = true,
  pad = true,
  stationOk = true
): Pick<BuildTodoInput, "method" | "methodChecks"> {
  const filler = pad
    ? Array.from(
        { length: Math.max(0, MODEL_MIN_CRITERIA - criteria.length) },
        (_, i) => ({
          criterionId: `filler${i}`,
          name: `Filler ${i}`,
          status: "approved" as const,
        })
      )
    : []
  const allCriteria = [...criteria, ...filler]
  const count = allCriteria.length
  return {
    method: { criteria: allCriteria, modelApproved },
    methodChecks: {
      // level: "blocker" on all four: they are real blockers in
      // validateMethod (packages/core), and payMappingReady's belt-and-braces
      // methodBlockersPass reads it directly, so stationOk: false correctly
      // fails that re-check too, not only the buildModel-group reading these
      // fixtures already exercise -- a station failure genuinely fails the
      // real checklist regardless of which chapter is asking.
      checks: [
        {
          key: "criterionCount",
          level: "blocker",
          ok:
            stationOk &&
            count >= MODEL_MIN_CRITERIA &&
            count <= MODEL_MAX_CRITERIA,
          count,
        },
        { key: "dimensionCaps", level: "blocker", ok: stationOk },
        { key: "dimensionCoverage", level: "blocker", ok: stationOk },
        // The Kriterier chapter's seventh unit (the working-conditions
        // materiality decision). Not one of the station checks these fixtures
        // flip, so it passes by default: a todo test is about the selection,
        // never about that decision.
        { key: "workingConditionsTested", level: "blocker", ok: true },
      ],
    },
  }
}

// Spread alongside a `method: null` fixture (no model exists at all): both
// getMethodModel and getMethodChecks read the same underlying absence, so
// methodChecks mirrors method's null exactly, the "no model" reading
// buildModel's own derivation expects.
const NO_MODEL = { method: null, methodChecks: null } as const

// An open (non-completed) run: the neutral default for tests that are not
// about the startPayMapping group itself, so a vacuously "ready" empty-input
// fixture (no people, no staffed roles) never sprouts an unrelated extra
// group and desyncs total/groups assertions written before that group existed.
const OPEN_RUN = [{ status: "active" as const }]

// One classified person staffed on a role outside each test's roles fixture:
// the neutral default for tests that are not about people at all, so the org
// never reads as empty (an empty org adds the importPeople group).
const PEOPLE_NEUTRAL = [
  {
    title: "Neutral",
    people: [
      {
        currentAssignment: {
          roleId: "neutral-staffed",
          senioritySource: "confirmed" as const,
        },
      },
    ],
  },
]

describe("buildTodo", () => {
  it("routes a profile-incomplete role to describeRoles only (the gate)", () => {
    const todo = buildTodo({
      roles: [
        role({
          roleId: "r1",
          profileComplete: false,
          ratedCount: 0,
          totalCriteria: 9,
        }),
      ],
      ...NO_MODEL,
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
    })
    expect(todo.groups.map((g) => g.key)).toEqual(["describeRoles"])
    expect(todo.groups[0]?.items[0]?.href).toBe("/roles/backend-engineer")
    expect(todo.total).toBe(1)
  })

  it("routes a profiled, partly-rated role to evaluateRoles with progress + rate link", () => {
    const todo = buildTodo({
      roles: [role({ profileComplete: true, ratedCount: 3, totalCriteria: 9 })],
      ...NO_MODEL,
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
    })
    const g = todo.groups.find((g) => g.key === "evaluateRoles")
    expect(g?.key).toBe("evaluateRoles")
    const item = g?.items[0] as {
      href: string
      ratedCount: number
      totalCriteria: number
    }
    expect(item.href).toBe("/roles/backend-engineer/rate")
    expect(item.ratedCount).toBe(3)
    expect(item.totalCriteria).toBe(9)
  })

  it("excludes a profiled, fully-rated, COMPLETED role from every group", () => {
    const todo = buildTodo({
      roles: [
        role({
          profileComplete: true,
          ratedCount: 9,
          totalCriteria: 9,
          completed: true,
        }),
      ],
      ...NO_MODEL,
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
    })
    expect(todo.total).toBe(0)
    expect(todo.groups).toEqual([])
  })

  it("keeps a fully-rated but NOT YET COMPLETED role in evaluateRoles (spec 2.4/6: it still needs action)", () => {
    const todo = buildTodo({
      roles: [
        role({
          profileComplete: true,
          ratedCount: 9,
          totalCriteria: 9,
          completed: false,
        }),
      ],
      ...NO_MODEL,
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
    })
    const g = todo.groups.find((g) => g.key === "evaluateRoles")
    expect(g?.key).toBe("evaluateRoles")
    expect(g?.items[0]?.href).toBe("/roles/backend-engineer/rate")
    expect(todo.total).toBe(1)
  })

  it("splits criteria into document (notStarted/inProgress) and approve (documented); approved is done", () => {
    const todo = buildTodo({
      roles: [],
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
      ...method([
        { criterionId: "c1", name: "Scope", status: "notStarted" },
        { criterionId: "c2", name: "Risk", status: "inProgress" },
        { criterionId: "c3", name: "Autonomy", status: "documented" },
        { criterionId: "c4", name: "Knowledge", status: "approved" },
      ]),
    })
    const doc = todo.groups.find((g) => g.key === "documentCriteria")
    const app = todo.groups.find((g) => g.key === "approveCriteria")
    expect(doc?.count).toBe(2)
    expect(app?.count).toBe(1)
    expect(doc?.items[0]?.href).toBe("/model/method")
    expect(todo.total).toBe(3)
  })

  it("orders groups describe, evaluate, document, approve and caps items at MAX_ITEMS while count stays full", () => {
    const roles = Array.from({ length: 6 }, (_, i) =>
      role({ roleId: `r${i}`, slug: `r-${i}`, profileComplete: false })
    )
    const todo = buildTodo({
      roles: [
        ...roles,
        role({
          roleId: "e1",
          slug: "e-1",
          profileComplete: true,
          ratedCount: 1,
          totalCriteria: 9,
        }),
      ],
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
      ...method([{ criterionId: "c1", name: "Scope", status: "documented" }]),
    })
    expect(todo.groups.map((g) => g.key)).toEqual([
      "describeRoles",
      "evaluateRoles",
      "approveCriteria",
    ])
    const describe = todo.groups[0]
    expect(describe?.count).toBe(6)
    expect(describe?.items).toHaveLength(MAX_ITEMS)
    expect(todo.total).toBe(8)
  })

  it("treats a null method as no criteria groups", () => {
    const todo = buildTodo({
      roles: [],
      ...NO_MODEL,
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
    })
    expect(todo).toEqual({ groups: [], total: 0 })
  })

  it("puts unconfirmed title groups first as classifyPeople, counting awaiting people", () => {
    const todo = buildTodo({
      roles: [role({ profileComplete: false })],
      ...NO_MODEL,
      payMappingRuns: OPEN_RUN,
      peopleByTitle: [
        {
          // One suggested + one unassigned: both awaiting confirmation.
          title: "Sales Manager",
          people: [
            {
              currentAssignment: { roleId: "r2", senioritySource: "suggested" },
            },
            { currentAssignment: null },
          ],
        },
        {
          // Fully confirmed: nothing to do, excluded.
          title: "Backend Engineer",
          people: [
            {
              currentAssignment: { roleId: "r1", senioritySource: "confirmed" },
            },
          ],
        },
      ],
    })
    expect(todo.groups.map((g) => g.key)).toEqual([
      "classifyPeople",
      "describeRoles",
    ])
    const g = todo.groups[0]
    expect(g?.count).toBe(1)
    const item = g?.items[0] as {
      title: string | null
      href: string
      peopleCount: number
    }
    expect(item.title).toBe("Sales Manager")
    expect(item.href).toBe("/people/classify")
    expect(item.peopleCount).toBe(2)
    expect(todo.total).toBe(2)
  })

  it("carries the no-title bucket as title null with a stable id", () => {
    const todo = buildTodo({
      roles: [],
      ...NO_MODEL,
      payMappingRuns: OPEN_RUN,
      peopleByTitle: [{ title: null, people: [{ currentAssignment: null }] }],
    })
    const g = todo.groups[0]
    expect(g?.key).toBe("classifyPeople")
    const item = g?.items[0] as { id: string; title: string | null }
    expect(item.title).toBeNull()
    expect(item.id).toBe("__no_title__")
  })

  it("caps classify items at MAX_ITEMS while count stays full", () => {
    const todo = buildTodo({
      roles: [],
      ...NO_MODEL,
      payMappingRuns: OPEN_RUN,
      peopleByTitle: Array.from({ length: 6 }, (_, i) => ({
        title: `Title ${i}`,
        people: [{ currentAssignment: null }],
      })),
    })
    const g = todo.groups[0]
    expect(g?.items).toHaveLength(MAX_ITEMS)
    expect(g?.count).toBe(6)
    expect(todo.total).toBe(6)
  })
})

describe("buildTodo buildModel group", () => {
  it("shows the criteria-incomplete state below MODEL_MIN_CRITERIA, naming how many are chosen, even when the model is otherwise marked approved (state A takes precedence)", () => {
    const todo = buildTodo({
      roles: [],
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
      ...method(
        [
          { criterionId: "c1", name: "Scope", status: "approved" },
          { criterionId: "c2", name: "Impact", status: "documented" },
        ],
        true,
        false
      ),
    })
    const g = todo.groups.find((g) => g.key === "buildModel")
    expect(g?.items).toEqual([
      { id: "buildModel", state: "criteria", href: "/model", selected: 2 },
    ])
    expect(g?.count).toBe(1)
  })

  it("shows the approve state at the Godkännande chapter (never the stale /model/method literal) once the selection clears MODEL_MIN_CRITERIA but the model still carries no current approval", () => {
    const todo = buildTodo({
      roles: [],
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
      ...method(
        [{ criterionId: "c1", name: "Scope", status: "approved" }],
        false
      ),
    })
    const g = todo.groups.find((g) => g.key === "buildModel")
    expect(g?.items).toEqual([
      { id: "buildModel", state: "approve", href: "/model/approval" },
    ])
    expect(g?.count).toBe(1)
  })

  it("keeps the criteria state when the count clears MODEL_MIN_CRITERIA but a station check still fails (coverage-failing-but-count-passing)", () => {
    const criteria = Array.from({ length: MODEL_MIN_CRITERIA }, (_, i) => ({
      criterionId: `c${i}`,
      name: `Criterion ${i}`,
      status: "approved" as const,
    }))
    const todo = buildTodo({
      roles: [],
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
      // Every naive count-only signal reads "done": six criteria chosen,
      // modelApproved true. stationOk: false alone (a broken dimension cap
      // or a mandatory dimension left uncovered, model-chapters.ts's
      // CRITERIA_STATION_CHECKS) must still keep this in the criteria state,
      // never jump to approve, and must not distort the live count shown.
      ...method(criteria, true, false, false),
    })
    const g = todo.groups.find((g) => g.key === "buildModel")
    expect(g?.items).toEqual([
      {
        id: "buildModel",
        state: "criteria",
        href: "/model",
        selected: MODEL_MIN_CRITERIA,
      },
    ])
    expect(g?.count).toBe(1)
  })

  it("hides it once the selection clears MODEL_MIN_CRITERIA and the model is approved", () => {
    const todo = buildTodo({
      roles: [],
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
      ...method(
        [{ criterionId: "c1", name: "Scope", status: "approved" }],
        true
      ),
    })
    expect(todo.groups.map((g) => g.key)).not.toContain("buildModel")
  })

  it("stays hidden while there is no model at all", () => {
    const todo = buildTodo({
      roles: [],
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
      ...NO_MODEL,
    })
    expect(todo.groups.map((g) => g.key)).not.toContain("buildModel")
  })

  // startPayMapping cannot appear alongside buildModel's "approve" state any
  // more (payMappingReady now requires modelApproved too): the two states are
  // mutually exclusive by construction, so this fixture (modelApproved false)
  // can no longer demonstrate "ahead of startPayMapping" the way it once did.
  it("sits FIRST in priority order, ahead of approveCriteria", () => {
    const todo = buildTodo({
      roles: [],
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: [],
      ...method(
        [{ criterionId: "c1", name: "Scope", status: "documented" }],
        false
      ),
    })
    expect(todo.groups.map((g) => g.key)).toEqual([
      "buildModel",
      "approveCriteria",
    ])
  })

  it("sits first even ahead of importPeople, for a fresh org with zero criteria selected", () => {
    const todo = buildTodo({
      roles: [role({ profileComplete: false })],
      ...method([], true, false),
      peopleByTitle: [],
      payMappingRuns: [],
    })
    expect(todo.groups.map((g) => g.key)).toEqual([
      "buildModel",
      "importPeople",
      "describeRoles",
    ])
    expect(todo.groups[0]).toEqual({
      key: "buildModel",
      items: [
        { id: "buildModel", state: "criteria", href: "/model", selected: 0 },
      ],
      count: 1,
    })
  })
})

describe("buildTodo startPayMapping group", () => {
  it("adds it last, after approveCriteria, once the gate is clear and no run is open", () => {
    const todo = buildTodo({
      roles: [],
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: [],
      ...method([{ criterionId: "c1", name: "Scope", status: "documented" }]),
    })
    expect(todo.groups.map((g) => g.key)).toEqual([
      "approveCriteria",
      "startPayMapping",
    ])
    expect(todo.groups[1]?.items).toEqual([
      { id: "startPayMapping", href: "/pay-mappings" },
    ])
    expect(todo.total).toBe(2)
  })

  it("does not add it while a person is unclassified", () => {
    const todo = buildTodo({
      roles: [],
      ...NO_MODEL,
      payMappingRuns: [],
      peopleByTitle: [
        { title: "Sales Manager", people: [{ currentAssignment: null }] },
      ],
    })
    expect(todo.groups.map((g) => g.key)).not.toContain("startPayMapping")
  })

  it("keeps it hidden, and lists the person under classify, when their assignment points to an archived/missing role (C1: listPeopleByTitle exposes this as currentAssignment: null, the same shape as no assignment at all)", () => {
    const todo = buildTodo({
      roles: [],
      ...NO_MODEL,
      payMappingRuns: [],
      peopleByTitle: [
        { title: "Retired Role", people: [{ currentAssignment: null }] },
      ],
    })
    expect(todo.groups.map((g) => g.key)).toEqual(["classifyPeople"])
    expect(todo.groups.map((g) => g.key)).not.toContain("startPayMapping")
  })

  it("does not add it while a staffed role is not fully evaluated", () => {
    const todo = buildTodo({
      roles: [role({ roleId: "r1", ratedCount: 3, totalCriteria: 9 })],
      ...NO_MODEL,
      payMappingRuns: [],
      peopleByTitle: [
        {
          title: "Backend Engineer",
          people: [
            {
              currentAssignment: { roleId: "r1", senioritySource: "confirmed" },
            },
          ],
        },
      ],
    })
    expect(todo.groups.map((g) => g.key)).not.toContain("startPayMapping")
  })

  it("does not add it while a staffed role is fully rated but NOT YET COMPLETED (spec 2.4/6, mirrors computePayMappingPreconditions)", () => {
    const todo = buildTodo({
      roles: [
        role({
          roleId: "r1",
          ratedCount: 9,
          totalCriteria: 9,
          completed: false,
        }),
      ],
      ...NO_MODEL,
      payMappingRuns: [],
      peopleByTitle: [
        {
          title: "Backend Engineer",
          people: [
            {
              currentAssignment: { roleId: "r1", senioritySource: "confirmed" },
            },
          ],
        },
      ],
    })
    expect(todo.groups.map((g) => g.key)).not.toContain("startPayMapping")
    // Still surfaced as needing action, not silently dropped.
    expect(todo.groups.map((g) => g.key)).toContain("evaluateRoles")
  })

  // ...method([]) (an approved model, zero non-filler criteria, so it
  // contributes no document/approve items of its own), not NO_MODEL: these
  // three are about role/run state, and now that payMappingReady also reads
  // the model, NO_MODEL would block on the model instead of the thing each
  // test actually names, per its own title.
  it("adds it once that same staffed role is completed", () => {
    const todo = buildTodo({
      roles: [
        role({
          roleId: "r1",
          ratedCount: 9,
          totalCriteria: 9,
          completed: true,
        }),
      ],
      ...method([]),
      payMappingRuns: [],
      peopleByTitle: [
        {
          title: "Backend Engineer",
          people: [
            {
              currentAssignment: { roleId: "r1", senioritySource: "confirmed" },
            },
          ],
        },
      ],
    })
    expect(todo.groups.map((g) => g.key)).toEqual(["startPayMapping"])
  })

  it("does not block on an unstaffed role that is not fully evaluated", () => {
    const todo = buildTodo({
      roles: [role({ roleId: "r1", profileComplete: false })],
      ...method([]),
      payMappingRuns: [],
      peopleByTitle: PEOPLE_NEUTRAL,
    })
    expect(todo.groups.map((g) => g.key)).toEqual([
      "describeRoles",
      "startPayMapping",
    ])
  })

  it("does not add it while a non-completed run already exists", () => {
    const todo = buildTodo({
      roles: [],
      ...NO_MODEL,
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: [{ status: "underReview" }],
    })
    expect(todo.groups.map((g) => g.key)).not.toContain("startPayMapping")
  })

  it("adds it once every existing run is completed", () => {
    const todo = buildTodo({
      roles: [],
      ...method([]),
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: [{ status: "completed" }, { status: "completed" }],
    })
    expect(todo.groups.map((g) => g.key)).toEqual(["startPayMapping"])
  })

  it("never adds it for an org with no model at all, even once every other precondition (people, staffed role) is met", () => {
    const todo = buildTodo({
      roles: [
        role({
          roleId: "r1",
          ratedCount: 9,
          totalCriteria: 9,
          completed: true,
        }),
      ],
      ...NO_MODEL,
      payMappingRuns: [],
      peopleByTitle: [
        {
          title: "Backend Engineer",
          people: [
            {
              currentAssignment: { roleId: "r1", senioritySource: "confirmed" },
            },
          ],
        },
      ],
    })
    expect(todo.groups.map((g) => g.key)).not.toContain("startPayMapping")
  })

  it("hides it and shows the buildModel approve entry instead once a previously-approved model's approval is reopened, even though people and roles are otherwise fully ready", () => {
    const todo = buildTodo({
      roles: [
        role({
          roleId: "r1",
          ratedCount: 9,
          totalCriteria: 9,
          completed: true,
        }),
      ],
      // modelApproved: false, station checks otherwise clean: the criteria
      // selection itself is done, only the model's own approval is missing
      // (the "reopened" state: a method-affecting edit fell it back to
      // draft), same as a method-affecting mutation would leave it.
      ...method([], false),
      payMappingRuns: [],
      peopleByTitle: [
        {
          title: "Backend Engineer",
          people: [
            {
              currentAssignment: { roleId: "r1", senioritySource: "confirmed" },
            },
          ],
        },
      ],
    })
    const buildModel = todo.groups.find((g) => g.key === "buildModel")
    expect(buildModel?.items).toEqual([
      { id: "buildModel", state: "approve", href: "/model/approval" },
    ])
    expect(todo.groups.map((g) => g.key)).not.toContain("startPayMapping")
  })
})

describe("buildTodo importPeople group", () => {
  it("puts the import row first, alone, when the org has no people", () => {
    const todo = buildTodo({
      roles: [],
      ...NO_MODEL,
      peopleByTitle: [],
      payMappingRuns: [],
    })
    expect(todo.groups.map((g) => g.key)).toEqual(["importPeople"])
    expect(todo.groups[0]?.items).toEqual([
      { id: "importPeople", href: "/people/import" },
    ])
    expect(todo.total).toBe(1)
  })

  it("never reads the pay-mapping gate as ready while the org is empty", () => {
    const todo = buildTodo({
      roles: [],
      peopleByTitle: [],
      payMappingRuns: [],
      ...method([{ criterionId: "c1", name: "Scope", status: "approved" }]),
    })
    expect(todo.groups.map((g) => g.key)).toEqual(["importPeople"])
    expect(todo.groups.map((g) => g.key)).not.toContain("startPayMapping")
  })

  it("keeps the import row while a run is somehow open, and drops it once people exist", () => {
    const empty = buildTodo({
      roles: [],
      ...NO_MODEL,
      peopleByTitle: [],
      payMappingRuns: OPEN_RUN,
    })
    expect(empty.groups.map((g) => g.key)).toEqual(["importPeople"])
    const staffed = buildTodo({
      roles: [],
      ...NO_MODEL,
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: OPEN_RUN,
    })
    expect(staffed.groups.map((g) => g.key)).not.toContain("importPeople")
  })
})

describe("buildOverviewStats", () => {
  it("reports totalPeople 0 when the org holds no people", () => {
    const stats = buildOverviewStats({
      roles: [],
      ...NO_MODEL,
      peopleByTitle: [],
      payMappingRuns: [],
    })
    expect(stats.totalPeople).toBe(0)
    expect(stats.unclassifiedCount).toBe(0)
  })

  it("mirrors buildTodo's per-domain counts for a mixed fixture", () => {
    const input = {
      roles: [
        role({ roleId: "r1", slug: "r-1", profileComplete: false }),
        role({
          roleId: "r2",
          slug: "r-2",
          profileComplete: true,
          ratedCount: 2,
          totalCriteria: 9,
        }),
      ],
      ...method([
        { criterionId: "c1", name: "Scope", status: "notStarted" },
        { criterionId: "c2", name: "Risk", status: "documented" },
      ]),
      peopleByTitle: [
        {
          title: "Sales Manager",
          people: [
            {
              currentAssignment: {
                roleId: "r3",
                senioritySource: "suggested" as const,
              },
            },
          ],
        },
      ],
      payMappingRuns: OPEN_RUN,
    }
    const stats = buildOverviewStats(input)
    expect(stats.describeCount).toBe(1)
    expect(stats.evaluateCount).toBe(1)
    expect(stats.documentCount).toBe(1)
    expect(stats.approveCount).toBe(1)
    expect(stats.unclassifiedCount).toBe(1)
    // Cross-check against buildTodo's own groups for the same input.
    const todo = buildTodo(input)
    const describe = todo.groups.find((g) => g.key === "describeRoles")
    const evaluate = todo.groups.find((g) => g.key === "evaluateRoles")
    expect(describe?.count).toBe(stats.describeCount)
    expect(evaluate?.count).toBe(stats.evaluateCount)
  })
})

// The AGGREGATE that replaced the list. The flag lives on the role's chip in
// /work and the act in its sheet (masterdokument 14.8); this is the only place
// left that says how many placements are waiting, so a register nobody opened
// today still surfaces them.
describe("buildTodo reviewPlacements", () => {
  function reviewable(over: Partial<Parameters<typeof role>[0]> = {}) {
    // A finished, placed role: past describe and past evaluate, so it can
    // reach the review branch at all.
    return role({
      profileComplete: true,
      ratedCount: 9,
      totalCriteria: 9,
      completed: true,
      level: 4,
      ...over,
    })
  }

  function reviewGroup(roles: ReturnType<typeof role>[]) {
    const todo = buildTodo({
      roles,
      ...NO_MODEL,
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: [],
    })
    return todo.groups.find((g) => g.key === "reviewPlacements")
  }

  it("says nothing when no placement raises a question", () => {
    expect(reviewGroup([reviewable()])).toBeUndefined()
  })

  it.each([
    ["capped", { profileLimited: true }],
    ["stale", { methodDrift: true }],
    ["deviating anchor", { anchorExpectedLevel: 2 }],
  ])("counts a %s placement", (_name, over) => {
    const group = reviewGroup([reviewable(over)])
    expect(group?.count).toBe(1)
    expect(group?.items[0]?.href).toBe("/work")
  })

  // The count is the FOLD's total, so it can never name a different set of
  // roles than the ladder marks: one role raising three questions is one
  // count, and a confirmed cap stops counting.
  it("counts roles, not questions, and drops what has been answered", () => {
    expect(
      reviewGroup([
        reviewable(),
        reviewable({ roleId: "a", profileLimited: true }),
        reviewable({
          roleId: "b",
          profileLimited: true,
          methodDrift: true,
          anchorExpectedLevel: 2,
        }),
        reviewable({ roleId: "c", profileLimited: true, calibrated: true }),
        reviewable({ roleId: "d", completed: false, profileLimited: true }),
      ])?.count
    ).toBe(2)
  })

  // The defect this block did not catch: every test above read the GROUP's
  // count, and the front page reads todo.total, which hand-listed the eight
  // other sources and left this one out. It said "1 thing to do" while
  // rendering two groups.
  it("counts its roles in the total, not only in its own group", () => {
    const todo = buildTodo({
      roles: [reviewable({ roleId: "a", profileLimited: true })],
      ...NO_MODEL,
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: [],
    })
    expect(todo.groups.find((g) => g.key === "reviewPlacements")?.count).toBe(1)
    expect(todo.total).toBe(1)
  })

  // A role still waiting to be rated belongs to evaluateRoles: it has no
  // placement to review yet, and a role in two groups is one job counted twice.
  it("leaves an unfinished role to the evaluate group alone", () => {
    const todo = buildTodo({
      roles: [
        reviewable({ ratedCount: 3, completed: false, profileLimited: true }),
      ],
      ...NO_MODEL,
      peopleByTitle: PEOPLE_NEUTRAL,
      payMappingRuns: [],
    })
    expect(
      todo.groups.find((g) => g.key === "reviewPlacements")
    ).toBeUndefined()
    expect(todo.groups.find((g) => g.key === "evaluateRoles")?.count).toBe(1)
  })
})

// The invariant that makes the group above impossible to lose again: the
// total is the groups' own counts summed, so it can never name a different
// amount of work than the list beside it. Asserted over fixtures that
// exercise every group rather than one, because the defect was a group
// falling out of a second hand-written list, not a wrong count.
describe("buildTodo total agrees with its groups", () => {
  const CASES: [string, Parameters<typeof buildTodo>[0]][] = [
    [
      "an empty org",
      { roles: [], ...NO_MODEL, peopleByTitle: [], payMappingRuns: OPEN_RUN },
    ],
    [
      "unclassified people and roles to describe",
      {
        roles: [role({ roleId: "r1" }), role({ roleId: "r2" })],
        ...NO_MODEL,
        peopleByTitle: [
          { title: "A", people: [{ currentAssignment: null }] },
          { title: "B", people: [{ currentAssignment: null }] },
        ],
        payMappingRuns: OPEN_RUN,
      },
    ],
    [
      "placements to review beside roles to evaluate",
      {
        roles: [
          role({
            roleId: "reviewable",
            profileComplete: true,
            ratedCount: 9,
            totalCriteria: 9,
            completed: true,
            level: 4,
            profileLimited: true,
          }),
          role({
            roleId: "unrated",
            profileComplete: true,
            ratedCount: 3,
            totalCriteria: 9,
          }),
        ],
        ...NO_MODEL,
        peopleByTitle: PEOPLE_NEUTRAL,
        payMappingRuns: OPEN_RUN,
      },
    ],
  ]

  it.each(CASES)("holds for %s", (_name, input) => {
    const todo = buildTodo(input)
    expect(todo.total).toBe(
      todo.groups.reduce((sum, group) => sum + group.count, 0)
    )
  })

  // Not vacuous: at least one case has to produce more than one group, or the
  // assertion above passes on an empty list forever.
  it("covers a fixture with several groups at once", () => {
    const counts = CASES.map(([, input]) => buildTodo(input).groups.length)
    expect(Math.max(...counts)).toBeGreaterThan(1)
  })
})

import { describe, expect, it } from "vitest"
import { buildTodo, MAX_ITEMS } from "./todo"

const role = (
  over: Partial<Parameters<typeof buildTodo>[0]["roles"][number]> = {}
) => ({
  roleId: "r1",
  title: "Backend Engineer",
  slug: "backend-engineer",
  ratedCount: 0,
  totalCriteria: 9,
  profileComplete: true,
  familyName: "Engineering",
  ...over,
})

const method = (
  criteria: {
    criterionId: string
    name: string
    status: "notStarted" | "inProgress" | "documented" | "approved"
  }[]
) => ({ criteria })

// An open (non-completed) run: the neutral default for tests that are not
// about the startPayMapping group itself, so a vacuously "ready" empty-input
// fixture (no people, no staffed roles) never sprouts an unrelated extra
// group and desyncs total/groups assertions written before that group existed.
const OPEN_RUN = [{ status: "active" as const }]

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
      method: null,
      peopleByTitle: [],
      payMappingRuns: OPEN_RUN,
    })
    expect(todo.groups.map((g) => g.key)).toEqual(["describeRoles"])
    expect(todo.groups[0]?.items[0]?.href).toBe("/roles/backend-engineer")
    expect(todo.total).toBe(1)
  })

  it("routes a profiled, partly-rated role to evaluateRoles with progress + rate link", () => {
    const todo = buildTodo({
      roles: [role({ profileComplete: true, ratedCount: 3, totalCriteria: 9 })],
      method: null,
      peopleByTitle: [],
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

  it("excludes a profiled, fully-rated role from every group", () => {
    const todo = buildTodo({
      roles: [role({ profileComplete: true, ratedCount: 9, totalCriteria: 9 })],
      method: null,
      peopleByTitle: [],
      payMappingRuns: OPEN_RUN,
    })
    expect(todo.total).toBe(0)
    expect(todo.groups).toEqual([])
  })

  it("splits criteria into document (notStarted/inProgress) and approve (documented); approved is done", () => {
    const todo = buildTodo({
      roles: [],
      peopleByTitle: [],
      payMappingRuns: OPEN_RUN,
      method: method([
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
      peopleByTitle: [],
      payMappingRuns: OPEN_RUN,
      method: method([
        { criterionId: "c1", name: "Scope", status: "documented" },
      ]),
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
      method: null,
      peopleByTitle: [],
      payMappingRuns: OPEN_RUN,
    })
    expect(todo).toEqual({ groups: [], total: 0 })
  })

  it("puts unconfirmed title groups first as classifyPeople, counting awaiting people", () => {
    const todo = buildTodo({
      roles: [role({ profileComplete: false })],
      method: null,
      payMappingRuns: OPEN_RUN,
      peopleByTitle: [
        {
          // One suggested + one unassigned: both awaiting confirmation.
          title: "Sales Manager",
          people: [
            { currentAssignment: { roleId: "r2", levelSource: "suggested" } },
            { currentAssignment: null },
          ],
        },
        {
          // Fully confirmed: nothing to do, excluded.
          title: "Backend Engineer",
          people: [
            { currentAssignment: { roleId: "r1", levelSource: "confirmed" } },
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
      method: null,
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
      method: null,
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

describe("buildTodo startPayMapping group", () => {
  it("adds it last, after approveCriteria, once the gate is clear and no run is open", () => {
    const todo = buildTodo({
      roles: [],
      peopleByTitle: [],
      payMappingRuns: [],
      method: method([
        { criterionId: "c1", name: "Scope", status: "documented" },
      ]),
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
      method: null,
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
      method: null,
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
      method: null,
      payMappingRuns: [],
      peopleByTitle: [
        {
          title: "Backend Engineer",
          people: [
            { currentAssignment: { roleId: "r1", levelSource: "confirmed" } },
          ],
        },
      ],
    })
    expect(todo.groups.map((g) => g.key)).not.toContain("startPayMapping")
  })

  it("does not block on an unstaffed role that is not fully evaluated", () => {
    const todo = buildTodo({
      roles: [role({ roleId: "r1", profileComplete: false })],
      method: null,
      payMappingRuns: [],
      peopleByTitle: [],
    })
    expect(todo.groups.map((g) => g.key)).toEqual([
      "describeRoles",
      "startPayMapping",
    ])
  })

  it("does not add it while a non-completed run already exists", () => {
    const todo = buildTodo({
      roles: [],
      method: null,
      peopleByTitle: [],
      payMappingRuns: [{ status: "underReview" }],
    })
    expect(todo.groups.map((g) => g.key)).not.toContain("startPayMapping")
  })

  it("adds it once every existing run is completed", () => {
    const todo = buildTodo({
      roles: [],
      method: null,
      peopleByTitle: [],
      payMappingRuns: [{ status: "completed" }, { status: "completed" }],
    })
    expect(todo.groups.map((g) => g.key)).toEqual(["startPayMapping"])
  })
})

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
    })
    expect(todo.groups.map((g) => g.key)).toEqual(["describeRoles"])
    expect(todo.groups[0]?.items[0]?.href).toBe("/roles/backend-engineer")
    expect(todo.total).toBe(1)
  })

  it("routes a profiled, partly-rated role to evaluateRoles with progress + rate link", () => {
    const todo = buildTodo({
      roles: [role({ profileComplete: true, ratedCount: 3, totalCriteria: 9 })],
      method: null,
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
    })
    expect(todo.total).toBe(0)
    expect(todo.groups).toEqual([])
  })

  it("splits criteria into document (notStarted/inProgress) and approve (documented); approved is done", () => {
    const todo = buildTodo({
      roles: [],
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
    const todo = buildTodo({ roles: [], method: null })
    expect(todo).toEqual({ groups: [], total: 0 })
  })
})

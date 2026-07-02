// Pure derivation of the front-page "To do" from the existing role + method
// queries. No stored aggregate (derive, like score/band). The profileComplete
// gate splits roles: a role without a profile can only be described, never
// evaluated. Only non-empty groups are returned, in priority order.
export const MAX_ITEMS = 4

export type TodoGroupKey =
  | "describeRoles"
  | "evaluateRoles"
  | "documentCriteria"
  | "approveCriteria"

export type RoleItem = {
  id: string
  title: string
  href: string
  family?: string
}
export type EvaluateItem = RoleItem & {
  ratedCount: number
  totalCriteria: number
}
export type CriterionItem = {
  id: string
  title: string
  href: string
  status: "notStarted" | "inProgress" | "documented"
}

export type TodoGroup =
  | { key: "describeRoles"; items: RoleItem[]; count: number }
  | { key: "evaluateRoles"; items: EvaluateItem[]; count: number }
  | { key: "documentCriteria"; items: CriterionItem[]; count: number }
  | { key: "approveCriteria"; items: CriterionItem[]; count: number }

export type Todo = { groups: TodoGroup[]; total: number }

// The subset of each query's return that buildTodo reads. The Convex return
// types are supersets, so useTodo passes them straight through.
type TodoRole = {
  roleId: string
  title: string
  slug: string
  ratedCount: number
  totalCriteria: number
  profileComplete: boolean
  familyName: string | null
}
type TodoMethod = {
  criteria: {
    criterionId: string
    name: string
    status: "notStarted" | "inProgress" | "documented" | "approved"
  }[]
} | null

export type BuildTodoInput = { roles: TodoRole[]; method: TodoMethod }

export function buildTodo({ roles, method }: BuildTodoInput): Todo {
  const describe: RoleItem[] = []
  const evaluate: EvaluateItem[] = []
  for (const r of roles) {
    const family = r.familyName ?? undefined
    if (!r.profileComplete) {
      describe.push({
        id: r.roleId,
        title: r.title,
        href: `/roles/${r.slug}`,
        family,
      })
    } else if (r.ratedCount < r.totalCriteria) {
      evaluate.push({
        id: r.roleId,
        title: r.title,
        href: `/roles/${r.slug}/rate`,
        family,
        ratedCount: r.ratedCount,
        totalCriteria: r.totalCriteria,
      })
    }
  }

  const documentItems: CriterionItem[] = []
  const approveItems: CriterionItem[] = []
  for (const c of method?.criteria ?? []) {
    if (c.status === "notStarted" || c.status === "inProgress") {
      documentItems.push({
        id: c.criterionId,
        title: c.name,
        href: "/model/method",
        status: c.status,
      })
    } else if (c.status === "documented") {
      approveItems.push({
        id: c.criterionId,
        title: c.name,
        href: "/model/method",
        status: "documented",
      })
    }
  }

  const groups: TodoGroup[] = []
  if (describe.length > 0)
    groups.push({
      key: "describeRoles",
      items: describe.slice(0, MAX_ITEMS),
      count: describe.length,
    })
  if (evaluate.length > 0)
    groups.push({
      key: "evaluateRoles",
      items: evaluate.slice(0, MAX_ITEMS),
      count: evaluate.length,
    })
  if (documentItems.length > 0)
    groups.push({
      key: "documentCriteria",
      items: documentItems.slice(0, MAX_ITEMS),
      count: documentItems.length,
    })
  if (approveItems.length > 0)
    groups.push({
      key: "approveCriteria",
      items: approveItems.slice(0, MAX_ITEMS),
      count: approveItems.length,
    })

  const total =
    describe.length +
    evaluate.length +
    documentItems.length +
    approveItems.length
  return { groups, total }
}

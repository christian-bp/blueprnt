// Pure derivation of the front-page "To do" from the existing role + method
// queries. No stored aggregate (derive, like score/band). The profileComplete
// gate splits roles: a role without a profile can only be described, never
// evaluated. Only non-empty groups are returned, in priority order.
export const MAX_ITEMS = 4

export type TodoGroupKey =
  | "importPeople"
  | "classifyPeople"
  | "describeRoles"
  | "evaluateRoles"
  | "documentCriteria"
  | "approveCriteria"
  | "startPayMapping"

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
// One imported job title still waiting for a confirmed classification.
// title: null is the no-title bucket (the component renders its label);
// peopleCount is the people in the group awaiting confirmation.
export type ClassifyItem = {
  id: string
  title: string | null
  href: string
  peopleCount: number
}
// The single "go start it" row once the pay-mapping gate is clear.
export type StartPayMappingItem = { id: string; href: string }
// The single "import your employees" row while the org holds no people.
export type ImportPeopleItem = { id: string; href: string }

export type TodoGroup =
  | { key: "importPeople"; items: ImportPeopleItem[]; count: number }
  | { key: "classifyPeople"; items: ClassifyItem[]; count: number }
  | { key: "describeRoles"; items: RoleItem[]; count: number }
  | { key: "evaluateRoles"; items: EvaluateItem[]; count: number }
  | { key: "documentCriteria"; items: CriterionItem[]; count: number }
  | { key: "approveCriteria"; items: CriterionItem[]; count: number }
  | { key: "startPayMapping"; items: StartPayMappingItem[]; count: number }

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
type TodoTitleGroup = {
  title: string | null
  people: {
    currentAssignment: {
      roleId: string
      levelSource: "suggested" | "confirmed"
    } | null
  }[]
}
type PayMappingRunStatus = "active" | "paused" | "underReview" | "completed"
// label is optional only so existing buildTodo fixtures (which never read
// it) keep type-checking unchanged; the real listPayMappingRuns query always
// supplies a non-empty one.
type TodoPayMappingRun = {
  status: PayMappingRunStatus
  label?: string
}

export type BuildTodoInput = {
  roles: TodoRole[]
  method: TodoMethod
  peopleByTitle: TodoTitleGroup[]
  payMappingRuns: TodoPayMappingRun[]
}

// One pass over the four queries, shared by buildTodo (the grouped to-do
// list) and buildOverviewStats (the overview widget cards), so the two views
// can never disagree about what still needs attention.
function computeCounts({
  roles,
  method,
  peopleByTitle,
  payMappingRuns,
}: BuildTodoInput) {
  // Classification first: after a payroll import it is the freshest work, and
  // people must sit in roles before any analysis can use them. One item per
  // imported title still holding people without a confirmed assignment
  // ("classified" = confirmed, matching countClassified and the tab badge).
  const classify: ClassifyItem[] = []
  for (const group of peopleByTitle) {
    const awaiting = group.people.filter(
      (p) => p.currentAssignment?.levelSource !== "confirmed"
    ).length
    if (awaiting > 0) {
      classify.push({
        id: group.title ?? "__no_title__",
        title: group.title,
        href: "/people/classify",
        peopleCount: awaiting,
      })
    }
  }

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

  // With no people at all, every other check below is vacuously clear, so
  // the whole journey starts with the import. One row, first in priority,
  // and the pay-mapping gate never reads as ready meanwhile.
  const totalPeople = peopleByTitle.reduce(
    (sum, group) => sum + group.people.length,
    0
  )

  // The pay-mapping gate's own readiness, mirroring the backend's shared
  // precondition helper exactly: every person classified (a confirmed open
  // assignment) and every STAFFED role (holding at least one open
  // assignment, any confirmation state) resolves a band (fully rated). An
  // unstaffed role's evaluation state never blocks this, unlike
  // describe/evaluate above, which track every role regardless of staffing.
  const totalUnclassified = classify.reduce(
    (sum, item) => sum + item.peopleCount,
    0
  )
  const staffedRoleIds = new Set<string>()
  for (const group of peopleByTitle) {
    for (const person of group.people) {
      if (person.currentAssignment !== null) {
        staffedRoleIds.add(person.currentAssignment.roleId)
      }
    }
  }
  const isRoleEvaluated = (r: TodoRole) =>
    r.totalCriteria > 0 && r.ratedCount === r.totalCriteria
  const unevaluatedStaffedRoles = roles.filter(
    (r) => staffedRoleIds.has(r.roleId) && !isRoleEvaluated(r)
  )
  const payMappingReady =
    totalPeople > 0 &&
    totalUnclassified === 0 &&
    unevaluatedStaffedRoles.length === 0
  const hasOpenRun = payMappingRuns.some((run) => run.status !== "completed")
  const isOpenRun = (
    run: TodoPayMappingRun
  ): run is TodoPayMappingRun & {
    status: Exclude<PayMappingRunStatus, "completed">
  } => run.status !== "completed"
  const openRun = payMappingRuns.find(isOpenRun)

  return {
    classify,
    describe,
    evaluate,
    documentItems,
    approveItems,
    totalPeople,
    totalUnclassified,
    unevaluatedStaffedRoles,
    payMappingReady,
    hasOpenRun,
    openRun,
  }
}

export function buildTodo(input: BuildTodoInput): Todo {
  const c = computeCounts(input)

  const groups: TodoGroup[] = []
  if (c.totalPeople === 0)
    groups.push({
      key: "importPeople",
      items: [{ id: "importPeople", href: "/people/import" }],
      count: 1,
    })
  if (c.classify.length > 0)
    groups.push({
      key: "classifyPeople",
      items: c.classify.slice(0, MAX_ITEMS),
      count: c.classify.length,
    })
  if (c.describe.length > 0)
    groups.push({
      key: "describeRoles",
      items: c.describe.slice(0, MAX_ITEMS),
      count: c.describe.length,
    })
  if (c.evaluate.length > 0)
    groups.push({
      key: "evaluateRoles",
      items: c.evaluate.slice(0, MAX_ITEMS),
      count: c.evaluate.length,
    })
  if (c.documentItems.length > 0)
    groups.push({
      key: "documentCriteria",
      items: c.documentItems.slice(0, MAX_ITEMS),
      count: c.documentItems.length,
    })
  if (c.approveItems.length > 0)
    groups.push({
      key: "approveCriteria",
      items: c.approveItems.slice(0, MAX_ITEMS),
      count: c.approveItems.length,
    })

  // Rendered as its own final group only once the gate is clear AND no
  // non-completed run is already in flight (nothing left to start).
  const startPayMapping = c.payMappingReady && !c.hasOpenRun
  if (startPayMapping) {
    groups.push({
      key: "startPayMapping",
      items: [{ id: "startPayMapping", href: "/pay-mappings" }],
      count: 1,
    })
  }

  const total =
    (c.totalPeople === 0 ? 1 : 0) +
    c.classify.length +
    c.describe.length +
    c.evaluate.length +
    c.documentItems.length +
    c.approveItems.length +
    (startPayMapping ? 1 : 0)
  return { groups, total }
}

// The overview front page's state: one entry per widget card's narrative.
export type OverviewStats = {
  totalPeople: number
  unclassifiedCount: number
  describeCount: number
  evaluateCount: number
  documentCount: number
  approveCount: number
}

// Derives the overview widget cards' state from the same counting pass
// buildTodo groups from (DRY: one pass, two views).
export function buildOverviewStats(input: BuildTodoInput): OverviewStats {
  const c = computeCounts(input)

  return {
    totalPeople: c.totalPeople,
    unclassifiedCount: c.totalUnclassified,
    describeCount: c.describe.length,
    evaluateCount: c.evaluate.length,
    documentCount: c.documentItems.length,
    approveCount: c.approveItems.length,
  }
}

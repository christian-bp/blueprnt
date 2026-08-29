import {
  Briefcase01Icon,
  ChartColumnIcon,
  Layers01Icon,
  Stairs01Icon,
  Structure01Icon,
  Tag01Icon,
  Tick02Icon,
  UserGroup03Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { type MethodCheck, methodBlockersPass } from "@workspace/core"
import { calibrationReason } from "@/lib/calibration-queue"
import { chapterHref, modelChapterProgress } from "@/lib/model-chapters"

// Pure derivation of the front-page "To do" from the existing role + method
// queries. No stored aggregate (derive, like score/level). The profileComplete
// gate splits roles: a role without a profile can only be described, never
// evaluated. Only non-empty groups are returned, in priority order.
export const MAX_ITEMS = 4

export type TodoGroupKey =
  | "buildModel"
  | "importPeople"
  | "classifyPeople"
  | "describeRoles"
  | "evaluateRoles"
  | "reviewPlacements"
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
// The state-aware "build the company's model" row, first in priority order
// (the whole evaluation journey depends on it): while the criteria selection
// itself is not yet done by the Kriterier chapter's own definition
// (modelChapterProgress, which also fails a selection that clears
// MODEL_MIN_CRITERIA by raw count but still breaks a dimension cap or misses
// a mandatory dimension), `selected` names how many are chosen so far and
// href sends the admin through the bare /model redirect into that chapter;
// once the selection is done but the model still lacks a current approval
// (ADR-0023, distinct from per-criterion approveCriteria), it becomes the
// approve state, href pointing straight at the Godkännande chapter. The two
// states are mutually exclusive.
export type BuildModelItem =
  | { id: "buildModel"; state: "criteria"; href: string; selected: number }
  | { id: "buildModel"; state: "approve"; href: string }

export type TodoGroup =
  | { key: "buildModel"; items: BuildModelItem[]; count: number }
  | { key: "importPeople"; items: ImportPeopleItem[]; count: number }
  | { key: "classifyPeople"; items: ClassifyItem[]; count: number }
  | { key: "describeRoles"; items: RoleItem[]; count: number }
  | { key: "evaluateRoles"; items: EvaluateItem[]; count: number }
  | { key: "reviewPlacements"; items: RoleItem[]; count: number }
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
  // Completing is the reveal (spec 2.4/6): a fully-rated role is still open,
  // and the pay-mapping gate (computePayMappingPreconditions) refuses it,
  // until this is true. Sourced from listRoles' own completed field.
  completed: boolean
  // The calibration facts the review group folds, straight off listRoles.
  level: number | null
  calibrated: boolean
  methodDrift: boolean
  profileLimited: boolean | null
  anchorExpectedLevel: number | null
  familyName: string | null
}
type TodoMethod = {
  criteria: {
    criterionId: string
    name: string
    status: "notStarted" | "inProgress" | "documented" | "approved"
  }[]
  // The model's own approval (ADR-0023), distinct from a criterion's own
  // `status === "approved"` above: a model can have every criterion
  // individually approved and still lack this, or vice versa.
  modelApproved: boolean
} | null
// The slice of getMethodChecks buildModel's criteria-incomplete/ready-to-
// approve boundary (and payMappingReady's own belt-and-braces check below)
// needs: the raw checks array, at the engine's own MethodCheck shape (level
// included, not narrowed to model-chapters.ts's leaner ModelProgressCheck),
// so a selection that clears the raw MODEL_MIN_CRITERIA count by number but
// still fails a dimension cap or misses a mandatory dimension's coverage
// keeps reading as incomplete here exactly like it does on the Kriterier
// chapter itself (model-chapters.ts's CRITERIA_STATION_CHECKS), instead of
// jumping straight to "ready to approve", AND so payMappingReady can reuse
// the SAME methodBlockersPass the backend gate re-checks with rather than
// re-deriving which keys are blockers.
type TodoMethodChecks = { checks: readonly MethodCheck[] } | null
type TodoTitleGroup = {
  title: string | null
  people: {
    currentAssignment: {
      roleId: string
      senioritySource: "suggested" | "confirmed"
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
  methodChecks: TodoMethodChecks
  peopleByTitle: TodoTitleGroup[]
  payMappingRuns: TodoPayMappingRun[]
}

// One pass over the five queries, shared by buildTodo (the grouped to-do
// list) and buildOverviewStats (the overview widget cards), so the two views
// can never disagree about what still needs attention.
function computeCounts({
  roles,
  method,
  methodChecks,
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
      (p) => p.currentAssignment?.senioritySource !== "confirmed"
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
  // Placements a person still has to look at (masterdokument 14.8). The flag
  // itself lives on the role's chip in /work and the act in its sheet; this is
  // the AGGREGATE, on the app's one attention surface, so a register nobody
  // has opened today still says how many are waiting. It replaces the list
  // section that used to carry that job on /work itself.
  const review: RoleItem[] = []
  for (const r of roles) {
    const family = r.familyName ?? undefined
    // A fully-rated role whose assessment is not yet completed still needs
    // action (spec 2.4/6: completing is the reveal, and the pay-mapping gate
    // below refuses it until then), so it stays in the evaluate group rather
    // silently disappearing from the to-do once its ratings are done. Gated
    // on totalCriteria > 0 so a role under a not-yet-built model (no
    // criteria at all, "completed" trivially false) is not wrongly flagged.
    const needsRating = r.ratedCount < r.totalCriteria
    const needsCompleting =
      r.totalCriteria > 0 && r.ratedCount === r.totalCriteria && !r.completed
    if (!r.profileComplete) {
      describe.push({
        id: r.roleId,
        title: r.title,
        href: `/roles/${r.slug}`,
        family,
      })
    } else if (needsRating || needsCompleting) {
      evaluate.push({
        id: r.roleId,
        title: r.title,
        href: `/roles/${r.slug}/rate`,
        family,
        ratedCount: r.ratedCount,
        totalCriteria: r.totalCriteria,
      })
    } else if (
      calibrationReason({
        completed: r.completed,
        level: r.level,
        calibrated: r.calibrated,
        methodDrift: r.methodDrift,
        profileLimited: r.profileLimited,
        // ?? null, not === null: an older deployed listRoles has no such
        // field at all, and { expectedLevel: undefined } would read as a
        // deviating anchor and inflate the count.
        anchor:
          r.anchorExpectedLevel == null
            ? null
            : { expectedLevel: r.anchorExpectedLevel },
      }) !== null
    ) {
      // The SAME fold the chip and the sheet read, so the number here can
      // never name a different set of roles than the ladder marks.
      review.push({
        id: r.roleId,
        title: r.title,
        href: "/work",
        family,
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
  // The model itself (spec 2.7), read ahead of documentItems/approveItems
  // above: the bare /model redirect lands in the Kriterier chapter (so no
  // chapter segment is hardcoded here) while the criteria selection itself
  // is not yet DONE by the chapter's own definition; once it is but the
  // model still carries no current approval (ADR-0023), the model needs its
  // own approve step, sent straight to the Godkännande chapter via
  // chapterHref rather than a literal path. A model that clears both is done
  // and contributes nothing here.
  //
  // "Done" is modelChapterProgress's own criteria-chapter reading (the same
  // derivation the Kriterier chapter's progress spine uses), not a naive
  // count against MODEL_MIN_CRITERIA: a selection of six or more that still
  // breaks a dimension cap or leaves a mandatory dimension uncovered stays
  // capped below the chapter's total there, so it keeps showing the build
  // entry here too instead of jumping straight to "ready to approve". The
  // raw `criteriaSelected` count still drives the incomplete state's own "N
  // of 6-8" copy: a reader picking criteria wants the number they actually
  // chose, not a value the station checks can cap below it.
  const criteriaSelected = method?.criteria.length ?? 0
  const criteriaProgress = methodChecks
    ? modelChapterProgress(
        {
          checks: methodChecks.checks,
          // Both unread by the "criteria" case of modelChapterProgress (the
          // approval chapter consults one, the weighting chapter the other);
          // supplied for the input's shape only.
          approved: method?.modelApproved ?? false,
          weightsSaved: false,
        },
        "criteria"
      )
    : null
  const criteriaDone =
    criteriaProgress !== null && criteriaProgress.done >= criteriaProgress.total
  const buildModel: BuildModelItem | null =
    method === null
      ? null
      : !criteriaDone
        ? {
            id: "buildModel",
            state: "criteria",
            href: "/model",
            selected: criteriaSelected,
          }
        : method.modelApproved
          ? null
          : {
              id: "buildModel",
              state: "approve",
              href: chapterHref("approval"),
            }

  // With no people at all, every other check below is vacuously clear, so
  // the whole journey starts with the import. One row, first in priority,
  // and the pay-mapping gate never reads as ready meanwhile.
  const totalPeople = peopleByTitle.reduce(
    (sum, group) => sum + group.people.length,
    0
  )

  // The pay-mapping gate's own readiness, mirroring the backend's shared
  // precondition helper exactly (computePayMappingPreconditions): every
  // person classified (a confirmed open assignment) and every STAFFED role
  // (holding at least one open assignment, any confirmation state) is both
  // fully rated AND COMPLETED (spec 2.4/6: an assessment that is fully rated
  // and still open is not a revealed evaluation, so it blocks the gate exactly
  // like an unrated role), AND the model itself carries a CURRENT approval
  // (ADR-0023) that still clears its own checklist. An unstaffed role's
  // evaluation state never blocks this, unlike describe/evaluate above, which
  // track every role regardless of staffing.
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
  const isRoleReady = (r: TodoRole) =>
    r.totalCriteria > 0 && r.ratedCount === r.totalCriteria && r.completed
  const unevaluatedStaffedRoles = roles.filter(
    (r) => staffedRoleIds.has(r.roleId) && !isRoleReady(r)
  )
  // modelApproved alone mirrors what the buildModel group above already
  // reads; methodBlockersPass alongside it is the same belt-and-braces
  // re-check computePayMappingPreconditions runs server-side (reusing the
  // engine's own methodBlockersPass rather than re-deriving which checks are
  // blockers), so this client-side reading can never drift from the
  // authority even if a future mutation forgets to reopen approval on a
  // blocker-moving edit.
  const modelReady =
    (method?.modelApproved ?? false) &&
    methodChecks !== null &&
    methodBlockersPass([...methodChecks.checks])
  const payMappingReady =
    totalPeople > 0 &&
    totalUnclassified === 0 &&
    unevaluatedStaffedRoles.length === 0 &&
    modelReady
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
    review,
    documentItems,
    approveItems,
    buildModel,
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
  // First in priority order (spec 2.7): the whole evaluation journey depends
  // on the model, so it leads even the import row.
  if (c.buildModel !== null)
    groups.push({
      key: "buildModel",
      items: [c.buildModel],
      count: 1,
    })
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
  if (c.review.length > 0)
    groups.push({
      key: "reviewPlacements",
      items: c.review.slice(0, MAX_ITEMS),
      count: c.review.length,
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

  // Derived from the groups themselves, never re-listed. A hand-written sum
  // over the same eight sources is a second copy of the list above, and it
  // silently lost reviewPlacements: the front page said "1 thing to do" while
  // rendering two groups. Every group already carries the count it contributes
  // (the full length, not the MAX_ITEMS-capped preview), so the reduce is the
  // same number by construction, and a new group cannot ship uncounted.
  const total = groups.reduce((sum, group) => sum + group.count, 0)
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

// Where each kind of outstanding work is done, for every group EXCEPT
// buildModel: its destination is state-dependent (the criteria-incomplete
// state redirects through /model, the approve state through the Godkännande
// chapter), so it carries its own href on its single item instead (see
// groupHref below). Still total over the rest of the group keys, so a new
// to-do group cannot ship without a destination. Lives here with the rest of
// the to-do model because two surfaces render these groups (the front page's
// To do band and the sidebar's to-do block) and they must never disagree on
// where a group leads or which glyph it wears.
const GROUP_HREF: Record<Exclude<TodoGroupKey, "buildModel">, string> = {
  importPeople: "/people/import",
  classifyPeople: "/people/classify",
  describeRoles: "/roles",
  evaluateRoles: "/roles",
  reviewPlacements: "/work",
  documentCriteria: "/model/method",
  approveCriteria: "/model/method",
  startPayMapping: "/pay-mappings",
}

// buildModel reads its own item's href (state-dependent, derived above);
// every other group resolves through the static map. buildTodo always
// populates exactly one item for that key; the fallback only satisfies
// noUncheckedIndexedAccess, never a real render path.
export function groupHref(group: TodoGroup): string {
  if (group.key === "buildModel") return group.items[0]?.href ?? "/model"
  return GROUP_HREF[group.key]
}

// Icon DATA, not rendered elements (the lib/navigation.ts convention), so
// this module stays framework free.
export const GROUP_ICONS: Record<TodoGroupKey, IconSvgElement> = {
  buildModel: Structure01Icon,
  importPeople: UserGroup03Icon,
  classifyPeople: Tag01Icon,
  describeRoles: Briefcase01Icon,
  evaluateRoles: Briefcase01Icon,
  reviewPlacements: Stairs01Icon,
  documentCriteria: Layers01Icon,
  approveCriteria: Tick02Icon,
  startPayMapping: ChartColumnIcon,
}

// Whether a group's count is a real QUANTITY of waiting items, or the group
// is a single act (build the model, import your employees, start the
// mapping) whose count is structurally 1. A "1" beside an act reads as
// noise, so the sidebar's to-do rows badge only the quantity groups, the
// same boundary the overview's groupDetail draws when it names the act
// instead of counting to one. Total over the keys, so a new group cannot
// ship without deciding which kind it is.
export const GROUP_COUNT_IS_QUANTITY: Record<TodoGroupKey, boolean> = {
  buildModel: false,
  importPeople: false,
  classifyPeople: true,
  describeRoles: true,
  evaluateRoles: true,
  reviewPlacements: true,
  documentCriteria: true,
  approveCriteria: true,
  startPayMapping: false,
}

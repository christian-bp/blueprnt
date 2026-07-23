// The single review journey's step queue (ADR-0012): a pure derivation from
// the run's gap result, its documentation rows, its collaboration record,
// and whether the org has an earlier completed kartläggning. No React, no
// Convex, no clock: the journey shell drives its wizard purely off this
// queue.
import { BASE_PRAXIS_AREA_KEYS, type PraxisAreaKey } from "@workspace/constants"
import {
  equalWorkGroupRequiresDocumentation,
  type PayGapFlag,
  womenDominatedGroupRequiresDocumentation,
} from "@workspace/core"
import type {
  GapGroup,
  GroupAnalysis,
  PayMappingGapResult,
  WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"

export type ReviewStep =
  | { kind: "start" }
  | { kind: "praxis"; area: PraxisAreaKey }
  | { kind: "chapterIntro"; chapter: "equalWork" | "equivalentWork" }
  | { kind: "group"; scope: "equalWork"; group: GapGroup }
  | { kind: "group"; scope: "equivalentWork"; group: WomenDominatedGroupWire }
  | { kind: "finish" }

export interface ReviewQueue {
  steps: ReviewStep[]
  // Index of the first actionable step whose done-state is unmet; the
  // finish index when everything is done.
  resumeIndex: number
  // Actionable progress (intros/finish excluded): done / total, per chapter
  // and overall.
  progress: {
    overall: { done: number; total: number }
    praxis: { done: number; total: number }
    equalWork: { done: number; total: number }
    equivalentWork: { done: number; total: number }
    collaborationDone: boolean
  }
}

export interface ReviewQueueInput {
  gap: PayMappingGapResult
  analyses: GroupAnalysis[]
  collaboration: { participants: string; description: string } | null
  hasPreviousCompletedRun: boolean
}

// Attention first: the severity scale, worst on top.
const FLAG_RANK: Record<PayGapFlag, number> = {
  critical: 0,
  elevated: 1,
  ok: 2,
  insufficient: 3,
}

// Worklist order for the equal-work view: worst flag first, then the widest
// gap, then a stable key order. The equivalent-work view keeps the engine's
// own delivered order instead (comparison count desc, then band asc, then
// key; see womenDominatedComparisons in @workspace/core), so it never calls
// this.
function sortGroupsByAttention(groups: GapGroup[]): GapGroup[] {
  return [...groups].sort((a, b) => {
    const rank = FLAG_RANK[a.flag] - FLAG_RANK[b.flag]
    if (rank !== 0) return rank
    const gapA = a.gapPct === null ? -1 : Math.abs(a.gapPct)
    const gapB = b.gapPct === null ? -1 : Math.abs(b.gapPct)
    if (gapA !== gapB) return gapB - gapA
    return a.key.localeCompare(b.key)
  })
}

// A stable, unique-per-step string: React keys and jump-menu targets in
// later tasks key off this instead of the step's array index.
export function stepKey(step: ReviewStep): string {
  switch (step.kind) {
    case "start":
      return "start"
    case "praxis":
      return `praxis:${step.area}`
    case "chapterIntro":
      return `intro:${step.chapter}`
    case "group":
      return `${step.scope}:${step.group.key}`
    case "finish":
      return "finish"
  }
}

// Whether a step's own documentation obligation is satisfied. chapterIntro
// and finish carry no obligation of their own (they are excluded from
// progress and from the resumeIndex scan), so they are trivially done.
export function isStepDone(step: ReviewStep, input: ReviewQueueInput): boolean {
  switch (step.kind) {
    case "start": {
      const collaboration = input.collaboration
      return (
        collaboration !== null &&
        collaboration.participants.trim() !== "" &&
        collaboration.description.trim() !== ""
      )
    }
    case "praxis":
      return input.analyses.some(
        (a) => a.scope === "praxis" && a.groupKey === step.area && a.done
      )
    case "group":
      return input.analyses.some(
        (a) => a.scope === step.scope && a.groupKey === step.group.key && a.done
      )
    case "chapterIntro":
    case "finish":
      return true
  }
}

// The step counter's position advances only on actionable steps (an intro
// or the finish screen freezes it at whatever the last actionable step
// already reached).
function isActionable(step: ReviewStep): boolean {
  return (
    step.kind === "start" || step.kind === "praxis" || step.kind === "group"
  )
}

export function buildReviewQueue(input: ReviewQueueInput): ReviewQueue {
  const { gap, hasPreviousCompletedRun } = input

  const praxisAreas: PraxisAreaKey[] = hasPreviousCompletedRun
    ? [...BASE_PRAXIS_AREA_KEYS, "previousActions"]
    : [...BASE_PRAXIS_AREA_KEYS]

  const requiringEqualWork = sortGroupsByAttention(
    gap.equalWork.filter((group) =>
      equalWorkGroupRequiresDocumentation(group.flag)
    )
  )

  const requiringWomenDominated = gap.womenDominated.filter((group) =>
    womenDominatedGroupRequiresDocumentation(group.comparisons.length)
  )

  const steps: ReviewStep[] = [
    { kind: "start" },
    ...praxisAreas.map((area): ReviewStep => ({ kind: "praxis", area })),
    { kind: "chapterIntro", chapter: "equalWork" },
    ...requiringEqualWork.map(
      (group): ReviewStep => ({ kind: "group", scope: "equalWork", group })
    ),
    { kind: "chapterIntro", chapter: "equivalentWork" },
    ...requiringWomenDominated.map(
      (group): ReviewStep => ({
        kind: "group",
        scope: "equivalentWork",
        group,
      })
    ),
    { kind: "finish" },
  ]

  const finishIndex = steps.length - 1
  const firstUndoneIndex = steps.findIndex(
    (step) => isActionable(step) && !isStepDone(step, input)
  )
  const resumeIndex = firstUndoneIndex === -1 ? finishIndex : firstUndoneIndex

  const praxisSteps = steps.filter((step) => step.kind === "praxis")
  const equalWorkSteps = steps.filter(
    (step) => step.kind === "group" && step.scope === "equalWork"
  )
  const equivalentWorkSteps = steps.filter(
    (step) => step.kind === "group" && step.scope === "equivalentWork"
  )

  const doneCount = (list: ReviewStep[]) =>
    list.filter((step) => isStepDone(step, input)).length

  const praxisDone = doneCount(praxisSteps)
  const equalWorkDone = doneCount(equalWorkSteps)
  const equivalentWorkDone = doneCount(equivalentWorkSteps)
  const collaborationDone = isStepDone({ kind: "start" }, input)

  const overallTotal =
    1 + praxisSteps.length + equalWorkSteps.length + equivalentWorkSteps.length
  const overallDone =
    (collaborationDone ? 1 : 0) +
    praxisDone +
    equalWorkDone +
    equivalentWorkDone

  return {
    steps,
    resumeIndex,
    progress: {
      overall: { done: overallDone, total: overallTotal },
      praxis: { done: praxisDone, total: praxisSteps.length },
      equalWork: { done: equalWorkDone, total: equalWorkSteps.length },
      equivalentWork: {
        done: equivalentWorkDone,
        total: equivalentWorkSteps.length,
      },
      collaborationDone,
    },
  }
}

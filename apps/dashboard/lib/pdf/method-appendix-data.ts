// Pure assembler: turns the getMethodModel query result plus the library's
// own content into the structured content of the metodbilaga, and computes
// the DRAFT/FINAL status. No React, no i18n, no side effects, so it is fully
// unit-testable. The library inputs are passed in rather than imported, so
// the assembly stays a function of its arguments.
import {
  LEVEL_RULES,
  ZONE_KEYS,
  ZONE_LEVEL_RANGES,
  ZONE_PROFILE_RULES,
  type ZoneKey,
} from "@workspace/core"
import { resolveAnchorSteps } from "@/lib/anchors"

type BiasRisk = "low" | "medium" | "high"
type Status = "notStarted" | "inProgress" | "documented" | "approved"

export type MethodModel = {
  modelName: string
  pointBudget: number
  workingConditions: {
    status: "active" | "testedNotMaterial"
    motivation: string
    decidedAt: number
  } | null
  criteria: readonly {
    criterionId: string
    libraryKey: string
    name: string
    description: string
    weightPoints: number
    share: number
    order: number
    purpose: string | null
    whyRelevant: string | null
    overlapNotes: string | null
    biasRisk: BiasRisk | null
    biasComment: string | null
    biasAction: string | null
    status: Status
    decidedByName: string | null
    decidedAt: number | null
  }[]
  progress: { documented: number; approved: number; total: number }
}

// The library content the appendix quotes: the shared scale, the midpoint
// copy, and each criterion's own anchors, keyed as the library keys them.
export type MethodAppendixLibrary = {
  sharedScale: Record<string, { name: string; meaning: string }>
  midpoints: { step2: string; step4: string }
  anchorsByKey: Record<
    string,
    readonly { step: number; text: string }[] | undefined
  >
}

export type AppendixCriterion = MethodModel["criteria"][number] & {
  // The full 1-5 ladder the criterion is rated against, midpoints resolved.
  anchors: { step: number; text: string }[]
}

export type MethodAppendixDoc = {
  status: "draft" | "final"
  modelName: string
  pointBudget: number
  biasStatement: string
  scaleSteps: { step: number; name: string; meaning: string }[]
  criteria: AppendixCriterion[]
  // The twelve thresholds grouped under their zones, highest zone first, with
  // each zone's profile gate (null = no requirement, the weighting alone).
  zones: {
    key: ZoneKey
    name: string
    levels: { level: number; minScore: number }[]
    minStep: number | null
  }[]
  workingConditions: MethodModel["workingConditions"]
}

export function assembleMethodAppendix(
  model: MethodModel,
  library: MethodAppendixLibrary,
  zoneNames: Record<ZoneKey, string>,
  labels: { biasStatement: string }
): MethodAppendixDoc {
  const status =
    model.progress.total > 0 && model.progress.approved === model.progress.total
      ? "final"
      : "draft"
  // The ladder and the zone gates are method law (packages/core), not org
  // content, so the appendix documents the constants rather than a copy of
  // them travelling alongside the org's own criteria.
  const minStepByZone = new Map(
    ZONE_PROFILE_RULES.map((rule) => [rule.zone, rule.minStep])
  )
  const ruleByLevel = new Map(
    LEVEL_RULES.map((rule) => [rule.level, rule.minScore])
  )
  return {
    status,
    modelName: model.modelName,
    pointBudget: model.pointBudget,
    biasStatement: labels.biasStatement,
    scaleSteps: [1, 2, 3, 4, 5].map((step) => ({
      step,
      name: library.sharedScale[`${step}`]?.name ?? "",
      meaning: library.sharedScale[`${step}`]?.meaning ?? "",
    })),
    criteria: [...model.criteria]
      .sort((a, b) => a.order - b.order)
      .map((criterion) => ({
        ...criterion,
        anchors: resolveAnchorSteps(
          library.anchorsByKey[criterion.libraryKey] ?? [],
          library.midpoints
        ),
      })),
    zones: ZONE_KEYS.map((zone) => ({
      key: zone,
      name: zoneNames[zone],
      levels: Array.from(
        {
          length: ZONE_LEVEL_RANGES[zone].to - ZONE_LEVEL_RANGES[zone].from + 1,
        },
        (_, index) => {
          const level = ZONE_LEVEL_RANGES[zone].from + index
          return { level, minScore: ruleByLevel.get(level) ?? 0 }
        }
      ),
      minStep: minStepByZone.get(zone) ?? null,
    })),
    workingConditions: model.workingConditions,
  }
}

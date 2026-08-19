// Pure assembler: turns the getMethodModel query result into the structured
// content of the metodbilaga, and computes the DRAFT/FINAL status. No React,
// no i18n, no side effects, so it is fully unit-testable.
type BiasRisk = "low" | "medium" | "high"
type Status = "notStarted" | "inProgress" | "documented" | "approved"

export type MethodModel = {
  modelName: string
  pointBudget: number
  levelRules: readonly { level: number; minScore: number }[]
  criteria: readonly {
    criterionId: string
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

export type MethodAppendixDoc = {
  status: "draft" | "final"
  modelName: string
  pointBudget: number
  biasStatement: string
  criteria: MethodModel["criteria"]
  levelRules: { level: number; minScore: number }[]
}

export function assembleMethodAppendix(
  model: MethodModel,
  labels: { biasStatement: string }
): MethodAppendixDoc {
  const status =
    model.progress.total > 0 && model.progress.approved === model.progress.total
      ? "final"
      : "draft"
  return {
    status,
    modelName: model.modelName,
    pointBudget: model.pointBudget,
    biasStatement: labels.biasStatement,
    criteria: [...model.criteria].sort((a, b) => a.order - b.order),
    levelRules: [...model.levelRules].sort((a, b) => a.level - b.level),
  }
}

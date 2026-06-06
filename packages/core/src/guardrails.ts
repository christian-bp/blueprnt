import type { GuardrailRange, GuardrailWarning, RatingInput } from "./types"

// Advisory only (PLAN-V1 9.3): warnings never block saving or approval.
// One warning per guardrail whose criterion has a rating outside [min, max].
// Output order follows the guardrails input order.
export function checkGuardrails(
  ratings: RatingInput[],
  guardrails: GuardrailRange[]
): GuardrailWarning[] {
  const valueById = new Map<string, RatingInput["value"]>()
  for (const rating of ratings) {
    if (valueById.has(rating.criterionId)) {
      throw new Error(`duplicate rating: ${rating.criterionId}`)
    }
    valueById.set(rating.criterionId, rating.value)
  }
  const warnings: GuardrailWarning[] = []
  for (const guardrail of guardrails) {
    const value = valueById.get(guardrail.criterionId)
    if (value === undefined) continue
    if (value < guardrail.min || value > guardrail.max) {
      warnings.push({
        criterionId: guardrail.criterionId,
        value,
        min: guardrail.min,
        max: guardrail.max,
      })
    }
  }
  return warnings
}

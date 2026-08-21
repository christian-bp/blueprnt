import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Mirrors MAX_WEIGHT_MOTIVATION in evaluationModel/criteria.ts, the same
// client/server pairing makeCriterionComplianceSchema already has: the backend
// is what decides, this is only the gate that keeps the reader from typing past
// it and losing the save.
const MAX = 2000

// Client gate for the weight-motivation form. Required, unlike the compliance
// texts: this form exists to answer a warning, and saving it empty would close
// the dialog having changed nothing while looking like it did.
export function makeWeightMotivationSchema(t: ValidationT) {
  return z.object({
    motivation: z
      .string()
      .trim()
      .min(1, t("required"))
      .max(MAX, t("maxLength")),
  })
}

export type WeightMotivationValues = z.infer<
  ReturnType<typeof makeWeightMotivationSchema>
>

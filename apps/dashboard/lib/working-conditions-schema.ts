import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

const MAX = 2000

// Client gate for the approval card's working-conditions decision control
// (evaluationModel/approval.ts's setWorkingConditionsDecision). Motivation is
// always required (unlike the criterion compliance form's optional fields):
// the backend refuses an empty one with motivationRequired either way, so the
// client gate matches that law rather than being more lenient than the server.
export function makeWorkingConditionsSchema(t: ValidationT) {
  return z.object({
    status: z.enum(["active", "testedNotMaterial"]),
    motivation: z
      .string()
      .trim()
      .min(1, t("required"))
      .max(MAX, t("maxLength")),
  })
}

export type WorkingConditionsValues = z.infer<
  ReturnType<typeof makeWorkingConditionsSchema>
>

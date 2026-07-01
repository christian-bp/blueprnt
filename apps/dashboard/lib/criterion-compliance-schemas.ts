import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

const MAX = 2000

// Client gate for the criterion compliance form. All fields are optional so
// partial progress can be saved; the editor gates Save on isDirty and gates
// Approve on the server-computed status (which requires the documented subset).
// The backend re-validates.
export function makeCriterionComplianceSchema(t: ValidationT) {
  return z.object({
    purpose: z.string().max(MAX, t("maxLength")),
    whyRelevant: z.string().max(MAX, t("maxLength")),
    overlapNotes: z.string().max(MAX, t("maxLength")),
    biasRisk: z.enum(["low", "medium", "high"]).optional(),
    biasComment: z.string().max(MAX, t("maxLength")),
    biasAction: z.string().max(MAX, t("maxLength")),
  })
}

export type CriterionComplianceValues = z.infer<
  ReturnType<typeof makeCriterionComplianceSchema>
>

import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Client gate for the shared criterion form: only the name is required. The six
// anchors are a fixed-length array of (possibly empty) strings. The backend
// re-validates.
export function makeCriterionSchema(t: ValidationT) {
  return z.object({
    name: z.string().trim().min(1, t("required")),
    description: z.string(),
    helpText: z.string(),
    anchors: z.array(z.string()).length(6),
  })
}
// The single source of truth for the criterion form's value shape; the form and
// its host dialogs all consume this (never a parallel hand-written interface).
export type CriterionFormValues = z.infer<
  ReturnType<typeof makeCriterionSchema>
>

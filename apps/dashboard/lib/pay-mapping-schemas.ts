import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// A pay mapping's label has one rule, and both surfaces that set it use it:
// starting a run and renaming one. The reference date and the frozen model
// snapshot are set by the backend at call time (startPayMappingRun), never
// entered by the user.
export function makeRunLabelSchema(t: ValidationT) {
  return z.object({
    label: z.string().trim().min(1, t("required")),
  })
}
export type RunLabelValues = z.infer<ReturnType<typeof makeRunLabelSchema>>

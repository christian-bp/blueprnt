import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Client gate for starting a pay mapping: the only input is a label. The
// reference date and the frozen model snapshot are set by the backend at
// call time (startPayMappingRun), never entered by the user.
export function makeStartRunSchema(t: ValidationT) {
  return z.object({
    label: z.string().trim().min(1, t("required")),
  })
}
export type StartRunValues = z.infer<ReturnType<typeof makeStartRunSchema>>

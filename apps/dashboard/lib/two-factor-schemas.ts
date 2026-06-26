import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Password re-confirmation before enable().
export function makeConfirmPasswordSchema(t: ValidationT) {
  return z.object({
    password: z.string().min(1, t("required")),
  })
}
export type ConfirmPasswordValues = z.infer<
  ReturnType<typeof makeConfirmPasswordSchema>
>

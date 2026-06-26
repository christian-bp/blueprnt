import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// 6-digit code field shared by the setup and challenge screens.
export function makeCodeSchema(t: ValidationT) {
  return z.object({
    code: z.string().regex(/^\d{6}$/, t("required")),
  })
}
export type CodeValues = z.infer<ReturnType<typeof makeCodeSchema>>

// Password re-confirmation before enable().
export function makeConfirmPasswordSchema(t: ValidationT) {
  return z.object({
    password: z.string().min(1, t("required")),
  })
}
export type ConfirmPasswordValues = z.infer<
  ReturnType<typeof makeConfirmPasswordSchema>
>

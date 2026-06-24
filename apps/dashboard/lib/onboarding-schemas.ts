import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Client gates for the onboarding single-field screens. The backend re-validates
// (Better Auth org create/update; the model mutations); these drive the inline
// field error.

export function makeOrgNameSchema(t: ValidationT) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, t("minLength", { min: 2 })),
  })
}
export type OrgNameValues = z.infer<ReturnType<typeof makeOrgNameSchema>>

export function makeScratchNameSchema(t: ValidationT) {
  return z.object({ scratchName: z.string().trim().min(1, t("required")) })
}
export type ScratchNameValues = z.infer<
  ReturnType<typeof makeScratchNameSchema>
>

import { z } from "zod"
import type { ValidationT } from "@/lib/validation"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-schemas"

// Client-side Zod schema factories for the account settings forms.
// The server (Convex) re-validates independently; these drive inline field errors.

export function makeProfileNameSchema(t: ValidationT) {
  return z.object({ name: z.string().trim().min(1, t("required")) })
}
export type ProfileNameValues = z.infer<
  ReturnType<typeof makeProfileNameSchema>
>

export function makeChangeEmailSchema(t: ValidationT, currentEmail: string) {
  return z.object({
    email: z
      .string()
      .trim()
      .email(t("invalidEmail"))
      .refine((v) => v.toLowerCase() !== currentEmail.toLowerCase(), {
        message: t("emailUnchanged"),
      }),
  })
}
export type ChangeEmailValues = z.infer<
  ReturnType<typeof makeChangeEmailSchema>
>

export function makeChangePasswordSchema(t: ValidationT) {
  return z
    .object({
      currentPassword: z.string().min(1, t("required")),
      newPassword: z
        .string()
        .min(MIN_PASSWORD_LENGTH, t("minLength", { min: MIN_PASSWORD_LENGTH })),
      confirmPassword: z.string(),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      message: t("passwordsMatch"),
      path: ["confirmPassword"],
    })
}
export type ChangePasswordValues = z.infer<
  ReturnType<typeof makeChangePasswordSchema>
>

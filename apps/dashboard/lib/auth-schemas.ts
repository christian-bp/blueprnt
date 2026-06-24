import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Client gates for the auth forms. Better Auth re-validates on the server; these
// drive the inline field errors.

export function makeSignInSchema(t: ValidationT) {
  return z.object({
    email: z.string().trim().email(t("invalidEmail")),
    password: z.string().min(1, t("required")),
  })
}
export type SignInValues = z.infer<ReturnType<typeof makeSignInSchema>>

export function makeForgotPasswordSchema(t: ValidationT) {
  return z.object({ email: z.string().trim().email(t("invalidEmail")) })
}
export type ForgotPasswordValues = z.infer<
  ReturnType<typeof makeForgotPasswordSchema>
>

// Mirrors better-auth's minPasswordLength (the server stays authoritative).
export const MIN_PASSWORD_LENGTH = 8
export function makeResetPasswordSchema(t: ValidationT) {
  return z.object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, t("minLength", { min: MIN_PASSWORD_LENGTH })),
  })
}
export type ResetPasswordValues = z.infer<
  ReturnType<typeof makeResetPasswordSchema>
>

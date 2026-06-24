import { SLUG_PATTERN } from "@workspace/constants"
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Client gates for the platform-admin forms. The backend re-validates with
// Convex validators + appError codes; these schemas drive the form and are the
// single client-side source of form rules. They are factories so messages are
// translated (FormMessage stays vendor-pure).

export function makeCreateUserSchema(t: ValidationT) {
  return z.object({
    name: z.string().trim().min(1, t("required")),
    email: z.string().trim().toLowerCase().email(t("invalidEmail")),
    orgId: z.string().min(1, t("required")),
    role: z.enum(["admin", "editor"]),
  })
}
export type CreateUserValues = z.infer<ReturnType<typeof makeCreateUserSchema>>

// Lowercase letters, digits, hyphens: the slug doubles as the org's unique
// Better Auth identifier. The pattern is the shared SLUG_PATTERN.
export function makeCreateOrgSchema(t: ValidationT) {
  return z.object({
    name: z.string().trim().min(1, t("required")),
    slug: z
      .string()
      .trim()
      .min(1, t("required"))
      .regex(SLUG_PATTERN, t("slug")),
  })
}
export type CreateOrgValues = z.infer<ReturnType<typeof makeCreateOrgSchema>>

// A user can be added to an organization with a role.
export function makeAddMembershipSchema(t: ValidationT) {
  return z.object({
    orgId: z.string().min(1, t("required")),
    role: z.enum(["admin", "editor"]),
  })
}
export type AddMembershipValues = z.infer<
  ReturnType<typeof makeAddMembershipSchema>
>

// All-optional settings: no messages needed, stays a plain schema.
export const orgSettingsSchema = z.object({
  country: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  language: z.string().trim().optional(),
  industry: z.string().trim().optional(),
})
export type OrgSettingsValues = z.infer<typeof orgSettingsSchema>

export const membershipRole = z.enum(["admin", "editor"])
export type MembershipRole = z.infer<typeof membershipRole>

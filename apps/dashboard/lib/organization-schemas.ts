import { FULL_TIME_HOURS_MAX } from "@workspace/constants"
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Client gates for the organization-settings forms. The backend re-validates
// with Convex validators + appError codes; these factories build the form rules
// with translated messages so FormMessage stays vendor-pure.

// The org profile edit form. Name and full-time hours are required (hours are
// a real stored value from the moment the org has a country, never an empty
// placeholder); the rest are optional selects.
export function makeOrganizationProfileSchema(t: ValidationT) {
  return z.object({
    name: z.string().trim().min(1, t("required")),
    country: z.string().trim().optional(),
    currency: z.string().trim().optional(),
    language: z.string().trim().optional(),
    industry: z.string().trim().optional(),
    fullTimeHoursPerMonth: z
      .number({ error: t("required") })
      .positive()
      .max(FULL_TIME_HOURS_MAX),
  })
}
export type OrganizationProfileValues = z.infer<
  ReturnType<typeof makeOrganizationProfileSchema>
>

// The invite-member form: an email and a role.
export function makeInviteSchema(t: ValidationT) {
  return z.object({
    email: z.string().trim().toLowerCase().email(t("invalidEmail")),
    role: z.enum(["admin", "editor"]),
  })
}
export type InviteValues = z.infer<ReturnType<typeof makeInviteSchema>>

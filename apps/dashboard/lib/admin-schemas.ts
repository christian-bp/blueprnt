import { z } from "zod"

// Client gates for the platform-admin forms. The backend re-validates with
// Convex validators + appError codes; these schemas drive canSubmit and are
// the single client-side source of form rules.

export const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
})
export type CreateUserValues = z.infer<typeof createUserSchema>

// Lowercase letters, digits, hyphens: the slug doubles as the org's unique
// Better Auth identifier.
export const createOrgSchema = z.object({
  name: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})
export type CreateOrgValues = z.infer<typeof createOrgSchema>

export const orgSettingsSchema = z.object({
  country: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  language: z.string().trim().optional(),
  industry: z.string().trim().optional(),
})
export type OrgSettingsValues = z.infer<typeof orgSettingsSchema>

export const membershipRole = z.enum(["admin", "editor"])
export type MembershipRole = z.infer<typeof membershipRole>

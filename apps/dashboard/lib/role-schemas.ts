import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Client gate for the create-role basics. trackKey is the fixed V1 literal union
// (ADR-0006), mirroring the backend trackKeyValidator (the authoritative source);
// an unpicked track (empty string) fails via z.enum. familyId is optional
// (nullable). The backend re-validates.
//
// `existing` (the org's current roles) + `duplicateMessage` let the form catch a
// title that is already taken within the selected family BEFORE submitting, so a
// duplicate never becomes a thrown server error. Role titles are unique within a
// family (case-insensitive); the same title is allowed in a different family, and
// family-less roles form their own group. The backend enforces the same rule as
// the authority (for the concurrent-edit race); this is purely a graceful gate.
export function makeCreateRoleSchema(
  t: ValidationT,
  existing: { title: string; familyId: string | null }[] = [],
  duplicateMessage = ""
) {
  return z
    .object({
      title: z.string().trim().min(1, t("required")),
      roleFunction: z.string().trim().min(1, t("required")),
      team: z.string().trim().min(1, t("required")),
      trackKey: z.enum(["IC", "Lead", "M"], { message: t("required") }),
      familyId: z.string().nullable(),
    })
    .superRefine((data, ctx) => {
      const lowered = data.title.trim().toLowerCase()
      if (lowered === "") return
      const scope = data.familyId ?? null
      const clash = existing.some(
        (role) =>
          (role.familyId ?? null) === scope &&
          role.title.toLowerCase() === lowered
      )
      if (clash) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["title"],
          message: duplicateMessage,
        })
      }
    })
}
export type CreateRoleValues = z.infer<ReturnType<typeof makeCreateRoleSchema>>

// Client gate for renaming a family: a trimmed, non-empty name. The backend
// re-validates length and case-insensitive uniqueness (the authority).
export function makeRenameFamilySchema(t: ValidationT) {
  return z.object({
    name: z.string().trim().min(1, t("required")),
  })
}
export type RenameFamilyValues = z.infer<
  ReturnType<typeof makeRenameFamilySchema>
>

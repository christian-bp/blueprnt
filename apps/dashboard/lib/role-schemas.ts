import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Client gate for the create-role basics. trackKey is the fixed V1 literal union
// (ADR-0006), mirroring the backend trackKeyValidator (the authoritative source);
// an unpicked track (empty string) fails via z.enum. familyId is optional
// (nullable). The backend re-validates.
export function makeCreateRoleSchema(t: ValidationT) {
  return z.object({
    title: z.string().trim().min(1, t("required")),
    roleFunction: z.string().trim().min(1, t("required")),
    team: z.string().trim().min(1, t("required")),
    trackKey: z.enum(["IC", "Lead", "M"], { message: t("required") }),
    familyId: z.string().nullable(),
  })
}
export type CreateRoleValues = z.infer<ReturnType<typeof makeCreateRoleSchema>>

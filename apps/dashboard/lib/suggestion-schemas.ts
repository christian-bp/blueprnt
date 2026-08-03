import { MAX_STARTER_IMPORT_TEXT } from "@workspace/constants"
import { z } from "zod"

// Stored AI suggestion payloads cross a trust boundary before rendering: the
// generation side is already Zod-validated (AI SDK Output.object) and
// server-filtered, but the panels re-parse the persisted suggestedValue so
// nothing malformed is ever shown. A failed parse renders as an empty
// suggestion (nothing to apply), never as broken UI.

export const weightReviewValueSchema = z.object({
  moves: z.array(
    z.object({
      fromCriterionId: z.string(),
      toCriterionId: z.string(),
      points: z.number().int().min(1).max(4),
      motivation: z.string(),
    })
  ),
})

// The onboarding paste-import textarea: client gate for the pasted role
// list (the backend re-validates with the same shared constant).
export const starterImportInputSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_STARTER_IMPORT_TEXT)

export const starterImportValueSchema = z.object({
  families: z.array(
    z.object({
      name: z.string(),
      roles: z.array(z.object({ title: z.string(), trackKey: z.string() })),
    })
  ),
  // Whether the generation clamped the grouping to the import's size caps.
  // Required: the writer always sets it, and pre-launch there is no row worth
  // keeping a reader-side shim for (a proposal predating the field parses as
  // empty and is re-requested, which is what resetting dev data means).
  truncated: z.boolean(),
})

export type StarterImportValue = z.infer<typeof starterImportValueSchema>

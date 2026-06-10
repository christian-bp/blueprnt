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

export type WeightReviewValue = z.infer<typeof weightReviewValueSchema>

export const modelDraftValueSchema = z.object({
  criteria: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      helpText: z.string(),
      weightPoints: z.number().int().min(1).max(5),
      anchors: z.array(z.string()).length(6),
    })
  ),
})

export type ModelDraftValue = z.infer<typeof modelDraftValueSchema>

// The role panel additionally whitelists the field NAMES it renders; this
// schema guards the value shape.
export const roleProfileValueSchema = z.object({
  profile: z.record(z.string(), z.string()),
})

// The onboarding paste-import textarea: client gate for the pasted role
// list (the backend re-validates with the same bounds).
export const starterImportInputSchema = z.string().trim().min(1).max(20_000)

export const starterImportValueSchema = z.object({
  families: z.array(
    z.object({
      name: z.string(),
      roles: z.array(z.object({ title: z.string(), trackKey: z.string() })),
    })
  ),
})

export type StarterImportValue = z.infer<typeof starterImportValueSchema>

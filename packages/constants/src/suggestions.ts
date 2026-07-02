// AI suggestion kinds, shared by the Convex backend (target.kind) and the
// dashboard panels (newestByKind lookups) so a typo cannot silently break a
// flow. Values are persisted in the suggestions table; never repurpose one.
export const SUGGESTION_KINDS = {
  modelDraft: "model.draft",
  weightReview: "model.weightReview",
  roleProfile: "role.profile",
  starterImport: "starter.import",
  criterionCompliance: "criterion.compliance",
} as const

export type SuggestionKind =
  (typeof SUGGESTION_KINDS)[keyof typeof SUGGESTION_KINDS]

// The paste-import textarea limit, enforced by the client Zod gate and
// re-validated by the backend mutation. One constant so they cannot drift.
export const MAX_STARTER_IMPORT_TEXT = 20_000

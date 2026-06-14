// Provider identity for suggestion provenance. Plain constants so the
// default-runtime mutation surface (suggest.ts) can import them without
// pulling the Node-only AI SDK into the V8 bundle.
export const AI_PROVIDER = "mistral"
// AI_MODEL_ID (Large 3) is the quality-defining default for the
// evaluation-model/criteria draft, weight review, and starter import.
// AI_PROFILE_MODEL_ID (Small 4) is the fast/cheap model for high-volume
// role-profile drafting. Both are Mistral La Plateforme (EU); the AI Gateway
// stays forbidden (ADR-0001/0003). Both are env-overridable.
export const AI_MODEL_ID = process.env.MISTRAL_MODEL ?? "mistral-large-latest"
export const AI_PROFILE_MODEL_ID =
  process.env.MISTRAL_PROFILE_MODEL ?? "mistral-small-latest"

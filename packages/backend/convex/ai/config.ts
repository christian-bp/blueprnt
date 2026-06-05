// Provider identity for suggestion provenance. Plain constants so the
// default-runtime mutation surface (suggest.ts) can import them without
// pulling the Node-only AI SDK into the V8 bundle.
export const AI_PROVIDER = "mistral"
export const AI_MODEL_ID = process.env.MISTRAL_MODEL ?? "mistral-large-latest"

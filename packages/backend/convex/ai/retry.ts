// mistral-small (the fast role-profile model) intermittently returns a
// COMPLETE, well-formed response that still fails the output schema: a Zod
// TypeValidationError (a field trips a constraint) or no parseable object at
// all. The AI SDK's own maxRetries only rides out transport errors (429, 5xx,
// network), never these, so a single bad generation would fail the whole
// profile call and leave roles unfilled. The model is stochastic, so simply
// regenerating almost always validates on the next attempt.
//
// Matched by error NAME so this stays free of any "ai" SDK import (it must run
// in the edge-runtime test environment): AI_NoObjectGeneratedError is the
// schema/parse miss, AI_NoOutputGeneratedError is an empty completion.
export function isSchemaMiss(error: unknown): boolean {
  const name = error instanceof Error ? error.name : ""
  return (
    name === "AI_NoObjectGeneratedError" || name === "AI_NoOutputGeneratedError"
  )
}

// Run an object-generating call, regenerating up to `attempts` times when the
// model returns a non-conforming object. Any other error (model unavailable,
// abort, rate limit the SDK already exhausted) propagates immediately. After
// the last attempt the final schema-miss error is rethrown so the caller's
// existing failure path runs unchanged.
export async function withSchemaRetry<T>(
  generate: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await generate()
    } catch (error) {
      if (!isSchemaMiss(error)) throw error
      lastError = error
    }
  }
  throw lastError
}

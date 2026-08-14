"use node"

import { createMistral } from "@ai-sdk/mistral"
import { AI_EMBEDDING_MODEL_ID, AI_MODEL_ID } from "./config"
import { nextRetryDelayMs } from "./embedRetry"

// ADR-0003: AI calls happen only in Convex actions against an EU-hosted
// model. This module is the single provider swap point (Mistral La
// Plateforme EU default; Azure OpenAI EU Data Zone is the documented
// fallback). NEVER route through Vercel AI Gateway: it cannot pin EU
// residency (ADR-0001). The model id is now a parameter (default =
// AI_MODEL_ID) so callers pick the faster profile model where appropriate.
export function aiModel(modelId: string = AI_MODEL_ID) {
  const apiKey = process.env.MISTRAL_API_KEY
  if (apiKey === undefined || apiKey === "") return null
  return createMistral({ apiKey })(modelId)
}

// The embedding calls are the only place a retry can be installed: the RAG
// component calls embedMany itself and exposes no retry budget, so nothing
// the caller passes to rag.add can raise it. Without this a single 429
// aborts a whole corpus sync. Scoped to the embedding provider on purpose:
// the assistant's streaming path surfaces rate limits deliberately and must
// keep doing so.
async function embeddingFetch(
  ...args: Parameters<typeof globalThis.fetch>
): Promise<Response> {
  // A stream body can only be sent once, so a retry would send an empty
  // request. Every call from the AI SDK serializes JSON to a string, so this
  // guard never fires today; it keeps the retry from silently corrupting a
  // request if that ever changes.
  const replayable = !(args[1]?.body instanceof ReadableStream)
  let waited = 0
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(...args)
    const delay = replayable
      ? nextRetryDelayMs({
          status: response.status,
          retryAfter: response.headers.get("retry-after"),
          attempt,
          waited,
          now: Date.now(),
        })
      : null
    if (delay === null) return response
    waited += delay
    // The body of a response we are about to discard holds the connection
    // open for the whole backoff otherwise.
    await response.body?.cancel()
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

// The embedding model for documentation search, through the same single
// provider swap point and the same EU constraint as aiModel: an embedding
// call sends documentation text to the provider exactly as a chat call
// sends prompt text, so it is bound by ADR-0001/0003 identically. The custom
// fetch is transport only (same host, same EU endpoint), it just retries.
// Returns null when unconfigured so callers degrade instead of throwing.
export function aiEmbeddingModel(modelId: string = AI_EMBEDDING_MODEL_ID) {
  const apiKey = process.env.MISTRAL_API_KEY
  if (apiKey === undefined || apiKey === "") return null
  return createMistral({ apiKey, fetch: embeddingFetch }).textEmbeddingModel(
    modelId
  )
}

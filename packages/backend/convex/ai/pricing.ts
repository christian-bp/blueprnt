// AI usage cost is stored as integer nano-USD (1e-9 USD) so sub-dollar
// per-million rates stay exact: $0.50 per 1M tokens is exactly 500 nano-USD
// per token. Raw tokens are the source of truth; this estimate is snapshotted
// onto each usage event (ai/usage.ts) so a later price change never rewrites
// historical cost. To change a price, edit this map; do not mutate stored
// rows. Verified for mistral-large-latest against mistral.ai/pricing on
// 2026-06-10 (Mistral Large 3: $0.50/1M input, $1.50/1M output).
interface ModelPrice {
  inNanosPerToken: number
  outNanosPerToken: number
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  "mistral-large-latest": { inNanosPerToken: 500, outNanosPerToken: 1500 },
}

// Returns integer nano-USD, or null when the model has no pricing entry (the
// caller still records the tokens, with cost 0, and logs the gap).
export function estimateCostNanos(
  model: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const price = MODEL_PRICING[model]
  if (price === undefined) return null
  return (
    inputTokens * price.inNanosPerToken + outputTokens * price.outNanosPerToken
  )
}

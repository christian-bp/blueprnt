"use node"

import { createMistral } from "@ai-sdk/mistral"
import { AI_MODEL_ID } from "./config"

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

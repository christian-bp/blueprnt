"use node"

import { createMistral } from "@ai-sdk/mistral"
import { AI_MODEL_ID } from "./config"

// ADR-0003: AI calls happen only in Convex actions against an EU-hosted
// model. This module is the single provider swap point (Mistral La
// Plateforme EU default; Azure OpenAI EU Data Zone is the documented
// fallback). NEVER route through Vercel AI Gateway: it cannot pin EU
// residency (ADR-0001).
export function aiModel() {
  const apiKey = process.env.MISTRAL_API_KEY
  if (apiKey === undefined || apiKey === "") return null
  return createMistral({ apiKey })(AI_MODEL_ID)
}

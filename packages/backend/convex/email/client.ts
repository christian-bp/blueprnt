import { Sweego } from "@christian-ek/sweego"
import { components } from "../_generated/api"

// Sweego owns durable delivery, retries, idempotency, and delivery tracking.
// The API key and webhook signing secret are read from the deployment env
// (SWEEGO_API_KEY / SWEEGO_WEBHOOK_SECRET). Real sends, not dry-run.
export const sweego = new Sweego(components.sweego, {
  webhookToleranceSeconds: 300,
})

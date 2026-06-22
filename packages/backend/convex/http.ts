import { httpRouter } from "convex/server"
import { authComponent, createAuth } from "./auth"
import { sweego } from "./email/client"
import { httpAction } from "./_generated/server"

const http = httpRouter()

authComponent.registerRoutes(http, createAuth)

// Sweego posts delivery events here. The client verifies the HMAC signature
// (SWEEGO_WEBHOOK_SECRET) against the raw body before the component records it.
http.route({
  path: "/webhooks/sweego",
  method: "POST",
  handler: httpAction(async (ctx, req) => sweego.handleSweegoWebhook(ctx, req)),
})

export default http

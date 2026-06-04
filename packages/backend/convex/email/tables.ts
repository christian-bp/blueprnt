import { defineTable } from "convex/server"
import { v } from "convex/values"

// Durable outbox: enqueue is transactional with the triggering write; a
// scheduled action renders + sends. Rows carry recipient PII, so a cron
// deletes sent/failed rows after 30 days (data minimization).
export const emails = defineTable({
  to: v.string(),
  templateKey: v.union(
    v.literal("invitation"),
    v.literal("verifyEmail"),
    v.literal("resetPassword")
  ),
  props: v.any(),
  locale: v.string(),
  status: v.union(
    v.literal("queued"),
    v.literal("sending"),
    v.literal("sent"),
    v.literal("failed")
  ),
  attempts: v.number(),
  providerMessageId: v.optional(v.string()),
  lastError: v.optional(v.string()),
}).index("by_status", ["status"])

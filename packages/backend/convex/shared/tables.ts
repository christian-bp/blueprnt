import { defineTable } from "convex/server"
import { v } from "convex/values"

// Append-only. actorName is snapshotted at write time so audit rows stay
// truthful if a user is later renamed or deleted.
export const auditLog = defineTable({
  orgId: v.string(),
  type: v.string(),
  actorId: v.string(),
  actorName: v.string(),
  payload: v.any(),
})
  .index("by_org", ["orgId"])
  .index("by_org_type", ["orgId", "type"])

// AI suggestion layer (ADR-0003): suggestions with provenance, separate from
// confirmed values. Schema only in this slice; no AI calls yet.
export const suggestions = defineTable({
  orgId: v.string(),
  target: v.object({
    kind: v.string(), // e.g. "role.field" | "criterion.anchor"
    roleId: v.optional(v.id("roles")),
    criterionId: v.optional(v.id("criteria")),
    field: v.optional(v.string()),
  }),
  suggestedValue: v.any(),
  motivation: v.optional(v.string()),
  source: v.literal("ai"),
  status: v.union(
    v.literal("suggested"),
    v.literal("confirmed"),
    v.literal("rejected")
  ),
  model: v.optional(v.object({ provider: v.string(), model: v.string() })),
  confirmedBy: v.optional(v.string()),
})
  .index("by_org", ["orgId"])
  .index("by_org_status", ["orgId", "status"])

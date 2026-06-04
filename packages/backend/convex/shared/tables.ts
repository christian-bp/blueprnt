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

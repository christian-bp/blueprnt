import { defineTable } from "convex/server"
import { v } from "convex/values"

// Append-only. actorName is snapshotted at write time so audit rows stay
// truthful if a user is later renamed or deleted. by_actor lets erasure find
// and anonymize a user's authored rows without a full scan.
export const auditLog = defineTable({
  orgId: v.string(),
  type: v.string(),
  actorId: v.string(),
  actorName: v.string(),
  payload: v.any(),
})
  .index("by_org", ["orgId"])
  .index("by_org_type", ["orgId", "type"])
  .index("by_actor", ["actorId"])

// The ADMIN audit log: the complete, authoritative record of every platform
// (admin page) action. Deliberately SEPARATE from the per-org auditLog above
// and never mixed with it. Org-free: platform-admin actions cross tenant
// boundaries (or have no org at all, e.g. user creation). Payloads carry IDs
// only, never the affected person's name or email, so an erased user leaves no
// PII here. by_actor lets erasure anonymize the operator's snapshotted name if
// the operator is themselves later erased.
export const platformAuditLog = defineTable({
  actorId: v.string(),
  actorName: v.string(),
  type: v.string(),
  targetUserId: v.optional(v.string()),
  targetOrgId: v.optional(v.string()),
  payload: v.any(),
}).index("by_actor", ["actorId"])

// AI suggestion layer (ADR-0003): suggestions with provenance, separate from
// confirmed values. status lifecycle: generating -> suggested -> confirmed |
// rejected; failed carries an errors.* code the frontend translates.
// confirmed and rejected are terminal: confirmedBy records who applied the
// suggestion, rejectedBy who dismissed it. The two never share a field so the
// human-confirmation provenance an applied suggestion carries cannot be
// rewritten by a later dismissal.
export const suggestions = defineTable({
  orgId: v.string(),
  target: v.object({
    kind: v.string(), // a SUGGESTION_KINDS value (@workspace/constants)
    roleId: v.optional(v.id("roles")),
    criterionId: v.optional(v.id("criteria")),
    modelId: v.optional(v.id("models")),
    field: v.optional(v.string()),
  }),
  suggestedValue: v.any(),
  motivation: v.optional(v.string()),
  source: v.literal("ai"),
  status: v.union(
    v.literal("generating"),
    v.literal("suggested"),
    v.literal("confirmed"),
    v.literal("rejected"),
    v.literal("failed")
  ),
  errorCode: v.optional(v.string()),
  model: v.optional(v.object({ provider: v.string(), model: v.string() })),
  // requestedBy: who triggered the AI generation; confirmedBy / rejectedBy:
  // who applied or dismissed it. The three are distinct provenance fields.
  requestedBy: v.optional(v.string()),
  confirmedBy: v.optional(v.string()),
  rejectedBy: v.optional(v.string()),
})
  .index("by_org", ["orgId"])
  .index("by_org_status", ["orgId", "status"])
  // Kind-scoped reads: a panel asking for ONE kind must not lose its row
  // behind 20 newer rows of other kinds (the per-status take cap).
  .index("by_org_status_kind", ["orgId", "status", "target.kind"])

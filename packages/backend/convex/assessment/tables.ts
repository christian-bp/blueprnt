import { defineTable } from "convex/server"
import { v } from "convex/values"
import { trackKeyValidator } from "../evaluationModel/tables"

// Role families (rollfamilj): content grouping of roles, e.g. "Software
// Engineering" or as broad as the organization wants. Families never affect
// scoring (presentation and organization only); membership is optional and
// a role belongs to at most one family.
export const roleFamilies = defineTable({
  orgId: v.string(),
  name: v.string(),
}).index("by_org", ["orgId"])

// Role identity is permanent: never hard-delete a role with ratings, never
// reuse ids (V2 equal-work grouping depends on it).
// Role/rating tables NEVER carry person, salary, or performance fields.
export const roles = defineTable({
  orgId: v.string(),
  title: v.string(), // the role's display title, e.g. "System Developer"
  function: v.string(),
  team: v.string(),
  // Stable track key (ADR-0006): tracks are fixed V1 constants, so the
  // schema-level literal union IS the referential integrity check.
  trackKey: trackKeyValidator,
  familyId: v.optional(v.id("roleFamilies")),
  purpose: v.string(),
  responsibilities: v.string(),
  archivedAt: v.optional(v.number()),
  // Anchor-role designation (ankarroll): the role as a calibration reference
  // point (2-5 per org is the guideline). An aggregate of the role
  // (ADR-0006): never referenced without it and cannot outlive it. The
  // designation persists through status "replaced" instead of being deleted,
  // so the calibration history stays auditable.
  anchorRole: v.optional(
    v.object({
      // The agreed band for the reference role (1 = highest).
      expectedBand: v.number(),
      // Why this role was chosen as an anchor (designation rationale).
      motivation: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("underReview"),
        v.literal("replaced")
      ),
      // Last review timestamp (anchors are reviewed at least yearly).
      reviewedAt: v.number(),
    })
  ),
}).index("by_org", ["orgId"])

// The stored truth (ADR-0002): ratings persist, score/band derive.
export const ratings = defineTable({
  orgId: v.string(),
  roleId: v.id("roles"),
  criterionId: v.id("criteria"),
  value: v.number(), // 0-5; uniqueness per (role, criterion) enforced in mutations
  motivation: v.optional(v.string()),
})
  .index("by_role_criterion", ["roleId", "criterionId"])
  .index("by_org", ["orgId"])
  .index("by_criterion", ["criterionId"])

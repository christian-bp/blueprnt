import { defineTable } from "convex/server"
import { v } from "convex/values"

// Append-only. actorName is snapshotted at write time so audit rows stay
// truthful if a user is later renamed or deleted. by_actor lets erasure find
// and anonymize a user's authored rows without a full scan. Payloads carry IDs,
// codes, and role/org/model domain content (including role-level free text such
// as motivation, purpose, and responsibilities), never person identity, salary,
// performance, or contact data, so erasure leaves no person PII in the trail and
// the rows can be kept under their legitimate-interest basis. Erasure
// (anonymizeAuthoredAuditRows) rewrites BOTH actorName AND the derived
// searchText to the tombstone: since searchText is denormalized from the name,
// anonymizing actorName alone would leave the name stored and searchable.
// category and searchText are derived in logAudit from the event type and
// payload: category is the action's app area (model/role/...) for filtering;
// searchText is denormalized lowercase text (actor + action + payload values)
// for full-text search. by_org_category supports category-filtered, time-ordered
// pagination; the search_text search index backs full-text search filterable by
// org and category. Both fields are optional so a schema push against
// pre-existing rows does not fail; logAudit always sets them going forward.
export const auditLog = defineTable({
  orgId: v.string(),
  type: v.string(),
  actorId: v.string(),
  actorName: v.string(),
  payload: v.any(),
  category: v.optional(v.string()),
  searchText: v.optional(v.string()),
})
  .index("by_org", ["orgId"])
  .index("by_org_type", ["orgId", "type"])
  .index("by_org_category", ["orgId", "category"])
  .index("by_actor", ["actorId"])
  .searchIndex("search_text", {
    searchField: "searchText",
    filterFields: ["orgId", "category"],
  })

// The ADMIN audit log: the complete, authoritative record of every platform
// (admin page) action. Deliberately SEPARATE from the per-org auditLog above
// and never mixed with it. Org-free: platform-admin actions cross tenant
// boundaries (or have no org at all, e.g. user creation). Payloads carry IDs
// only, never the affected person's name or email, so an erased user leaves no
// PII here. by_actor lets erasure anonymize the operator's snapshotted name if
// the operator is themselves later erased.
// category and searchText are derived in logPlatformAudit from the event type
// and payload: category is the action's area (user/organization/membership/
// admin) for filtering; searchText is denormalized lowercase text for full-text
// search. Critically, searchText carries no TARGET PII (no target email or user
// name, which are resolved at read time for display only): it is built from the
// actor name, the event type, and the id-only payload codes only. It does carry
// the ACTOR name, so erasure (anonymizeAuthoredAuditRows) rewrites both
// actorName and searchText to the tombstone. by_category supports category-
// filtered, time-ordered pagination; the search_text search index backs full-
// text search filterable by category. Both fields are optional so a schema push
// against pre-existing rows does not fail; logPlatformAudit always sets them
// going forward.
export const platformAuditLog = defineTable({
  actorId: v.string(),
  actorName: v.string(),
  type: v.string(),
  targetUserId: v.optional(v.string()),
  targetOrgId: v.optional(v.string()),
  payload: v.any(),
  category: v.optional(v.string()),
  searchText: v.optional(v.string()),
})
  .index("by_actor", ["actorId"])
  .index("by_category", ["category"])
  .searchIndex("search_text", {
    searchField: "searchText",
    filterFields: ["category"],
  })

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

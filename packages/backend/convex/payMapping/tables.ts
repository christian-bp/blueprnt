import { defineTable } from "convex/server"
import { v } from "convex/values"

// Lifecycle status of a pay-mapping run. Shared by the table definition and
// every wire shape that carries a run's status (runs.ts), so the 4-literal
// union has a single source of truth.
export const payMappingRunStatus = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("underReview"),
  v.literal("completed")
)

// A kartläggning (pay-mapping survey). The mutable metadata + the model config
// frozen once (ADR-0008); per-person frozen data lives in payMappingSnapshotRows.
export const payMappingRuns = defineTable({
  orgId: v.string(),
  slug: v.string(),
  label: v.string(),
  status: payMappingRunStatus,
  referenceDate: v.number(), // epoch ms; = createdAt this slice (freeze time)
  initiatedBy: v.string(), // actorId
  initiatedAt: v.number(), // UTC epoch ms
  systemVersion: v.string(),
  populationNote: v.optional(v.string()),
  populationCount: v.number(),
  withPayCount: v.number(),
  unclassifiedExcludedCount: v.number(),
  frozenModel: v.object({
    criteria: v.array(
      v.object({
        name: v.string(),
        weightPoints: v.number(),
        anchorCount: v.number(),
      })
    ),
    bandThresholds: v.array(
      v.object({ band: v.number(), minScore: v.number() })
    ),
  }),
})
  .index("by_org", ["orgId"])
  .index("by_org_slug", ["orgId", "slug"])

// One immutable frozen row per person in a run's population. Holds a
// pseudonymizable identity (NOT a live FK): erasure keys on personPublicId,
// tombstones displayName, clears birthDate, keeps the gender/band/pay aggregate.
export const payMappingSnapshotRows = defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  personPublicId: v.string(),
  displayName: v.string(),
  erased: v.boolean(),
  gender: v.union(v.literal("Man"), v.literal("Kvinna")),
  birthDate: v.optional(v.string()),
  employmentType: v.optional(v.string()),
  department: v.optional(v.string()),
  ftePercent: v.optional(v.number()),
  employmentStartDate: v.optional(v.string()),
  roleTitle: v.string(),
  trackKey: v.string(),
  level: v.string(),
  band: v.union(v.number(), v.null()),
  score: v.union(v.number(), v.null()),
  basicMonthly: v.union(v.number(), v.null()),
  components: v.array(
    v.object({ kind: v.string(), monthlyAmount: v.number() })
  ),
  currency: v.optional(v.string()),
  payYear: v.optional(v.number()),
})
  .index("by_run", ["orgId", "runId"])
  .index("by_org_person", ["orgId", "personPublicId"])

// Read-oriented access dimension (ADR-0011 §3), kept out of the domain audit
// trail so high-volume view events do not pollute it. Slice 1: only "view".
export const payMappingAccessLog = defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  actorId: v.string(),
  at: v.number(),
  kind: v.union(v.literal("view"), v.literal("export")),
}).index("by_run", ["orgId", "runId"])

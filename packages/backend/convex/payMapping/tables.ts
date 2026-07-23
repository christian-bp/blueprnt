import type { PayGapReason } from "@workspace/constants"
import { defineTable } from "convex/server"
import type { Infer } from "convex/values"
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
  populationCount: v.number(),
  withPayCount: v.number(),
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
  // The samverkansredogörelse (DL 3 kap. 11-14 §§): who the employer
  // cooperated with on the kartläggning and how. Cleared (undefined) when
  // both fields are emptied, never stored as an empty-string object.
  // Participants are people's names by design (statutory documentation
  // content on this run document), but must NEVER enter the audit trail
  // (setPayMappingCollaboration logs a pure { runId } marker).
  collaboration: v.optional(
    v.object({ participants: v.string(), description: v.string() })
  ),
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

// The objective-reason taxonomy (sakligt skäl, ADR M6) a documentation entry
// can cite. Group-level only, never person PII: a reason documents WHY a
// group's pay gap is acceptable, not any individual's circumstances.
export const payGapReasonValidator = v.union(
  v.literal("alternativeLabourMarket"),
  v.literal("recruitmentPayLevel"),
  v.literal("experience"),
  v.literal("historicalPay"),
  v.literal("competence"),
  v.literal("performance"),
  v.literal("responsibility")
)

// Compile-time drift guard: the validator's literals must exactly match
// @workspace/constants' PayGapReason, so the two cannot silently diverge.
type ReasonFromValidator = Infer<typeof payGapReasonValidator>
type _ReasonsExact = ReasonFromValidator extends PayGapReason
  ? PayGapReason extends ReasonFromValidator
    ? true
    : never
  : never
const _assertReasonsMatch: _ReasonsExact = true
void _assertReasonsMatch

// A finding for a praxis review area (DL 3 kap. 8 § p1): "none" records that
// no deficiency was found, "found" records that one was, which the note must
// then describe. Shared by the table field, the upsert mutation's args, and
// the query's wire shape, so the two-literal union has a single source of
// truth.
export const payMappingFindingValidator = v.union(
  v.literal("none"),
  v.literal("found")
)

// One documentation entry for an equal-work (lika) or equivalent-work
// (likvärdigt)/women-dominated group, or (scope "praxis") a
// lönebestämmelser/praxis review area, in a run (ADR-0012 gate; DL 3 kap. 8 §
// p1 for praxis): the reasons cited plus a free-text note, a done flag, and
// (praxis only) a finding verdict. groupKey is the same key format the gap
// query already produces for equalWork/equivalentWork (equalWork:
// `${roleTitle}|${band}|${level}`; women-dominated: the same equalWork key);
// for praxis it is instead one of the constant PRAXIS_AREA_KEYS slugs, never
// the "roleTitle|band|level" format. Group-level only, never person PII.
export const payMappingGroupAnalyses = defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  scope: v.union(
    v.literal("equalWork"),
    v.literal("equivalentWork"),
    v.literal("praxis")
  ),
  groupKey: v.string(),
  reasons: v.array(payGapReasonValidator),
  note: v.optional(v.string()),
  done: v.boolean(),
  finding: v.optional(payMappingFindingValidator),
}).index("by_run", ["orgId", "runId"])

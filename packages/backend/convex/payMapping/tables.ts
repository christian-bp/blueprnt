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

// The severity band of a gap figure, mirroring @workspace/core's PayGapFlag.
// Declared here so the frozen run row and every wire shape that carries a
// flag share one union.
export const payGapFlag = v.union(
  v.literal("critical"),
  v.literal("elevated"),
  v.literal("ok"),
  v.literal("insufficient")
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
  // The population's gender split, denormalized off the snapshot rows at
  // freeze time exactly as populationCount is. The overview's workforce trend
  // plots one point per run, so reading this from the rows instead would mean
  // scanning every snapshot row of every run on each dashboard load.
  womenCount: v.number(),
  menCount: v.number(),
  // The org-level unadjusted gap, denormalized at freeze time for the same
  // reason the gender split above is: the front page plots one point per run,
  // and computing it at read time would scan every snapshot row of every run
  // on each dashboard load, which passes Convex's per-transaction read
  // ceiling well inside the org sizes this product targets.
  //
  // Unlike the counts, this is ENGINE OUTPUT: it is computed by orgGap() over
  // the frozen rows. That is sound because the rows it derives from are
  // themselves frozen (ADR-0011), so the figure can only go stale if the gap
  // formula itself changes, which is a recompute-all event.
  //
  // Null when that mapping had no measurable gap (a gender absent among its
  // priced rows), which is a real reading and not a missing one: the trend
  // keeps the point and breaks its curve there.
  orgGapPct: v.union(v.number(), v.null()),
  orgGapFlag: payGapFlag,
  // Full method evidence, frozen once at run creation (ADR-0023, ADR-0011):
  // this is the ONLY place the product versions its method. Every field
  // below (levelRules/zoneProfileRules/workingConditions/approval, and each
  // criterion's dimensionKey/libraryKey) is populated unconditionally by
  // startPayMappingRun going forward, but stays optional here: a pre-cutover
  // frozen run carries the old sparse shape (criteria with only name/
  // weightPoints/anchorCount, the legacy levelThresholds array, no
  // levelRules/zoneProfileRules/workingConditions/approval), and frozen
  // evidence is never migrated, so the validator must keep tolerating it.
  frozenModel: v.object({
    criteria: v.array(
      v.object({
        // Which of the 21 library criteria this row is.
        libraryKey: v.optional(v.string()),
        // The criterion's library display name, localized in the org's
        // content locale at freeze time; never re-resolved later, so a
        // subsequent locale change or content edit cannot alter an
        // already-frozen run.
        name: v.string(),
        dimensionKey: v.optional(v.string()),
        weightPoints: v.number(),
        // The number of anchor texts the library carries for this criterion
        // at freeze time: 5 for a section-13.5 entry, 3 otherwise.
        anchorCount: v.number(),
      })
    ),
    // Superseded by levelRules below; no longer populated by
    // startPayMappingRun. Kept only so a pre-cutover frozen run's stored
    // array still validates.
    levelThresholds: v.optional(
      v.array(v.object({ level: v.number(), minScore: v.number() }))
    ),
    // Seniority-to-score mapping, copied from the live model at freeze time.
    levelRules: v.optional(
      v.array(v.object({ level: v.number(), minScore: v.number() }))
    ),
    // Per-zone profile-eligibility thresholds, copied from the live model at
    // freeze time.
    zoneProfileRules: v.optional(
      v.array(
        v.object({
          zone: v.union(
            v.literal("A"),
            v.literal("B"),
            v.literal("C"),
            v.literal("D")
          ),
          minStep: v.number(),
        })
      )
    ),
    // The working-conditions materiality decision, copied from the live
    // model at freeze time.
    workingConditions: v.optional(
      v.object({
        status: v.union(v.literal("active"), v.literal("testedNotMaterial")),
        motivation: v.string(),
        decidedBy: v.string(),
        decidedAt: v.number(),
      })
    ),
    // Model approval grant, copied from the live model at freeze time.
    // Legitimately absent, not just a defensive fallback: a method-affecting
    // edit reopens approval (reopenApprovalIfSet) without unlocking any role
    // already locked under the prior approval, so a run can start with
    // staffed, locked roles while the model itself carries no current
    // approval. ADR-0023 accepts this as visible-never-prevented (the
    // affected roles' methodDrift marking is the visibility); there is no
    // behavioral gate on run start for it.
    approval: v.optional(
      v.object({ approvedBy: v.string(), approvedAt: v.number() })
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
// tombstones displayName, clears birthDate, keeps the gender/level/pay aggregate.
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
  seniority: v.string(),
  level: v.union(v.number(), v.null()),
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
  v.literal("geographicDifferentiation"),
  v.literal("retention"),
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

// Which comparison a work-layer record belongs to: the lika arbete flow or
// the women-dominated (likvärdigt) chapter. Shared by group analyses,
// actions, and notes.
export const payComparisonScopeValidator = v.union(
  v.literal("equalWork"),
  v.literal("equivalentWork")
)

// What an action or note is anchored to (ADR-0015, Iteration 2 note 5):
// a whole comparison group, one individual within a group, or ONE
// comparison a women-dominated group is measured against. Individuals are
// referenced by personPublicId ONLY (Role != Person): names and pay are
// never denormalized in; display values resolve from the snapshot row,
// which the erasure path already pseudonymizes, so an erased person
// renders as the tombstone with no extra hook.
//
// The "comparison" kind exists because 3 kap. 9 § asks whether the
// difference against EACH equally or lower valued job has a connection to
// sex, and those answers differ: in a real run one women-dominated group
// was measured against 16 jobs whose differences ranged from 3 677 kr to
// 50 218 kr a month. One reason for the whole group forces sixteen
// separate judgements into one, which is exactly where the documentation
// is read hardest. It is optional per row: most comparisons need nothing,
// and requiring all of them would be unworkable at 21 groups.
//
// It replaces the former "pair" kind, whose only producer (the cross-level
// section) was removed once the equivalent-work scatter showed the same
// finding in context.
export const actionTargetValidator = v.union(
  v.object({
    kind: v.literal("group"),
    scope: payComparisonScopeValidator,
    groupKey: v.string(),
  }),
  v.object({
    kind: v.literal("person"),
    scope: payComparisonScopeValidator,
    groupKey: v.string(),
    personPublicId: v.string(),
  }),
  v.object({
    kind: v.literal("comparison"),
    // The women-dominated group being documented, and the comparison it is
    // measured against: both are group keys, so the pair reads the same way
    // the analysis renders it.
    groupKey: v.string(),
    comparisonKey: v.string(),
  })
)

// The kinds above as a VALUE, because two consumers outside this file need
// the list rather than the validator: the audit payload contracts, and the
// dashboard's map from kind to its localized label. Both used to restate the
// literals, and when "pair" became "comparison" the label map kept the dead
// kind, so the audit log rendered the raw wire code and the drift test passed
// because its own copy of the list was stale too.
export const ACTION_TARGET_KINDS = ["group", "person", "comparison"] as const
export type ActionTargetKind = (typeof ACTION_TARGET_KINDS)[number]

// Compile-time drift guard: the list and the validator must admit exactly the
// same kinds, so neither can gain or lose one alone.
type KindFromValidator = Infer<typeof actionTargetValidator>["kind"]
type _KindsExact = KindFromValidator extends ActionTargetKind
  ? ActionTargetKind extends KindFromValidator
    ? true
    : never
  : never
const _assertKindsMatch: _KindsExact = true
void _assertKindsMatch

export const payMappingActionStatusValidator = v.union(
  v.literal("notStarted"),
  v.literal("inProgress"),
  v.literal("done")
)

export const payMappingActionPriorityValidator = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low")
)

// A formal remediation action (åtgärd, DL 3 kap. 11 §; M7). Work-layer
// content keyed to the run (ADR-0011): free text is statutory documentation
// the user writes (steered away from naming individuals); estimatedCost is
// an org budget figure. ownerUserId is a system user, resolved to a name at
// read time (never frozen in). Status updates stay allowed after the run
// completes (the plan runs over years); content edits lock with the run.
export const payMappingActions = defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  target: actionTargetValidator,
  problem: v.string(),
  plannedAction: v.string(),
  reason: v.optional(payGapReasonValidator),
  ownerUserId: v.string(),
  plannedDate: v.number(), // epoch ms (day precision)
  estimatedCost: v.optional(v.number()),
  priority: payMappingActionPriorityValidator,
  status: payMappingActionStatusValidator,
  createdBy: v.string(), // actorId
  createdAt: v.number(),
}).index("by_run", ["orgId", "runId"])

// An informal note (notering, Iteration 2 note 5): free-text context that is
// NOT a formal action. Fully locked once the run completes. The deep-dive's
// gender-pure groups take notes too (their group keys validate against the
// excluded bucket, not only the shown flow).
export const payMappingNoteTypeValidator = v.union(
  v.literal("objectiveReason"),
  v.literal("discussionNeeded"),
  v.literal("noActionNeeded")
)

export const payMappingNotes = defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  target: actionTargetValidator,
  text: v.string(),
  noteType: payMappingNoteTypeValidator,
  createdBy: v.string(), // actorId
  createdAt: v.number(),
}).index("by_run", ["orgId", "runId"])

// One documentation entry for an equal-work (lika) or equivalent-work
// (likvärdigt)/women-dominated group, or (scope "praxis") a
// lönebestämmelser/praxis review area, in a run (ADR-0012 gate; DL 3 kap. 8 §
// p1 for praxis): the reasons cited plus a free-text note, a done flag, and
// (praxis only) a finding verdict. groupKey is whatever equalWorkGroupKey
// (gap.ts) produces for equalWork/equivalentWork, which is where the format
// is defined rather than restated here; women-dominated uses that same key.
// For praxis it is instead one of the constant PRAXIS_AREA_KEYS slugs, never
// a group key. Group-level only, never person PII.
export const payMappingGroupAnalyses = defineTable({
  orgId: v.string(),
  runId: v.id("payMappingRuns"),
  scope: v.union(
    v.literal("equalWork"),
    v.literal("equivalentWork"),
    v.literal("praxis")
  ),
  groupKey: v.string(),
  // Set only on an equivalentWork row documenting ONE comparison: the
  // comparator group's own key. Absent on the group's own row, which carries
  // the klarmarkering and the summary note, and on every equalWork row, where
  // the group IS the unit of comparison (DL 3 kap. 8 § p2) and one set of
  // reasons for the group is the correct shape. Likvärdigt arbete compares
  // BETWEEN groups (p3), so there each difference carries its own reason.
  comparisonKey: v.optional(v.string()),
  reasons: v.array(payGapReasonValidator),
  note: v.optional(v.string()),
  done: v.boolean(),
  finding: v.optional(payMappingFindingValidator),
}).index("by_run", ["orgId", "runId"])

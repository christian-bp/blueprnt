import type { LevelRule, ZoneProfileRule } from "@workspace/core"
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { appError, ERROR_CODES } from "../lib/errors"
import {
  type CriteriaLibraryKey,
  criteriaLibraryContent,
  isCriteriaLibraryKey,
  LIBRARY_DIMENSION,
} from "./criteriaLibrary"
import type { ModelEvidence } from "./tables"

// The model's method evidence: ONE builder and ONE diff, shared by every
// consumer that needs either.
//
// The evidence itself (buildModelEvidence) is written by two callers and must
// stay byte-identical between them: approveModel stores it as the model's
// lastApprovedModel buffer (ADR-0023 decision 11), and startPayMappingRun
// stores it as a run's frozenModel (the ADR-0011/ADR-0023 freeze, the only
// place the product versions its method). The two used to be one inline object
// literal in payMapping/runs.ts; a second copy would have drifted the moment
// either side gained a field.
//
// The diff (buildModelRestoreDiff) is likewise one function with two consumers:
// the restore confirm dialog's change list and the model.restored audit
// payload. They render the same change set through the same field vocabulary,
// so what the dialog promised and what the trail records can never disagree.

export type EvidenceCriterion = ModelEvidence["criteria"][number]

// A buffer criterion the restore can actually write back: one whose library
// key the CURRENT library still knows.
export type RestorableCriterion = EvidenceCriterion & {
  libraryKey: CriteriaLibraryKey
}

// The buffer's criteria as the restorable set, keyed by library key and in the
// buffer's own order. The ONE predicate for "can this entry be restored",
// shared by the diff builder and the restore mutation, so the change list and
// the writes can never disagree about which entries count.
//
// It THROWS rather than filtering, and that is the whole point. An entry whose
// key the library no longer knows cannot be written back, and skipping it
// silently is the worst of the three possible outcomes: the restore would
// report success, write an audit row asserting a restoration that never
// happened, and leave the surviving criteria off the ADR-0004 point budget
// (criteria count x 3, an exact sum, so dropping one entry unbalances it).
// Failing the whole transaction leaves the model exactly as it was.
//
// Unreachable for a buffer approveModel wrote against the current library. The
// shared evidence shape keeps libraryKey a loose optional string only because
// pre-cutover frozen pay-mapping runs need it to be, which is precisely why
// the check belongs here rather than in the validator. invalidInput is the
// code because the stored buffer no longer validates against the library, not
// because the caller passed anything wrong.
export function restorableCriteria(
  buffer: ModelEvidence
): Map<CriteriaLibraryKey, RestorableCriterion> {
  const restorable = new Map<CriteriaLibraryKey, RestorableCriterion>()
  for (const criterion of buffer.criteria) {
    const libraryKey = criterion.libraryKey
    if (libraryKey === undefined || !isCriteriaLibraryKey(libraryKey)) {
      throw appError(ERROR_CODES.invalidInput)
    }
    restorable.set(libraryKey, { ...criterion, libraryKey })
  }
  return restorable
}

// Builds the model's full method evidence from the live rows. `locale` is the
// content locale the criterion display names are frozen in (resolved by the
// caller through the shared resolveContentLocale, so both writers name criteria
// the same way).
export async function buildModelEvidence(
  ctx: QueryCtx | MutationCtx,
  model: Doc<"models"> | null,
  locale: string
): Promise<ModelEvidence> {
  const rows =
    model === null
      ? []
      : await ctx.db
          .query("criteria")
          .withIndex("by_model", (q) => q.eq("modelId", model._id))
          .collect()
  rows.sort((a, b) => a.order - b.order)
  const content = criteriaLibraryContent(locale)
  return {
    criteria: rows.map((row) => {
      const entry = content.criteria[row.libraryKey]
      return {
        libraryKey: row.libraryKey,
        name: entry.name,
        dimensionKey: LIBRARY_DIMENSION[row.libraryKey],
        weightPoints: row.weightPoints,
        anchorCount:
          3 +
          (entry.anchor2 !== undefined ? 1 : 0) +
          (entry.anchor4 !== undefined ? 1 : 0),
        order: row.order,
        weightMotivation: row.weightMotivation,
        purpose: row.purpose,
        whyRelevant: row.whyRelevant,
        overlapNotes: row.overlapNotes,
        biasRisk: row.biasRisk,
        biasComment: row.biasComment,
        biasAction: row.biasAction,
        approved: row.approved,
        decidedBy: row.decidedBy,
        decidedAt: row.decidedAt,
      }
    }),
    levelRules: model?.levelRules ?? [],
    zoneProfileRules: model?.zoneProfileRules ?? [],
    workingConditions: model?.workingConditions,
    // Approval can be legitimately absent, not just as a defensive fallback:
    // a method-affecting edit reopens approval (reopenApprovalIfSet) without
    // touching any assessment already completed under the prior approval, so a
    // run can
    // freeze this state. ADR-0023 accepts it as visible-never-prevented.
    approval: model?.approval,
  }
}

// Compact technical summaries for a level/zone-profile rules diff's from/to
// values, not localized prose: an array-valued changes entry renders as an
// opaque complexValue placeholder (formatChanges/changeEntries), which would
// make every rules change read identically. Level 1 is the highest (house
// convention), so "top" is its minScore.
export function summarizeLevelRules(rules: readonly LevelRule[]): string {
  const top = rules.find((rule) => rule.level === 1)?.minScore
  return `${rules.length} rules, top ${top ?? 0}`
}

export function summarizeZoneProfileRules(
  rules: readonly ZoneProfileRule[]
): string {
  if (rules.length === 0) return "0 rules"
  const detail = rules.map((rule) => `${rule.zone}>=${rule.minStep}`).join(", ")
  return `${rules.length} rules: ${detail}`
}

// One scalar side of a restore change. Never an object or array: both consumers
// render through the audit-detail formatting language, where a complex value
// collapses into an opaque placeholder.
export type RestoreValue = string | number | boolean | null

export type RestoreChanges = Record<
  string,
  { from: RestoreValue; to: RestoreValue }
>

// What restoring does to ONE criterion. `kind` is the shape of the change, not
// a second encoding of it: the same fact is in `changes.selected`, so a
// consumer that only renders changes still says the right thing.
export type RestoreCriterionDiff = {
  libraryKey: string
  // The criterion's library name in the locale the caller asked for (the org's
  // content locale for the audit label, the viewer's own for the dialog).
  name: string
  kind: "removed" | "restored" | "changed"
  changes: RestoreChanges
}

export type ModelRestoreDiff = {
  criteria: RestoreCriterionDiff[]
  // Model-level changes: the working-conditions materiality decision and the
  // level/zone-profile rules.
  changes: RestoreChanges
}

// The criterion-level diff fields, and the model-level ones. Exported so the
// dashboard's audit field-label coverage test can assert every one of them has
// a label, exactly as it does for the other *_AUDIT_FIELDS sets.
export const RESTORE_CRITERION_AUDIT_FIELDS = [
  "selected",
  "deletedRatingCount",
  "weightPoints",
  "weightMotivation",
  "purpose",
  "whyRelevant",
  "overlapNotes",
  "biasRisk",
  "biasComment",
  "biasAction",
  "approved",
] as const

export const RESTORE_MODEL_AUDIT_FIELDS = [
  "status",
  "motivation",
  "levelRules",
  "zoneProfileRules",
] as const

// The criterion fields compared between the live row and the buffer, and how
// each one reads as a scalar. decidedBy/decidedAt are deliberately excluded
// (an id and a timestamp that carry no reviewable meaning next to `approved`),
// as are order and anchorCount (derived, never edited).
export const COMPARED_CRITERION_FIELDS = [
  "weightPoints",
  "weightMotivation",
  "purpose",
  "whyRelevant",
  "overlapNotes",
  "biasRisk",
  "biasComment",
  "biasAction",
  "approved",
] as const

// The structural subset both sides share, so the comparison indexes ONE type
// rather than a union of the stored row and the evidence copy.
type ComparableCriterion = {
  weightPoints: number
  weightMotivation?: string
  purpose?: string
  whyRelevant?: string
  overlapNotes?: string
  biasRisk?: "low" | "medium" | "high"
  biasComment?: string
  biasAction?: string
  approved?: boolean
}

function criterionValue(
  source: ComparableCriterion,
  field: (typeof COMPARED_CRITERION_FIELDS)[number]
): RestoreValue {
  // `approved` is tri-state on the row (true / false / never set) but binary in
  // meaning, so an unset row diffs as false rather than vanishing from the
  // comparison and reading as "unchanged".
  if (field === "approved") return source.approved === true
  return source[field] ?? null
}

// The per-criterion comparison, as its own function because THREE readers need
// to agree on it: the confirm dialog's change list, the model.restored audit
// payload, and the cheap boolean that decides whether the restore control is
// offered at all. A field added to COMPARED_CRITERION_FIELDS joins all three at
// once; a second implementation would eventually offer a restore that changes
// nothing, or hide one that changes something.
export function criterionRestoreChanges(
  live: ComparableCriterion,
  buffered: ComparableCriterion
): RestoreChanges {
  const changes: RestoreChanges = {}
  for (const field of COMPARED_CRITERION_FIELDS) {
    const from = criterionValue(live, field)
    const to = criterionValue(buffered, field)
    if (from !== to) changes[field] = { from, to }
  }
  return changes
}

// The model's OWN fields the restore writes back: the materiality decision and
// the two rule sets. Same reasoning as the per-criterion comparison above, and
// the rules compare through the same summaries the diff renders, so "changed"
// means exactly what the change list will show.
export function modelRestoreChanges(
  model: Doc<"models">,
  buffer: ModelEvidence
): RestoreChanges {
  const changes: RestoreChanges = {}
  const liveStatus = model.workingConditions?.status ?? null
  const bufferStatus = buffer.workingConditions?.status ?? null
  if (liveStatus !== bufferStatus) {
    changes.status = { from: liveStatus, to: bufferStatus }
  }
  const liveMotivation = model.workingConditions?.motivation ?? null
  const bufferMotivation = buffer.workingConditions?.motivation ?? null
  if (liveMotivation !== bufferMotivation) {
    changes.motivation = { from: liveMotivation, to: bufferMotivation }
  }
  const liveLevelRules = summarizeLevelRules(model.levelRules)
  const bufferLevelRules = summarizeLevelRules(
    buffer.levelRules ?? model.levelRules
  )
  if (liveLevelRules !== bufferLevelRules) {
    changes.levelRules = { from: liveLevelRules, to: bufferLevelRules }
  }
  const liveZoneRules = summarizeZoneProfileRules(model.zoneProfileRules)
  const bufferZoneRules = summarizeZoneProfileRules(
    buffer.zoneProfileRules ?? model.zoneProfileRules
  )
  if (liveZoneRules !== bufferZoneRules) {
    changes.zoneProfileRules = { from: liveZoneRules, to: bufferZoneRules }
  }
  return changes
}

// Whether restoring the buffer would change anything at all.
//
// The Godkännande chapter asks this on every render to decide whether to offer
// the restore at all: a model whose live state is already identical to its
// buffer (an edit made and manually reverted, say) reopens approval but has
// nothing to restore, and a control that promises a change it will not make is
// worse than no control.
//
// Deliberately cheaper than buildModelRestoreDiff, which answers "what would
// change" for a dialog the reader has opened. It skips the criteria library
// resolution (names are for rendering; a boolean needs none) and, more
// importantly, the per-removed-criterion ratings collect: that is one indexed
// read PER criterion the restore would remove, and this runs on a query the
// whole model section subscribes to on all four chapters. The rating count is
// the confirm dialog's business, where it costs one read on one open.
export async function restoreWouldChange(
  ctx: QueryCtx | MutationCtx,
  model: Doc<"models">,
  buffer: ModelEvidence | undefined
): Promise<boolean> {
  if (buffer === undefined) return false
  const rows = await ctx.db
    .query("criteria")
    .withIndex("by_model", (q) => q.eq("modelId", model._id))
    .collect()
  const buffered = restorableCriteria(buffer)
  // The selection itself: either side holding a key the other does not is a
  // criterion the restore would add or remove.
  if (rows.length !== buffered.size) return true
  for (const row of rows) {
    const criterion = buffered.get(row.libraryKey)
    if (criterion === undefined) return true
    if (Object.keys(criterionRestoreChanges(row, criterion)).length > 0) {
      return true
    }
  }
  return Object.keys(modelRestoreChanges(model, buffer)).length > 0
}

// The ONE diff both consumers derive from: everything restoring the buffer
// would undo. Reads the live criteria rows and, for each criterion the restore
// removes, its rating count (the consequence the confirm dialog has to state
// per criterion, and the trail has to record).
//
// `locale` names the criteria: the mutation passes the org's content locale so
// the audit label matches every other model row, the preview query passes the
// viewer's own display locale.
export async function buildModelRestoreDiff(
  ctx: QueryCtx | MutationCtx,
  model: Doc<"models">,
  buffer: ModelEvidence,
  locale: string
): Promise<ModelRestoreDiff> {
  const rows = await ctx.db
    .query("criteria")
    .withIndex("by_model", (q) => q.eq("modelId", model._id))
    .collect()
  rows.sort((a, b) => a.order - b.order)
  const content = criteriaLibraryContent(locale)
  const nameOf = (libraryKey: string): string =>
    (content.criteria as Record<string, { name: string } | undefined>)[
      libraryKey
    ]?.name ?? libraryKey

  // The same predicate the restore mutation writes from, so the change list
  // can never name an entry the writes will not touch (and vice versa).
  const buffered = restorableCriteria(buffer)
  const live = new Map(rows.map((row) => [row.libraryKey as string, row]))

  const criteria: RestoreCriterionDiff[] = []

  // Criteria selected since the approval: restoring removes them, and their
  // ratings go with them (the same deletion deactivateCriterion performs).
  for (const row of rows) {
    if (buffered.has(row.libraryKey)) continue
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_criterion", (q) => q.eq("criterionId", row._id))
      .collect()
    criteria.push({
      libraryKey: row.libraryKey,
      name: nameOf(row.libraryKey),
      kind: "removed",
      changes: {
        selected: { from: true, to: false },
        // A consequence, not a before/after: rendered as a plain "Ratings
        // removed: 12" by the shared formatter's first-time-set branch.
        ...(ratings.length > 0
          ? { deletedRatingCount: { from: null, to: ratings.length } }
          : {}),
      },
    })
  }

  // Criteria deselected since the approval: restoring brings them back, with
  // no ratings, so every role has to be evaluated on them again.
  for (const libraryKey of buffered.keys()) {
    if (live.has(libraryKey)) continue
    criteria.push({
      libraryKey,
      name: nameOf(libraryKey),
      kind: "restored",
      changes: { selected: { from: false, to: true } },
    })
  }

  // Criteria on both sides: only the fields that actually differ.
  for (const [libraryKey, criterion] of buffered) {
    const row = live.get(libraryKey)
    if (row === undefined) continue
    const changes = criterionRestoreChanges(row, criterion)
    if (Object.keys(changes).length === 0) continue
    criteria.push({
      libraryKey,
      name: nameOf(libraryKey),
      kind: "changed",
      changes,
    })
  }

  return { criteria, changes: modelRestoreChanges(model, buffer) }
}

// The diff over the wire, for the confirm dialog's preview query. Kept as a
// record of scalar from/to pairs so the dashboard can feed it straight into the
// audit-detail formatters (changeEntries) that render every other diff.
export const restoreChangeValue = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null()
)

export const restoreChangesShape = v.record(
  v.string(),
  v.object({ from: restoreChangeValue, to: restoreChangeValue })
)

export const modelRestoreDiffShape = v.object({
  criteria: v.array(
    v.object({
      libraryKey: v.string(),
      name: v.string(),
      kind: v.union(
        v.literal("removed"),
        v.literal("restored"),
        v.literal("changed")
      ),
      changes: restoreChangesShape,
    })
  ),
  changes: restoreChangesShape,
})

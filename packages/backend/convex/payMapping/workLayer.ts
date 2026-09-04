// Shared plumbing for the run's action/note work layer (ADR-0015): target
// validation against the frozen snapshot and the audit-safe display label.
// Module-level pure/async helpers, imported by actions.ts and notes.ts so
// the two record kinds can never drift on what a valid target is.
import type { Infer } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { appError, ERROR_CODES } from "../lib/errors"
import { buildGapAggregates, equalWorkGroupKey } from "./gap"
import type { actionTargetValidator } from "./tables"

export type ActionTarget = Infer<typeof actionTargetValidator>

export async function snapshotRowsForRun(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  runId: Id<"payMappingRuns">
): Promise<Doc<"payMappingSnapshotRows">[]> {
  return await ctx.db
    .query("payMappingSnapshotRows")
    .withIndex("by_run", (q) => q.eq("orgId", orgId).eq("runId", runId))
    .collect()
}

// The audit-safe display label a group key resolves to: the single
// derivation every call site (validation, existing-record labels, the
// group-analysis trail) goes through, so the format can never drift.
export function groupKeyLabel(groupKey: string): string {
  // A group is roleTitle|level (ADR-0017), so the title alone is its name;
  // the level rides as its own badge rather than inside the label.
  return groupKey.split("|")[0] ?? ""
}

// Validates a target against the run's own groups and people, and returns
// the audit-safe GROUP-level display label (the role title): even a
// person-targeted record is labeled by its group, never by a name (a name
// in an audit payload could not be scrubbed on erasure).
//
// Valid targets: a group in the shown lika arbete flow, a women-dominated
// group (equivalentWork scope), or, when `allowExcludedGroups` (notes only),
// a gender-pure group. A person must be a member of the exact group the
// target anchors to (never a member of some other group: a member of an
// excluded group could otherwise take a formal action through a shown
// group's key). A comparison must be one the engine actually produced for
// the group it names.
export function validateTarget(
  rows: Doc<"payMappingSnapshotRows">[],
  target: ActionTarget,
  options: { allowExcludedGroups: boolean; allowPraxis: boolean }
): { targetLabel: string } {
  // A practice area is not a group: its label is the constant area key
  // (the same value the praxis analysis rows log), and whether an action
  // may anchor to it depends on the area's finding, which
  // assertPraxisTargetAllowed reads from the analyses. Notes never take it.
  if (target.kind === "praxis") {
    if (!options.allowPraxis) throw appError(ERROR_CODES.invalidInput)
    return { targetLabel: target.area }
  }
  const { equalWork, excluded, womenDominated } = buildGapAggregates(rows)

  // A comparison target names a women-dominated group AND one of the jobs
  // the engine actually measured it against, so neither half can be an
  // arbitrary key: a caller must not be able to document a comparison the
  // analysis never made.
  if (target.kind === "comparison") {
    const group = womenDominated.find(
      (candidate) => candidate.key === target.groupKey
    )
    if (group === undefined) throw appError(ERROR_CODES.notFound)
    const comparison = group.comparisons.find(
      (candidate) => candidate.key === target.comparisonKey
    )
    if (comparison === undefined) throw appError(ERROR_CODES.notFound)
    return { targetLabel: groupKeyLabel(target.comparisonKey) }
  }

  const validKeys = new Set<string>(
    target.scope === "equalWork"
      ? [
          ...equalWork.map((group) => group.key),
          ...(options.allowExcludedGroups
            ? excluded.genderPure.map((group) => group.key)
            : []),
        ]
      : womenDominated.map((group) => group.key)
  )
  if (!validKeys.has(target.groupKey)) throw appError(ERROR_CODES.notFound)

  if (target.kind === "person") {
    const person = rows.find(
      (row) => row.personPublicId === target.personPublicId
    )
    if (person === undefined || equalWorkGroupKey(person) !== target.groupKey)
      throw appError(ERROR_CODES.notFound)
    // An erased person takes no NEW documentation, and a tombstoned row's
    // content cannot be rewritten (both paths revalidate their target here):
    // the erasure hook (ADR-0027) is a one-time sweep, so free text written
    // against the dead pseudonym AFTER it would never be scrubbed. Status
    // moves and deletion skip target validation and stay open.
    if (person.erased) throw appError(ERROR_CODES.invalidInput)
  }

  return { targetLabel: groupKeyLabel(target.groupKey) }
}

// The audit-safe label of a target: the comparator's role title for a
// comparison (the row the reader documented), the raw area key for a
// practice area (a constant slug, never split on "|"), the group's role
// title otherwise. Every kind labels without a database read.
function targetLabelOf(target: ActionTarget): string {
  if (target.kind === "praxis") return target.area
  return groupKeyLabel(
    target.kind === "comparison" ? target.comparisonKey : target.groupKey
  )
}

// Whether an edit re-targets the record. Compared field by field per kind
// rather than by shape equality, so a widened union does not compile until
// its new fields are compared here.
export function sameTarget(a: ActionTarget, b: ActionTarget): boolean {
  if (a.kind !== b.kind) return false
  switch (a.kind) {
    case "group":
      return (
        b.kind === "group" && a.scope === b.scope && a.groupKey === b.groupKey
      )
    case "person":
      return (
        b.kind === "person" &&
        a.scope === b.scope &&
        a.groupKey === b.groupKey &&
        a.personPublicId === b.personPublicId
      )
    case "comparison":
      return (
        b.kind === "comparison" &&
        a.groupKey === b.groupKey &&
        a.comparisonKey === b.comparisonKey
      )
    case "praxis":
      return b.kind === "praxis" && a.area === b.area
  }
}

// The audit-safe label of an EXISTING record's target, from rows the caller
// already holds (updateAction diffs the OLD target's label without a second
// snapshot read).
export function targetLabelFromRows(
  _rows: Doc<"payMappingSnapshotRows">[],
  target: ActionTarget
): string {
  return targetLabelOf(target)
}

// The ISO date string a day-precision epoch-ms field (an action's
// plannedDate, the run's collaboration date) is diffed as: never epoch ms, a
// raw number in the trail would render as an unreadable integer.
export function plannedDateIso(plannedDate: number): string {
  return new Date(plannedDate).toISOString().slice(0, 10)
}

// The audit-safe display label for an EXISTING record's target (status
// flips, deletes: no re-validation, no whole-snapshot read).
export function resolveTargetLabel(target: ActionTarget): string {
  return targetLabelOf(target)
}

// Pure membership gate for the Ansvarig field: the owner must be a current
// org member (callers fetch the roster via the Better Auth component).
export function assertOwnerIsMember(
  members: readonly { userId: string }[],
  ownerUserId: string
): void {
  if (!members.some((m) => m.userId === ownerUserId)) {
    throw appError(ERROR_CODES.invalidInput)
  }
}

// A praxis-targeted action is the plan's answer to a deficiency, so the
// area's review must have FOUND one: the praxis analysis row for the area
// must carry finding "found". Read in the same transaction as the write;
// a group/person/comparison target passes through untouched.
export async function assertPraxisTargetAllowed(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  runId: Id<"payMappingRuns">,
  target: ActionTarget
): Promise<void> {
  if (target.kind !== "praxis") return
  const rows = await ctx.db
    .query("payMappingGroupAnalyses")
    .withIndex("by_run", (q) => q.eq("orgId", orgId).eq("runId", runId))
    .collect()
  const area = rows.find(
    (row) => row.scope === "praxis" && row.groupKey === target.area
  )
  if (area?.finding !== "found") throw appError(ERROR_CODES.invalidInput)
}

// The single authority for a day-precision epoch-ms field's valid range (an
// action's plannedDate, the run's collaboration date). Convex v.number()
// accepts NaN/Infinity, and an out-of-range day would make plannedDateIso
// throw a raw RangeError AFTER the write instead of a translatable error
// code. The window is deliberately generous (multi-year action plans) but
// keeps Date arithmetic valid.
const DAY_MIN = Date.UTC(2000, 0, 1)
const DAY_MAX = Date.UTC(2100, 0, 1)

export function assertAuditDayValid(value: number): void {
  if (!Number.isFinite(value) || value < DAY_MIN || value > DAY_MAX) {
    throw appError(ERROR_CODES.invalidInput)
  }
}

// Backend re-validation of an action's numeric content (the client's Zod
// gate is never the only gate).
export function assertActionNumbersValid(content: {
  plannedDate: number
  estimatedCost?: number
  estimatedCostUnit?: string
}): void {
  assertAuditDayValid(content.plannedDate)
  if (
    content.estimatedCost !== undefined &&
    (!Number.isFinite(content.estimatedCost) || content.estimatedCost < 0)
  ) {
    throw appError(ERROR_CODES.invalidInput)
  }
  // A cost is meaningless without its recurrence, and a unit without a cost
  // is a stray: the pair travels together or not at all.
  if (
    (content.estimatedCost !== undefined) !==
    (content.estimatedCostUnit !== undefined)
  ) {
    throw appError(ERROR_CODES.invalidInput)
  }
}

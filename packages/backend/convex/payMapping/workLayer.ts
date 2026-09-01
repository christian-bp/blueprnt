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
  options: { allowExcludedGroups: boolean }
): { targetLabel: string } {
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

// The audit-safe label of an EXISTING record's target, from rows the caller
// already holds (updateAction diffs the OLD target's label without a second
// snapshot read).
export function targetLabelFromRows(
  _rows: Doc<"payMappingSnapshotRows">[],
  target: ActionTarget
): string {
  // A comparison is labeled by the job it compares AGAINST: that is the row
  // the reader is looking at when they document it.
  return groupKeyLabel(
    target.kind === "comparison" ? target.comparisonKey : target.groupKey
  )
}

// The ISO date string an action's plannedDate is diffed as (never epoch ms:
// a raw number in the trail would render as an unreadable integer).
export function plannedDateIso(plannedDate: number): string {
  return new Date(plannedDate).toISOString().slice(0, 10)
}

// The audit-safe display label for an EXISTING record's target (status
// flips, deletes: no re-validation, no whole-snapshot read). Every kind
// labels from a group key, so this needs no database read at all.
export function resolveTargetLabel(target: ActionTarget): string {
  return groupKeyLabel(
    target.kind === "comparison" ? target.comparisonKey : target.groupKey
  )
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

// Backend re-validation of an action's numeric content (the client's Zod
// gate is never the only gate). Convex v.number() accepts NaN/Infinity, and
// an out-of-range plannedDate would make plannedDateIso throw a raw
// RangeError AFTER the insert instead of a translatable error code. The
// date window is deliberately generous (multi-year action plans) but keeps
// Date arithmetic valid.
const PLANNED_DATE_MIN = Date.UTC(2000, 0, 1)
const PLANNED_DATE_MAX = Date.UTC(2100, 0, 1)

export function assertActionNumbersValid(content: {
  plannedDate: number
  estimatedCost?: number
  estimatedCostUnit?: string
}): void {
  if (
    !Number.isFinite(content.plannedDate) ||
    content.plannedDate < PLANNED_DATE_MIN ||
    content.plannedDate > PLANNED_DATE_MAX
  ) {
    throw appError(ERROR_CODES.invalidInput)
  }
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

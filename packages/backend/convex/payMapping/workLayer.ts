// Shared plumbing for the run's action/note work layer (ADR-0015): target
// validation against the frozen snapshot and the audit-safe display label.
// Module-level pure/async helpers, imported by actions.ts and notes.ts so
// the two record kinds can never drift on what a valid target is.
import { fteTotalMonthlyComp } from "@workspace/constants"
import { crossLevelPairs } from "@workspace/core"
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

// The audit-safe display label a group key resolves to ("roleTitle ·
// seniority"): the single derivation every call site (validation, existing-
// record labels, the group-analysis trail) goes through, so the format and
// its empty-part filtering can never drift.
export function groupKeyLabel(groupKey: string): string {
  const [roleTitle, , seniority] = groupKey.split("|")
  return [roleTitle, seniority]
    .filter((part) => part !== undefined && part !== "")
    .join(" · ")
}

// A pair-targeted record is labeled by the WOMAN's group (the affected
// side), through the same key derivation as everything else.
function memberLabel(row: Doc<"payMappingSnapshotRows">): string {
  return groupKeyLabel(equalWorkGroupKey(row))
}

// The engine's own base measure (FTE-adjusted base salary): pair validation
// must judge the pair by the same number the analysis renders.
function memberBase(row: Doc<"payMappingSnapshotRows">): number | null {
  return row.basicMonthly === null
    ? null
    : fteTotalMonthlyComp(row.basicMonthly, [], row.ftePercent)
}

// Validates a target against the run's own groups and people, and returns
// the audit-safe GROUP-level display label ("roleTitle · seniority"): even a
// person- or pair-targeted record is labeled by its group, never by a name
// (a name in an audit payload could not be scrubbed on erasure).
//
// Valid targets: a group in the shown lika arbete flow, a women-dominated
// group (equivalentWork scope), or, when `allowExcludedGroups` (notes only),
// a gender-pure group from the deep-dive. A person must be a member of the
// exact group the target anchors to (never a member of some other group: a
// gender-pure member could otherwise take a formal action through a shown
// group's key). A pair must be a real tvärnivå pair by the engine's own
// rule (the man on a numerically higher = lower-valued level, out-earning
// the woman), never just any woman + any man.
export function validateTarget(
  rows: Doc<"payMappingSnapshotRows">[],
  target: ActionTarget,
  options: { allowExcludedGroups: boolean }
): { targetLabel: string } {
  const { equalWork, excluded, womenDominated } = buildGapAggregates(rows)

  if (target.kind === "pair") {
    const woman = rows.find(
      (row) =>
        row.personPublicId === target.womanPublicId && row.gender === "Kvinna"
    )
    const man = rows.find(
      (row) => row.personPublicId === target.manPublicId && row.gender === "Man"
    )
    if (woman === undefined || man === undefined) {
      throw appError(ERROR_CODES.notFound)
    }
    const pair = crossLevelPairs([
      {
        personPublicId: woman.personPublicId,
        gender: "Kvinna",
        level: woman.level,
        trackKey: woman.trackKey,
        base: memberBase(woman),
      },
      {
        personPublicId: man.personPublicId,
        gender: "Man",
        level: man.level,
        trackKey: man.trackKey,
        base: memberBase(man),
      },
    ])
    if (pair.length === 0) throw appError(ERROR_CODES.notFound)
    return { targetLabel: memberLabel(woman) }
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
  }

  return { targetLabel: groupKeyLabel(target.groupKey) }
}

// The audit-safe label of an EXISTING record's target, from rows the caller
// already holds (updateAction diffs the OLD target's label without a second
// snapshot read).
export function targetLabelFromRows(
  rows: Doc<"payMappingSnapshotRows">[],
  target: ActionTarget
): string {
  if (target.kind !== "pair") return groupKeyLabel(target.groupKey)
  const woman = rows.find((row) => row.personPublicId === target.womanPublicId)
  return woman === undefined ? "" : memberLabel(woman)
}

// The ISO date string an action's plannedDate is diffed as (never epoch ms:
// a raw number in the trail would render as an unreadable integer).
export function plannedDateIso(plannedDate: number): string {
  return new Date(plannedDate).toISOString().slice(0, 10)
}

// The audit-safe display label for an EXISTING record's target (status
// flips, deletes: no re-validation, no whole-snapshot read). Group/person
// targets label from the group key; a pair labels from the woman's group,
// fetched via the person index.
export async function resolveTargetLabel(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  runId: Id<"payMappingRuns">,
  target: ActionTarget
): Promise<string> {
  if (target.kind !== "pair") return groupKeyLabel(target.groupKey)
  const woman = (
    await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_org_person", (q) =>
        q.eq("orgId", orgId).eq("personPublicId", target.womanPublicId)
      )
      .collect()
  ).find((row) => row.runId === runId)
  return woman === undefined ? "" : memberLabel(woman)
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
}

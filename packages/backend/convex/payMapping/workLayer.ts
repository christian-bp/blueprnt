// Shared plumbing for the run's action/note work layer (ADR-0015): target
// validation against the frozen snapshot and the audit-safe display label.
// Module-level pure/async helpers, imported by actions.ts and notes.ts so
// the two record kinds can never drift on what a valid target is.
import type { Infer } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { appError, ERROR_CODES } from "../lib/errors"
import { buildGapAggregates } from "./gap"
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

// Validates a target against the run's own groups and people, and returns
// the audit-safe GROUP-level display label ("roleTitle · seniority"): even a
// person- or pair-targeted record is labeled by its group, never by a name
// (a name in an audit payload could not be scrubbed on erasure).
//
// Valid targets: a group in the shown lika arbete flow, a women-dominated
// group (equivalentWork scope), or, when `allowExcludedGroups` (notes only),
// a gender-pure group from the deep-dive. Persons must be members of the
// run's snapshot; pairs must be a woman and a man from the snapshot.
export function validateTarget(
  rows: Doc<"payMappingSnapshotRows">[],
  target: ActionTarget,
  options: { allowExcludedGroups: boolean }
): { targetLabel: string } {
  const { equalWork, excluded, womenDominated } = buildGapAggregates(rows)

  const groupLabelFromKey = (groupKey: string): string => {
    const [roleTitle, , seniority] = groupKey.split("|")
    return [roleTitle, seniority].filter((p) => p !== "").join(" · ")
  }

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
    // The pair is labeled by the WOMAN's group (the affected side).
    return { targetLabel: `${woman.roleTitle} · ${woman.seniority}` }
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
    if (person === undefined) throw appError(ERROR_CODES.notFound)
  }

  return { targetLabel: groupLabelFromKey(target.groupKey) }
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
  if (target.kind !== "pair") {
    const [roleTitle, , seniority] = target.groupKey.split("|")
    return [roleTitle, seniority]
      .filter((p) => p !== undefined && p !== "")
      .join(" · ")
  }
  const woman = (
    await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_org_person", (q) =>
        q.eq("orgId", orgId).eq("personPublicId", target.womanPublicId)
      )
      .collect()
  ).find((row) => row.runId === runId)
  return woman === undefined ? "" : `${woman.roleTitle} · ${woman.seniority}`
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

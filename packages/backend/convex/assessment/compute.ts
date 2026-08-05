import {
  type CriterionWeight,
  type LevelThreshold,
  type RatingValue,
  type RoleRatings,
  type RoleResult,
  type WeightPoints,
  computeResults,
} from "@workspace/core"
import type { GenericMutationCtx } from "convex/server"
import type { DataModel } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { AUDIT_EVENTS, buildChanges, logAudit } from "../lib/audit"
import type { LevelCause } from "../lib/auditPayloads"

export interface DerivedResults {
  results: RoleResult[]
  totalCriteria: number
}

// Derives the org's full result set (score/level per role) from current state
// via the pure engine. Never stores anything (ADR-0002). Used by the results
// queries and by mutations for before/after level.shift diffs. Alpha-scale
// data: full-org collects are deliberate and fine.
export async function deriveResults(
  ctx: QueryCtx | MutationCtx,
  orgId: string
): Promise<DerivedResults> {
  const model = await ctx.db
    .query("models")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  if (model === null) return { results: [], totalCriteria: 0 }

  const criteriaRows = await ctx.db
    .query("criteria")
    .withIndex("by_model", (q) => q.eq("modelId", model._id))
    .collect()
  const criteria: CriterionWeight[] = criteriaRows.map((row) => ({
    criterionId: row._id as string,
    weightPoints: row.weightPoints as WeightPoints,
  }))

  // Thresholds live on the model document (ADR-0006): no extra read on the
  // hottest path in the app (this runs twice per result-affecting mutation).
  const thresholds: LevelThreshold[] = model.levelThresholds.map((row) => ({
    level: row.level,
    minScore: row.minScore,
  }))

  const roleRows = await ctx.db
    .query("roles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  const activeRoles = roleRows.filter((role) => role.archivedAt === undefined)

  const ratingRows = await ctx.db
    .query("ratings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  const byRole = new Map<string, RoleRatings["ratings"]>()
  for (const rating of ratingRows) {
    const key = rating.roleId as string
    const list = byRole.get(key) ?? []
    // Stored as v.number(); the engine re-validates the 0-5 integer range.
    list.push({
      criterionId: rating.criterionId as string,
      value: rating.value as RatingValue,
    })
    byRole.set(key, list)
  }

  const roles: RoleRatings[] = activeRoles.map((role) => ({
    roleId: role._id as string,
    ratings: byRole.get(role._id as string) ?? [],
  }))

  return {
    results: computeResults({ criteria, thresholds, roles }),
    totalCriteria: criteria.length,
  }
}

// Compares two derived result sets and logs one level.shift audit row per role
// whose level changed; a role missing on one side counts as level null. Runs
// in the same transaction as the mutation that caused the shift, so the audit
// trail can never drift from the data (ADR-0002 live derivation). The required
// `cause` records the triggering domain event (and the role/criterion/entity it
// touched) so a level.shift can always be traced back to what moved it.
export async function logLevelShifts(
  ctx: GenericMutationCtx<DataModel>,
  args: {
    orgId: string
    actorId: string
    before: RoleResult[]
    after: RoleResult[]
    cause: LevelCause
  }
) {
  const beforeByRole = new Map(args.before.map((r) => [r.roleId, r]))
  const afterByRole = new Map(args.after.map((r) => [r.roleId, r]))
  const roleIds = new Set([...beforeByRole.keys(), ...afterByRole.keys()])
  // The result fields diffed into changes. A role missing on one side is
  // represented with all four picked as null so buildChanges still emits them
  // (it skips keys absent from `after`): changes.level is therefore always
  // present (the level change gates the row), even for appear/disappear shifts.
  const FIELDS = ["level", "score", "complete", "ratedCount"] as const
  const pick = (result: RoleResult | undefined): Record<string, unknown> => ({
    level: result?.level ?? null,
    score: result?.score ?? null,
    complete: result?.complete ?? null,
    ratedCount: result?.ratedCount ?? null,
  })
  for (const roleId of roleIds) {
    const beforeResult = beforeByRole.get(roleId)
    const afterResult = afterByRole.get(roleId)
    // Gate on the level actually changing (a role missing on one side reads as
    // level null via the ?? null collapse pick applies).
    if ((beforeResult?.level ?? null) === (afterResult?.level ?? null)) continue
    await logAudit(ctx, {
      orgId: args.orgId,
      type: AUDIT_EVENTS.levelShift,
      actorId: args.actorId,
      payload: {
        roleId,
        cause: args.cause,
        changes: buildChanges(pick(beforeResult), pick(afterResult), FIELDS),
        totalCriteria:
          afterResult?.totalCriteria ?? beforeResult?.totalCriteria,
      },
    })
  }
}

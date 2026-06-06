import {
  type BandThreshold,
  type CriterionWeight,
  type ImportanceLevel,
  type RatingValue,
  type RoleRatings,
  type RoleResult,
  computeResults,
} from "@workspace/core"
import type { GenericMutationCtx } from "convex/server"
import type { DataModel } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"

export interface DerivedResults {
  results: RoleResult[]
  totalCriteria: number
  // The grouped ratings that produced the results, for callers that also
  // need raw per-role ratings (guardrail checks in the results queries).
  roles: RoleRatings[]
}

// Derives the org's full result set (score/band per role) from current state
// via the pure engine. Never stores anything (ADR-0002). Used by the results
// queries and by mutations for before/after band.shift diffs. Alpha-scale
// data: full-org collects are deliberate and fine.
export async function deriveResults(
  ctx: QueryCtx | MutationCtx,
  orgId: string
): Promise<DerivedResults> {
  const model = await ctx.db
    .query("models")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  if (model === null) return { results: [], totalCriteria: 0, roles: [] }

  const criteriaRows = await ctx.db
    .query("criteria")
    .withIndex("by_model", (q) => q.eq("modelId", model._id))
    .collect()
  const criteria: CriterionWeight[] = criteriaRows.map((row) => ({
    criterionId: row._id as string,
    importanceLevel: row.importanceLevel as ImportanceLevel,
  }))

  const thresholdRows = await ctx.db
    .query("bandThresholds")
    .withIndex("by_model", (q) => q.eq("modelId", model._id))
    .collect()
  const thresholds: BandThreshold[] = thresholdRows.map((row) => ({
    band: row.band,
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
    roles,
  }
}

// Compares two derived result sets and logs one band.shift audit row per role
// whose band changed; a role missing on one side counts as band null. Runs in
// the same transaction as the mutation that caused the shift, so the audit
// trail can never drift from the data (ADR-0002 live derivation).
export async function logBandShifts(
  ctx: GenericMutationCtx<DataModel>,
  args: {
    orgId: string
    actorId: string
    before: RoleResult[]
    after: RoleResult[]
  }
) {
  const beforeBands = new Map(
    args.before.map((result) => [result.roleId, result.band])
  )
  const afterBands = new Map(
    args.after.map((result) => [result.roleId, result.band])
  )
  const roleIds = new Set([...beforeBands.keys(), ...afterBands.keys()])
  for (const roleId of roleIds) {
    const fromBand = beforeBands.get(roleId) ?? null
    const toBand = afterBands.get(roleId) ?? null
    if (fromBand === toBand) continue
    await logAudit(ctx, {
      orgId: args.orgId,
      type: AUDIT_EVENTS.bandShift,
      actorId: args.actorId,
      payload: { roleId, fromBand, toBand },
    })
  }
}

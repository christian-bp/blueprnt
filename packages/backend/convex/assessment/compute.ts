import {
  type CriterionWeight,
  type LevelThreshold,
  type RatingValue,
  type RoleRatings,
  type RoleResult,
  type WeightPoints,
  type ZoneProfileRule,
  computeResults,
} from "@workspace/core"
import type { Doc } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { LIBRARY_DIMENSION } from "../evaluationModel/criteriaLibrary"
import {
  AUDIT_EVENTS,
  type AuditMutationCtx,
  buildChanges,
  logAudit,
} from "../lib/audit"
import type { LevelCause } from "../lib/auditPayloads"

export interface DerivedResults {
  results: RoleResult[]
  totalCriteria: number
}

// Everything the engine needs for one org, read ONCE. Alpha-scale data:
// full-org collects are deliberate and fine.
//
// Split out of deriveResults so a caller that wants the same ratings scored
// under a DIFFERENT method (the consequence analysis: live model vs the
// last-approved buffer) pays for one set of reads instead of two. The ratings
// and the roles are the same in both runs by definition; only the method
// changes, and the method is pure input.
export interface ResultInputs {
  criteria: CriterionWeight[]
  thresholds: LevelThreshold[]
  zoneProfileRules: ZoneProfileRule[]
  roles: RoleRatings[]
  // The ACTIVE role documents these RoleRatings were built from, in the same
  // order. The engine only needs the ratings, but a caller that also has to
  // name a role (its title, slug, family) would otherwise collect the whole
  // table a second time in the same transaction to get fields this read has
  // already paid for. getConsequenceAnalysis did exactly that, on the branch's
  // hottest new read, which is the cost the extraction existed to remove.
  activeRoles: Doc<"roles">[]
  // The live criteria rows' library keys, by criterion id. The buffer
  // identifies its criteria by libraryKey (ids are not part of the evidence),
  // so a caller re-scoring under it needs the mapping back to the ids the
  // ratings are keyed on.
  libraryKeyById: Map<string, string>
}

export async function readResultInputs(
  ctx: QueryCtx | MutationCtx,
  orgId: string
): Promise<ResultInputs | null> {
  const model = await ctx.db
    .query("models")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  if (model === null) return null

  const criteriaRows = await ctx.db
    .query("criteria")
    .withIndex("by_model", (q) => q.eq("modelId", model._id))
    .collect()
  const criteria: CriterionWeight[] = criteriaRows.map((row) => ({
    criterionId: row._id as string,
    dimensionKey: LIBRARY_DIMENSION[row.libraryKey],
    weightPoints: row.weightPoints as WeightPoints,
  }))

  // Level rules live on the model document (ADR-0006): no extra read on the
  // hottest path in the app (this runs twice per result-affecting mutation).
  // The engine's own ComputeInput field is still named `thresholds`
  // (packages/core is untouched by this rename; see @workspace/core#LevelThreshold).
  const thresholds: LevelThreshold[] = model.levelRules.map((row) => ({
    level: row.level,
    minScore: row.minScore,
  }))
  // Zone profile rules live on the model document too (ADR-0022); decoupled
  // from the stored document shape the same way thresholds is above.
  const zoneProfileRules: ZoneProfileRule[] = model.zoneProfileRules.map(
    (rule) => ({
      zone: rule.zone,
      minStep: rule.minStep,
    })
  )

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
    // Stored as v.number(); the engine re-validates the 1-5 integer range (0
    // only for a workingConditions criterion).
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
    criteria,
    thresholds,
    zoneProfileRules,
    roles,
    activeRoles,
    libraryKeyById: new Map(
      criteriaRows.map((row) => [row._id as string, row.libraryKey as string])
    ),
  }
}

// Derives the org's full result set (score/level per role) from current state
// via the pure engine. Never stores anything (ADR-0002). Used by the results
// queries and by mutations for before/after level.shift diffs.
export async function deriveResults(
  ctx: QueryCtx | MutationCtx,
  orgId: string
): Promise<DerivedResults> {
  const inputs = await readResultInputs(ctx, orgId)
  if (inputs === null) return { results: [], totalCriteria: 0 }
  return {
    results: computeResults(inputs),
    totalCriteria: inputs.criteria.length,
  }
}

// Compares two derived result sets and logs one level.shift audit row per role
// whose level changed; a role missing on one side counts as level null. Runs
// in the same transaction as the mutation that caused the shift, so the audit
// trail can never drift from the data (ADR-0002 live derivation). The required
// `cause` records the triggering domain event (and the role/criterion/entity it
// touched) so a level.shift can always be traced back to what moved it.
export async function logLevelShifts(
  ctx: AuditMutationCtx,
  args: {
    orgId: string
    actorId: string
    before: RoleResult[]
    after: RoleResult[]
    cause: LevelCause
    // Only the ctx-bound writer passes this; see logAudit's own note.
    gestureId?: string
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
      gestureId: args.gestureId,
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

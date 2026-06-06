import { checkGuardrails, type GuardrailRange } from "@workspace/core"
import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { clampLocale, isCriterionKey } from "../evaluationModel/localize"
import { templateContent } from "../evaluationModel/standardTemplate"
import { orgQuery } from "../lib/functions"
import { deriveResults } from "./compute"
import { trackLevelNames } from "./names"

// Guardrail ranges for one level, keyed for the engine. Plain QueryCtx: the
// org-scoped wrapper ctx is structurally assignable.
async function guardrailsForLevel(
  ctx: QueryCtx,
  levelId: Id<"levels">
): Promise<GuardrailRange[]> {
  const rows = await ctx.db
    .query("trackGuardrails")
    .withIndex("by_level", (q) => q.eq("levelId", levelId))
    .collect()
  return rows.map((row) => ({
    criterionId: row.criterionId as string,
    min: row.min,
    max: row.max,
  }))
}

// The results view: live-derived rows for every non-archived role plus the
// model's band list. Score/band are computed at read time and never stored
// (ADR-0002). Sorted band-first (Band 1 on top), score desc within a band,
// incomplete roles last by title.
export const getResults = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.object({
    rows: v.array(
      v.object({
        roleId: v.id("roles"),
        title: v.string(),
        trackKey: v.string(),
        trackName: v.string(),
        levelKey: v.string(),
        levelName: v.string(),
        status: v.string(),
        complete: v.boolean(),
        ratedCount: v.number(),
        totalCriteria: v.number(),
        score: v.union(v.number(), v.null()),
        band: v.union(v.number(), v.null()),
        warningCount: v.number(),
      })
    ),
    bands: v.array(v.object({ band: v.number(), minScore: v.number() })),
  }),
  handler: async (ctx, { locale }) => {
    const derived = await deriveResults(ctx, ctx.orgId)
    const resultByRole = new Map(
      derived.results.map((result) => [result.roleId, result])
    )
    const ratingsByRole = new Map(
      derived.roles.map((role) => [role.roleId, role.ratings])
    )

    const names = await trackLevelNames(ctx, ctx.orgId, locale)
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    const bands: { band: number; minScore: number }[] = []
    if (model !== null) {
      const thresholds = await ctx.db
        .query("bandThresholds")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .collect()
      thresholds.sort((a, b) => a.band - b.band)
      for (const threshold of thresholds) {
        bands.push({ band: threshold.band, minScore: threshold.minScore })
      }
    }

    const roleRows = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const active = roleRows.filter((role) => role.archivedAt === undefined)

    const rows = []
    for (const role of active) {
      const result = resultByRole.get(role._id as string)
      const guardrails = await guardrailsForLevel(ctx, role.levelId)
      const warnings = checkGuardrails(
        ratingsByRole.get(role._id as string) ?? [],
        guardrails
      )
      const track = names.trackName.get(role.trackId as string)
      const level = names.levelName.get(role.levelId as string)
      rows.push({
        roleId: role._id,
        title: role.title,
        trackKey: track?.key ?? "",
        trackName: track?.name ?? "",
        levelKey: level?.key ?? "",
        levelName: level?.name ?? "",
        status: role.status,
        complete: result?.complete ?? false,
        ratedCount: result?.ratedCount ?? 0,
        totalCriteria: derived.totalCriteria,
        score: result?.score ?? null,
        band: result?.band ?? null,
        warningCount: warnings.length,
      })
    }
    const sortLocale = clampLocale(locale)
    rows.sort((a, b) => {
      if (a.band !== null && b.band !== null) {
        return (
          a.band - b.band ||
          (b.score ?? 0) - (a.score ?? 0) ||
          a.title.localeCompare(b.title, sortLocale)
        )
      }
      if (a.band !== null) return -1
      if (b.band !== null) return 1
      return a.title.localeCompare(b.title, sortLocale)
    })
    return { rows, bands }
  },
})

// Per-role result: score, band outcome, and the per-criterion breakdown
// (localized criterion name, importance LEVEL for the label, rating value,
// motivation, advisory guardrail flag). Weighted per-criterion contributions
// are deliberately absent: they would expose the weights (CLAUDE.md rule).
export const getRoleResult = orgQuery({
  args: { roleId: v.string(), locale: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      roleId: v.id("roles"),
      title: v.string(),
      complete: v.boolean(),
      ratedCount: v.number(),
      totalCriteria: v.number(),
      score: v.union(v.number(), v.null()),
      band: v.union(v.number(), v.null()),
      criteria: v.array(
        v.object({
          criterionId: v.id("criteria"),
          name: v.string(),
          importanceLevel: v.number(),
          value: v.union(v.number(), v.null()),
          motivation: v.union(v.string(), v.null()),
          guardrail: v.union(
            v.null(),
            v.object({ min: v.number(), max: v.number() })
          ),
          outside: v.boolean(),
        })
      ),
    })
  ),
  handler: async (ctx, { roleId, locale }) => {
    const docId = ctx.db.normalizeId("roles", roleId)
    if (docId === null) return null
    const role = await ctx.db.get(docId)
    if (role === null || role.orgId !== ctx.orgId) return null

    const derived = await deriveResults(ctx, ctx.orgId)
    const result = derived.results.find(
      (row) => row.roleId === (docId as string)
    )

    const content = templateContent(clampLocale(locale))
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null
    const criteriaRows = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    criteriaRows.sort((a, b) => a.order - b.order)

    const ratingRows = await ctx.db
      .query("ratings")
      .withIndex("by_role_criterion", (q) => q.eq("roleId", docId))
      .collect()
    const ratingByCriterion = new Map(
      ratingRows.map((rating) => [rating.criterionId as string, rating])
    )
    const guardrailRows = await ctx.db
      .query("trackGuardrails")
      .withIndex("by_level", (q) => q.eq("levelId", role.levelId))
      .collect()
    const guardrailByCriterion = new Map(
      guardrailRows.map((row) => [row.criterionId as string, row])
    )

    return {
      roleId: role._id,
      title: role.title,
      complete: result?.complete ?? false,
      ratedCount: result?.ratedCount ?? 0,
      totalCriteria: derived.totalCriteria,
      score: result?.score ?? null,
      band: result?.band ?? null,
      criteria: criteriaRows.map((row) => {
        // Pristine template criteria localize by key (same rule as getModel).
        const localized =
          row.templateKey !== undefined && isCriterionKey(row.templateKey)
            ? content.criteria[row.templateKey]
            : null
        const rating = ratingByCriterion.get(row._id as string)
        const guardrail = guardrailByCriterion.get(row._id as string)
        const value = rating?.value ?? null
        const outside =
          guardrail !== undefined &&
          value !== null &&
          (value < guardrail.min || value > guardrail.max)
        return {
          criterionId: row._id,
          name: localized?.name ?? row.name,
          importanceLevel: row.importanceLevel,
          value,
          motivation: rating?.motivation ?? null,
          guardrail:
            guardrail === undefined
              ? null
              : { min: guardrail.min, max: guardrail.max },
          outside,
        }
      }),
    }
  },
})

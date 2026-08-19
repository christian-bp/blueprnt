import { v } from "convex/values"
import { criteriaLibraryContent } from "../evaluationModel/criteriaLibrary"
import { clampLocale } from "../evaluationModel/localize"
import { orgQuery } from "../lib/functions"
import { deriveResults } from "./compute"
import { familyNames, trackNames } from "./names"

// The results view: live-derived rows for every non-archived role plus the
// model's level list. Score/level are computed at read time and never stored
// (ADR-0002). Sorted level-first (Level 1 on top), score desc within a level,
// incomplete roles last by title.
export const getResults = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.object({
    rows: v.array(
      v.object({
        roleId: v.id("roles"),
        title: v.string(),
        slug: v.string(),
        trackKey: v.string(),
        trackName: v.string(),
        complete: v.boolean(),
        ratedCount: v.number(),
        totalCriteria: v.number(),
        score: v.union(v.number(), v.null()),
        level: v.union(v.number(), v.null()),
        zone: v.union(v.string(), v.null()),
        profileLimited: v.union(v.boolean(), v.null()),
        profileFailures: v.union(
          v.array(
            v.object({
              criterionId: v.string(),
              required: v.number(),
              actual: v.number(),
            })
          ),
          v.null()
        ),
        familyId: v.union(v.id("roleFamilies"), v.null()),
        familyName: v.union(v.string(), v.null()),
        anchor: v.union(
          v.null(),
          v.object({
            expectedLevel: v.number(),
            status: v.union(v.literal("active"), v.literal("underReview")),
          })
        ),
      })
    ),
    levels: v.array(v.object({ level: v.number(), minScore: v.number() })),
  }),
  handler: async (ctx, { locale }) => {
    const derived = await deriveResults(ctx, ctx.orgId)
    const resultByRole = new Map(
      derived.results.map((result) => [result.roleId, result])
    )

    const names = trackNames(locale)
    const families = await familyNames(ctx, ctx.orgId)
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    const levels =
      model === null
        ? []
        : [...model.levelRules]
            .sort((a, b) => a.level - b.level)
            .map((threshold) => ({
              level: threshold.level,
              minScore: threshold.minScore,
            }))

    const roleRows = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const active = roleRows.filter((role) => role.archivedAt === undefined)

    const rows = []
    for (const role of active) {
      const result = resultByRole.get(role._id as string)
      const track = names.get(role.trackKey)
      const anchorRole = role.anchorRole
      const anchor =
        anchorRole === undefined || anchorRole.status === "replaced"
          ? null
          : {
              expectedLevel: anchorRole.expectedLevel,
              status: anchorRole.status,
            }
      rows.push({
        roleId: role._id,
        title: role.title,
        slug: role.slug,
        trackKey: role.trackKey,
        trackName: track?.name ?? role.trackKey,
        complete: result?.complete ?? false,
        ratedCount: result?.ratedCount ?? 0,
        totalCriteria: derived.totalCriteria,
        score: result?.score ?? null,
        level: result?.level ?? null,
        zone: result?.zone ?? null,
        profileLimited: result?.profileLimited ?? null,
        profileFailures: result?.profileFailures ?? null,
        familyId: role.familyId ?? null,
        familyName:
          role.familyId !== undefined
            ? (families.get(role.familyId as string)?.name ?? null)
            : null,
        anchor,
      })
    }
    const sortLocale = clampLocale(locale)
    rows.sort((a, b) => {
      if (a.level !== null && b.level !== null) {
        return (
          a.level - b.level ||
          (b.score ?? 0) - (a.score ?? 0) ||
          a.title.localeCompare(b.title, sortLocale)
        )
      }
      if (a.level !== null) return -1
      if (b.level !== null) return 1
      return a.title.localeCompare(b.title, sortLocale)
    })
    return { rows, levels }
  },
})

// Per-role result: score (normalized 0-100), level outcome, and the
// per-criterion breakdown (localized criterion name, weight points, rating
// value, motivation). The role view derives each criterion's contribution
// share from value * weightPoints client-side (packages/core criterionShares),
// so this payload stays unchanged: weightPoints and value are all it needs.
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
      level: v.union(v.number(), v.null()),
      zone: v.union(v.string(), v.null()),
      profileLimited: v.union(v.boolean(), v.null()),
      profileFailures: v.union(
        v.array(
          v.object({
            criterionId: v.string(),
            required: v.number(),
            actual: v.number(),
          })
        ),
        v.null()
      ),
      criteria: v.array(
        v.object({
          criterionId: v.id("criteria"),
          name: v.string(),
          weightPoints: v.number(),
          value: v.union(v.number(), v.null()),
          motivation: v.union(v.string(), v.null()),
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

    const content = criteriaLibraryContent(clampLocale(locale))
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

    return {
      roleId: role._id,
      title: role.title,
      complete: result?.complete ?? false,
      ratedCount: result?.ratedCount ?? 0,
      totalCriteria: derived.totalCriteria,
      score: result?.score ?? null,
      level: result?.level ?? null,
      zone: result?.zone ?? null,
      profileLimited: result?.profileLimited ?? null,
      profileFailures: result?.profileFailures ?? null,
      criteria: criteriaRows.map((row) => {
        // Every criterion is a library selection (decision 8): its display
        // name always localizes from criteriaLibraryContent by libraryKey,
        // never stored (same rule as getModel).
        const rating = ratingByCriterion.get(row._id as string)
        return {
          criterionId: row._id,
          name: content.criteria[row.libraryKey].name,
          weightPoints: row.weightPoints,
          value: rating?.value ?? null,
          motivation: rating?.motivation ?? null,
        }
      }),
    }
  },
})

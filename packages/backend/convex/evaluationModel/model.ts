import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgQuery } from "../lib/functions"
import {
  CRITERION_KEYS,
  DEFAULT_BAND_THRESHOLDS,
  DEFAULT_IMPORTANCE,
  GUARDRAILS,
  STANDARD_TEMPLATE_KEY,
  TRACK_DEFS,
  type TemplateLocale,
  templateContent,
} from "./standardTemplate"
import { clampLocale, isCriterionKey, isLevelKey, isTrackKey } from "./localize"

async function assertNoModel(ctx: MutationCtx, orgId: string) {
  // Read-then-insert is safe here: a concurrent create invalidates this
  // read set (same by_org range), so Convex retries the loser via OCC and
  // it lands on modelExists. Keep the guard and the insert on this table.
  const existing = await ctx.db
    .query("models")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first()
  if (existing !== null) throw appError(ERROR_CODES.modelExists)
}

async function contentLocale(
  ctx: MutationCtx,
  orgId: string
): Promise<TemplateLocale> {
  const settings = await ctx.db
    .query("organizations")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  return settings?.language === "sv" ? "sv" : "en"
}

// Seeds the fixed track schema (IC/Lead/M is fixed in V1) and the default
// band thresholds; shared by the template and scratch paths. Returns the
// level ids keyed by level key so the template path can attach guardrails.
async function seedTracksAndThresholds(
  ctx: MutationCtx,
  orgId: string,
  modelId: Id<"models">,
  locale: TemplateLocale
) {
  const content = templateContent(locale)
  const levelIdByKey = new Map<string, Id<"levels">>()
  for (const [trackIndex, trackDef] of TRACK_DEFS.entries()) {
    const trackId = await ctx.db.insert("tracks", {
      orgId,
      modelId,
      key: trackDef.key,
      name: content.trackNames[trackDef.key],
      order: trackIndex + 1,
    })
    for (const [levelIndex, levelKey] of trackDef.levels.entries()) {
      const levelId = await ctx.db.insert("levels", {
        trackId,
        key: levelKey,
        name: content.levelNames[levelKey],
        definition: content.levelDefinitions[levelKey],
        order: levelIndex + 1,
      })
      levelIdByKey.set(levelKey, levelId)
    }
  }
  for (const threshold of DEFAULT_BAND_THRESHOLDS) {
    await ctx.db.insert("bandThresholds", {
      orgId,
      modelId,
      band: threshold.band,
      minScore: threshold.minScore,
    })
  }
  return levelIdByKey
}

export const createModelFromTemplate = adminMutation({
  args: {},
  returns: v.id("models"),
  handler: async (ctx) => {
    await assertNoModel(ctx, ctx.orgId)
    const locale = await contentLocale(ctx, ctx.orgId)
    const content = templateContent(locale)

    const modelId = await ctx.db.insert("models", {
      orgId: ctx.orgId,
      name: content.modelName,
      templateKey: STANDARD_TEMPLATE_KEY,
    })

    const criterionIdByKey = new Map<string, Id<"criteria">>()
    for (const [index, key] of CRITERION_KEYS.entries()) {
      const criterion = content.criteria[key]
      const criterionId = await ctx.db.insert("criteria", {
        orgId: ctx.orgId,
        modelId,
        name: criterion.name,
        description: criterion.description,
        helpText: criterion.helpText,
        // The standard template key keeps this row pristine-localizable in getModel.
        // E2 editing MUST clear it when any text field changes.
        templateKey: key,
        importanceLevel: DEFAULT_IMPORTANCE[key],
        order: index + 1,
        isCustom: false,
      })
      criterionIdByKey.set(key, criterionId)
      for (const [level, text] of criterion.anchors.entries()) {
        await ctx.db.insert("criterionAnchors", { criterionId, level, text })
      }
    }

    const levelIdByKey = await seedTracksAndThresholds(
      ctx,
      ctx.orgId,
      modelId,
      locale
    )
    for (const [levelKey, ranges] of Object.entries(GUARDRAILS)) {
      const levelId = levelIdByKey.get(levelKey)
      if (levelId === undefined) continue
      for (const [criterionKey, range] of Object.entries(ranges)) {
        const criterionId = criterionIdByKey.get(criterionKey)
        if (criterionId === undefined || range === undefined) continue
        await ctx.db.insert("trackGuardrails", {
          orgId: ctx.orgId,
          levelId,
          criterionId,
          min: range[0],
          max: range[1],
        })
      }
    }

    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelCreated,
      actorId: ctx.authUserId,
      payload: { modelId, templateKey: STANDARD_TEMPLATE_KEY },
    })
    return modelId
  },
})

export const createEmptyModel = adminMutation({
  args: { name: v.string() },
  returns: v.id("models"),
  handler: async (ctx, { name }) => {
    if (name.trim().length === 0) throw appError(ERROR_CODES.invalidInput)
    await assertNoModel(ctx, ctx.orgId)
    const locale = await contentLocale(ctx, ctx.orgId)
    const modelId = await ctx.db.insert("models", {
      orgId: ctx.orgId,
      name: name.trim(),
    })
    await seedTracksAndThresholds(ctx, ctx.orgId, modelId, locale)
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelCreated,
      actorId: ctx.authUserId,
      payload: { modelId, templateKey: null },
    })
    return modelId
  },
})

// Onboarding escape hatch: lets an admin undo the template-vs-scratch choice
// while onboarding is still in progress. Deletes the model and every row that
// hangs off it (child-first, mirroring removeSeededOrganization for one org) plus
// the stale model.* AI suggestions, so a fresh choice starts clean. Blocked
// once onboarding has completed or any role exists (roles reference
// tracks/levels; never break referential integrity). Idempotent on an empty
// org.
export const discardModel = adminMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (typeof settings?.onboardingCompletedAt === "number") {
      throw appError(ERROR_CODES.invalidInput)
    }

    const role = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .first()
    if (role !== null) throw appError(ERROR_CODES.invalidInput)

    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null

    // Child-first deletion, same order as mirrors.removeSeededOrganization:
    // tracks -> levels -> guardrails, criteria -> anchors, bandThresholds,
    // then the model row.
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    for (const track of tracks) {
      const levels = await ctx.db
        .query("levels")
        .withIndex("by_track", (q) => q.eq("trackId", track._id))
        .collect()
      for (const level of levels) {
        const guardrails = await ctx.db
          .query("trackGuardrails")
          .withIndex("by_level", (q) => q.eq("levelId", level._id))
          .collect()
        for (const guardrail of guardrails) {
          await ctx.db.delete(guardrail._id)
        }
        await ctx.db.delete(level._id)
      }
      await ctx.db.delete(track._id)
    }

    const criteria = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    for (const criterion of criteria) {
      const anchors = await ctx.db
        .query("criterionAnchors")
        .withIndex("by_criterion", (q) => q.eq("criterionId", criterion._id))
        .collect()
      for (const anchor of anchors) {
        await ctx.db.delete(anchor._id)
      }
      await ctx.db.delete(criterion._id)
    }

    const thresholds = await ctx.db
      .query("bandThresholds")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    for (const threshold of thresholds) {
      await ctx.db.delete(threshold._id)
    }

    await ctx.db.delete(model._id)

    // Drop the org's model-scoped AI suggestions so a stale draft cannot be
    // confirmed against a new model. Suggestion counts are tiny, so a by_org
    // collect with an in-code filter is fine.
    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    for (const suggestion of suggestions) {
      if (
        suggestion.target.kind === "model.draft" ||
        suggestion.target.kind === "model.importanceReview"
      ) {
        await ctx.db.delete(suggestion._id)
      }
    }

    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelDiscarded,
      actorId: ctx.authUserId,
      payload: { modelId: model._id, templateKey: model.templateKey ?? null },
    })
    return null
  },
})

const anchorShape = v.object({ level: v.number(), text: v.string() })

// Localizes pristine standard-template content at read time. Template-seeded
// criteria carry their standard template key (criteria.templateKey); tracks and
// levels carry stable keys. For those rows we serve name/description/helpText/
// anchors and track/level names/definitions from the per-locale content modules
// in the requested locale instead of the stored copies. Custom and AI-authored
// rows (no templateKey, unknown keys) render as stored. This is read-time only:
// stored data is never mutated here. E2 editing will clear a criterion's
// templateKey on any text edit, after which the row renders as stored.
export const getModel = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      modelId: v.id("models"),
      name: v.string(),
      templateKey: v.union(v.string(), v.null()),
      criteria: v.array(
        v.object({
          criterionId: v.id("criteria"),
          name: v.string(),
          description: v.string(),
          helpText: v.string(),
          importanceLevel: v.number(),
          order: v.number(),
          isCustom: v.boolean(),
          anchors: v.array(anchorShape),
        })
      ),
      tracks: v.array(
        v.object({
          trackId: v.id("tracks"),
          key: v.string(),
          name: v.string(),
          order: v.number(),
          levels: v.array(
            v.object({
              levelId: v.id("levels"),
              key: v.string(),
              name: v.string(),
              order: v.number(),
            })
          ),
        })
      ),
      bandThresholds: v.array(
        v.object({ band: v.number(), minScore: v.number() })
      ),
    })
  ),
  handler: async (ctx, { locale }) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null

    const content = templateContent(clampLocale(locale))
    const isTemplateModel = model.templateKey !== undefined

    const criteriaRows = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    criteriaRows.sort((a, b) => a.order - b.order)
    const criteria = []
    for (const row of criteriaRows) {
      const anchors = await ctx.db
        .query("criterionAnchors")
        .withIndex("by_criterion", (q) => q.eq("criterionId", row._id))
        .collect()
      anchors.sort((a, b) => a.level - b.level)
      // Pristine template criteria localize from the content module by their
      // standard template key. Custom/AI rows (no key, or an unknown key) and rows
      // whose key was cleared by an E2 edit render as stored.
      const localized =
        row.templateKey !== undefined && isCriterionKey(row.templateKey)
          ? content.criteria[row.templateKey]
          : null
      criteria.push({
        criterionId: row._id,
        name: localized?.name ?? row.name,
        description: localized?.description ?? row.description,
        helpText: localized?.helpText ?? row.helpText,
        importanceLevel: row.importanceLevel,
        order: row.order,
        isCustom: row.isCustom,
        anchors:
          localized !== null
            ? anchors.map((a) => ({
                level: a.level,
                text: localized.anchors[a.level] ?? a.text,
              }))
            : anchors.map((a) => ({ level: a.level, text: a.text })),
      })
    }

    const trackRows = await ctx.db
      .query("tracks")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    trackRows.sort((a, b) => a.order - b.order)
    const tracks = []
    for (const row of trackRows) {
      const levels = await ctx.db
        .query("levels")
        .withIndex("by_track", (q) => q.eq("trackId", row._id))
        .collect()
      levels.sort((a, b) => a.order - b.order)
      // Tracks and levels are seeded from the fixed schema by BOTH the template
      // and scratch paths, so their keys are always stable: localize by key
      // whenever the key is known, falling back to stored values otherwise.
      tracks.push({
        trackId: row._id,
        key: row.key,
        name: isTrackKey(row.key) ? content.trackNames[row.key] : row.name,
        order: row.order,
        levels: levels.map((level) => ({
          levelId: level._id,
          key: level.key,
          name: isLevelKey(level.key)
            ? content.levelNames[level.key]
            : level.name,
          order: level.order,
        })),
      })
    }

    const thresholdRows = await ctx.db
      .query("bandThresholds")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    thresholdRows.sort((a, b) => a.band - b.band)

    return {
      modelId: model._id,
      // The template model name localizes; a scratch model keeps its stored,
      // user-chosen name.
      name: isTemplateModel ? content.modelName : model.name,
      templateKey: model.templateKey ?? null,
      criteria,
      tracks,
      bandThresholds: thresholdRows.map((threshold) => ({
        band: threshold.band,
        minScore: threshold.minScore,
      })),
    }
  },
})

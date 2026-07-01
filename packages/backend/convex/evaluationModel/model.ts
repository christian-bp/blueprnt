import { v } from "convex/values"
import { internalMutation, type MutationCtx } from "../_generated/server"
import {
  AUDIT_EVENTS,
  buildCreateChanges,
  buildDeleteChanges,
  criterionCreateItem,
  criterionDeleteItem,
  logAudit,
  MODEL_AUDIT_FIELDS,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgQuery } from "../lib/functions"
import {
  CRITERION_KEYS,
  DEFAULT_BAND_THRESHOLDS,
  DEFAULT_WEIGHT_POINTS,
  STANDARD_TEMPLATE_KEY,
  TRACK_KEYS,
  type TemplateLocale,
  templateContent,
} from "./standardTemplate"
import { clampLocale, isCriterionKey } from "./localize"
import { trackKeyValidator } from "./tables"

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
  // Seed criteria in the org's own product locale (all five), not a binary
  // sv/en split, so an nb/da/fi org's stored rows are not frozen to English the
  // first time an E2 edit clears a criterion's templateKey.
  return clampLocale(settings?.language)
}

// Used by BOTH template and scratch models (thresholds are editable in E2).
// Tracks are fixed V1 constants (TRACK_KEYS, ADR-0006) and are not seeded.
function defaultBandThresholds() {
  return DEFAULT_BAND_THRESHOLDS.map((threshold) => ({
    band: threshold.band,
    minScore: threshold.minScore,
  }))
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
      bandThresholds: defaultBandThresholds(),
    })

    // Capture each inserted criterion as a bulk create-snapshot item; the
    // criterionId and field values come from the same insert loop, so the
    // audit `items` mirror exactly what was written.
    const criteriaSnapshots = []
    for (const [index, key] of CRITERION_KEYS.entries()) {
      const criterion = content.criteria[key]
      const anchors = criterion.anchors.map((text, level) => ({ level, text }))
      const criterionId = await ctx.db.insert("criteria", {
        orgId: ctx.orgId,
        modelId,
        name: criterion.name,
        description: criterion.description,
        helpText: criterion.helpText,
        anchors,
        // The standard template key keeps this row pristine-localizable in getModel.
        // E2 editing MUST clear it when any text field changes.
        templateKey: key,
        weightPoints: DEFAULT_WEIGHT_POINTS[key],
        order: index + 1,
        isCustom: false,
      })
      criteriaSnapshots.push(
        criterionCreateItem({
          criterionId,
          name: criterion.name,
          description: criterion.description,
          helpText: criterion.helpText,
          anchors,
          weightPoints: DEFAULT_WEIGHT_POINTS[key],
          order: index + 1,
          isCustom: false,
          templateKey: key,
        })
      )
    }

    await ctx.audit.log({
      type: AUDIT_EVENTS.modelCreated,
      payload: {
        modelId,
        source: "template",
        templateKey: STANDARD_TEMPLATE_KEY,
        locale,
        name: content.modelName,
        changes: buildCreateChanges(
          {
            name: content.modelName,
            templateKey: STANDARD_TEMPLATE_KEY,
            bandThresholds: defaultBandThresholds(),
          },
          MODEL_AUDIT_FIELDS
        ),
        count: CRITERION_KEYS.length,
        items: criteriaSnapshots,
      },
    })
    return modelId
  },
})

// Dev/seed-only twin of createModelFromTemplate that takes an explicit orgId,
// locale, and actorId instead of an auth context. The dev seed runs in a "use
// node" action with no identity, so it cannot call the adminMutation above; the
// founder authId is passed in as actorId so the model.created audit row is
// attributed to the seeded account rather than the "system" sentinel. The insert
// loop and template constants are shared; the only behavioural difference is that
// this is idempotent (it skips when the org already has a model) rather than
// throwing modelExists.
export const seedStandardModel = internalMutation({
  args: {
    orgId: v.string(),
    locale: v.optional(v.string()),
    actorId: v.string(),
  },
  returns: v.union(v.id("models"), v.null()),
  handler: async (ctx, { orgId, locale, actorId }) => {
    const existing = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first()
    if (existing !== null) return null

    const seedLocale = clampLocale(locale)
    const content = templateContent(seedLocale)
    const modelId = await ctx.db.insert("models", {
      orgId,
      name: content.modelName,
      templateKey: STANDARD_TEMPLATE_KEY,
      bandThresholds: defaultBandThresholds(),
    })

    // Same per-criterion create-snapshot building as createModelFromTemplate.
    const criteriaSnapshots = []
    for (const [index, key] of CRITERION_KEYS.entries()) {
      const criterion = content.criteria[key]
      const anchors = criterion.anchors.map((text, level) => ({ level, text }))
      const criterionId = await ctx.db.insert("criteria", {
        orgId,
        modelId,
        name: criterion.name,
        description: criterion.description,
        helpText: criterion.helpText,
        anchors,
        templateKey: key,
        weightPoints: DEFAULT_WEIGHT_POINTS[key],
        order: index + 1,
        isCustom: false,
      })
      criteriaSnapshots.push(
        criterionCreateItem({
          criterionId,
          name: criterion.name,
          description: criterion.description,
          helpText: criterion.helpText,
          anchors,
          weightPoints: DEFAULT_WEIGHT_POINTS[key],
          order: index + 1,
          isCustom: false,
          templateKey: key,
        })
      )
    }

    await logAudit(ctx, {
      orgId,
      type: AUDIT_EVENTS.modelCreated,
      actorId,
      payload: {
        modelId,
        source: "template",
        seeded: true,
        templateKey: STANDARD_TEMPLATE_KEY,
        locale: seedLocale,
        name: content.modelName,
        changes: buildCreateChanges(
          {
            name: content.modelName,
            templateKey: STANDARD_TEMPLATE_KEY,
            bandThresholds: defaultBandThresholds(),
          },
          MODEL_AUDIT_FIELDS
        ),
        count: CRITERION_KEYS.length,
        items: criteriaSnapshots,
      },
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
    const modelId = await ctx.db.insert("models", {
      orgId: ctx.orgId,
      name: name.trim(),
      bandThresholds: defaultBandThresholds(),
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelCreated,
      payload: {
        modelId,
        source: "scratch",
        templateKey: null,
        name: name.trim(),
        changes: buildCreateChanges(
          { name: name.trim(), bandThresholds: defaultBandThresholds() },
          ["name", "bandThresholds"]
        ),
        count: 0,
        items: [],
      },
    })
    return modelId
  },
})

// Onboarding escape hatch: lets an admin undo the template-vs-scratch choice
// while onboarding is still in progress. Deletes the model and every row that
// hangs off it (child-first, mirroring removeSeededOrganization for one org) plus
// the stale model.* AI suggestions, so a fresh choice starts clean. Blocked
// once onboarding has completed or any role exists (discarding the model
// under existing roles would orphan their ratings and reset the org's
// evaluation basis). Idempotent on an empty org.
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
    // criteria, then the model row. Anchors and band thresholds ride along
    // on their parent documents (ADR-0006); tracks are constants.
    const criteria = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()

    // Drop the org's model-scoped AI suggestions so a stale draft cannot be
    // confirmed against a new model. Suggestion counts are tiny, so a by_org
    // collect with an in-code filter is fine. Capture the dropped set BEFORE
    // the delete loop so the audit reads in-memory docs.
    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const droppedSuggestions = suggestions.filter(
      (suggestion) =>
        suggestion.target.kind === "model.draft" ||
        suggestion.target.kind === "model.weightReview"
    )

    for (const criterion of criteria) {
      await ctx.db.delete(criterion._id)
    }

    await ctx.db.delete(model._id)

    for (const suggestion of droppedSuggestions) {
      await ctx.db.delete(suggestion._id)
    }

    await ctx.audit.log({
      type: AUDIT_EVENTS.modelDiscarded,
      payload: {
        modelId: model._id,
        name: model.name,
        // The discarded model as a full delete-snapshot (all fields to:null).
        changes: buildDeleteChanges(model, MODEL_AUDIT_FIELDS),
        // Every removed criterion as a delete-snapshot item (incl. templateKey).
        count: criteria.length,
        items: criteria.map(criterionDeleteItem),
        // Dropped suggestions: id + kind + status only (never suggestedValue).
        suggestionCount: droppedSuggestions.length,
        suggestions: droppedSuggestions.map((suggestion) => ({
          suggestionId: suggestion._id,
          kind: suggestion.target.kind,
          status: suggestion.status,
        })),
      },
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
          weightPoints: v.number(),
          order: v.number(),
          isCustom: v.boolean(),
          anchors: v.array(anchorShape),
          // Per-criterion weighting explanations (for weight points 1..5),
          // localized, for pristine template criteria; null for custom or
          // edited rows, where the UI falls back to the generic level meanings.
          weightLevels: v.union(v.array(v.string()), v.null()),
        })
      ),
      tracks: v.array(
        v.object({
          key: trackKeyValidator,
          name: v.string(),
          order: v.number(),
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
      const anchors = [...row.anchors].sort((a, b) => a.level - b.level)
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
        weightPoints: row.weightPoints,
        order: row.order,
        isCustom: row.isCustom,
        anchors:
          localized !== null
            ? anchors.map((a) => ({
                level: a.level,
                text: localized.anchors[a.level] ?? a.text,
              }))
            : anchors.map((a) => ({ level: a.level, text: a.text })),
        // Pristine template criteria serve their localized per-criterion
        // weighting explanations; custom/edited rows return null so the UI
        // falls back to the generic weight-level meanings.
        weightLevels: localized?.weightLevels ?? null,
      })
    }

    // Tracks are fixed V1 constants (ADR-0006), derived per request with
    // localized names; nothing is stored or queried.
    const tracks = TRACK_KEYS.map((key, index) => ({
      key,
      name: content.trackNames[key],
      order: index + 1,
    }))

    const thresholds = [...model.bandThresholds].sort((a, b) => a.band - b.band)

    return {
      modelId: model._id,
      // The template model name localizes; a scratch model keeps its stored,
      // user-chosen name.
      name: isTemplateModel ? content.modelName : model.name,
      templateKey: model.templateKey ?? null,
      criteria,
      tracks,
      bandThresholds: thresholds.map((threshold) => ({
        band: threshold.band,
        minScore: threshold.minScore,
      })),
    }
  },
})

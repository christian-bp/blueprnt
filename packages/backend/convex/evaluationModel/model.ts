import {
  DEFAULT_LEVEL_RULES,
  DEFAULT_ZONE_PROFILE_RULES,
  DIMENSION_KEYS,
} from "@workspace/core"
import { v } from "convex/values"
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server"
import {
  AUDIT_EVENTS,
  buildCreateChanges,
  logAudit,
  MODEL_AUDIT_FIELDS,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { criteriaLibraryContent, LIBRARY_DIMENSION } from "./criteriaLibrary"
import { clampLocale, type ProductContentLocale } from "./localize"
import {
  dimensionKeyValidator,
  libraryKeyValidator,
  trackKeyValidator,
  zoneKeyValidator,
} from "./tables"
import { TRACK_KEYS, trackName } from "./trackSchema"

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

// Resolves the org's product content locale (organizations.language, clamped
// to the five supported product locales). Shared by every mutation/query that
// localizes library content from an org-scoped ctx rather than a caller-passed
// locale, so a fresh model/criterion seeds and re-localizes in the org's own
// language, not a binary sv/en split. Read-only, so it accepts either a query
// or a mutation ctx.
export async function resolveContentLocale(
  ctx: QueryCtx | MutationCtx,
  orgId: string
): Promise<ProductContentLocale> {
  const settings = await ctx.db
    .query("organizations")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  return clampLocale(settings?.language)
}

// The calibrate-before-launch defaults (packages/core), copied into plain
// mutable arrays for storage. Used by BOTH createDefaultModel and
// seedDefaultModel so a fresh model (interactive or seeded) always starts
// from the same starting point. Nothing in the product edits
// levelRules/zoneProfileRules, so this is the only place their values are
// set.
function defaultLevelRules() {
  return DEFAULT_LEVEL_RULES.map((rule) => ({
    level: rule.level,
    minScore: rule.minScore,
  }))
}
function defaultZoneProfileRules() {
  return DEFAULT_ZONE_PROFILE_RULES.map((rule) => ({
    zone: rule.zone,
    minStep: rule.minStep,
  }))
}

// Seeds an empty draft model shell: a name from the library content's
// modelName (org-locale), the default level/zone rules, and NO criteria (the
// library picker is the only way in, ADR-0021 addendum). There is no
// template-vs-scratch choice to make; every model starts from this one path.
export const createDefaultModel = orgMutation({
  args: {},
  returns: v.id("models"),
  handler: async (ctx) => {
    await assertNoModel(ctx, ctx.orgId)
    const locale = await resolveContentLocale(ctx, ctx.orgId)
    const content = criteriaLibraryContent(locale)
    const modelId = await ctx.db.insert("models", {
      orgId: ctx.orgId,
      name: content.modelName,
      levelRules: defaultLevelRules(),
      zoneProfileRules: defaultZoneProfileRules(),
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelCreated,
      payload: {
        modelId,
        source: "default",
        locale,
        name: content.modelName,
        changes: buildCreateChanges(
          {
            name: content.modelName,
            levelRules: defaultLevelRules(),
          },
          MODEL_AUDIT_FIELDS
        ),
        count: 0,
        items: [],
      },
    })
    return modelId
  },
})

// Dev/seed-only twin of createDefaultModel that takes an explicit orgId,
// locale, and actorId instead of an auth context. The dev seed runs in a "use
// node" action with no identity, so it cannot call the orgMutation above;
// the founder authId is passed in as actorId so the model.created audit row
// is attributed to the seeded account rather than the "system" sentinel.
// Idempotent (skips when the org already has a model) rather than throwing
// modelExists. Selects nothing: assessment/seed.ts seeds the demo org's own
// criteria directly, mirroring how it has always written ratings/weights
// directly rather than through the interactive mutations.
export const seedDefaultModel = internalMutation({
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
    const content = criteriaLibraryContent(seedLocale)
    const modelId = await ctx.db.insert("models", {
      orgId,
      name: content.modelName,
      levelRules: defaultLevelRules(),
      zoneProfileRules: defaultZoneProfileRules(),
    })

    await logAudit(ctx, {
      orgId,
      type: AUDIT_EVENTS.modelCreated,
      actorId,
      payload: {
        modelId,
        source: "default",
        seeded: true,
        locale: seedLocale,
        name: content.modelName,
        changes: buildCreateChanges(
          {
            name: content.modelName,
            levelRules: defaultLevelRules(),
          },
          MODEL_AUDIT_FIELDS
        ),
        count: 0,
        items: [],
      },
    })
    return modelId
  },
})

const anchorShape = v.object({ step: v.number(), text: v.string() })

// A criterion's anchor steps from its library entry. Steps 1/3/5 are always
// defined; 2/4 exist only where the library says something more specific than
// "a considered midpoint", and the reading surface fills those gaps from the
// model's shared midpoints. Shared by the two reads below so a criterion's
// scale cannot be assembled two ways.
function criterionAnchors(entry: {
  anchor1: string
  anchor2?: string
  anchor3: string
  anchor4?: string
  anchor5: string
}): { step: number; text: string }[] {
  return [
    { step: 1, text: entry.anchor1 },
    ...(entry.anchor2 !== undefined ? [{ step: 2, text: entry.anchor2 }] : []),
    { step: 3, text: entry.anchor3 },
    ...(entry.anchor4 !== undefined ? [{ step: 4, text: entry.anchor4 }] : []),
    { step: 5, text: entry.anchor5 },
  ]
}

// What the RATING surface reads, and nothing else.
//
// A separate read rather than a slice of getModel, because the difference is
// not convenience: an assessor rates a role criterion by criterion against the
// 0-5 anchors, and must not see how much each criterion COUNTS. The weighting
// is the model owner's decision and knowing it while rating invites steering
// the score toward a level. Serving that surface from the full model wire left
// the firewall standing at render level only: the weights were in the client,
// one devtools panel away, on every rating session.
//
// So this carries no weightPoints, no weightMotivation, and no order (the
// array IS the order), and it reports approval as a bare boolean: whether
// rating is allowed at all, never who approved or when.
export const getRatingModel = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      // The gate (ADR-0023): a role cannot be rated until the model is
      // approved. The page states the precondition; the mutation enforces it.
      approved: v.boolean(),
      criteria: v.array(
        v.object({
          criterionId: v.id("criteria"),
          dimensionKey: dimensionKeyValidator,
          name: v.string(),
          measures: v.string(),
          notMeasures: v.string(),
          assessmentQuestion: v.string(),
          anchors: v.array(anchorShape),
        })
      ),
      // Fills the steps a criterion's own scale leaves out (see
      // criterionAnchors).
      midpoints: v.object({ step2: v.string(), step4: v.string() }),
    })
  ),
  handler: async (ctx, { locale }) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null

    const content = criteriaLibraryContent(clampLocale(locale))
    const rows = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    rows.sort((a, b) => a.order - b.order)

    return {
      approved: model.approval !== undefined,
      criteria: rows.map((row) => {
        const entry = content.criteria[row.libraryKey]
        return {
          criterionId: row._id,
          dimensionKey: LIBRARY_DIMENSION[row.libraryKey],
          name: entry.name,
          measures: entry.measures,
          notMeasures: entry.notMeasures,
          assessmentQuestion: entry.assessmentQuestion,
          anchors: criterionAnchors(entry),
        }
      }),
      midpoints: content.midpoints,
    }
  },
})

// The org's selection + method-law wire, localized from library content by
// libraryKey (decision 8: there is no stored text left to fall back to). The
// dimension is always derived (LIBRARY_DIMENSION), never stored. This is the
// Oversikt/picker read; getMethodModel (method.ts) separately serves the
// kriterieurvalsprotokoll + bias-review compliance surface.
export const getModel = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      modelId: v.id("models"),
      name: v.string(),
      approval: v.union(
        v.object({ approvedBy: v.string(), approvedAt: v.number() }),
        v.null()
      ),
      workingConditions: v.union(
        v.object({
          status: v.union(v.literal("active"), v.literal("testedNotMaterial")),
          motivation: v.string(),
          decidedBy: v.string(),
          decidedAt: v.number(),
        }),
        v.null()
      ),
      criteria: v.array(
        v.object({
          criterionId: v.id("criteria"),
          libraryKey: libraryKeyValidator,
          dimensionKey: dimensionKeyValidator,
          name: v.string(),
          shortUiText: v.string(),
          measures: v.string(),
          notMeasures: v.string(),
          assessmentQuestion: v.string(),
          // 1/3/5 always present; 2/4 only when the library entry has them
          // (the three section 13.5 criteria today).
          anchors: v.array(anchorShape),
          weightPoints: v.number(),
          order: v.number(),
          weightMotivation: v.union(v.string(), v.null()),
        })
      ),
      midpoints: v.object({ step2: v.string(), step4: v.string() }),
      // The name and nothing else: the columns' own help bodies are the app's
      // authored i18n copy, not the library's `question`/`why`, so shipping
      // those was shipping text no surface reads.
      dimensions: v.array(
        v.object({ key: dimensionKeyValidator, name: v.string() })
      ),
      tracks: v.array(
        v.object({
          key: trackKeyValidator,
          name: v.string(),
          order: v.number(),
        })
      ),
      levelRules: v.array(
        v.object({ level: v.number(), minScore: v.number() })
      ),
      zoneProfileRules: v.array(
        v.object({ zone: zoneKeyValidator, minStep: v.number() })
      ),
    })
  ),
  handler: async (ctx, { locale }) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null

    const resolvedLocale = clampLocale(locale)
    const content = criteriaLibraryContent(resolvedLocale)

    const criteriaRows = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    criteriaRows.sort((a, b) => a.order - b.order)
    const criteria = criteriaRows.map((row) => {
      const entry = content.criteria[row.libraryKey]
      return {
        criterionId: row._id,
        libraryKey: row.libraryKey,
        dimensionKey: LIBRARY_DIMENSION[row.libraryKey],
        name: entry.name,
        shortUiText: entry.shortUiText,
        measures: entry.measures,
        notMeasures: entry.notMeasures,
        assessmentQuestion: entry.assessmentQuestion,
        anchors: criterionAnchors(entry),
        weightPoints: row.weightPoints,
        order: row.order,
        weightMotivation: row.weightMotivation ?? null,
      }
    })

    // Tracks are fixed V1 constants (ADR-0006), derived per request with
    // localized names; nothing is stored or queried.
    const tracks = TRACK_KEYS.map((key, index) => ({
      key,
      name: trackName(resolvedLocale, key),
      order: index + 1,
    }))

    const dimensions = DIMENSION_KEYS.map((key) => ({
      key,
      name: content.dimensions[key].name,
    }))

    const levelRules = [...model.levelRules].sort((a, b) => a.level - b.level)
    const zoneProfileRules = [...model.zoneProfileRules]

    return {
      modelId: model._id,
      name: model.name,
      approval: model.approval ?? null,
      workingConditions: model.workingConditions ?? null,
      criteria,
      midpoints: content.midpoints,
      dimensions,
      tracks,
      levelRules: levelRules.map((rule) => ({
        level: rule.level,
        minScore: rule.minScore,
      })),
      zoneProfileRules: zoneProfileRules.map((rule) => ({
        zone: rule.zone,
        minStep: rule.minStep,
      })),
    }
  },
})

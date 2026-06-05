import { IMPORTANCE_LEVELS, type ImportanceLevel } from "@workspace/core"
import { v } from "convex/values"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation } from "../lib/functions"

function assertImportance(level: number): asserts level is ImportanceLevel {
  if (
    !Number.isInteger(level) ||
    !IMPORTANCE_LEVELS.includes(level as ImportanceLevel)
  ) {
    throw appError(ERROR_CODES.invalidInput)
  }
}

// Minimal criterion editor for the onboarding scratch path; E2 reuses and
// extends this surface (update, rationale, bias review).
export const addCriterion = adminMutation({
  args: {
    name: v.string(),
    description: v.string(),
    helpText: v.string(),
    importanceLevel: v.number(),
    anchors: v.array(v.string()),
  },
  returns: v.id("criteria"),
  handler: async (ctx, args) => {
    assertImportance(args.importanceLevel)
    if (args.name.trim().length === 0 || args.anchors.length !== 6) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) throw appError(ERROR_CODES.notFound)
    const existing = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    // Gaps after removal are intentional; E2 owns renumber/reorder.
    const maxOrder = existing.reduce(
      (max, criterion) => Math.max(max, criterion.order),
      0
    )
    const criterionId = await ctx.db.insert("criteria", {
      orgId: ctx.orgId,
      modelId: model._id,
      name: args.name.trim(),
      description: args.description,
      helpText: args.helpText,
      importanceLevel: args.importanceLevel,
      order: maxOrder + 1,
      isCustom: true,
    })
    for (const [level, text] of args.anchors.entries()) {
      await ctx.db.insert("criterionAnchors", { criterionId, level, text })
    }
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelUpdated,
      actorId: ctx.authUserId,
      payload: { change: "criterion.added", criterionId },
    })
    return criterionId
  },
})

// Patches importanceLevel only. Deliberately does not touch templateKey so
// template texts stay localized; importance is organization state by design.
export const updateCriterionImportance = adminMutation({
  args: {
    criterionId: v.id("criteria"),
    importanceLevel: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { criterionId, importanceLevel }) => {
    assertImportance(importanceLevel)
    const criterion = await ctx.db.get(criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    // No-op when the level is already set; avoids a spurious audit row.
    if (criterion.importanceLevel === importanceLevel) return null
    await ctx.db.patch(criterionId, { importanceLevel })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelUpdated,
      actorId: ctx.authUserId,
      payload: {
        change: "criterion.importanceChanged",
        criterionId,
        importanceLevel,
      },
    })
    return null
  },
})

// Onboarding-phase removal: no ratings can exist yet (roles arrive in E3).
// E2 must add a ratings guard before exposing removal post-onboarding.
export const removeCriterion = adminMutation({
  args: { criterionId: v.id("criteria") },
  returns: v.null(),
  handler: async (ctx, { criterionId }) => {
    const criterion = await ctx.db.get(criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    const anchors = await ctx.db
      .query("criterionAnchors")
      .withIndex("by_criterion", (q) => q.eq("criterionId", criterionId))
      .collect()
    for (const anchor of anchors) {
      await ctx.db.delete(anchor._id)
    }
    await ctx.db.delete(criterionId)
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.modelUpdated,
      actorId: ctx.authUserId,
      payload: { change: "criterion.removed", criterionId },
    })
    return null
  },
})

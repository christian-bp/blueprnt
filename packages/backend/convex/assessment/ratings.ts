import { v } from "convex/values"
import { AUDIT_EVENTS, buildChanges } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation } from "../lib/functions"
import { deriveResults } from "./compute"
import { isProfileComplete } from "./roles"

// The only hand-entered value in the whole loop (assessment glossary): a
// 0-5 integer per (role, criterion), with an optional motivation. Blind by
// design: this mutation never returns or logs a score or band; the band.shift
// wrap records derived consequences in the audit log only.
export const setRating = orgMutation({
  args: {
    roleId: v.id("roles"),
    criterionId: v.id("criteria"),
    value: v.number(),
    motivation: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { roleId, criterionId, value, motivation }) => {
    if (!Number.isInteger(value) || value < 0 || value > 5) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const role = await ctx.db.get(roleId)
    if (role === null || role.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    // Ratings are editable until the role is archived.
    if (role.archivedAt !== undefined) {
      throw appError(ERROR_CODES.roleLocked)
    }
    // The job profile is the standardized input that makes ratings
    // comparable; its mandatory core must exist before rating starts.
    if (!isProfileComplete(role)) {
      throw appError(ERROR_CODES.profileIncomplete)
    }
    const criterion = await ctx.db.get(criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }

    const trimmedMotivation = motivation?.trim()
    const existing = await ctx.db
      .query("ratings")
      .withIndex("by_role_criterion", (q) =>
        q.eq("roleId", roleId).eq("criterionId", criterionId)
      )
      .unique()

    // No-op short-circuit: identical value and motivation writes nothing and
    // audits nothing (mirrors updateCriterionImportance).
    const nextMotivation =
      trimmedMotivation === undefined || trimmedMotivation === ""
        ? undefined
        : trimmedMotivation
    if (
      existing !== null &&
      existing.value === value &&
      (motivation === undefined ||
        (existing.motivation ?? undefined) === nextMotivation)
    ) {
      return null
    }

    const before = await deriveResults(ctx, ctx.orgId)
    if (existing === null) {
      await ctx.db.insert("ratings", {
        orgId: ctx.orgId,
        roleId,
        criterionId,
        value,
        ...(nextMotivation !== undefined ? { motivation: nextMotivation } : {}),
      })
    } else {
      // motivation === undefined leaves the stored motivation untouched; an
      // empty string clears it (patching undefined removes the field).
      await ctx.db.patch(existing._id, {
        value,
        ...(motivation !== undefined ? { motivation: nextMotivation } : {}),
      })
    }
    const after = await deriveResults(ctx, ctx.orgId)
    // Thread the triggering event so each resulting band.shift records what
    // moved it (the role + criterion that was rated).
    await ctx.audit.bandShifts({
      before: before.results,
      after: after.results,
      cause: { event: AUDIT_EVENTS.ratingChanged, roleId, criterionId },
    })
    // Structured before/after over value + motivation. `existing` was read
    // before the insert/patch, so it is the true before-state. motivation is
    // role-scoped free text and is captured (the PII decision treats it as
    // role content). The `motivation === undefined` guard leaves the motivation
    // entry out entirely when the caller did not touch motivation.
    const beforeRating = {
      value: existing?.value ?? null,
      motivation: existing?.motivation ?? null,
    }
    const afterRating = {
      value,
      motivation:
        motivation === undefined
          ? beforeRating.motivation
          : (nextMotivation ?? null),
    }
    await ctx.audit.log({
      type: AUDIT_EVENTS.ratingChanged,
      payload: {
        roleId,
        criterionId,
        created: existing === null,
        changes: buildChanges(beforeRating, afterRating, [
          "value",
          "motivation",
        ]),
      },
    })
    return null
  },
})

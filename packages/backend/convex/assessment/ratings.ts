import { v } from "convex/values"
import { AUDIT_EVENTS, buildChanges } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { LIBRARY_DIMENSION } from "../evaluationModel/criteriaLibrary"
import { orgMutation } from "../lib/functions"
import { deriveResults } from "./compute"
import { isProfileComplete } from "./roles"

// The only hand-entered value in the whole loop (assessment glossary): a
// 1-5 integer per (role, criterion), or 0 for a workingConditions criterion
// ("omfattas inte"), with a motivation that becomes required at 1, 4, or 5.
// Blind by design: this mutation never returns or logs a score or level; the
// level.shift wrap records derived consequences in the audit log only.
export const setRating = orgMutation({
  args: {
    roleId: v.id("roles"),
    criterionId: v.id("criteria"),
    value: v.number(),
    motivation: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { roleId, criterionId, value, motivation }) => {
    // FIRST gate (ADR-0023): rating requires an approved model. Checked before
    // even the value range, so an unapproved org always sees the same,
    // actionable code rather than a value-shaped error that has nothing to do
    // with why the save actually failed.
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null || model.approval === undefined) {
      throw appError(ERROR_CODES.modelNotApproved)
    }
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
    // 0 ("omfattas inte") is only ever meaningful for a workingConditions
    // criterion; every other dimension floors at 1 (spec 2.5/3.1).
    const dimensionKey = LIBRARY_DIMENSION[criterion.libraryKey]
    if (dimensionKey !== "workingConditions" && value < 1) {
      throw appError(ERROR_CODES.invalidInput)
    }

    const trimmedMotivation = motivation?.trim()
    const existing = await ctx.db
      .query("ratings")
      .withIndex("by_role_criterion", (q) =>
        q.eq("roleId", roleId).eq("criterionId", criterionId)
      )
      .unique()

    // No-op short-circuit: identical value and motivation writes nothing and
    // audits nothing (mirrors rebalanceWeights' no-op return).
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

    // Motivation becomes required once the NEW value lands on 1, 4, or 5
    // (spec 2.5/17.3): the field the write actually leaves behind is what
    // counts, so an untouched motivation (motivation === undefined) falls
    // back to whatever is already stored, and only a genuinely empty result
    // is refused. A working-conditions 0 never reaches this branch.
    const effectiveMotivation =
      motivation !== undefined ? nextMotivation : existing?.motivation
    if (
      (value === 1 || value === 4 || value === 5) &&
      (effectiveMotivation === undefined || effectiveMotivation === "")
    ) {
      throw appError(ERROR_CODES.motivationRequired)
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
    // Thread the triggering event so each resulting level.shift records what
    // moved it (the role + criterion that was rated).
    await ctx.audit.levelShifts({
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

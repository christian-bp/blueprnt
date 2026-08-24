import { assertValidRatingValue } from "@workspace/core"
import { v } from "convex/values"
import { LIBRARY_DIMENSION } from "../evaluationModel/criteriaLibrary"
import { AUDIT_EVENTS } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation } from "../lib/functions"

// The assessment completion lifecycle (ADR-0023, spec 2.4/6, decision 14):
// while rating, a role's assessment is open and no results exist anywhere;
// COMPLETING it is the reveal, and it is taken at the end of the rating flow
// rather than as an errand of its own. `roles.assessment`
// (assessment/tables.ts) is the whole state: absent = open, present =
// completed, `calibratedAt` present = also calibrated.
// Method drift (assessment.completedAt < model.approval.approvedAt) is derived
// at read time by the results wire (assessment/results.ts), never stored
// here or anywhere else.
//
// None of the three mutations below wrap in ctx.audit.levelShifts. A
// level.shift row records the derivation actually moving (a rating changing
// the computed level); completing and reopening never touch the derivation,
// only what assessment/results.ts is willing to reveal from it. Wrapping a
// visibility change in the level-shift trail would log a "shift" for a level
// that never moved, which is exactly the confusion that trail exists to
// prevent.

const MAX_CALIBRATION_NOTE = 1000

// Completes a role's assessment: the reveal (spec 2.4/6). Requires the role
// active and org-owned, the model approved, and every model criterion
// carrying a rating that still satisfies current law (dimension-aware range,
// motivation required at 1/4/5) -- re-validated here rather than trusted from
// write time, since the law a rating was written under is not necessarily
// the model's law today (a criterion's own dimension is fixed once selected,
// but this is the gate that would catch a future law change touching
// existing rows).
export const completeAssessment = orgMutation({
  args: { roleId: v.id("roles") },
  returns: v.null(),
  handler: async (ctx, { roleId }) => {
    const role = await ctx.db.get(roleId)
    if (role === null || role.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    if (role.archivedAt !== undefined) {
      throw appError(ERROR_CODES.roleLocked)
    }
    if (role.assessment !== undefined) {
      throw appError(ERROR_CODES.assessmentCompleted)
    }

    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null || model.approval === undefined) {
      throw appError(ERROR_CODES.modelNotApproved)
    }

    const criteria = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    const ratingRows = await ctx.db
      .query("ratings")
      .withIndex("by_role_criterion", (q) => q.eq("roleId", roleId))
      .collect()
    const ratingByCriterion = new Map(
      ratingRows.map((rating) => [rating.criterionId as string, rating])
    )

    for (const criterion of criteria) {
      const rating = ratingByCriterion.get(criterion._id as string)
      // Missing coverage: no rating at all for one of the model's current
      // criteria (never rated, or the criterion was added after this role
      // was last touched).
      if (rating === undefined) {
        throw appError(ERROR_CODES.ratingsIncomplete)
      }
      const dimensionKey = LIBRARY_DIMENSION[criterion.libraryKey]
      try {
        assertValidRatingValue(rating.value, dimensionKey)
      } catch {
        // A stored value that no longer satisfies the dimension-aware range
        // is not a usable rating either: same code as missing coverage, the
        // role is not actually ready.
        throw appError(ERROR_CODES.ratingsIncomplete)
      }
      if (
        (rating.value === 1 || rating.value === 4 || rating.value === 5) &&
        (rating.motivation === undefined || rating.motivation.trim() === "")
      ) {
        throw appError(ERROR_CODES.motivationRequired)
      }
    }

    const completedAt = Date.now()
    await ctx.db.patch(roleId, {
      assessment: { completedBy: ctx.authUserId, completedAt },
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.assessmentCompleted,
      payload: { roleId, ratedCount: criteria.length },
    })
    return null
  },
})

// Reopens a role's assessment for re-evaluation: one press, audited, no
// confirm (decision 14). Clears the whole assessment aggregate (the completion
// AND any calibration it carried), so completing again starts a fresh reveal
// rather than resurrecting a stale calibration note against a possibly
// different set of ratings. The ratings themselves are untouched, which is
// what makes the act light: it is undone by completing again.
export const reopenAssessment = orgMutation({
  args: { roleId: v.id("roles") },
  returns: v.null(),
  handler: async (ctx, { roleId }) => {
    const role = await ctx.db.get(roleId)
    if (role === null || role.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    if (role.assessment === undefined) {
      throw appError(ERROR_CODES.assessmentNotCompleted)
    }
    await ctx.db.patch(roleId, { assessment: undefined })
    await ctx.audit.log({
      type: AUDIT_EVENTS.assessmentReopened,
      payload: { roleId },
    })
    return null
  },
})

// Confirms a completed role's placement from the calibration queue (spec 6):
// stamps calibratedBy/calibratedAt and an optional note. Requires the
// assessment already completed (calibration reviews a revealed placement, it
// does not itself reveal one). An omitted or blank note leaves any
// previously recorded note untouched, mirroring the anchor-role motivation
// update's leave-as-is rule; the note text itself never enters the audit
// trail (free-text audit practice, like a pay-mapping action's problem
// text), only whether one was given this time.
export const calibrateAssessment = orgMutation({
  args: { roleId: v.id("roles"), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { roleId, note }) => {
    const role = await ctx.db.get(roleId)
    if (role === null || role.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    const assessment = role.assessment
    if (assessment === undefined) {
      throw appError(ERROR_CODES.assessmentNotCompleted)
    }
    const trimmedNote = note !== undefined ? note.trim() : undefined
    if (
      trimmedNote !== undefined &&
      trimmedNote.length > MAX_CALIBRATION_NOTE
    ) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const noteProvided = trimmedNote !== undefined && trimmedNote.length > 0
    const nextNote = noteProvided ? trimmedNote : assessment.calibrationNote

    const calibratedAt = Date.now()
    await ctx.db.patch(roleId, {
      assessment: {
        ...assessment,
        calibratedBy: ctx.authUserId,
        calibratedAt,
        ...(nextNote !== undefined ? { calibrationNote: nextNote } : {}),
      },
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.assessmentCalibrated,
      payload: { roleId, noteProvided },
    })
    return null
  },
})

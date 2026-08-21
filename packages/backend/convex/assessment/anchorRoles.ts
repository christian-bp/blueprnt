import { v } from "convex/values"
import { trackKeyValidator } from "../evaluationModel/tables"
import {
  ANCHOR_AUDIT_FIELDS,
  AUDIT_EVENTS,
  buildChanges,
  buildCreateChanges,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { deriveResults } from "./compute"

// Anchor roles (ankarroller): 2-5 designated reference roles used to compare
// and calibrate other roles AFTER the ordinary criteria assessment (the
// anchor-role guide, 2026-06-10). The designation is an aggregate on the
// role document (assessment/tables.ts); these mutations own its lifecycle:
// designate -> active -> underReview/replaced, never deleted, so the
// calibration history stays auditable. Admin scope: designating calibration
// references is model governance.

const MAX_MOTIVATION = 1000

const anchorStatusValidator = v.union(
  v.literal("active"),
  v.literal("underReview"),
  v.literal("replaced")
)

async function levelCount(
  ctx: Parameters<typeof deriveResults>[0],
  orgId: string
): Promise<number> {
  const model = await ctx.db
    .query("models")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  if (model === null) throw appError(ERROR_CODES.notFound)
  return model.levelRules.length
}

function validateExpectedLevel(expectedLevel: number, levels: number) {
  if (
    !Number.isInteger(expectedLevel) ||
    expectedLevel < 1 ||
    expectedLevel > levels
  ) {
    throw appError(ERROR_CODES.invalidInput)
  }
}

function validateMotivation(motivation: string): string {
  const trimmed = motivation.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_MOTIVATION) {
    throw appError(ERROR_CODES.invalidInput)
  }
  return trimmed
}

// Designates a role as an anchor role. Preconditions follow the guide's
// designation process: the role must exist, not be archived, not already be
// an anchor, and must be a LOCKED reference (lock-as-reveal: an unlocked
// role's level is not revealed anywhere, so it cannot anchor anything) with a
// COMPLETE assessment (a real rating on every criterion, so the anchor has a
// criteria profile and a computed level to calibrate against).
export const designateAnchorRole = orgMutation({
  args: {
    roleId: v.id("roles"),
    expectedLevel: v.number(),
    motivation: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { roleId, expectedLevel, motivation }) => {
    const role = await ctx.db.get(roleId)
    if (role === null || role.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    if (role.archivedAt !== undefined) throw appError(ERROR_CODES.roleLocked)
    if (role.anchorRole !== undefined) {
      throw appError(ERROR_CODES.invalidTransition)
    }
    if (role.assessment === undefined) {
      throw appError(ERROR_CODES.assessmentNotLocked)
    }
    validateExpectedLevel(expectedLevel, await levelCount(ctx, ctx.orgId))
    const trimmedMotivation = validateMotivation(motivation)

    const derived = await deriveResults(ctx, ctx.orgId)
    const result = derived.results.find((row) => row.roleId === roleId)
    if (result === undefined || result.level === null) {
      throw appError(ERROR_CODES.ratingsIncomplete)
    }

    const reviewedAt = Date.now()
    await ctx.db.patch(roleId, {
      anchorRole: {
        expectedLevel,
        motivation: trimmedMotivation,
        status: "active",
        reviewedAt,
      },
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.anchorRoleDesignated,
      payload: {
        roleId,
        computedLevel: result.level,
        changes: buildCreateChanges(
          {
            expectedLevel,
            motivation: trimmedMotivation,
            status: "active",
            reviewedAt,
          },
          ANCHOR_AUDIT_FIELDS
        ),
      },
    })
    return null
  },
})

// Updates an existing designation: agreed level, motivation, or lifecycle
// status (underReview during a review round, replaced when retired). Every
// update counts as a review, so reviewedAt is always bumped, and every update
// re-reads the live computed level for the audit row -- which means every
// call, not only reactivation, requires the role still be a LOCKED reference
// (same rule as designation), so that write never leaks a derived level for
// an unlocked role. Reactivating a non-active anchor additionally re-passes
// the completeness precondition: the assessment may have become incomplete
// (e.g. a criterion was added) since it was designated, even while it stays
// locked.
export const updateAnchorRole = orgMutation({
  args: {
    roleId: v.id("roles"),
    expectedLevel: v.optional(v.number()),
    motivation: v.optional(v.string()),
    status: v.optional(anchorStatusValidator),
  },
  returns: v.null(),
  handler: async (ctx, { roleId, expectedLevel, motivation, status }) => {
    const role = await ctx.db.get(roleId)
    if (
      role === null ||
      role.orgId !== ctx.orgId ||
      role.anchorRole === undefined
    ) {
      throw appError(ERROR_CODES.notFound)
    }
    if (role.assessment === undefined) {
      throw appError(ERROR_CODES.assessmentNotLocked)
    }
    if (expectedLevel !== undefined) {
      validateExpectedLevel(expectedLevel, await levelCount(ctx, ctx.orgId))
    }
    const trimmedMotivation =
      motivation !== undefined ? validateMotivation(motivation) : undefined
    // The role's current derived level is the value the designation is
    // calibrated against, so it is always captured in the audit row (binding
    // correction #5), not only on reactivation. The same single-role level
    // derivation also gates reactivation (the assessment must still be
    // complete). Derived once and reused for both.
    const derived = await deriveResults(ctx, ctx.orgId)
    const computedLevel =
      derived.results.find((row) => row.roleId === roleId)?.level ?? null
    if (status === "active" && role.anchorRole.status !== "active") {
      if (role.archivedAt !== undefined) throw appError(ERROR_CODES.roleLocked)
      if (computedLevel === null) {
        throw appError(ERROR_CODES.ratingsIncomplete)
      }
    }

    const reviewedAt = Date.now()
    const before = {
      expectedLevel: role.anchorRole.expectedLevel,
      motivation: role.anchorRole.motivation,
      status: role.anchorRole.status,
      reviewedAt: role.anchorRole.reviewedAt,
    }
    const after = {
      expectedLevel: expectedLevel ?? before.expectedLevel,
      motivation: trimmedMotivation ?? before.motivation,
      status: status ?? before.status,
      reviewedAt,
    }
    await ctx.db.patch(roleId, { anchorRole: after })
    await ctx.audit.log({
      type: AUDIT_EVENTS.anchorRoleUpdated,
      payload: {
        roleId,
        computedLevel,
        changes: buildChanges(before, after, ANCHOR_AUDIT_FIELDS),
      },
    })
    return null
  },
})

// The org's anchor roles with their live computed level next to the agreed
// level, for the calibration surfaces (results page, rating reveal). Computed
// at read time like every result (ADR-0002). computedLevel is null for an
// unlocked role, mirroring results.ts's own locked gate: an anchor's
// designation survives its role being unlocked (only archiving retires it),
// but lock-as-reveal means the level itself is not revealed anywhere while
// unlocked, calibration surfaces included. Replaced anchors are included (the
// consumer filters by status); the list is small by design (2-5). Archived
// roles are excluded here, and archiveRole marks their designation "replaced"
// so the role page and the audit log agree with that exclusion.
export const listAnchorRoles = orgQuery({
  args: {},
  returns: v.array(
    v.object({
      roleId: v.id("roles"),
      title: v.string(),
      trackKey: trackKeyValidator,
      expectedLevel: v.number(),
      computedLevel: v.union(v.number(), v.null()),
      motivation: v.string(),
      status: anchorStatusValidator,
      reviewedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const anchors = roles.filter(
      (role) => role.anchorRole !== undefined && role.archivedAt === undefined
    )
    if (anchors.length === 0) return []
    const derived = await deriveResults(ctx, ctx.orgId)
    return anchors.map((role) => {
      const anchorRole = role.anchorRole
      if (anchorRole === undefined) throw appError(ERROR_CODES.notFound)
      const locked = role.assessment !== undefined
      return {
        roleId: role._id,
        title: role.title,
        trackKey: role.trackKey,
        expectedLevel: anchorRole.expectedLevel,
        computedLevel: locked
          ? (derived.results.find((row) => row.roleId === role._id)?.level ??
            null)
          : null,
        motivation: anchorRole.motivation,
        status: anchorRole.status,
        reviewedAt: anchorRole.reviewedAt,
      }
    })
  },
})

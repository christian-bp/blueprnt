import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { clampLocale } from "../evaluationModel/localize"
import { trackKeyValidator } from "../evaluationModel/tables"
import {
  AUDIT_EVENTS,
  buildChanges,
  buildCreateChanges,
  logAudit,
} from "../lib/audit"
import { familyNames, trackNames } from "./names"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgMutation, orgQuery } from "../lib/functions"
import { deriveResults, logBandShifts } from "./compute"

// The job profile text fields (assessment glossary). purpose and
// responsibilities are the mandatory core (required before rating).
// Title/function/team/track are identity, handled separately.
export const PROFILE_TEXT_FIELDS = ["purpose", "responsibilities"] as const
export type ProfileTextField = (typeof PROFILE_TEXT_FIELDS)[number]

const MAX_TITLE_LENGTH = 200
const MAX_FIELD_LENGTH = 5000

const optionalProfileArgs = {
  purpose: v.optional(v.string()),
  responsibilities: v.optional(v.string()),
}

// Mandatory job profile core present? (purpose + responsibilities non-empty.)
export function isProfileComplete(role: {
  purpose: string
  responsibilities: string
}): boolean {
  return (
    role.purpose.trim().length > 0 && role.responsibilities.trim().length > 0
  )
}

function assertFieldLength(value: string): void {
  if (value.length > MAX_FIELD_LENGTH) throw appError(ERROR_CODES.invalidInput)
}

// Used by Task 8 mutations (updateRole, archiveRole).
export async function requireOwnRole(
  ctx: QueryCtx & { orgId: string },
  roleId: Id<"roles">
): Promise<Doc<"roles">> {
  const role = await ctx.db.get(roleId)
  if (role === null || role.orgId !== ctx.orgId) {
    throw appError(ERROR_CODES.notFound)
  }
  return role
}

export const createRole = orgMutation({
  args: {
    title: v.string(),
    function: v.string(),
    team: v.string(),
    // The literal-union validator IS the track integrity check (ADR-0006).
    trackKey: trackKeyValidator,
    familyId: v.optional(v.id("roleFamilies")),
    ...optionalProfileArgs,
  },
  returns: v.id("roles"),
  handler: async (ctx, args) => {
    const title = args.title.trim()
    const roleFunction = args.function.trim()
    const team = args.team.trim()
    if (
      title.length === 0 ||
      title.length > MAX_TITLE_LENGTH ||
      roleFunction.length === 0 ||
      team.length === 0
    ) {
      throw appError(ERROR_CODES.invalidInput)
    }
    if (args.familyId !== undefined) {
      const family = await ctx.db.get(args.familyId)
      if (family === null || family.orgId !== ctx.orgId) {
        throw appError(ERROR_CODES.notFound)
      }
    }
    const optional: Record<string, string> = {}
    for (const field of PROFILE_TEXT_FIELDS) {
      const value = args[field]
      if (value === undefined) continue
      assertFieldLength(value)
      optional[field] = value.trim()
    }
    const roleId = await ctx.db.insert("roles", {
      orgId: ctx.orgId,
      title,
      function: roleFunction,
      team,
      trackKey: args.trackKey,
      ...(args.familyId !== undefined ? { familyId: args.familyId } : {}),
      // purpose/responsibilities are required strings in the schema; they
      // start empty and gate the rating flow via profileComplete.
      purpose: optional.purpose ?? "",
      responsibilities: optional.responsibilities ?? "",
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleCreated,
      actorId: ctx.authUserId,
      payload: {
        roleId,
        changes: buildCreateChanges(
          {
            title,
            function: roleFunction,
            team,
            trackKey: args.trackKey,
            familyId: args.familyId ?? null,
            purpose: optional.purpose ?? "",
            responsibilities: optional.responsibilities ?? "",
          },
          [
            "title",
            "function",
            "team",
            "trackKey",
            "familyId",
            "purpose",
            "responsibilities",
          ]
        ),
      },
    })
    return roleId
  },
})

export const listRoles = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.array(
    v.object({
      roleId: v.id("roles"),
      title: v.string(),
      function: v.string(),
      team: v.string(),
      trackKey: v.string(),
      trackName: v.string(),
      ratedCount: v.number(),
      totalCriteria: v.number(),
      profileComplete: v.boolean(),
      familyId: v.union(v.id("roleFamilies"), v.null()),
      familyName: v.union(v.string(), v.null()),
      trackOrder: v.number(),
    })
  ),
  handler: async (ctx, { locale }) => {
    const derived = await deriveResults(ctx, ctx.orgId)
    const resultByRole = new Map(
      derived.results.map((result) => [result.roleId, result])
    )
    const names = trackNames(locale)
    const families = await familyNames(ctx, ctx.orgId)
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const active = roles.filter((role) => role.archivedAt === undefined)
    const sortLocale = clampLocale(locale)
    active.sort((a, b) => a.title.localeCompare(b.title, sortLocale))
    return active.map((role) => {
      const result = resultByRole.get(role._id as string)
      const track = names.get(role.trackKey)
      return {
        roleId: role._id,
        title: role.title,
        function: role.function,
        team: role.team,
        trackKey: track?.key ?? "",
        trackName: track?.name ?? "",
        ratedCount: result?.ratedCount ?? 0,
        totalCriteria: derived.totalCriteria,
        profileComplete: isProfileComplete(role),
        familyId: role.familyId ?? null,
        familyName:
          role.familyId !== undefined
            ? (families.get(role.familyId as string) ?? null)
            : null,
        trackOrder: track?.order ?? 0,
      }
    })
  },
})

const ratingShape = v.object({
  criterionId: v.id("criteria"),
  value: v.number(),
  motivation: v.union(v.string(), v.null()),
})

// Full job profile readout for the role page and the rating flow. NEVER
// returns score or band: the blind rating flow reads this; results come from
// assessment/results.ts (assessment glossary, blindness).
export const getRole = orgQuery({
  args: { roleId: v.string(), locale: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      roleId: v.id("roles"),
      title: v.string(),
      function: v.string(),
      team: v.string(),
      trackKey: trackKeyValidator,
      trackName: v.string(),
      purpose: v.string(),
      responsibilities: v.string(),
      archived: v.boolean(),
      profileComplete: v.boolean(),
      ratedCount: v.number(),
      totalCriteria: v.number(),
      familyId: v.union(v.id("roleFamilies"), v.null()),
      familyName: v.union(v.string(), v.null()),
      // The anchor-role designation, when this role is a calibration anchor.
      anchorRole: v.union(
        v.null(),
        v.object({
          expectedBand: v.number(),
          motivation: v.string(),
          status: v.union(
            v.literal("active"),
            v.literal("underReview"),
            v.literal("replaced")
          ),
          reviewedAt: v.number(),
        })
      ),
      ratings: v.array(ratingShape),
    })
  ),
  handler: async (ctx, { roleId, locale }) => {
    // roleId arrives from the URL: normalize instead of trusting the format.
    const docId = ctx.db.normalizeId("roles", roleId)
    if (docId === null) return null
    const role = await ctx.db.get(docId)
    if (role === null || role.orgId !== ctx.orgId) return null

    const track = trackNames(locale).get(role.trackKey)
    const fNames = await familyNames(ctx, ctx.orgId)

    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    const criterionIds = new Set<string>()
    if (model !== null) {
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_model", (q) => q.eq("modelId", model._id))
        .collect()
      for (const criterion of criteria) {
        criterionIds.add(criterion._id as string)
      }
    }

    const ratingRows = await ctx.db
      .query("ratings")
      .withIndex("by_role_criterion", (q) => q.eq("roleId", docId))
      .collect()
    const ratings = ratingRows
      .filter((rating) => criterionIds.has(rating.criterionId as string))
      .map((rating) => ({
        criterionId: rating.criterionId,
        value: rating.value,
        motivation: rating.motivation ?? null,
      }))

    return {
      roleId: role._id,
      title: role.title,
      function: role.function,
      team: role.team,
      trackKey: role.trackKey,
      trackName: track?.name ?? role.trackKey,
      purpose: role.purpose,
      responsibilities: role.responsibilities,
      archived: role.archivedAt !== undefined,
      profileComplete: isProfileComplete(role),
      ratedCount: ratings.length,
      totalCriteria: criterionIds.size,
      familyId: role.familyId ?? null,
      familyName:
        role.familyId !== undefined
          ? (fNames.get(role.familyId as string) ?? null)
          : null,
      anchorRole: role.anchorRole ?? null,
      ratings,
    }
  },
})

export const updateRole = orgMutation({
  args: {
    roleId: v.id("roles"),
    title: v.optional(v.string()),
    function: v.optional(v.string()),
    team: v.optional(v.string()),
    trackKey: v.optional(trackKeyValidator),
    familyId: v.optional(v.union(v.id("roleFamilies"), v.null())),
    ...optionalProfileArgs,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const role = await requireOwnRole(ctx, args.roleId)
    if (role.archivedAt !== undefined) {
      throw appError(ERROR_CODES.roleLocked)
    }
    const patch: Record<string, unknown> = {}
    if (args.title !== undefined) {
      const title = args.title.trim()
      if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
        throw appError(ERROR_CODES.invalidInput)
      }
      patch.title = title
    }
    if (args.function !== undefined) {
      const roleFunction = args.function.trim()
      if (roleFunction.length === 0) throw appError(ERROR_CODES.invalidInput)
      patch.function = roleFunction
    }
    if (args.team !== undefined) {
      const team = args.team.trim()
      if (team.length === 0) throw appError(ERROR_CODES.invalidInput)
      patch.team = team
    }
    if (args.trackKey !== undefined) {
      patch.trackKey = args.trackKey
    }
    if (args.familyId !== undefined) {
      if (args.familyId === null) {
        // The null sentinel clears membership (patching undefined removes
        // the field); undefined in args means "leave unchanged".
        patch.familyId = undefined
      } else {
        const family = await ctx.db.get(args.familyId)
        if (family === null || family.orgId !== ctx.orgId) {
          throw appError(ERROR_CODES.notFound)
        }
        patch.familyId = args.familyId
      }
    }
    for (const field of PROFILE_TEXT_FIELDS) {
      const value = args[field]
      if (value === undefined) continue
      assertFieldLength(value)
      patch[field] = value.trim()
    }
    if (Object.keys(patch).length === 0) return null
    await ctx.db.patch(args.roleId, patch)
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleUpdated,
      actorId: ctx.authUserId,
      payload: {
        roleId: args.roleId,
        changes: buildChanges(role, patch, Object.keys(patch)),
      },
    })
    return null
  },
})

// Soft archive: role ids are permanent and rows are never deleted
// (assessment glossary, role-id permanence). Archived roles leave the
// results set, so the wrap logs band.shift to null for a complete role.
export const archiveRole = adminMutation({
  args: { roleId: v.id("roles") },
  returns: v.null(),
  handler: async (ctx, { roleId }) => {
    const role = await requireOwnRole(ctx, roleId)
    if (role.archivedAt !== undefined) return null
    const before = await deriveResults(ctx, ctx.orgId)
    // An archived role cannot stay an active calibration reference:
    // listAnchorRoles excludes archived roles, so without this transition
    // the designation would silently vanish from the calibration surfaces
    // while the role page kept showing it as active. Archiving retires the
    // anchor explicitly (status "replaced") with its own audit row.
    const archivedAt = Date.now()
    const retiredAnchor =
      role.anchorRole !== undefined && role.anchorRole.status !== "replaced"
        ? {
            ...role.anchorRole,
            status: "replaced" as const,
            reviewedAt: archivedAt,
          }
        : undefined
    await ctx.db.patch(roleId, {
      archivedAt,
      ...(retiredAnchor !== undefined ? { anchorRole: retiredAnchor } : {}),
    })
    const after = await deriveResults(ctx, ctx.orgId)
    await logBandShifts(ctx, {
      orgId: ctx.orgId,
      actorId: ctx.authUserId,
      before: before.results,
      after: after.results,
      cause: { event: AUDIT_EVENTS.roleUpdated, roleId },
    })
    if (retiredAnchor !== undefined) {
      await logAudit(ctx, {
        orgId: ctx.orgId,
        type: AUDIT_EVENTS.anchorRoleUpdated,
        actorId: ctx.authUserId,
        payload: {
          roleId,
          viaArchive: true,
          expectedBand: role.anchorRole?.expectedBand,
          changes: buildChanges(role.anchorRole ?? {}, retiredAnchor, [
            "status",
            "reviewedAt",
          ]),
        },
      })
    }
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleArchived,
      actorId: ctx.authUserId,
      payload: {
        roleId,
        title: role.title,
        trackKey: role.trackKey,
        function: role.function,
        team: role.team,
        familyId: role.familyId ?? null,
        anchorRetired: retiredAnchor !== undefined,
        changes: { archivedAt: { from: null, to: archivedAt } },
      },
    })
    return null
  },
})

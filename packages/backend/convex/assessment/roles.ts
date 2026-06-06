import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { clampLocale } from "../evaluationModel/localize"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { familyNames, trackLevelNames } from "./names"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgMutation, orgQuery } from "../lib/functions"
import { deriveResults, logBandShifts } from "./compute"

// The nine free-text job profile fields (assessment glossary). purpose and
// responsibilities are the mandatory core (required before rating); the rest
// are optional structured fields. Title/function/team/track/level are
// handled separately.
export const PROFILE_TEXT_FIELDS = [
  "purpose",
  "responsibilities",
  "decisionMandate",
  "stakeholders",
  "knowledge",
  "financial",
  "people",
  "risk",
  "deliverables",
] as const
export type ProfileTextField = (typeof PROFILE_TEXT_FIELDS)[number]

const MAX_TITLE_LENGTH = 200
const MAX_FIELD_LENGTH = 5000

const optionalProfileArgs = {
  purpose: v.optional(v.string()),
  responsibilities: v.optional(v.string()),
  decisionMandate: v.optional(v.string()),
  stakeholders: v.optional(v.string()),
  knowledge: v.optional(v.string()),
  financial: v.optional(v.string()),
  people: v.optional(v.string()),
  risk: v.optional(v.string()),
  deliverables: v.optional(v.string()),
}

// Mandatory job profile core present? (purpose + responsibilities non-empty;
// the other core fields are enforced non-empty at insert.)
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

// Used by Task 8 mutations (updateRole, archiveRole, setRoleStatus).
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

async function requireOwnTrackLevel(
  ctx: QueryCtx & { orgId: string },
  trackId: Id<"tracks">,
  levelId: Id<"levels">
): Promise<void> {
  const track = await ctx.db.get(trackId)
  if (track === null || track.orgId !== ctx.orgId) {
    throw appError(ERROR_CODES.notFound)
  }
  const level = await ctx.db.get(levelId)
  if (level === null || level.trackId !== trackId) {
    throw appError(ERROR_CODES.notFound)
  }
}

export const createRole = orgMutation({
  args: {
    title: v.string(),
    function: v.string(),
    team: v.string(),
    trackId: v.id("tracks"),
    levelId: v.id("levels"),
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
    await requireOwnTrackLevel(ctx, args.trackId, args.levelId)
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
      trackId: args.trackId,
      levelId: args.levelId,
      ...(args.familyId !== undefined ? { familyId: args.familyId } : {}),
      // purpose/responsibilities are required strings in the schema; they
      // start empty and gate the rating flow via profileComplete.
      purpose: optional.purpose ?? "",
      responsibilities: optional.responsibilities ?? "",
      ...Object.fromEntries(
        Object.entries(optional).filter(
          ([key]) => key !== "purpose" && key !== "responsibilities"
        )
      ),
      status: "draft",
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleCreated,
      actorId: ctx.authUserId,
      payload: { roleId },
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
      levelKey: v.string(),
      levelName: v.string(),
      status: v.string(),
      ratedCount: v.number(),
      totalCriteria: v.number(),
      profileComplete: v.boolean(),
      familyId: v.union(v.id("roleFamilies"), v.null()),
      familyName: v.union(v.string(), v.null()),
      trackOrder: v.number(),
      levelOrder: v.number(),
    })
  ),
  handler: async (ctx, { locale }) => {
    const derived = await deriveResults(ctx, ctx.orgId)
    const resultByRole = new Map(
      derived.results.map((result) => [result.roleId, result])
    )
    const names = await trackLevelNames(ctx, ctx.orgId, locale)
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
      const track = names.trackName.get(role.trackId as string)
      const level = names.levelName.get(role.levelId as string)
      return {
        roleId: role._id,
        title: role.title,
        function: role.function,
        team: role.team,
        trackKey: track?.key ?? "",
        trackName: track?.name ?? "",
        levelKey: level?.key ?? "",
        levelName: level?.name ?? "",
        status: role.status,
        ratedCount: result?.ratedCount ?? 0,
        totalCriteria: derived.totalCriteria,
        profileComplete: isProfileComplete(role),
        familyId: role.familyId ?? null,
        familyName:
          role.familyId !== undefined
            ? (families.get(role.familyId as string) ?? null)
            : null,
        trackOrder: track?.order ?? 0,
        levelOrder: level?.order ?? 0,
      }
    })
  },
})

const ratingShape = v.object({
  criterionId: v.id("criteria"),
  value: v.number(),
  motivation: v.union(v.string(), v.null()),
})

const guardrailShape = v.object({
  criterionId: v.id("criteria"),
  min: v.number(),
  max: v.number(),
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
      trackId: v.id("tracks"),
      levelId: v.id("levels"),
      trackKey: v.string(),
      trackName: v.string(),
      levelKey: v.string(),
      levelName: v.string(),
      purpose: v.string(),
      responsibilities: v.string(),
      decisionMandate: v.union(v.string(), v.null()),
      stakeholders: v.union(v.string(), v.null()),
      knowledge: v.union(v.string(), v.null()),
      financial: v.union(v.string(), v.null()),
      people: v.union(v.string(), v.null()),
      risk: v.union(v.string(), v.null()),
      deliverables: v.union(v.string(), v.null()),
      status: v.string(),
      archived: v.boolean(),
      profileComplete: v.boolean(),
      ratedCount: v.number(),
      totalCriteria: v.number(),
      familyId: v.union(v.id("roleFamilies"), v.null()),
      familyName: v.union(v.string(), v.null()),
      ratings: v.array(ratingShape),
      guardrails: v.array(guardrailShape),
    })
  ),
  handler: async (ctx, { roleId, locale }) => {
    // roleId arrives from the URL: normalize instead of trusting the format.
    const docId = ctx.db.normalizeId("roles", roleId)
    if (docId === null) return null
    const role = await ctx.db.get(docId)
    if (role === null || role.orgId !== ctx.orgId) return null

    const names = await trackLevelNames(ctx, ctx.orgId, locale)
    const track = names.trackName.get(role.trackId as string)
    const level = names.levelName.get(role.levelId as string)
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

    const guardrailRows = await ctx.db
      .query("trackGuardrails")
      .withIndex("by_level", (q) => q.eq("levelId", role.levelId))
      .collect()

    return {
      roleId: role._id,
      title: role.title,
      function: role.function,
      team: role.team,
      trackId: role.trackId,
      levelId: role.levelId,
      trackKey: track?.key ?? "",
      trackName: track?.name ?? "",
      levelKey: level?.key ?? "",
      levelName: level?.name ?? "",
      purpose: role.purpose,
      responsibilities: role.responsibilities,
      decisionMandate: role.decisionMandate ?? null,
      stakeholders: role.stakeholders ?? null,
      knowledge: role.knowledge ?? null,
      financial: role.financial ?? null,
      people: role.people ?? null,
      risk: role.risk ?? null,
      deliverables: role.deliverables ?? null,
      status: role.status,
      archived: role.archivedAt !== undefined,
      profileComplete: isProfileComplete(role),
      ratedCount: ratings.length,
      totalCriteria: criterionIds.size,
      familyId: role.familyId ?? null,
      familyName:
        role.familyId !== undefined
          ? (fNames.get(role.familyId as string) ?? null)
          : null,
      ratings,
      guardrails: guardrailRows.map((row) => ({
        criterionId: row.criterionId,
        min: row.min,
        max: row.max,
      })),
    }
  },
})

export const updateRole = orgMutation({
  args: {
    roleId: v.id("roles"),
    title: v.optional(v.string()),
    function: v.optional(v.string()),
    team: v.optional(v.string()),
    trackId: v.optional(v.id("tracks")),
    levelId: v.optional(v.id("levels")),
    familyId: v.optional(v.union(v.id("roleFamilies"), v.null())),
    ...optionalProfileArgs,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const role = await requireOwnRole(ctx, args.roleId)
    if (role.archivedAt !== undefined || role.status === "approved") {
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
    if (args.trackId !== undefined || args.levelId !== undefined) {
      // A track change always needs an explicit level on the new track; the
      // old level cannot belong to it, so requireOwnTrackLevel rejects that.
      const trackId = args.trackId ?? role.trackId
      const levelId = args.levelId ?? role.levelId
      await requireOwnTrackLevel(ctx, trackId, levelId)
      patch.trackId = trackId
      patch.levelId = levelId
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
      payload: { roleId: args.roleId, fields: Object.keys(patch) },
    })
    return null
  },
})

type RoleStatus = "draft" | "inReview" | "approved"

// Status machine (spec): draft -> inReview (member, requires complete),
// draft -> approved (admin shortcut, requires complete), inReview ->
// approved (admin), inReview -> draft (member withdraw), approved -> draft
// (admin reopen). Everything else is invalid.
export const setRoleStatus = orgMutation({
  args: {
    roleId: v.id("roles"),
    to: v.union(
      v.literal("draft"),
      v.literal("inReview"),
      v.literal("approved")
    ),
  },
  returns: v.null(),
  handler: async (ctx, { roleId, to }) => {
    const role = await requireOwnRole(ctx, roleId)
    if (role.archivedAt !== undefined) throw appError(ERROR_CODES.roleLocked)
    const from = role.status as RoleStatus

    const adminOnly =
      to === "approved" || (from === "approved" && to === "draft")
    const valid =
      (from === "draft" && to === "inReview") ||
      (from === "draft" && to === "approved") ||
      (from === "inReview" && to === "approved") ||
      (from === "inReview" && to === "draft") ||
      (from === "approved" && to === "draft")
    if (!valid) throw appError(ERROR_CODES.invalidTransition)
    if (adminOnly && ctx.role !== "admin") {
      throw appError(ERROR_CODES.adminRequired)
    }

    // Moving forward (into review or approval) requires the mandatory job
    // profile core and a fully rated role; moving back never does.
    if (to === "inReview" || to === "approved") {
      if (!isProfileComplete(role)) {
        throw appError(ERROR_CODES.profileIncomplete)
      }
      const derived = await deriveResults(ctx, ctx.orgId)
      const result = derived.results.find(
        (row) => row.roleId === (roleId as string)
      )
      if (result === undefined || !result.complete) {
        throw appError(ERROR_CODES.ratingsIncomplete)
      }
    }

    await ctx.db.patch(roleId, { status: to })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleStatusChanged,
      actorId: ctx.authUserId,
      payload: { roleId, from, to },
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
    await ctx.db.patch(roleId, { archivedAt: Date.now() })
    const after = await deriveResults(ctx, ctx.orgId)
    await logBandShifts(ctx, {
      orgId: ctx.orgId,
      actorId: ctx.authUserId,
      before: before.results,
      after: after.results,
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleArchived,
      actorId: ctx.authUserId,
      payload: { roleId },
    })
    return null
  },
})

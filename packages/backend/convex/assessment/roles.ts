import { isValidLevelForTrack } from "@workspace/constants"
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { clampLocale } from "../evaluationModel/localize"
import { trackKeyValidator } from "../evaluationModel/tables"
import {
  AUDIT_EVENTS,
  buildChanges,
  buildCreateChanges,
  ROLE_CREATE_FIELDS,
} from "../lib/audit"
import { familyNames, trackNames } from "./names"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgMutation, orgQuery } from "../lib/functions"
import { uniqueSlug } from "../lib/slug"
import { deriveResults } from "./compute"

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

// Role titles are unique within a family (case-insensitive); the same title
// may recur in a different family, and family-less roles form their own group.
// Archived roles are retired and never block a title. Org role counts are
// small, so a by_org collect is fine.
async function assertUniqueRoleTitle(
  ctx: MutationCtx,
  orgId: string,
  title: string,
  familyId: Id<"roleFamilies"> | undefined,
  excludeId?: Id<"roles">
): Promise<void> {
  const roles = await ctx.db
    .query("roles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  const lowered = title.toLowerCase()
  const scope = familyId ?? null
  const clash = roles.some(
    (role) =>
      role._id !== excludeId &&
      role.archivedAt === undefined &&
      (role.familyId ?? null) === scope &&
      role.title.toLowerCase() === lowered
  )
  if (clash) throw appError(ERROR_CODES.roleExists)
}

// A family's slug, used to prefix a role slug when its title collides with a
// role in another family. Undefined for a family-less role.
async function familySlugFor(
  ctx: QueryCtx,
  familyId: Id<"roleFamilies"> | undefined
): Promise<string | undefined> {
  if (familyId === undefined) return undefined
  const family = await ctx.db.get(familyId)
  return family?.slug
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
  // Returns the new role's id (for follow-up writes) and slug (the route
  // handle), so a caller can navigate to the role without a second read.
  returns: v.object({ roleId: v.id("roles"), slug: v.string() }),
  handler: async (ctx, args) => {
    const title = args.title.trim()
    // Function and team are optional context (empty string = not set); only
    // the title is required.
    const roleFunction = args.function.trim()
    const team = args.team.trim()
    if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
      throw appError(ERROR_CODES.invalidInput)
    }
    let familySlug: string | undefined
    if (args.familyId !== undefined) {
      const family = await ctx.db.get(args.familyId)
      if (family === null || family.orgId !== ctx.orgId) {
        throw appError(ERROR_CODES.notFound)
      }
      familySlug = family.slug
    }
    // Role titles are unique within a family; the backend is the source of
    // truth for this gate (the client form cannot check it).
    await assertUniqueRoleTitle(ctx, ctx.orgId, title, args.familyId)
    const optional: Record<string, string> = {}
    for (const field of PROFILE_TEXT_FIELDS) {
      const value = args[field]
      if (value === undefined) continue
      assertFieldLength(value)
      optional[field] = value.trim()
    }
    const slug = await uniqueSlug(ctx, "roles", ctx.orgId, title, {
      prefix: familySlug,
    })
    const roleId = await ctx.db.insert("roles", {
      orgId: ctx.orgId,
      title,
      slug,
      function: roleFunction,
      team,
      trackKey: args.trackKey,
      ...(args.familyId !== undefined ? { familyId: args.familyId } : {}),
      // purpose/responsibilities are required strings in the schema; they
      // start empty and gate the rating flow via profileComplete.
      purpose: optional.purpose ?? "",
      responsibilities: optional.responsibilities ?? "",
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.roleCreated,
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
          ROLE_CREATE_FIELDS
        ),
      },
    })
    return { roleId, slug }
  },
})

export const listRoles = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.array(
    v.object({
      roleId: v.id("roles"),
      title: v.string(),
      slug: v.string(),
      function: v.string(),
      team: v.string(),
      trackKey: v.string(),
      trackName: v.string(),
      ratedCount: v.number(),
      totalCriteria: v.number(),
      profileComplete: v.boolean(),
      familyId: v.union(v.id("roleFamilies"), v.null()),
      familyName: v.union(v.string(), v.null()),
      familySlug: v.union(v.string(), v.null()),
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
        slug: role.slug,
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
            ? (families.get(role.familyId as string)?.name ?? null)
            : null,
        familySlug:
          role.familyId !== undefined
            ? (families.get(role.familyId as string)?.slug ?? null)
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
const roleDetailShape = v.object({
  roleId: v.id("roles"),
  title: v.string(),
  slug: v.string(),
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
  familySlug: v.union(v.string(), v.null()),
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

// Builds the full profile readout for a resolved role doc. Shared by getRole
// (by id, from in-app navigation) and getRoleBySlug (by URL handle). NEVER
// returns score or band: the blind rating flow reads this; results come from
// assessment/results.ts (assessment glossary, blindness).
async function buildRoleDetail(
  ctx: QueryCtx & { orgId: string },
  role: Doc<"roles">,
  locale: string | undefined
) {
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
    .withIndex("by_role_criterion", (q) => q.eq("roleId", role._id))
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
    slug: role.slug,
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
        ? (fNames.get(role.familyId as string)?.name ?? null)
        : null,
    familySlug:
      role.familyId !== undefined
        ? (fNames.get(role.familyId as string)?.slug ?? null)
        : null,
    anchorRole: role.anchorRole ?? null,
    ratings,
  }
}

export const getRole = orgQuery({
  args: { roleId: v.string(), locale: v.optional(v.string()) },
  returns: v.union(v.null(), roleDetailShape),
  handler: async (ctx, { roleId, locale }) => {
    // roleId arrives from in-app code: normalize instead of trusting the format.
    const docId = ctx.db.normalizeId("roles", roleId)
    if (docId === null) return null
    const role = await ctx.db.get(docId)
    if (role === null || role.orgId !== ctx.orgId) return null
    return await buildRoleDetail(ctx, role, locale)
  },
})

// Resolve a role by its per-org URL slug (the route handle, not the id).
export const getRoleBySlug = orgQuery({
  args: { slug: v.string(), locale: v.optional(v.string()) },
  returns: v.union(v.null(), roleDetailShape),
  handler: async (ctx, { slug, locale }) => {
    const role = await ctx.db
      .query("roles")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", ctx.orgId).eq("slug", slug)
      )
      .first()
    if (role === null) return null
    return await buildRoleDetail(ctx, role, locale)
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
    // Function and team are optional context: an empty string clears the
    // field (undefined leaves it unchanged).
    if (args.function !== undefined) {
      patch.function = args.function.trim()
    }
    if (args.team !== undefined) {
      patch.team = args.team.trim()
    }
    if (args.trackKey !== undefined) {
      // Changing the track would orphan any active individual level: levels are
      // per-track and disjoint (IC*/Lead-*/M*; ADR-0005), so an IC3 assignment
      // cannot stay on a Manager-track role. Block the change while an active
      // assignment holds a level invalid for the new track, so HR reassigns
      // explicitly instead of leaving a level outside the role's ladder. Closed
      // (historical) assignments keep their own level and are not affected.
      if (args.trackKey !== role.trackKey) {
        const roleAssignments = await ctx.db
          .query("personAssignments")
          .withIndex("by_role", (q) =>
            q.eq("orgId", ctx.orgId).eq("roleId", role._id)
          )
          .collect()
        const wouldOrphan = roleAssignments.some(
          (a) =>
            a.endedAt === undefined &&
            !isValidLevelForTrack(args.trackKey as string, a.level)
        )
        if (wouldOrphan) throw appError(ERROR_CODES.roleTrackChangeBlocked)
      }
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
    // Re-validate (title, family) uniqueness when either changes, and refresh
    // the slug on a title change (using the effective family as the prefix).
    // Unchanged titles keep their slug so the URL never churns.
    const titleChanged = patch.title !== undefined && patch.title !== role.title
    if (titleChanged || "familyId" in patch) {
      const newTitle = (patch.title as string | undefined) ?? role.title
      const newFamilyId =
        "familyId" in patch
          ? (patch.familyId as Id<"roleFamilies"> | undefined)
          : role.familyId
      await assertUniqueRoleTitle(
        ctx,
        ctx.orgId,
        newTitle,
        newFamilyId,
        role._id
      )
      if (titleChanged) {
        patch.slug = await uniqueSlug(ctx, "roles", ctx.orgId, newTitle, {
          excludeId: role._id,
          prefix: await familySlugFor(ctx, newFamilyId),
        })
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
    await ctx.audit.log({
      type: AUDIT_EVENTS.roleUpdated,
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
    await ctx.audit.bandShifts({
      before: before.results,
      after: after.results,
      cause: { event: AUDIT_EVENTS.roleArchived, roleId },
    })
    if (retiredAnchor !== undefined) {
      await ctx.audit.log({
        type: AUDIT_EVENTS.anchorRoleUpdated,
        payload: {
          roleId,
          viaArchive: true,
          expectedBand: role.anchorRole?.expectedBand,
          // The live computed band of this role just before it leaves the
          // results set, sourced from the pre-archive derive (`before`).
          computedBand:
            before.results.find((r) => r.roleId === roleId)?.band ?? null,
          changes: buildChanges(role.anchorRole ?? {}, retiredAnchor, [
            "status",
            "reviewedAt",
          ]),
        },
      })
    }
    await ctx.audit.log({
      type: AUDIT_EVENTS.roleArchived,
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

import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { isTrackKey } from "../evaluationModel/localize"
import { trackKeyValidator } from "../evaluationModel/tables"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { clampIndustry, starterContent } from "./industryStarters"

// The starter-set contract, shared with the AI import path (ai/suggest,
// ai/starterImport): one source of truth for the size limits.
export const MAX_FAMILIES = 20
export const MAX_ROLES = 100
export const MAX_FAMILY_NAME = 100
export const MAX_ROLE_TITLE = 200

// The createStarterSet input shape: purpose/responsibilities are OPTIONAL
// because the AI-import and reconcile paths create roles with no predefined
// profile (they default to ""). The template path sends them, carrying the
// predefined profiles straight through from getIndustryStarter.
export const starterFamilyShape = v.object({
  name: v.string(),
  roles: v.array(
    v.object({
      title: v.string(),
      trackKey: v.string(),
      purpose: v.optional(v.string()),
      responsibilities: v.optional(v.string()),
    })
  ),
})

// The getIndustryStarter return shape: every predefined role carries a
// purpose + responsibilities (required here, unlike the input shape).
const industryStarterFamilyShape = v.object({
  name: v.string(),
  roles: v.array(
    v.object({
      title: v.string(),
      trackKey: v.string(),
      purpose: v.string(),
      responsibilities: v.string(),
    })
  ),
})

export interface StarterFamilyInput {
  name: string
  roles: {
    title: string
    trackKey: string
    purpose?: string
    responsibilities?: string
  }[]
}

// The industry starter for the onboarding families step. Display only: the
// org's saved industry picks the set, the locale picks the language, and
// nothing is written until createStarterSet runs with the user's adjusted
// list (founder decision 2026-06-06: pre-filled and adjustable).
export const getIndustryStarter = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.object({ families: v.array(industryStarterFamilyShape) }),
  handler: async (ctx, { locale }) => {
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    const industry = clampIndustry(settings?.industry ?? undefined)
    const content = starterContent(locale)
    return { families: content[industry] }
  },
})

// Inserts a starter set in ONE transaction: families plus their draft roles.
// Shared by the plain onboarding flow (createStarterSet) and the AI import
// confirm (ai/suggest.confirmStarterImport); `source` distinguishes them in
// the audit trail. Roles insert with EMPTY function/team (honest drafts, no
// invented data; rollfamilj stays separate from funktion/avdelning). Purpose
// and responsibilities come from the input: the template path carries the
// predefined per-role profile (so those roles arrive profileComplete and the
// onboarding prefill skips them), while the AI-import path sends none and the
// roles start empty (default "") for prefill to fill. Families never affect
// scoring, so there is no band-shift wrap.
export async function insertStarterSet(
  ctx: MutationCtx,
  args: {
    orgId: string
    actorId: string
    families: StarterFamilyInput[]
    source: "starter" | "aiImport"
  }
): Promise<{ familyCount: number; roleCount: number }> {
  const { orgId, actorId, families, source } = args
  if (families.length === 0) return { familyCount: 0, roleCount: 0 }
  if (families.length > MAX_FAMILIES) {
    throw appError(ERROR_CODES.invalidInput)
  }
  const totalRoles = families.reduce(
    (sum, family) => sum + family.roles.length,
    0
  )
  if (totalRoles > MAX_ROLES) throw appError(ERROR_CODES.invalidInput)

  // Uniqueness: against the org's existing families AND within the payload.
  const existing = await ctx.db
    .query("roleFamilies")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  const taken = new Set(existing.map((family) => family.name.toLowerCase()))

  let roleCount = 0
  for (const family of families) {
    const name = family.name.trim()
    if (name.length === 0 || name.length > MAX_FAMILY_NAME) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const lowered = name.toLowerCase()
    if (taken.has(lowered)) throw appError(ERROR_CODES.roleFamilyExists)
    taken.add(lowered)

    const familyId = await ctx.db.insert("roleFamilies", {
      orgId,
      name,
    })
    await logAudit(ctx, {
      orgId,
      type: AUDIT_EVENTS.roleFamilyCreated,
      actorId,
      payload: { familyId, name, source },
    })

    for (const role of family.roles) {
      const title = role.title.trim()
      if (title.length === 0 || title.length > MAX_ROLE_TITLE) {
        throw appError(ERROR_CODES.invalidInput)
      }
      // Tracks are fixed constants (ADR-0006): validate the client-sent
      // key against TRACK_KEYS before the schema validator would reject it
      // with a generic error.
      if (!isTrackKey(role.trackKey)) {
        throw appError(ERROR_CODES.invalidInput)
      }
      const roleId = await ctx.db.insert("roles", {
        orgId,
        title,
        function: "",
        team: "",
        trackKey: role.trackKey,
        familyId,
        purpose: role.purpose ?? "",
        responsibilities: role.responsibilities ?? "",
        status: "draft",
      })
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.roleCreated,
        actorId,
        payload: { roleId, source },
      })
      roleCount += 1
    }
  }
  return { familyCount: families.length, roleCount }
}

// Creates the adjusted starter set from the template/manual onboarding path.
// Member scope, like the role register.
export const createStarterSet = orgMutation({
  args: { families: v.array(starterFamilyShape) },
  returns: v.null(),
  handler: async (ctx, { families }) => {
    await insertStarterSet(ctx, {
      orgId: ctx.orgId,
      actorId: ctx.authUserId,
      families,
      source: "starter",
    })
    return null
  },
})

// The edited starter set: the same families shape as createStarterSet but
// every family and role may carry a real id. Present id = the thing already
// exists and is diffed; absent id = it is new.
const reconcileFamilyShape = v.object({
  familyId: v.optional(v.id("roleFamilies")),
  name: v.string(),
  roles: v.array(
    v.object({
      roleId: v.optional(v.id("roles")),
      title: v.string(),
      trackKey: trackKeyValidator,
    })
  ),
})

// Reconciles the org's role families + roles to match the EDITED starter set,
// atomically, in one mutation. This is the onboarding "families" step revisited
// after the first save: the client sends the full edited list, carrying ids for
// what already exists, and the server diffs it against the stored state.
//
// Diff algorithm (all org-scoped):
//   - Validate the payload like createStarterSet (limits, trimmed non-empty
//     names/titles within bounds, valid track keys). Reject foreign ids with
//     errors.notFound.
//   - Families: id present -> rename if the name changed (roleFamily.renamed);
//     id absent -> create (roleFamily.created), capturing the new id for its
//     roles.
//   - Roles: id present -> patch title/trackKey/familyId where they changed
//     (role.updated with the changed field names, matching updateRole); id
//     absent -> insert a draft role with empty function/team/purpose/
//     responsibilities (role.created), exactly like insertStarterSet.
//   - Removed roles: any existing non-archived role NOT in the payload is
//     ARCHIVED (archivedAt set, role.archived), never hard-deleted, so its
//     ratings and audit survive and it simply leaves the listings/results.
//   - Removed families: any existing family NOT referenced by a payload
//     familyId is hard-deleted once step 5 has archived/moved its roles, so it
//     is empty of non-archived roles (roleFamily.removed).
//
// Families never affect scoring and archiving only drops a role from results,
// so reconcile never changes ratings or the model: there is NO band-shift wrap
// here (ADR-0002 untouched), unlike archiveRole.
export const reconcileStarterSet = orgMutation({
  args: { families: v.array(reconcileFamilyShape) },
  returns: v.null(),
  handler: async (ctx, { families }) => {
    const { orgId, authUserId: actorId } = ctx

    // 1. Re-validate the payload shape, exactly like insertStarterSet.
    if (families.length > MAX_FAMILIES) throw appError(ERROR_CODES.invalidInput)
    const totalRoles = families.reduce(
      (sum, family) => sum + family.roles.length,
      0
    )
    if (totalRoles > MAX_ROLES) throw appError(ERROR_CODES.invalidInput)

    // 2. Load the org's existing non-archived state.
    const existingFamilies = await ctx.db
      .query("roleFamilies")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
    const existingFamilyById = new Map(
      existingFamilies.map((family) => [family._id as string, family])
    )
    const allRoles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
    const activeRoles = allRoles.filter((role) => role.archivedAt === undefined)
    const activeRoleById = new Map(
      activeRoles.map((role) => [role._id as string, role])
    )

    // Track which existing things the payload keeps, so the rest are removed.
    const keptFamilyIds = new Set<string>()
    const keptRoleIds = new Set<string>()

    // Normalize + validate a family name (trim, non-empty, length bound).
    const normalizeFamilyName = (raw: string): string => {
      const name = raw.trim()
      if (name.length === 0 || name.length > MAX_FAMILY_NAME) {
        throw appError(ERROR_CODES.invalidInput)
      }
      return name
    }
    const normalizeRoleTitle = (raw: string): string => {
      const title = raw.trim()
      if (title.length === 0 || title.length > MAX_ROLE_TITLE) {
        throw appError(ERROR_CODES.invalidInput)
      }
      return title
    }

    // 2b. Validate the whole payload BEFORE any write, so a rejection rolls
    // back cleanly (nothing is written). Two invariants the dedicated
    // mutations enforce but this org-scoped reconcile must not bypass:
    //
    //   Family-name uniqueness (case-insensitive, per org), mirroring
    //   assertUniqueName: build the set of lowercased names the payload will
    //   PRODUCE (kept-by-id families keep their own name; an existing family
    //   may keep its own name via exceptId semantics) and reject the first
    //   collision with roleFamilyExists. This covers create, rename onto
    //   another family, and keep-by-id + new-with-same-name alike.
    //
    //   Role lock (roleLocked, like updateRole/archiveRole): an approved or
    //   archived role may not be modified (title/trackKey/familyId change),
    //   and an approved role may not be archived by omission. Archiving a
    //   draft/inReview role by omission stays allowed (the onboarding edit).
    const resultingFamilyNames = new Set<string>()
    for (const family of families) {
      const name = normalizeFamilyName(family.name)
      const lowered = name.toLowerCase()
      if (resultingFamilyNames.has(lowered)) {
        throw appError(ERROR_CODES.roleFamilyExists)
      }
      resultingFamilyNames.add(lowered)

      // Resolve a kept family's target id once so the role-lock pre-pass can
      // tell whether a kept role's family actually changes.
      let targetFamilyId: string | undefined
      if (family.familyId !== undefined) {
        const existing = existingFamilyById.get(family.familyId as string)
        if (existing === undefined) throw appError(ERROR_CODES.notFound)
        targetFamilyId = existing._id as string
      }

      for (const role of family.roles) {
        const title = normalizeRoleTitle(role.title)
        if (!isTrackKey(role.trackKey)) {
          throw appError(ERROR_CODES.invalidInput)
        }
        if (role.roleId === undefined) continue
        const existing = activeRoleById.get(role.roleId as string)
        if (existing === undefined) throw appError(ERROR_CODES.notFound)
        // A kept approved/archived role may not be modified.
        const wouldModify =
          existing.title !== title ||
          existing.trackKey !== role.trackKey ||
          (existing.familyId as string | undefined) !== targetFamilyId
        if (
          wouldModify &&
          (existing.status === "approved" || existing.archivedAt !== undefined)
        ) {
          throw appError(ERROR_CODES.roleLocked)
        }
      }
    }
    // An approved role omitted from the payload would be archived: refuse.
    // (Only active roles can be omitted; archived ones are already gone.)
    const keptRoleIdsForLockCheck = new Set<string>()
    for (const family of families) {
      for (const role of family.roles) {
        if (role.roleId !== undefined) {
          keptRoleIdsForLockCheck.add(role.roleId as string)
        }
      }
    }
    for (const role of activeRoles) {
      if (keptRoleIdsForLockCheck.has(role._id as string)) continue
      if (role.status === "approved") throw appError(ERROR_CODES.roleLocked)
    }

    // 3 + 4. Reconcile families, then their roles.
    for (const family of families) {
      const name = normalizeFamilyName(family.name)
      let familyId: Id<"roleFamilies">
      if (family.familyId !== undefined) {
        // Existing family: must belong to this org.
        const existing = existingFamilyById.get(family.familyId as string)
        if (existing === undefined) throw appError(ERROR_CODES.notFound)
        familyId = existing._id
        keptFamilyIds.add(familyId as string)
        // Rename only when the name actually changed (no-op otherwise:
        // no write, no audit row).
        if (existing.name !== name) {
          await ctx.db.patch(familyId, { name })
          await logAudit(ctx, {
            orgId,
            type: AUDIT_EVENTS.roleFamilyRenamed,
            actorId,
            payload: { familyId, name },
          })
        }
      } else {
        // New family.
        familyId = await ctx.db.insert("roleFamilies", { orgId, name })
        await logAudit(ctx, {
          orgId,
          type: AUDIT_EVENTS.roleFamilyCreated,
          actorId,
          payload: { familyId, name, source: "starter" },
        })
      }

      for (const role of family.roles) {
        const title = normalizeRoleTitle(role.title)
        // The literal-union validator already guarantees the track key, but
        // guard defensively in case the validator is ever loosened.
        if (!isTrackKey(role.trackKey)) {
          throw appError(ERROR_CODES.invalidInput)
        }
        if (role.roleId !== undefined) {
          // Existing role: must belong to this org and not be archived.
          const existing = activeRoleById.get(role.roleId as string)
          if (existing === undefined) throw appError(ERROR_CODES.notFound)
          keptRoleIds.add(existing._id as string)
          // Patch only the fields that changed, recording their names in the
          // audit payload exactly like updateRole.
          const patch: Record<string, unknown> = {}
          if (existing.title !== title) {
            patch.title = title
            // The job profile is NAME-derived (AI prefill drafts it from the
            // title), so a renamed role's old profile no longer fits: clear
            // purpose + responsibilities so the next prefill regenerates them.
            // Only on a title change (a track-only or family-only edit keeps
            // the profile); only clear non-empty fields, so an already-empty
            // profile stays a no-op and is not re-listed in the audit fields.
            if (existing.purpose !== "") patch.purpose = ""
            if (existing.responsibilities !== "") patch.responsibilities = ""
          }
          if (existing.trackKey !== role.trackKey)
            patch.trackKey = role.trackKey
          if ((existing.familyId as string | undefined) !== familyId) {
            patch.familyId = familyId
          }
          if (Object.keys(patch).length > 0) {
            await ctx.db.patch(existing._id, patch)
            await logAudit(ctx, {
              orgId,
              type: AUDIT_EVENTS.roleUpdated,
              actorId,
              payload: { roleId: existing._id, fields: Object.keys(patch) },
            })
          }
        } else {
          // New draft role: empty function/team/purpose/responsibilities
          // (honest drafts, no invented data), exactly like insertStarterSet.
          const roleId = await ctx.db.insert("roles", {
            orgId,
            title,
            function: "",
            team: "",
            trackKey: role.trackKey,
            familyId,
            purpose: "",
            responsibilities: "",
            status: "draft",
          })
          await logAudit(ctx, {
            orgId,
            type: AUDIT_EVENTS.roleCreated,
            actorId,
            payload: { roleId, source: "starter" },
          })
        }
      }
    }

    // 5. Removed roles: any existing non-archived role not kept by the payload
    // is archived (never hard-deleted). No band-shift wrap: reconcile never
    // changes ratings or the model, and an archived role simply leaves results.
    for (const role of activeRoles) {
      if (keptRoleIds.has(role._id as string)) continue
      // An archived role cannot stay an active calibration reference, so retire
      // the anchor with its own audit row (mirrors archiveRole).
      const retiredAnchor =
        role.anchorRole !== undefined && role.anchorRole.status !== "replaced"
          ? {
              ...role.anchorRole,
              status: "replaced" as const,
              reviewedAt: Date.now(),
            }
          : undefined
      await ctx.db.patch(role._id, {
        archivedAt: Date.now(),
        ...(retiredAnchor !== undefined ? { anchorRole: retiredAnchor } : {}),
      })
      if (retiredAnchor !== undefined) {
        await logAudit(ctx, {
          orgId,
          type: AUDIT_EVENTS.anchorRoleUpdated,
          actorId,
          payload: { roleId: role._id, status: "replaced", viaArchive: true },
        })
      }
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.roleArchived,
        actorId,
        payload: { roleId: role._id },
      })
    }

    // 6. Removed families: any existing family the payload no longer references
    // is removed. Step 5 has already archived its roles, so it holds no
    // non-archived roles; clear any remaining (archived) membership and delete.
    for (const family of existingFamilies) {
      if (keptFamilyIds.has(family._id as string)) continue
      const clearedRoleIds: Id<"roles">[] = []
      for (const role of allRoles) {
        if (role.familyId !== family._id) continue
        await ctx.db.patch(role._id, { familyId: undefined })
        clearedRoleIds.push(role._id)
      }
      await ctx.db.delete(family._id)
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.roleFamilyRemoved,
        actorId,
        payload: { familyId: family._id, name: family.name, clearedRoleIds },
      })
    }

    return null
  },
})

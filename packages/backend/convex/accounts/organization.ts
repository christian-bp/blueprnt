import { MIN_CRITERIA } from "@workspace/core"
import { v } from "convex/values"
import { components, internal } from "../_generated/api"
import { action, internalMutation, internalQuery } from "../_generated/server"
import {
  assertValidImageBlob,
  clearStoredImage,
  IMAGE_UPLOAD_MAX_BYTES,
  replaceStoredImage,
} from "../files"
import {
  AUDIT_EVENTS,
  buildChanges,
  logAudit,
  SETTINGS_AUDIT_FIELDS,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import {
  adminMutation,
  adminQuery,
  orgQuery,
  requireOrgAdminAction,
} from "../lib/functions"

const settingsShape = v.object({
  orgId: v.string(),
  country: v.union(v.string(), v.null()),
  currency: v.union(v.string(), v.null()),
  language: v.union(v.string(), v.null()),
  employeeCount: v.union(v.number(), v.null()),
  industry: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
  pseudonymizeNames: v.boolean(),
})

export const getOrganizationSettings = orgQuery({
  args: {},
  returns: settingsShape,
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (settings === null) throw appError(ERROR_CODES.notFound)
    const imageUrl =
      settings.imageId != null
        ? await ctx.storage.getUrl(settings.imageId)
        : null
    return {
      orgId: settings.orgId,
      country: settings.country ?? null,
      currency: settings.currency ?? null,
      language: settings.language ?? null,
      employeeCount: settings.employeeCount ?? null,
      industry: settings.industry ?? null,
      imageUrl,
      pseudonymizeNames: settings.pseudonymizeNames ?? false,
    }
  },
})

// Upsert: if the trigger-seeded row exists, patch it; otherwise insert a new
// one. This makes it safe to call updateOrganizationSettings immediately after
// organization.create, before the onOrganizationCreate trigger has committed.
export const updateOrganizationSettings = adminMutation({
  args: {
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    language: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
    industry: v.optional(v.string()),
    pseudonymizeNames: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (settings === null) {
      await ctx.db.insert("organizations", { orgId: ctx.orgId, ...args })
    } else {
      await ctx.db.patch(settings._id, args)
    }
    await ctx.audit.log({
      type: AUDIT_EVENTS.organizationSettingsUpdated,
      // `settings` is read before the write, so it is the correct before-state.
      // `created` flags the upsert-insert path; employeeCount is included so a
      // changed headcount is captured in the diff.
      payload: {
        created: settings === null,
        changes: buildChanges(settings ?? {}, args, SETTINGS_AUDIT_FIELDS),
      },
    })
    return null
  },
})

// Marks onboarding as finished by stamping onboardingCompletedAt. The gate
// trusts this explicit, persisted act instead of inferring "done" from the
// presence of a model. Upsert posture mirrors updateOrganizationSettings: insert
// an empty row if the trigger-seeded one is not there yet. Idempotent: the
// first timestamp is kept and no second audit row is written on re-calls.
// Composition floor: a model may not be finished with fewer than
// MIN_CRITERIA criteria (the wizard's Next gates enforce this in the UI;
// this is the server-side backstop).
export const completeOnboarding = adminMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    // Lifted to outer scope so the audit payload can report the criteria count.
    let count: number | null = null
    if (model !== null) {
      count = (
        await ctx.db
          .query("criteria")
          .withIndex("by_model", (q) => q.eq("modelId", model._id))
          .collect()
      ).length
      if (count < MIN_CRITERIA) throw appError(ERROR_CODES.tooFewCriteria)
    }
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    // Hoisted so the stamped value and the audited `to` are identical.
    const completedAt = Date.now()
    if (settings === null) {
      await ctx.db.insert("organizations", {
        orgId: ctx.orgId,
        onboardingCompletedAt: completedAt,
      })
    } else {
      if (typeof settings.onboardingCompletedAt === "number") return null
      await ctx.db.patch(settings._id, { onboardingCompletedAt: completedAt })
    }
    await ctx.audit.log({
      type: AUDIT_EVENTS.onboardingCompleted,
      // The early-return guard means a re-stamp never reaches here, so `from` is
      // structurally null: this is a one-time completion stamp, not an edit.
      payload: {
        created: settings === null,
        criteriaCount: count ?? null,
        hadModel: model !== null,
        changes: {
          onboardingCompletedAt: {
            from: settings?.onboardingCompletedAt ?? null,
            to: completedAt,
          },
        },
      },
    })
    return null
  },
})

// Thin app-boundary wrapper so the auth hook can branch the reset/welcome email
// on whether the user has set a password yet.
export const userHasPassword = internalQuery({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { userId }) =>
    ctx.runQuery(components.betterAuth.provisioning.hasPassword, { userId }),
})

// Used by the auth invitation callback to resolve the organization's language so
// the invite email goes out in the org's locale. Not org-scoped: the caller is
// Better Auth (no app session), and it only exposes the language.
export const getLanguageForOrg = internalQuery({
  args: { orgId: v.string() },
  returns: v.union(
    v.null(),
    v.object({ language: v.union(v.string(), v.null()) })
  ),
  handler: async (ctx, { orgId }) => {
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    if (settings === null) return null
    return { language: settings.language ?? null }
  },
})

// Used by the auth password-reset callback to resolve the user's org language
// so reset emails go out in the org's locale. Maps via the user's first
// membership (users have exactly one org in V1). Not org-scoped: the caller is
// Better Auth (no app session), and it only exposes the language.
export const getLanguageForUser = internalQuery({
  args: { userId: v.string() },
  returns: v.union(
    v.null(),
    v.object({ language: v.union(v.string(), v.null()) })
  ),
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.runQuery(
      components.betterAuth.membership.listMembershipsForUser,
      { userId }
    )
    const selected = memberships[0]
    if (selected === undefined) return null
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", selected.organizationId))
      .unique()
    if (settings === null) return null
    return { language: settings.language ?? null }
  },
})

// --- Org logo (org-domain content, audited; never person PII) ---

// Org logo upload. An ACTION so a rejected blob can be deleted outside a
// transaction (a thrown mutation would roll the delete back). Admin-gated via
// requireOrgAdminAction (actions cannot use adminMutation). Validates the blob,
// then delegates the row write + audit to the internal applyOrgAvatar mutation.
export const setOrgAvatar = action({
  args: { orgId: v.string(), storageId: v.id("_storage") },
  returns: v.string(),
  handler: async (ctx, { orgId, storageId }): Promise<string> => {
    const actorId = await requireOrgAdminAction(ctx, orgId)
    await assertValidImageBlob(ctx, storageId, IMAGE_UPLOAD_MAX_BYTES)
    return await ctx.runMutation(
      internal.accounts.organization.applyOrgAvatar,
      {
        orgId,
        storageId,
        actorId,
      }
    )
  },
})

// Associates a validated blob as the org logo, replacing any previous file, and
// audits organization.logoUpdated. Internal: only setOrgAvatar (after the admin
// + blob checks) calls it. Upserts the organizations row defensively.
export const applyOrgAvatar = internalMutation({
  args: { orgId: v.string(), storageId: v.id("_storage"), actorId: v.string() },
  returns: v.string(),
  handler: async (ctx, { orgId, storageId, actorId }) => {
    const row = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    const url = await replaceStoredImage(ctx, {
      previousId: row?.imageId ?? null,
      storageId,
    })
    if (row === null) {
      await ctx.db.insert("organizations", { orgId, imageId: storageId })
    } else {
      await ctx.db.patch(row._id, { imageId: storageId })
    }
    await logAudit(ctx, {
      orgId,
      actorId,
      type: AUDIT_EVENTS.organizationLogoUpdated,
      payload: {},
    })
    return url
  },
})

// Removes the org logo (file + field) and audits organization.logoRemoved.
// No-op when there is no logo. Admin-only.
export const removeOrgAvatar = adminMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (row === null || row.imageId == null) return null
    await clearStoredImage(ctx, row.imageId)
    await ctx.db.patch(row._id, { imageId: undefined })
    await ctx.audit.log({
      type: AUDIT_EVENTS.organizationLogoRemoved,
      payload: {},
    })
    return null
  },
})

// --- Org name (lives on the Better Auth org record, not the app mirror) ---

// Org name edit. Admin-only; audited as organization.nameUpdated with the
// old/new name diffed. updateOrganizationIdentity raw-patches the component row,
// which does not fire the member/invitation adapter triggers, so we log the
// audit row explicitly with the real admin actor.
export const updateOrganizationName = adminMutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, { name }) => {
    const trimmed = name.trim()
    if (trimmed === "") throw appError(ERROR_CODES.invalidInput)
    const current = await ctx.runQuery(
      components.betterAuth.provisioning.getOrganization,
      { orgId: ctx.orgId }
    )
    const from = current?.name ?? null
    if (from === trimmed) return null
    await ctx.runMutation(
      components.betterAuth.provisioning.updateOrganizationIdentity,
      { orgId: ctx.orgId, name: trimmed }
    )
    await ctx.audit.log({
      type: AUDIT_EVENTS.organizationNameUpdated,
      payload: { changes: { name: { from, to: trimmed } } },
    })
    return null
  },
})

// --- Team members (admin-managed; role change + removal with last-admin guard) ---

const memberRoleArg = v.union(v.literal("admin"), v.literal("editor"))

// Pure: would changing/removing this member leave the org admin-less?
function isSoleAdmin(
  members: { userId: string; role: string }[],
  userId: string
): boolean {
  const target = members.find((m) => m.userId === userId)
  if (target === undefined || target.role !== "admin") return false
  return members.filter((m) => m.role === "admin").length === 1
}

// The team roster. Admin-only (this surface is admin-only). Wraps the component
// listMembers (id + name + email + role; bounded at 500).
export const listOrgMembers = adminQuery({
  args: {},
  returns: v.array(
    v.object({
      userId: v.string(),
      name: v.string(),
      email: v.string(),
      role: v.string(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.runQuery(components.betterAuth.provisioning.listMembers, {
      organizationId: ctx.orgId,
    })
  },
})

// Change a member's role. Admin-only. Refuses to demote the sole admin (would
// leave the org admin-less). The raw provisioning patch bypasses the adapter
// trigger, so member.roleChanged is logged explicitly with the real admin actor.
export const updateMemberRole = adminMutation({
  args: { userId: v.string(), role: memberRoleArg },
  returns: v.null(),
  handler: async (ctx, { userId, role }) => {
    const members = await ctx.runQuery(
      components.betterAuth.provisioning.listMembers,
      { organizationId: ctx.orgId }
    )
    if (role === "editor" && isSoleAdmin(members, userId)) {
      throw appError(ERROR_CODES.lastAdmin)
    }
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.setMemberRole,
      { organizationId: ctx.orgId, userId, role }
    )
    if (result === null || result.from === role) return null
    await ctx.audit.log({
      type: AUDIT_EVENTS.memberRoleChanged,
      payload: {
        memberUserId: userId,
        changes: { role: { from: result.from, to: role } },
      },
    })
    return null
  },
})

// Remove a member. Admin-only. Refuses to remove the sole admin. Logs
// member.removed explicitly with the real admin actor.
export const removeMember = adminMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const members = await ctx.runQuery(
      components.betterAuth.provisioning.listMembers,
      { organizationId: ctx.orgId }
    )
    if (isSoleAdmin(members, userId)) {
      throw appError(ERROR_CODES.lastAdmin)
    }
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.removeMember,
      { organizationId: ctx.orgId, userId }
    )
    if (result === null) return null
    await ctx.audit.log({
      type: AUDIT_EVENTS.memberRemoved,
      payload: {
        memberUserId: userId,
        changes: { role: { from: result.role, to: null } },
      },
    })
    return null
  },
})

import { isValidSlug } from "@workspace/constants"
import { v } from "convex/values"
import { components } from "../_generated/api"
import { query } from "../_generated/server"
import { onOrganizationCreate, onUserCreate } from "../accounts/mirrors"
import {
  buildChanges,
  PLATFORM_AUDIT_EVENTS,
  logPlatformAudit,
} from "../lib/audit"
import { ERROR_CODES, appError } from "../lib/errors"
import { platformMutation, platformQuery } from "../lib/functions"

const roleArg = v.union(v.literal("admin"), v.literal("editor"))

// Non-throwing: returns false for anyone who is not a platform admin (signed
// out, no mirror row, or flag unset), so the avatar-menu link simply hides.
// The real security boundary is platformMutation/platformQuery, never this.
export const isPlatformAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) return false
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique()
    return user?.isPlatformAdmin === true
  },
})

// Create a Better Auth user (no password yet) plus the app users mirror, and
// record the operator action. The new user receives a set-password email from
// the client (authClient.requestPasswordReset) after this resolves.
export const createUser = platformMutation({
  args: { name: v.string(), email: v.string() },
  returns: v.object({ authId: v.string(), created: v.boolean() }),
  handler: async (ctx, { name, email }) => {
    const trimmedName = name.trim()
    // Lowercase the email so the mirror, the component user row, and the
    // idempotency check all key off one canonical form.
    const trimmedEmail = email.trim().toLowerCase()
    if (trimmedName === "" || trimmedEmail === "") {
      throw appError(ERROR_CODES.invalidInput)
    }
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.provisionUser,
      { email: trimmedEmail, name: trimmedName }
    )
    // Direct component inserts bypass the Better Auth triggers, so mirror the
    // app users row explicitly (idempotent).
    await onUserCreate(ctx, {
      _id: result.userId,
      email: trimmedEmail,
      name: trimmedName,
    })
    if (result.created) {
      await logPlatformAudit(ctx, {
        actorId: ctx.authUserId,
        type: PLATFORM_AUDIT_EVENTS.userCreated,
        targetUserId: result.userId,
        payload: {},
      })
    }
    return { authId: result.userId, created: result.created }
  },
})

export const createOrganization = platformMutation({
  args: { name: v.string(), slug: v.string() },
  returns: v.object({ orgId: v.string(), created: v.boolean() }),
  handler: async (ctx, { name, slug }) => {
    const trimmedName = name.trim()
    const normalizedSlug = slug.trim().toLowerCase()
    if (trimmedName === "" || normalizedSlug === "") {
      throw appError(ERROR_CODES.invalidInput)
    }
    // Server-side slug rule (shared with the client Zod gate): reject anything
    // that is not a clean lowercase hyphenated slug before it reaches the
    // component.
    if (!isValidSlug(normalizedSlug)) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.provisionOrganization,
      { name: trimmedName, slug: normalizedSlug }
    )
    // Mirror the app organizations row. onOrganizationCreate also writes the
    // org's own organization.created lifecycle row (actor "system"), exactly
    // as seeded orgs do; the operator-attributed record goes to the admin log
    // only. Idempotent.
    await onOrganizationCreate(ctx, { _id: result.orgId })
    if (result.created) {
      await logPlatformAudit(ctx, {
        actorId: ctx.authUserId,
        type: PLATFORM_AUDIT_EVENTS.orgCreated,
        targetOrgId: result.orgId,
        payload: {},
      })
    }
    return { orgId: result.orgId, created: result.created }
  },
})

// Validates the user mirror and org mirror both exist; throws errors.notFound
// otherwise so no display text crosses the wire.
async function assertUserAndOrg(
  ctx: { db: import("../_generated/server").QueryCtx["db"] },
  authId: string,
  orgId: string
): Promise<void> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", authId))
    .unique()
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  if (user === null || org === null) throw appError(ERROR_CODES.notFound)
}

export const addMembership = platformMutation({
  args: { authId: v.string(), orgId: v.string(), role: roleArg },
  returns: v.null(),
  handler: async (ctx, { authId, orgId, role }) => {
    await assertUserAndOrg(ctx, authId, orgId)
    const { created } = await ctx.runMutation(
      components.betterAuth.provisioning.addMember,
      { organizationId: orgId, userId: authId, role }
    )
    if (!created) return null // idempotent: already a member, nothing to log
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.membershipGranted,
      targetUserId: authId,
      targetOrgId: orgId,
      payload: { role },
    })
    return null
  },
})

export const setMembershipRole = platformMutation({
  args: { authId: v.string(), orgId: v.string(), role: roleArg },
  returns: v.null(),
  handler: async (ctx, { authId, orgId, role }) => {
    await assertUserAndOrg(ctx, authId, orgId)
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.setMemberRole,
      { organizationId: orgId, userId: authId, role }
    )
    if (result === null) throw appError(ERROR_CODES.notFound)
    if (result.from === role) return null // no-op
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.membershipRoleChanged,
      targetUserId: authId,
      targetOrgId: orgId,
      payload: { from: result.from, to: role },
    })
    return null
  },
})

export const removeMembership = platformMutation({
  args: { authId: v.string(), orgId: v.string() },
  returns: v.null(),
  handler: async (ctx, { authId, orgId }) => {
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.removeMember,
      { organizationId: orgId, userId: authId }
    )
    if (result === null) throw appError(ERROR_CODES.notFound)
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.membershipRevoked,
      targetUserId: authId,
      targetOrgId: orgId,
      payload: {},
    })
    return null
  },
})

// All users across the installation (basic identity). Cross-org by design.
export const listUsers = platformQuery({
  args: {},
  returns: v.array(
    v.object({
      authId: v.string(),
      name: v.string(),
      email: v.string(),
      isPlatformAdmin: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const baUsers = await ctx.runQuery(
      components.betterAuth.provisioning.listAllUsers,
      {}
    )
    // Join the app mirror to surface the platform-admin flag.
    const result: {
      authId: string
      name: string
      email: string
      isPlatformAdmin: boolean
    }[] = []
    for (const u of baUsers) {
      const mirror = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", u.userId))
        .unique()
      result.push({
        authId: u.userId,
        name: u.name,
        email: u.email,
        isPlatformAdmin: mirror?.isPlatformAdmin === true,
      })
    }
    return result
  },
})

// All organizations with their app-side settings.
export const listOrganizations = platformQuery({
  args: {},
  returns: v.array(
    v.object({
      orgId: v.string(),
      name: v.string(),
      slug: v.string(),
      country: v.union(v.null(), v.string()),
      currency: v.union(v.null(), v.string()),
      language: v.union(v.null(), v.string()),
      industry: v.union(v.null(), v.string()),
      onboarded: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const baOrgs = await ctx.runQuery(
      components.betterAuth.provisioning.listAllOrganizations,
      {}
    )
    const result: {
      orgId: string
      name: string
      slug: string
      country: string | null
      currency: string | null
      language: string | null
      industry: string | null
      onboarded: boolean
    }[] = []
    for (const o of baOrgs) {
      const settings = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", o.orgId))
        .unique()
      result.push({
        orgId: o.orgId,
        name: o.name,
        slug: o.slug,
        country: settings?.country ?? null,
        currency: settings?.currency ?? null,
        language: settings?.language ?? null,
        industry: settings?.industry ?? null,
        onboarded: typeof settings?.onboardingCompletedAt === "number",
      })
    }
    return result
  },
})

// The admin audit trail, newest first. Target ids are resolved to human labels
// (user email, org name) best-effort; an erased or unknown target falls back to
// its raw id. V1 like the other list queries: a 200-row cap and a 500-row
// enrichment cap (the component list helpers .take(500)), no pagination.
export const listAuditLog = platformQuery({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      at: v.number(),
      actorId: v.string(),
      actorName: v.string(),
      type: v.string(),
      targetUser: v.union(v.null(), v.string()),
      targetOrg: v.union(v.null(), v.string()),
      payload: v.any(),
    })
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("platformAuditLog").order("desc").take(200)
    const users = await ctx.runQuery(
      components.betterAuth.provisioning.listAllUsers,
      {}
    )
    const orgs = await ctx.runQuery(
      components.betterAuth.provisioning.listAllOrganizations,
      {}
    )
    const userLabel = new Map(users.map((u) => [u.userId, u.email]))
    const orgLabel = new Map(orgs.map((o) => [o.orgId, o.name]))
    return rows.map((r) => ({
      id: r._id.toString(),
      at: r._creationTime,
      actorId: r.actorId,
      actorName: r.actorName,
      type: r.type,
      targetUser:
        r.targetUserId !== undefined
          ? (userLabel.get(r.targetUserId) ?? r.targetUserId)
          : null,
      targetOrg:
        r.targetOrgId !== undefined
          ? (orgLabel.get(r.targetOrgId) ?? r.targetOrgId)
          : null,
      payload: r.payload,
    }))
  },
})

// One org's members (identity + role), for the manage view.
export const listOrganizationMembers = platformQuery({
  args: { orgId: v.string() },
  returns: v.array(
    v.object({
      authId: v.string(),
      name: v.string(),
      email: v.string(),
      role: v.string(),
    })
  ),
  handler: async (ctx, { orgId }) => {
    const members = await ctx.runQuery(
      components.betterAuth.provisioning.listMembers,
      { organizationId: orgId }
    )
    return members.map((m) => ({
      authId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
    }))
  },
})

// Edit org identity (name/slug, in the component) and settings (country/
// currency/language/industry, in the app mirror). All fields optional.
export const updateOrganization = platformMutation({
  args: {
    orgId: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    language: v.optional(v.string()),
    industry: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, name, slug, ...settings }) => {
    const mirror = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    if (mirror === null) throw appError(ERROR_CODES.notFound)
    // Treat undefined AND empty-string (after trim) as "not provided": the
    // frontend sends all fields from controlled inputs, often "". An empty
    // value is not a meaningful setting, so it is ignored rather than written.
    const trimmedName = name?.trim()
    const normalizedSlug = slug?.trim().toLowerCase()
    const hasName = trimmedName !== undefined && trimmedName !== ""
    const hasSlug = normalizedSlug !== undefined && normalizedSlug !== ""
    // Validate the slug server-side when one is provided (shared rule with the
    // client Zod gate); the component then guards uniqueness on the update.
    if (hasSlug && !isValidSlug(normalizedSlug)) {
      throw appError(ERROR_CODES.invalidInput)
    }
    if (hasName || hasSlug) {
      await ctx.runMutation(
        components.betterAuth.provisioning.updateOrganizationIdentity,
        {
          orgId,
          ...(hasName ? { name: trimmedName } : {}),
          ...(hasSlug ? { slug: normalizedSlug } : {}),
        }
      )
    }
    // Only entries whose trimmed value DIFFERS from the current mirror value
    // are a real change. Empty/undefined values are "not provided", and a value
    // equal to the current one is a no-op: both are excluded so the
    // changed.length === 0 guard suppresses the redundant write and audit row.
    const mirrorValues = mirror as Record<string, unknown>
    const settingsPatch = Object.fromEntries(
      Object.entries(settings)
        .map(([key, val]) => [key, val?.trim()] as const)
        .filter(
          ([key, val]) =>
            val !== undefined && val !== "" && val !== mirrorValues[key]
        )
    )
    if (Object.keys(settingsPatch).length > 0) {
      await ctx.db.patch(mirror._id, settingsPatch)
    }
    const changed = [
      ...(hasName ? ["name"] : []),
      ...(hasSlug ? ["slug"] : []),
      ...Object.keys(settingsPatch),
    ]
    // True no-op: nothing meaningful provided. Skip the patch and the audit
    // row entirely, matching the membership/role mutations' discipline.
    if (changed.length === 0) return null
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.orgUpdated,
      targetOrgId: orgId,
      // Structured before->after diff for the settings fields. Name/slug old
      // values live in the BA component and the manage UI does not send them,
      // so they stay out of `changes` for now.
      payload: {
        changes: buildChanges(mirror, settingsPatch, [
          "country",
          "currency",
          "language",
          "industry",
        ]),
      },
    })
    return null
  },
})

// Tombstone replacing a deleted person's snapshotted name in append-only logs.
const ERASED_ACTOR_NAME = "deleted user"

// GDPR erasure. Deletes every identity/membership/invitation row (via the
// component), the app users mirror, and anonymizes the person's snapshotted
// actorName in both audit logs (the rows are kept for the trail's legitimate-
// interest basis, and their payloads carry IDs/codes only, never PII). The
// erasure itself is recorded in the ADMIN log only; nothing is written to any
// org's auditLog. Self-delete is blocked. The admin-log payload carries a
// non-identifying org count, never the erased name/email.
export const deleteUser = platformMutation({
  args: { authId: v.string() },
  returns: v.null(),
  handler: async (ctx, { authId }) => {
    if (authId === ctx.authUserId) throw appError(ERROR_CODES.invalidInput)
    const { orgIds } = await ctx.runMutation(
      components.betterAuth.provisioning.eraseUser,
      { userId: authId }
    )
    // App mirror.
    const mirror = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", authId))
      .unique()
    if (mirror !== null) await ctx.db.delete(mirror._id)
    // Anonymize this person's snapshotted name in both audit logs.
    const orgAuthored = await ctx.db
      .query("auditLog")
      .withIndex("by_actor", (q) => q.eq("actorId", authId))
      .collect()
    for (const row of orgAuthored) {
      await ctx.db.patch(row._id, { actorName: ERASED_ACTOR_NAME })
    }
    const platformAuthored = await ctx.db
      .query("platformAuditLog")
      .withIndex("by_actor", (q) => q.eq("actorId", authId))
      .collect()
    for (const row of platformAuthored) {
      await ctx.db.patch(row._id, { actorName: ERASED_ACTOR_NAME })
    }
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.userDeleted,
      targetUserId: authId,
      payload: { orgCount: orgIds.length },
    })
    return null
  },
})

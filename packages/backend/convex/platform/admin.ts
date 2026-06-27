import { isValidSlug } from "@workspace/constants"
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { components, internal } from "../_generated/api"
import { query } from "../_generated/server"
import type { QueryCtx } from "../_generated/server"
import { onOrganizationCreate, onUserCreate } from "../accounts/mirrors"
import {
  buildChanges,
  PLATFORM_AUDIT_CATEGORIES,
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

// Create a Better Auth user (no password yet) plus the app users mirror,
// attach them to the given org, and record both operator actions. The new
// user receives a welcome (set-password) email from the client
// (authClient.requestPasswordReset) after this resolves. A user is never
// created without an organization: the membership is added atomically.
export const createUser = platformMutation({
  args: {
    name: v.string(),
    email: v.string(),
    orgId: v.string(),
    role: roleArg,
  },
  returns: v.object({ authId: v.string(), created: v.boolean() }),
  handler: async (ctx, { name, email, orgId, role }) => {
    const trimmedName = name.trim()
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
    // Require + attach the org membership in the same mutation so a user is
    // never created without an organization. assertUserAndOrg throws notFound
    // if the org does not exist.
    await assertUserAndOrg(ctx, result.userId, orgId)
    const membership = await ctx.runMutation(
      components.betterAuth.provisioning.addMember,
      { organizationId: orgId, userId: result.userId, role }
    )
    if (membership.created) {
      await logPlatformAudit(ctx, {
        actorId: ctx.authUserId,
        type: PLATFORM_AUDIT_EVENTS.membershipGranted,
        targetUserId: result.userId,
        targetOrgId: orgId,
        payload: { role },
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

// One admin audit row with its target ids resolved to human labels (user email,
// org name) for display. The labels are resolved at READ time only and never
// stored, keeping the platformAuditLog table id-only/PII-free; an erased or
// unknown target falls back to its raw id. category rides along for filtering.
const platformAuditRow = v.object({
  id: v.string(),
  at: v.number(),
  actorId: v.string(),
  actorName: v.string(),
  type: v.string(),
  category: v.optional(v.string()),
  // The resolved target name (user name, or org name), or null when the row has
  // no such target OR the target was since deleted. The *Missing flags
  // distinguish "no target" (false) from "target deleted" (true) so the client
  // can show a localized "deleted" label instead of a raw id. We never return
  // the raw id as display text.
  targetUser: v.union(v.null(), v.string()),
  targetUserMissing: v.boolean(),
  targetOrg: v.union(v.null(), v.string()),
  targetOrgMissing: v.boolean(),
  payload: v.any(),
})

type PlatformAuditRowDoc = {
  _id: { toString(): string }
  _creationTime: number
  actorId: string
  actorName: string
  type: string
  category?: string
  targetUserId?: string
  targetOrgId?: string
  payload: unknown
}

// Narrows an incoming category arg to a known PLATFORM_AUDIT_CATEGORIES value,
// or null when it is absent/invalid (the browse query then falls back to the
// full table, and the search query drops the category filter).
function validPlatformCategory(category: string | undefined): string | null {
  if (category === undefined) return null
  return (PLATFORM_AUDIT_CATEGORIES as readonly string[]).includes(category)
    ? category
    : null
}

// Shared target resolution for both audit queries. Fetches the cross-org user
// and org lists from the Better Auth component, builds id -> name maps, and maps
// each page/result row to the display shape: targetUserId -> user name (else
// email), targetOrgId -> org name. A target that no longer resolves (the user or
// org was deleted) yields a null label and a *Missing flag, so the client shows
// a localized "deleted" label, never the raw id. The labels are display-only and
// never persisted, so the stored rows stay id-only.
async function resolvePlatformTargets(
  ctx: QueryCtx,
  rows: PlatformAuditRowDoc[]
): Promise<Array<typeof platformAuditRow.type>> {
  const users = await ctx.runQuery(
    components.betterAuth.provisioning.listAllUsers,
    {}
  )
  const orgs = await ctx.runQuery(
    components.betterAuth.provisioning.listAllOrganizations,
    {}
  )
  const userLabel = new Map(users.map((u) => [u.userId, u.name || u.email]))
  const orgLabel = new Map(orgs.map((o) => [o.orgId, o.name]))
  return rows.map((r) => {
    const targetUser =
      r.targetUserId !== undefined
        ? (userLabel.get(r.targetUserId) ?? null)
        : null
    const targetOrg =
      r.targetOrgId !== undefined ? (orgLabel.get(r.targetOrgId) ?? null) : null
    return {
      id: r._id.toString(),
      at: r._creationTime,
      actorId: r.actorId,
      actorName: r.actorName,
      type: r.type,
      ...(r.category !== undefined ? { category: r.category } : {}),
      targetUser,
      targetUserMissing: r.targetUserId !== undefined && targetUser === null,
      targetOrg,
      targetOrgMissing: r.targetOrgId !== undefined && targetOrg === null,
      payload: r.payload,
    }
  })
}

// The earliest admin audit row's creation time, or null when the trail is
// empty. Used by the client to default the date-range picker to the full span
// (earliest entry to today). The earliest entry is the first platform action.
// The default order is by _creationTime, so ascending + first = the oldest row.
export const auditLogBounds = platformQuery({
  args: {},
  returns: v.object({ earliest: v.union(v.null(), v.number()) }),
  handler: async (ctx) => {
    const oldest = await ctx.db.query("platformAuditLog").order("asc").first()
    return { earliest: oldest?._creationTime ?? null }
  },
})

// The admin audit trail (platform-admin only), paginated and newest-first. When
// `category` is a known PLATFORM_AUDIT_CATEGORIES value the by_category index
// scopes the page to that area; otherwise the by_creation_time index pages the
// full table (so the optional date range can ride an index in either branch).
// The optional `start`/`end` epoch-ms bounds restrict `_creationTime` inclusively
// (start <= _creationTime <= end): in the category branch after the category eq,
// in the no-category branch directly on by_creation_time. Each page row has its
// target ids resolved to display labels. The Convex pagination result shape
// carries optional framework fields (splitCursor/pageStatus), so no explicit
// `returns` validator is set here (mirroring the org listAuditLog): a
// hand-written object validator would reject those framework fields.
export const listAuditLog = platformQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    start: v.optional(v.number()),
    end: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const category = validPlatformCategory(args.category)
    const { start, end } = args
    const result =
      category !== null
        ? await ctx.db
            .query("platformAuditLog")
            .withIndex("by_category", (q) => {
              // The _creationTime range follows the category eq field. Explicit
              // branches: the builder's type narrows after the first .gte/.lte,
              // so a reassignment would not typecheck.
              const base = q.eq("category", category)
              if (start !== undefined && end !== undefined) {
                return base
                  .gte("_creationTime", start)
                  .lte("_creationTime", end)
              }
              if (start !== undefined) return base.gte("_creationTime", start)
              if (end !== undefined) return base.lte("_creationTime", end)
              return base
            })
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("platformAuditLog")
            // No category eq, so the range goes directly on the built-in
            // by_creation_time index. With both bounds absent this is equivalent
            // to a full table scan (the prior bare-table behavior).
            .withIndex("by_creation_time", (q) => {
              if (start !== undefined && end !== undefined) {
                return q.gte("_creationTime", start).lte("_creationTime", end)
              }
              if (start !== undefined) return q.gte("_creationTime", start)
              if (end !== undefined) return q.lte("_creationTime", end)
              return q
            })
            .order("desc")
            .paginate(args.paginationOpts)
    return {
      ...result,
      page: await resolvePlatformTargets(ctx, result.page),
    }
  },
})

// Full-text search over the admin audit trail (platform-admin only). Like the
// org search, results are relevance-ranked, capped, and NOT paginated (search
// indexes are not .order()-able), so this is a separate query the client uses
// while a search term is active; an empty term returns no rows. A known category
// further constrains the search via the index filter field. searchText is built
// PII-free (actor + type + payload codes), so search covers the operator, the
// action, and payload codes, NOT resolved target names/emails.
export const searchAuditLog = platformQuery({
  args: {
    search: v.string(),
    category: v.optional(v.string()),
    start: v.optional(v.number()),
    end: v.optional(v.number()),
  },
  returns: v.object({ rows: v.array(platformAuditRow) }),
  handler: async (ctx, args) => {
    const search = args.search.trim()
    if (search.length === 0) return { rows: [] }
    const category = validPlatformCategory(args.category)
    const { start, end } = args
    const rows = await ctx.db
      .query("platformAuditLog")
      .withSearchIndex("search_text", (q) => {
        let s = q.search("searchText", search)
        if (category !== null) s = s.eq("category", category)
        return s
      })
      .take(50)
    // The search index filterFields are equality-only, so the date range cannot
    // be an index filter: apply it in memory over the top-50 relevance results.
    // A date-filtered search may therefore return fewer than 50 rows (the range
    // is intersected with the relevance cap, not applied before it).
    const inRange = rows.filter(
      (r) =>
        (start === undefined || r._creationTime >= start) &&
        (end === undefined || r._creationTime <= end)
    )
    return { rows: await resolvePlatformTargets(ctx, inRange) }
  },
})

// All organizations the user belongs to, with the org name and role. Used by
// the per-user Organizations dialog. The betterAuth membership component already
// returns organizationName, so no extra join is needed.
export const listOrganizationsForUser = platformQuery({
  args: { authId: v.string() },
  returns: v.array(
    v.object({
      orgId: v.string(),
      name: v.string(),
      role: v.string(),
    })
  ),
  handler: async (ctx, { authId }) => {
    const memberships = await ctx.runQuery(
      components.betterAuth.membership.listMembershipsForUser,
      { userId: authId }
    )
    return memberships.map((m) => ({
      orgId: m.organizationId,
      name: m.organizationName,
      role: m.role,
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
// component), the app users mirror, the person's email history in the Sweego
// component (messages + deliveries + events addressed to them), and anonymizes
// the person's snapshotted actorName in both audit logs (the rows are kept for
// the trail's legitimate-interest basis, and their payloads carry IDs/codes
// only, never PII). The erasure itself is recorded in the ADMIN log only;
// nothing is written to any org's auditLog. Self-delete is blocked. The
// admin-log payload carries a non-identifying org count, never the erased
// name/email.
export const deleteUser = platformMutation({
  args: { authId: v.string() },
  returns: v.null(),
  handler: async (ctx, { authId }) => {
    if (authId === ctx.authUserId) throw appError(ERROR_CODES.invalidInput)
    const { orgIds, email } = await ctx.runMutation(
      components.betterAuth.provisioning.eraseUser,
      { userId: authId }
    )
    // GDPR erasure of the person's email PII: purge every message addressed to
    // them (with its deliveries + events) from the Sweego email component, via
    // the email module. Scheduled so it commits with the erasure. Keyed on the
    // Better Auth address returned by eraseUser (the authoritative source the
    // mirror only mirrors), so the purge runs even if the app mirror is missing.
    if (email !== null) {
      await ctx.scheduler.runAfter(
        0,
        internal.email.erasure.purgeRecipientEmails,
        { email }
      )
    }
    // App mirror.
    const mirror = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", authId))
      .unique()
    if (mirror !== null) {
      // GDPR erasure of the avatar PII: delete the stored file BEFORE the row,
      // so the personal image is gone from storage, not just dereferenced.
      if (mirror.imageId != null) await ctx.storage.delete(mirror.imageId)
      await ctx.db.delete(mirror._id)
    }
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

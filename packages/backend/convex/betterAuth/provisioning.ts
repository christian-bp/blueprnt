import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"

// The member role enum, enforced at the component boundary so it matches the
// public platform boundary's roleArg (admin/editor).
const memberRoleArg = v.union(v.literal("admin"), v.literal("editor"))

// Provision a Better Auth user with NO credential account. The account is
// created later by resetPassword when the invited user sets their password
// (better-auth 1.6.17 creates the credential row on reset if absent).
// emailVerified is true so a future requireEmailVerification flip cannot lock
// the account. Idempotent by email.
export const provisionUser = mutation({
  args: { email: v.string(), name: v.string() },
  returns: v.object({ userId: v.string(), created: v.boolean() }),
  handler: async (ctx, { email, name }) => {
    // Canonicalize the email so the lookup and the insert agree, and a
    // case-variant of an existing email cannot create a duplicate user.
    const normalizedEmail = email.trim().toLowerCase()
    const existing = await ctx.db
      .query("user")
      .withIndex("email_name", (q) => q.eq("email", normalizedEmail))
      .first()
    if (existing) return { userId: existing._id.toString(), created: false }
    const now = Date.now()
    const id = await ctx.db.insert("user", {
      email: normalizedEmail,
      name,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    return { userId: id.toString(), created: true }
  },
})

// Idempotent by slug.
export const provisionOrganization = mutation({
  args: { name: v.string(), slug: v.string() },
  returns: v.object({ orgId: v.string(), created: v.boolean() }),
  handler: async (ctx, { name, slug }) => {
    const existing = await ctx.db
      .query("organization")
      .withIndex("slug", (q) => q.eq("slug", slug))
      .first()
    if (existing) return { orgId: existing._id.toString(), created: false }
    const now = Date.now()
    const id = await ctx.db.insert("organization", {
      name,
      slug,
      createdAt: now,
    })
    return { orgId: id.toString(), created: true }
  },
})

// Idempotent on (organizationId, userId).
export const addMember = mutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    role: memberRoleArg,
  },
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx, { organizationId, userId, role }) => {
    const existing = await ctx.db
      .query("member")
      .withIndex("organizationId_userId", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .unique()
    if (existing) return { created: false }
    await ctx.db.insert("member", {
      organizationId,
      userId,
      role,
      createdAt: Date.now(),
    })
    return { created: true }
  },
})

// Returns the previous role (null if no membership) so the caller can audit
// the change and skip a no-op.
export const setMemberRole = mutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    role: memberRoleArg,
  },
  returns: v.union(v.null(), v.object({ from: v.string() })),
  handler: async (ctx, { organizationId, userId, role }) => {
    const member = await ctx.db
      .query("member")
      .withIndex("organizationId_userId", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .unique()
    if (member === null) return null
    const from = member.role
    await ctx.db.patch(member._id, { role })
    return { from }
  },
})

// Returns the removed role (null if no membership) so the caller can audit.
export const removeMember = mutation({
  args: { organizationId: v.string(), userId: v.string() },
  returns: v.union(v.null(), v.object({ role: v.string() })),
  handler: async (ctx, { organizationId, userId }) => {
    const member = await ctx.db
      .query("member")
      .withIndex("organizationId_userId", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .unique()
    if (member === null) return null
    const role = member.role
    await ctx.db.delete(member._id)
    return { role }
  },
})

// Patch organization identity (name/slug). Both optional. When a slug is
// provided, guard uniqueness: only the update path can alias two orgs onto the
// same slug (createOrganization is idempotent-by-slug), so reject if a
// DIFFERENT organization already holds it. The code maps to errors.invalidInput
// in lib/errors.ts (this component cannot import it; the boundary throws the
// code directly and the frontend translates).
export const updateOrganizationIdentity = mutation({
  args: {
    orgId: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, name, slug }) => {
    const id = ctx.db.normalizeId("organization", orgId)
    if (id === null) return null
    if (slug !== undefined) {
      const holder = await ctx.db
        .query("organization")
        .withIndex("slug", (q) => q.eq("slug", slug))
        .first()
      if (holder !== null && holder._id !== id) {
        throw new ConvexError({ code: "errors.invalidInput" })
      }
    }
    await ctx.db.patch(id, {
      ...(name !== undefined ? { name } : {}),
      ...(slug !== undefined ? { slug } : {}),
    })
    return null
  },
})

// GDPR erasure: delete every identity/membership/invitation row for a user.
// Returns the distinct org ids the user was a member of; the caller uses only
// the count for its admin-log entry. Per-org org-auditLog rows are intentionally
// not written, keeping operator actions out of tenants' logs. Bounded reads are
// fine at V1 scale.
export const eraseUser = mutation({
  args: { userId: v.string() },
  returns: v.object({ orgIds: v.array(v.string()) }),
  handler: async (ctx, { userId }) => {
    const members = await ctx.db
      .query("member")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect()
    const orgIds = [...new Set(members.map((m) => m.organizationId))]
    for (const m of members) await ctx.db.delete(m._id)
    const accounts = await ctx.db
      .query("account")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect()
    for (const a of accounts) await ctx.db.delete(a._id)
    const sessions = await ctx.db
      .query("session")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect()
    for (const s of sessions) await ctx.db.delete(s._id)
    // Invitations carry the invitee email (PII), so purge them too. Read the
    // user's email BEFORE deleting the user row, then delete invitations where
    // the user is the invitee (email index) and where they are the sender
    // (inviterId index).
    const uid = ctx.db.normalizeId("user", userId)
    const user = uid === null ? null : await ctx.db.get(uid)
    if (user !== null) {
      const invitedTo = await ctx.db
        .query("invitation")
        .withIndex("email", (q) => q.eq("email", user.email))
        .collect()
      for (const inv of invitedTo) await ctx.db.delete(inv._id)
    }
    const invitedBy = await ctx.db
      .query("invitation")
      .withIndex("inviterId", (q) => q.eq("inviterId", userId))
      .collect()
    for (const inv of invitedBy) await ctx.db.delete(inv._id)
    if (uid !== null) await ctx.db.delete(uid)
    return { orgIds }
  },
})

// Cross-org listings for the admin page. Bounded at 500 rows for V1 (pagination
// is a post-V1 follow-up; the caller surfaces no truncation today).
export const listAllUsers = query({
  args: {},
  returns: v.array(
    v.object({ userId: v.string(), name: v.string(), email: v.string() })
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("user").take(500)
    return rows.map((u) => ({
      userId: u._id.toString(),
      name: u.name,
      email: u.email,
    }))
  },
})

export const listAllOrganizations = query({
  args: {},
  returns: v.array(
    v.object({ orgId: v.string(), name: v.string(), slug: v.string() })
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("organization").take(500)
    return rows.map((o) => ({
      orgId: o._id.toString(),
      name: o.name,
      slug: o.slug,
    }))
  },
})

// Members of one org, with the member's user identity joined in.
export const listMembers = query({
  args: { organizationId: v.string() },
  returns: v.array(
    v.object({
      userId: v.string(),
      name: v.string(),
      email: v.string(),
      role: v.string(),
    })
  ),
  handler: async (ctx, { organizationId }) => {
    const members = await ctx.db
      .query("member")
      .withIndex("organizationId", (q) =>
        q.eq("organizationId", organizationId)
      )
      .take(500)
    const result: {
      userId: string
      name: string
      email: string
      role: string
    }[] = []
    for (const m of members) {
      const uid = ctx.db.normalizeId("user", m.userId)
      const user = uid === null ? null : await ctx.db.get(uid)
      result.push({
        userId: m.userId,
        name: user?.name ?? "",
        email: user?.email ?? "",
        role: m.role,
      })
    }
    return result
  },
})

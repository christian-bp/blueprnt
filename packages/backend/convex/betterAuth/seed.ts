import { v } from "convex/values"
import { mutation } from "./_generated/server"

// Dev-only seed. Only reachable via the internal action convex/seed.ts which
// enforces the localhost guard. Never expose this as a public function.
export const insertCredentialUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
  },
  returns: v.object({ userId: v.string(), created: v.boolean() }),
  handler: async (ctx, { email, name, passwordHash }) => {
    // Idempotent: if a user with this email already exists, return it.
    const existing = await ctx.db
      .query("user")
      .withIndex("email_name", (q) => q.eq("email", email))
      .first()
    if (existing) {
      return { userId: existing._id.toString(), created: false }
    }

    const now = Date.now()
    const userDocId = await ctx.db.insert("user", {
      email,
      name,
      emailVerified: true, // Accounts are provisioned pre-verified (invitation/admin-only; no self-serve sign-up).
      createdAt: now,
      updatedAt: now,
    })

    // Better Auth's credential provider uses:
    //   providerId = "credential"
    //   accountId  = the user's Better Auth id (which equals the Convex _id string)
    // Verified against sign-up.mjs: linkAccount({ userId: createdUser.id, providerId: "credential", accountId: createdUser.id, password: hash })
    const userId = userDocId.toString()
    await ctx.db.insert("account", {
      userId,
      providerId: "credential",
      accountId: userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    })

    return { userId, created: true }
  },
})

// Dev-only cleanup counterpart. Only reachable via the internal action
// convex/seed.ts which enforces the localhost guard. Deletes the user and
// its account and session rows.
export const removeUserByEmail = mutation({
  args: { email: v.string() },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("user")
      .withIndex("email_name", (q) => q.eq("email", email))
      .first()
    if (user === null) return null

    const userId = user._id.toString()
    for (const table of ["account", "session"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect()
      for (const row of rows) {
        await ctx.db.delete(row._id)
      }
    }
    await ctx.db.delete(user._id)
    return userId
  },
})

// Tables wiped by wipeAuthData. jwks is deliberately excluded (see below).
// twoFactor (TOTP secrets + backup codes) and rateLimit are included so a reset
// leaves no prior user's credentials or throttle state behind.
const AUTH_WIPE_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "organization",
  "member",
  "invitation",
  "twoFactor",
  "rateLimit",
] as const

// Page size mirrors devReset.wipeAppTables: bound the per-transaction write
// count so the mutation stays under Convex's limit and the caller loops.
const AUTH_WIPE_PAGE_SIZE = 500

// Dev-only auth wipe. Only reachable via the internal action convex/seed.ts
// which enforces the localhost guard. Clears every Better Auth table EXCEPT
// jwks: those are the JWT signing keys, and wiping them would needlessly churn
// the auth handshake (clients would have to re-establish trust on every reset)
// without buying anything, since they carry no user data. Returns done = no
// table was truncated, so the caller loops until done.
export const wipeAuthData = mutation({
  args: {},
  returns: v.object({ done: v.boolean() }),
  handler: async (ctx) => {
    let truncated = false
    for (const table of AUTH_WIPE_TABLES) {
      const rows = await ctx.db.query(table).take(AUTH_WIPE_PAGE_SIZE)
      for (const row of rows) {
        await ctx.db.delete(row._id)
      }
      if (rows.length === AUTH_WIPE_PAGE_SIZE) {
        truncated = true
      }
    }
    return { done: !truncated }
  },
})

// Dev-only organization removal. Only reachable via the internal action
// convex/seed.ts which enforces the localhost guard. Finds all orgs the
// user belongs to, deletes every member and invitation row for each org,
// then deletes the org itself. Returns the list of removed org id strings
// so the caller can clean up the app-side tables.
export const removeOrganizationsForUserEmail = mutation({
  args: { email: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("user")
      .withIndex("email_name", (q) => q.eq("email", email))
      .first()
    if (user === null) return []

    const userId = user._id.toString()
    const memberRows = await ctx.db
      .query("member")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect()

    // Collect distinct org ids from the user's memberships.
    const orgIds = [...new Set(memberRows.map((m) => m.organizationId))]

    for (const orgId of orgIds) {
      // Delete all member rows for this org.
      const orgMembers = await ctx.db
        .query("member")
        .withIndex("organizationId", (q) => q.eq("organizationId", orgId))
        .collect()
      for (const m of orgMembers) {
        await ctx.db.delete(m._id)
      }

      // Delete all invitation rows for this org.
      const invitations = await ctx.db
        .query("invitation")
        .withIndex("organizationId", (q) => q.eq("organizationId", orgId))
        .collect()
      for (const inv of invitations) {
        await ctx.db.delete(inv._id)
      }

      // Delete the org document.
      const orgDocId = ctx.db.normalizeId("organization", orgId)
      if (orgDocId !== null) {
        await ctx.db.delete(orgDocId)
      }
    }

    return orgIds
  },
})

// Dev-only organization seed. Only reachable via the internal action
// convex/seed.ts which enforces the localhost guard. Idempotent by slug;
// the member row is idempotent per (organization, user).
export const insertOrganization = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    email: v.string(),
    role: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    userId: v.string(),
    createdOrg: v.boolean(),
    createdMember: v.boolean(),
  }),
  handler: async (ctx, { name, slug, email, role }) => {
    const user = await ctx.db
      .query("user")
      .withIndex("email_name", (q) => q.eq("email", email))
      .first()
    if (user === null) {
      throw new Error(`no user with email ${email}; run seed:seedDevUser first`)
    }
    const userId = user._id.toString()

    const now = Date.now()
    let orgId: string
    let createdOrg = false
    const existingOrg = await ctx.db
      .query("organization")
      .withIndex("slug", (q) => q.eq("slug", slug))
      .first()
    if (existingOrg !== null) {
      orgId = existingOrg._id.toString()
    } else {
      orgId = (
        await ctx.db.insert("organization", { name, slug, createdAt: now })
      ).toString()
      createdOrg = true
    }

    let createdMember = false
    const existingMember = await ctx.db
      .query("member")
      .withIndex("organizationId_userId", (q) =>
        q.eq("organizationId", orgId).eq("userId", userId)
      )
      .unique()
    if (existingMember === null) {
      await ctx.db.insert("member", {
        organizationId: orgId,
        userId,
        role,
        createdAt: now,
      })
      createdMember = true
    }

    return { orgId, userId, createdOrg, createdMember }
  },
})

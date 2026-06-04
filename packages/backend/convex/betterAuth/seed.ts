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
      emailVerified: true, // Pre-verified so a future requireEmailVerification flip does not lock this account.
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

// Dev-only workspace seed. Only reachable via the internal action
// convex/seed.ts which enforces the localhost guard. Idempotent by slug;
// the member row is idempotent per (organization, user).
export const insertWorkspace = mutation({
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

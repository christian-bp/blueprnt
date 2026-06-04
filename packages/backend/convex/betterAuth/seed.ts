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

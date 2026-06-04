"use node"
// Dev-only seeding. Run from packages/backend with:
//   bunx convex run seed:seedDevUser
// Guarded so it can never run against a deployment whose SITE_URL is not
// localhost (i.e. production).
import { v } from "convex/values"
import { hashPassword } from "better-auth/crypto"
import { internalAction } from "./_generated/server"
import { components, internal } from "./_generated/api"

export const seedDevUser = internalAction({
  args: {
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  returns: v.object({ userId: v.string(), created: v.boolean() }),
  handler: async (ctx, args) => {
    const siteUrl = process.env.SITE_URL ?? ""
    if (!siteUrl.includes("localhost")) {
      throw new Error(
        "seedDevUser only runs on dev deployments (SITE_URL must contain 'localhost')"
      )
    }

    const email = args.email ?? "hej@blueprnt.se"
    const password = args.password ?? "abc123"
    const name = args.name ?? "Hej"

    // hashPassword from better-auth/crypto uses @better-auth/utils/password which
    // selects node:crypto scrypt under the Node.js runtime ("use node" above).
    // Output format: "hexSalt:hexKey" — identical to what Better Auth's sign-in
    // credential verify path (verifyPassword) expects.
    const passwordHash = await hashPassword(password)

    const result = await ctx.runMutation(
      components.betterAuth.seed.insertCredentialUser,
      { email, name, passwordHash }
    )

    // Direct component inserts bypass the Better Auth triggers, so the
    // app-side users mirror row (audit actor names, future locale setting)
    // is created explicitly.
    await ctx.runMutation(internal.accounts.mirrors.mirrorSeededUser, {
      authId: result.userId,
      email,
      name,
    })

    return result
  },
})

// Dev-only cleanup. Run from packages/backend with:
//   bunx convex run seed:removeDevUser '{"email":"..."}'
export const removeDevUser = internalAction({
  args: { email: v.string() },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, { email }) => {
    const siteUrl = process.env.SITE_URL ?? ""
    if (!siteUrl.includes("localhost")) {
      throw new Error(
        "removeDevUser only runs on dev deployments (SITE_URL must contain 'localhost')"
      )
    }
    const authId = await ctx.runMutation(
      components.betterAuth.seed.removeUserByEmail,
      { email }
    )
    if (authId !== null) {
      await ctx.runMutation(internal.accounts.mirrors.removeMirroredUser, {
        authId,
      })
    }
    return authId
  },
})

// Dev-only workspace seed: gives the seeded user an admin membership in a
// workspace so local sign-in lands in a realistic tenant. Run with:
//   bunx convex run seed:seedDevWorkspace
export const seedDevWorkspace = internalAction({
  args: {
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.object({
    orgId: v.string(),
    userId: v.string(),
    createdOrg: v.boolean(),
    createdMember: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const siteUrl = process.env.SITE_URL ?? ""
    if (!siteUrl.includes("localhost")) {
      throw new Error(
        "seedDevWorkspace only runs on dev deployments (SITE_URL must contain 'localhost')"
      )
    }

    const result = await ctx.runMutation(
      components.betterAuth.seed.insertWorkspace,
      {
        name: args.name ?? "blueprnt dev",
        slug: args.slug ?? "blueprnt-dev",
        email: args.email ?? "hej@blueprnt.se",
        role: "admin",
      }
    )

    // Direct component inserts bypass the Better Auth triggers; seed the
    // profile row and audit entries explicitly (idempotently).
    await ctx.runMutation(internal.accounts.mirrors.mirrorSeededWorkspace, {
      orgId: result.orgId,
      memberUserId: result.userId,
      role: "admin",
      auditMember: result.createdMember,
    })

    return result
  },
})

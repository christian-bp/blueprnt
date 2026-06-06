"use node"
// Dev-only seeding. Run from packages/backend with:
//   bunx convex run seed:seedDevUser
// Guarded so it can never run against a deployment whose SITE_URL is not
// localhost (i.e. production).
//
// Full database reset (seed:resetDatabase): run from the repo root with
//   bun db:reset
// or from packages/backend with
//   bunx convex run seed:resetDatabase
// Everything is deleted: the signed-in browser session dies (sign in again
// with the seeded user, hej@blueprnt.se / abc123) and onboarding restarts from
// scratch. The dev user is re-seeded at the end so local sign-in works again.
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

// Dev-only organization reset: removes all organizations (and their app-side rows)
// for the given user so the onboarding flow can be retested from step 1. Run with:
//   bunx convex run seed:removeDevOrganizations
export const removeDevOrganizations = internalAction({
  args: { email: v.optional(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const siteUrl = process.env.SITE_URL ?? ""
    if (!siteUrl.includes("localhost")) {
      throw new Error(
        "removeDevOrganizations only runs on dev deployments (SITE_URL must contain 'localhost')"
      )
    }

    const email = args.email ?? "hej@blueprnt.se"

    const orgIds = await ctx.runMutation(
      components.betterAuth.seed.removeOrganizationsForUserEmail,
      { email }
    )

    for (const orgId of orgIds) {
      await ctx.runMutation(
        internal.accounts.mirrors.removeSeededOrganization,
        {
          orgId,
        }
      )
    }

    return orgIds
  },
})

// Dev-only organization seed: gives the seeded user an admin membership in a
// organization so local sign-in lands in a realistic tenant. Run with:
//   bunx convex run seed:seedDevOrganization
export const seedDevOrganization = internalAction({
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
        "seedDevOrganization only runs on dev deployments (SITE_URL must contain 'localhost')"
      )
    }

    const result = await ctx.runMutation(
      components.betterAuth.seed.insertOrganization,
      {
        name: args.name ?? "blueprnt dev",
        slug: args.slug ?? "blueprnt-dev",
        email: args.email ?? "hej@blueprnt.se",
        role: "admin",
      }
    )

    // Direct component inserts bypass the Better Auth triggers; seed the
    // organization settings row and audit entries explicitly (idempotently).
    await ctx.runMutation(internal.accounts.mirrors.mirrorSeededOrganization, {
      orgId: result.orgId,
      memberUserId: result.userId,
      role: "admin",
      auditMember: result.createdMember,
    })

    return result
  },
})

// Dev-only full reset: wipes every app table and every Better Auth table
// (except jwks), then re-seeds the dev user. Run from the repo root with
// `bun db:reset` (or from packages/backend with
// `bunx convex run seed:resetDatabase`). See the file header for what this
// deletes and how to recover.
const MAX_WIPE_ITERATIONS = 50

export const resetDatabase = internalAction({
  args: {},
  returns: v.object({ userId: v.string() }),
  handler: async (ctx) => {
    // Stricter than the sibling guards (substring match): this action wipes
    // EVERYTHING, so the hostname must BE localhost, not merely contain it.
    const siteUrl = process.env.SITE_URL ?? ""
    let hostname = ""
    try {
      hostname = new URL(siteUrl).hostname
    } catch {
      hostname = ""
    }
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      throw new Error(
        "resetDatabase only runs on dev deployments (SITE_URL must contain 'localhost')"
      )
    }

    // Wipe the app tables, paging until no table reported a full page.
    let appIterations = 0
    while (true) {
      const { done } = await ctx.runMutation(
        internal.devReset.wipeAppTables,
        {}
      )
      if (done) break
      if (++appIterations >= MAX_WIPE_ITERATIONS) {
        throw new Error("wipe did not converge")
      }
    }

    // Wipe the Better Auth tables (component side), same paging contract.
    let authIterations = 0
    while (true) {
      const { done } = await ctx.runMutation(
        components.betterAuth.seed.wipeAuthData,
        {}
      )
      if (done) break
      if (++authIterations >= MAX_WIPE_ITERATIONS) {
        throw new Error("wipe did not converge")
      }
    }

    // Re-seed the dev user (reuses the defaults hej@blueprnt.se / abc123 / "Hej").
    const result: { userId: string; created: boolean } = await ctx.runAction(
      internal.seed.seedDevUser,
      {}
    )

    return { userId: result.userId }
  },
})

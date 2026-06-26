"use node"
// Dev-only seeding. Run from packages/backend with:
//   bunx convex run seed:seedDevUser
// Guarded so it can never run against a deployment whose SITE_URL is not
// localhost (i.e. production).
//
// Full database reset: run from the repo root with `bun db:reset` (or from
// packages/backend with `bunx convex run seed:resetDatabase`). Everything is
// deleted, then the two team accounts (Karl + Christian, the same as
// seedProduction), the onboarded+rated Blueprnt AB company, and the bare Blueprnt
// Nordic AB company are re-seeded. The signed-in browser session dies (sign in
// again with a seeded account, e.g. karl@blueprnt.se / abc123). To test
// onboarding, switch to Blueprnt Nordic AB (left intentionally un-onboarded).
import { v } from "convex/values"
import { hashPassword } from "better-auth/crypto"
import { type ActionCtx, internalAction } from "./_generated/server"
import { components, internal } from "./_generated/api"

const MAX_WIPE_ITERATIONS = 50

// Shared by resetDatabase (dev) and seedProduction: wipes every app table,
// then every Better Auth table (except jwks), paging until no table reports
// a full page.
async function wipeAllData(ctx: ActionCtx): Promise<void> {
  let appIterations = 0
  while (true) {
    const { done } = await ctx.runMutation(internal.devReset.wipeAppTables, {})
    if (done) break
    if (++appIterations >= MAX_WIPE_ITERATIONS) {
      throw new Error("wipe did not converge")
    }
  }
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
}

// The demo companies seeded into a fresh deployment (dev reset AND production
// seed). Blueprnt AB is a FULLY onboarded, rated company (settings + standard
// model + the ~40-role demo company, every role rated so the results/band view
// is populated). Blueprnt Nordic AB is left BARE (membership only), so switching
// to it opens the onboarding wizard. They model a real group: Blueprnt AB is the
// operating company, Blueprnt Nordic AB a sister entity. Idempotent (orgs keyed
// by slug; settings/model/roles seeding skip on re-run).
const SEED_ORGANIZATIONS = [
  {
    name: "Blueprnt AB",
    slug: "blueprnt-ab",
    onboarded: true,
    country: "se",
    currency: "SEK",
    language: "sv",
    industry: "itTelecom",
  },
  { name: "Blueprnt Nordic AB", slug: "blueprnt-nordic-ab", onboarded: false },
] as const

// Seeds SEED_ORGANIZATIONS for the already-existing user identified by email.
// Shared by seedDevOrganization (dev) and seedProduction (prod); the callers own
// the guard (localhost / confirm sentinel), so this helper is unguarded and is
// never exposed as a callable function.
async function seedDemoCompaniesForUser(
  ctx: ActionCtx,
  email: string
): Promise<
  {
    orgId: string
    userId: string
    createdOrg: boolean
    createdMember: boolean
  }[]
> {
  const results: {
    orgId: string
    userId: string
    createdOrg: boolean
    createdMember: boolean
  }[] = []
  for (const org of SEED_ORGANIZATIONS) {
    const result = await ctx.runMutation(
      components.betterAuth.seed.insertOrganization,
      { name: org.name, slug: org.slug, email, role: "admin" }
    )

    // The founder's Better Auth id, threaded as actorId into every
    // audit-writing seed mutation below so the seeded org's audit log reads as
    // that account having set it up rather than the "system" sentinel.
    const actorId = result.userId

    // Direct component inserts bypass the Better Auth triggers; seed the
    // app-side organization row + membership audit (always, even when bare).
    await ctx.runMutation(internal.accounts.mirrors.mirrorSeededOrganization, {
      orgId: result.orgId,
      memberUserId: result.userId,
      role: "admin",
      auditMember: result.createdMember,
      actorId,
    })

    // Onboarded org: fill settings + mark complete, create the standard model,
    // then seed rated roles so it lands on a populated dashboard. A bare org
    // (onboarded: false) gets none of this, so switching to it opens the wizard.
    if (org.onboarded) {
      await ctx.runMutation(
        internal.accounts.mirrors.seedOrganizationSettings,
        {
          orgId: result.orgId,
          country: org.country,
          currency: org.currency,
          language: org.language,
          industry: org.industry,
          completeOnboarding: true,
          actorId,
        }
      )
      await ctx.runMutation(internal.evaluationModel.model.seedStandardModel, {
        orgId: result.orgId,
        locale: org.language,
        actorId,
      })
      await ctx.runMutation(internal.assessment.seed.seedRatedRoles, {
        orgId: result.orgId,
        actorId,
      })
    }

    results.push(result)
  }
  return results
}

// The team accounts seeded into a fresh deployment, used by BOTH the dev reset
// and seedProduction so the two environments match. Both are platform admins (V1
// bootstrap so they reach /admin without an out-of-band grant) and members of
// the seeded demo orgs. They sign in with the seed password, then enrol in real
// email 2FA: in prod the OTP goes to these real inboxes; locally it is printed to
// the dev console (sendOTP logs it when NODE_ENV !== "production"). There is no
// 2FA exemption. Throwaway scaffolding, removed before go-live.
const SEED_TEAM_USERS = [
  { email: "karl@blueprnt.se", name: "Karl Stolt" },
  { email: "christian@blueprnt.se", name: "Christian Ek" },
] as const

// The local-dev password for the seeded team accounts (sign in with any
// SEED_TEAM_USERS email + this). Dev only; production uses the password passed to
// seedProduction. 8 chars so it also satisfies the prod minimum
// (minPasswordLength 8); the dev seed inserts the hash directly either way.
const DEV_PASSWORD = "abcd1234"

// Adds an already-provisioned user as an admin member of every seeded org (the
// orgs must already exist via seedDemoCompaniesForUser). insertOrganization is
// idempotent by slug and per (org, user), so this only inserts the membership;
// the mirror writes that member's app-side row + the member.added audit.
async function addUserToSeededOrganizations(
  ctx: ActionCtx,
  email: string
): Promise<void> {
  for (const org of SEED_ORGANIZATIONS) {
    const result = await ctx.runMutation(
      components.betterAuth.seed.insertOrganization,
      { name: org.name, slug: org.slug, email, role: "admin" }
    )
    await ctx.runMutation(internal.accounts.mirrors.mirrorSeededOrganization, {
      orgId: result.orgId,
      memberUserId: result.userId,
      role: "admin",
      auditMember: result.createdMember,
      actorId: result.userId,
    })
  }
}

// Creates every SEED_TEAM_USERS account with the given password hash (each
// flagged platform admin), then seeds the demo companies for the first account
// and adds the rest as members of the same orgs so the whole team shares them.
// Shared by the dev reset and seedProduction; the caller owns the wipe and the
// guard. Returns the created Better Auth user ids.
//
// PRE-LAUNCH BOOTSTRAP: the platform-admin flag lets the founders reach /admin
// without an out-of-band grant while we build V1. At real go-live this whole
// surface is deleted and platform admins are granted via
// internal.platform.bootstrap.grantPlatformAdminByEmail instead.
async function seedTeamAccounts(
  ctx: ActionCtx,
  passwordHash: string
): Promise<string[]> {
  // Direct component inserts bypass the Better Auth triggers, so each app-side
  // users row is mirrored explicitly.
  const userIds: string[] = []
  for (const u of SEED_TEAM_USERS) {
    const result = await ctx.runMutation(
      components.betterAuth.seed.insertCredentialUser,
      { email: u.email, name: u.name, passwordHash }
    )
    await ctx.runMutation(internal.accounts.mirrors.mirrorSeededUser, {
      authId: result.userId,
      email: u.email,
      name: u.name,
      isPlatformAdmin: true,
    })
    userIds.push(result.userId)
  }

  const [first, ...rest] = SEED_TEAM_USERS
  await seedDemoCompaniesForUser(ctx, first.email)
  for (const u of rest) {
    await addUserToSeededOrganizations(ctx, u.email)
  }
  return userIds
}

// TODO(go-live): remove this action (and this whole wipe-capable surface)
// before real customer data exists; tracked in packages/backend/README.md
// under "Before go-live".
//
// Production reset + seed, the prod sibling of resetDatabase. Self-serve
// sign-up is disabled (disableSignUp in auth.ts) and the dev seeds are
// localhost-guarded, so this internalAction (never callable from clients)
// is the admin path to a clean demo state: it wipes EVERY app table and
// EVERY Better Auth table (except jwks) on the target deployment, then
// creates the team accounts (SEED_TEAM_USERS) and seeds the same demo companies
// as a dev reset (Blueprnt AB rated + Blueprnt Nordic AB bare), with both
// founders as members. The destructive step is gated by the confirm sentinel
// instead of a hostname guard, and the password hash is computed BEFORE the wipe
// so nothing can fail after the data is gone. Run from packages/backend with:
//   bunx convex run seed:seedProduction '{"password":"...","confirm":"wipe-and-seed"}' --prod
export const seedProduction = internalAction({
  args: {
    password: v.string(),
    confirm: v.string(),
  },
  returns: v.object({ userIds: v.array(v.string()) }),
  handler: async (ctx, { password, confirm }) => {
    if (confirm !== "wipe-and-seed") {
      throw new Error(
        'seedProduction: pass confirm: "wipe-and-seed" to acknowledge that this deletes ALL data on the deployment'
      )
    }
    // Matches Better Auth's default minimum password length so the accounts
    // are consistent with what the auth endpoints would accept.
    if (password.length < 8) {
      throw new Error("seedProduction: password must be at least 8 characters")
    }

    // Hash before the wipe: the only Node-only call happens while the data is
    // still intact. Both accounts share this bootstrap password; each then
    // enrols in real email 2FA on first sign-in.
    const passwordHash = await hashPassword(password)
    await wipeAllData(ctx)
    const userIds = await seedTeamAccounts(ctx, passwordHash)
    return { userIds }
  },
})

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
      isPlatformAdmin: true,
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

// Dev-only organization seed: seeds the demo companies (Blueprnt AB rated +
// Blueprnt Nordic AB bare) for the dev user. Localhost-guarded; the shared
// seeding lives in
// seedDemoCompaniesForUser (also used by seedProduction). Idempotent.
// Run with: bunx convex run seed:seedDevOrganization
export const seedDevOrganization = internalAction({
  args: { email: v.optional(v.string()) },
  returns: v.array(
    v.object({
      orgId: v.string(),
      userId: v.string(),
      createdOrg: v.boolean(),
      createdMember: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const siteUrl = process.env.SITE_URL ?? ""
    if (!siteUrl.includes("localhost")) {
      throw new Error(
        "seedDevOrganization only runs on dev deployments (SITE_URL must contain 'localhost')"
      )
    }
    return await seedDemoCompaniesForUser(ctx, args.email ?? "hej@blueprnt.se")
  },
})

// Stricter than the sibling guards (substring match): the reset actions wipe
// EVERYTHING, so the hostname must BE localhost, not merely contain it.
function assertResettable(actionName: string) {
  const siteUrl = process.env.SITE_URL ?? ""
  let hostname = ""
  try {
    hostname = new URL(siteUrl).hostname
  } catch {
    hostname = ""
  }
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error(
      `${actionName} only runs on dev deployments (SITE_URL must contain 'localhost')`
    )
  }
}

// Dev-only full reset: wipes every app table and every Better Auth table (except
// jwks), then re-seeds the SAME team accounts as production (Karl + Christian,
// password DEV_PASSWORD) and the demo companies (Blueprnt AB rated + Blueprnt
// Nordic AB bare), with both founders as members. Sign-in (e.g. karl@blueprnt.se
// / abc123) lands on Blueprnt AB's populated dashboard, then the mandatory 2FA
// setup (read the OTP from the dev console); switch to Blueprnt Nordic AB to test
// onboarding (it is intentionally left un-onboarded). Run from the repo root with
// `bun db:reset`.
export const resetDatabase = internalAction({
  args: {},
  returns: v.object({ userIds: v.array(v.string()) }),
  handler: async (ctx) => {
    assertResettable("resetDatabase")
    await wipeAllData(ctx)
    const userIds = await seedTeamAccounts(
      ctx,
      await hashPassword(DEV_PASSWORD)
    )
    return { userIds }
  },
})

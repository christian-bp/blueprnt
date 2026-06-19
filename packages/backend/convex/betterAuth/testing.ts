import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Fail closed outside tests. convex-test sets CONVEX_TEST=true via the
// backend vitest config (test.env); the live Convex deployment never sets it,
// so these seeds throw there. The error code keeps display text out of the
// backend even on this defensive path.
function assertTestEnv() {
  if (process.env.CONVEX_TEST !== "true") {
    // Keep in sync with ERROR_CODES in convex/lib/errors.ts (component boundary prevents the import).
    throw new ConvexError({ code: "errors.notFound" })
  }
}

// Test-only seeding. Lives inside the component so it can write the auth
// tables directly; component functions are never internet-exposed, and this
// one is additionally only called from convex-test.
export const seedMembership = mutation({
  args: { email: v.string(), name: v.string(), role: v.string() },
  returns: v.object({ orgId: v.string(), userId: v.string() }),
  handler: async (ctx, { email, name, role }) => {
    assertTestEnv()
    const now = Date.now()
    const userId = await ctx.db.insert("user", {
      email,
      name,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })
    const orgId = await ctx.db.insert("organization", {
      name: "Acme",
      slug: `acme-${now}`,
      createdAt: now,
    })
    await ctx.db.insert("member", {
      organizationId: orgId,
      userId,
      role,
      createdAt: now,
    })
    return { orgId, userId }
  },
})

// Test-only: insert a SECOND member row for an existing (org, user) pair to
// exercise the fail-closed contract. getMembership uses .unique() on the
// organizationId_userId index, so a duplicate makes it throw, and the
// org-scoping wrapper must turn that into errors.membershipConflict.
export const seedDuplicateMember = mutation({
  args: { orgId: v.string(), userId: v.string(), role: v.string() },
  returns: v.null(),
  handler: async (ctx, { orgId, userId, role }) => {
    assertTestEnv()
    await ctx.db.insert("member", {
      organizationId: orgId,
      userId,
      role,
      createdAt: Date.now(),
    })
    return null
  },
})

// Test-only: attach an EXISTING user to a SECOND organisation, so multi-company
// switching can be exercised. Mirrors seedMembership but reuses the userId
// instead of creating a new user.
export const seedOrgForUser = mutation({
  args: { userId: v.string(), orgName: v.string(), role: v.string() },
  returns: v.object({ orgId: v.string() }),
  handler: async (ctx, { userId, orgName, role }) => {
    assertTestEnv()
    const now = Date.now()
    const orgId = await ctx.db.insert("organization", {
      name: orgName,
      slug: `${orgName.toLowerCase()}-${now}`,
      createdAt: now,
    })
    await ctx.db.insert("member", {
      organizationId: orgId,
      userId,
      role,
      createdAt: now,
    })
    return { orgId }
  },
})

// Test-only: seed an invitation row directly in the component, so the erasure
// path (provisioning.eraseUser) can be exercised against a populated invitation
// table. No product code creates invitations yet; this future-proofs erasure.
export const seedInvitation = mutation({
  args: {
    organizationId: v.string(),
    email: v.string(),
    inviterId: v.string(),
  },
  returns: v.object({ invitationId: v.string() }),
  handler: async (ctx, { organizationId, email, inviterId }) => {
    assertTestEnv()
    const now = Date.now()
    const invitationId = await ctx.db.insert("invitation", {
      organizationId,
      email,
      role: null,
      status: "pending",
      expiresAt: now + 1000 * 60 * 60 * 24,
      createdAt: now,
      inviterId,
    })
    return { invitationId: invitationId.toString() }
  },
})

// Test-only: list invitation rows (email + inviterId) so erasure can assert
// which invitations remain after a purge.
export const listInvitations = query({
  args: {},
  returns: v.array(v.object({ email: v.string(), inviterId: v.string() })),
  handler: async (ctx) => {
    assertTestEnv()
    const rows = await ctx.db.query("invitation").collect()
    return rows.map((r) => ({ email: r.email, inviterId: r.inviterId }))
  },
})

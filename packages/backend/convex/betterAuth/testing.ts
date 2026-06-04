import { v } from "convex/values"
import { mutation } from "./_generated/server"

// Test-only seeding. Lives inside the component so it can write the auth
// tables directly; component functions are never internet-exposed, and this
// one is additionally only called from convex-test.
export const seedMembership = mutation({
  args: { email: v.string(), name: v.string(), role: v.string() },
  returns: v.object({ orgId: v.string(), userId: v.string() }),
  handler: async (ctx, { email, name, role }) => {
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

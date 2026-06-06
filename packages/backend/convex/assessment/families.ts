import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { clampLocale } from "../evaluationModel/localize"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"

const MAX_NAME_LENGTH = 100

// Trimmed, non-empty, bounded family name or errors.invalidInput.
function normalizeName(raw: string): string {
  const name = raw.trim()
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    throw appError(ERROR_CODES.invalidInput)
  }
  return name
}

// Family names are unique per organization, case-insensitively, so two
// spellings of the same family cannot drift apart. Org family counts are
// tiny; a by_org collect is fine.
async function assertUniqueName(
  ctx: MutationCtx & { orgId: string },
  name: string,
  exceptId?: Id<"roleFamilies">
): Promise<void> {
  const families = await ctx.db
    .query("roleFamilies")
    .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
    .collect()
  const lowered = name.toLowerCase()
  const clash = families.some(
    (family) => family._id !== exceptId && family.name.toLowerCase() === lowered
  )
  if (clash) throw appError(ERROR_CODES.roleFamilyExists)
}

// Families never affect scoring: no band-shift wraps anywhere in this module
// (ADR-0002 untouched). Member scope: families are role content, like roles.
export const createRoleFamily = orgMutation({
  args: { name: v.string() },
  returns: v.id("roleFamilies"),
  handler: async (ctx, args) => {
    const name = normalizeName(args.name)
    await assertUniqueName(ctx, name)
    const familyId = await ctx.db.insert("roleFamilies", {
      orgId: ctx.orgId,
      name,
    })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleFamilyCreated,
      actorId: ctx.authUserId,
      payload: { familyId, name },
    })
    return familyId
  },
})

export const renameRoleFamily = orgMutation({
  args: { familyId: v.id("roleFamilies"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const family = await ctx.db.get(args.familyId)
    if (family === null || family.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    const name = normalizeName(args.name)
    // Unchanged name is a no-op: no write, no audit row.
    if (name === family.name) return null
    await assertUniqueName(ctx, name, args.familyId)
    await ctx.db.patch(args.familyId, { name })
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleFamilyRenamed,
      actorId: ctx.authUserId,
      payload: { familyId: args.familyId, name },
    })
    return null
  },
})

// Hard delete is safe for families (unlike roles, whose ids are permanent):
// nothing derived hangs off a family. Membership is cleared from the org's
// roles in the same transaction and the cleared ids are audited.
export const removeRoleFamily = orgMutation({
  args: { familyId: v.id("roleFamilies") },
  returns: v.null(),
  handler: async (ctx, { familyId }) => {
    const family = await ctx.db.get(familyId)
    if (family === null || family.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const clearedRoleIds: Id<"roles">[] = []
    for (const role of roles) {
      if (role.familyId !== familyId) continue
      // Patching to undefined removes the field.
      await ctx.db.patch(role._id, { familyId: undefined })
      clearedRoleIds.push(role._id)
    }
    await ctx.db.delete(familyId)
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.roleFamilyRemoved,
      actorId: ctx.authUserId,
      payload: { familyId, name: family.name, clearedRoleIds },
    })
    return null
  },
})

export const listRoleFamilies = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.array(
    v.object({
      familyId: v.id("roleFamilies"),
      name: v.string(),
      roleCount: v.number(),
    })
  ),
  handler: async (ctx, { locale }) => {
    const families = await ctx.db
      .query("roleFamilies")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const counts = new Map<string, number>()
    for (const role of roles) {
      if (role.familyId === undefined || role.archivedAt !== undefined) {
        continue
      }
      const key = role.familyId as string
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const sortLocale = clampLocale(locale)
    families.sort((a, b) => a.name.localeCompare(b.name, sortLocale))
    return families.map((family) => ({
      familyId: family._id,
      name: family.name,
      roleCount: counts.get(family._id as string) ?? 0,
    }))
  },
})

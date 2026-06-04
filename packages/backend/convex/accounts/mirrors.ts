import type { GenericMutationCtx } from "convex/server"
import type { DataModel } from "../_generated/dataModel"

type Ctx = GenericMutationCtx<DataModel>

interface AuthUserDoc {
  _id: string
  email: string
  name: string
}

interface AuthOrgDoc {
  _id: string
}

// All handlers are idempotent: a Better Auth endpoint can perform several
// writes and only the triggering operation rolls back on error.

export async function onUserCreate(ctx: Ctx, doc: AuthUserDoc) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", doc._id))
    .unique()
  if (existing !== null) return
  await ctx.db.insert("users", {
    authId: doc._id,
    name: doc.name,
    email: doc.email,
  })
}

export async function onUserUpdate(
  ctx: Ctx,
  newDoc: AuthUserDoc,
  _oldDoc: AuthUserDoc
) {
  const row = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", newDoc._id))
    .unique()
  if (row === null) {
    await onUserCreate(ctx, newDoc)
    return
  }
  await ctx.db.patch(row._id, { name: newDoc.name, email: newDoc.email })
}

export async function onUserDelete(ctx: Ctx, doc: AuthUserDoc) {
  const row = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", doc._id))
    .unique()
  if (row !== null) await ctx.db.delete(row._id)
}

export async function onOrganizationCreate(ctx: Ctx, doc: AuthOrgDoc) {
  const existing = await ctx.db
    .query("workspaceProfiles")
    .withIndex("by_org", (q) => q.eq("orgId", doc._id))
    .unique()
  if (existing !== null) return
  await ctx.db.insert("workspaceProfiles", { orgId: doc._id })
}

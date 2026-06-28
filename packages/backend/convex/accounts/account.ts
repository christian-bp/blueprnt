import { v } from "convex/values"
import { components, internal } from "../_generated/api"
import {
  type ActionCtx,
  action,
  internalMutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "../_generated/server"
import { authComponent, createAuth } from "../auth"
import {
  assertValidImageBlob,
  clearStoredImage,
  IMAGE_UPLOAD_MAX_BYTES,
  replaceStoredImage,
} from "../files"
import {
  ERASED_ACTOR_NAME,
  PLATFORM_AUDIT_EVENTS,
  logPlatformAudit,
} from "../lib/audit"
import { ERROR_CODES, appError } from "../lib/errors"
import { authedMutation } from "../lib/functions"

// The orgs where `authUserId` is the SOLE admin. Shared by getMyAccount (drives
// the delete-account guard UI) and eraseSelf (re-validates server-side before
// erasing, never trusting the client). listMembershipsForUser returns the org
// display name, so no extra org-name lookup is needed.
async function soleAdminOrgs(
  ctx: QueryCtx | MutationCtx,
  authUserId: string
): Promise<{ orgId: string; name: string }[]> {
  const memberships = await ctx.runQuery(
    components.betterAuth.membership.listMembershipsForUser,
    { userId: authUserId }
  )
  const adminMemberships = memberships.filter((m) => m.role === "admin")
  const result: { orgId: string; name: string }[] = []
  for (const m of adminMemberships) {
    const members = await ctx.runQuery(
      components.betterAuth.provisioning.listMembers,
      { organizationId: m.organizationId }
    )
    const adminCount = members.filter((mem) => mem.role === "admin").length
    if (adminCount === 1) {
      result.push({ orgId: m.organizationId, name: m.organizationName })
    }
  }
  return result
}

// The caller's account profile: name, email, locale, current 2FA method, and
// the set of orgs where they are the SOLE admin. The sole-admin list drives
// the delete-account guard UI (blocking deletion when it would leave an org
// admin-less).
//
// Deliberately a plain query (not authedQuery): mirrors getMyMfaStatus so a
// token-refresh blip returns null instead of throwing notAuthenticated, which
// would crash the settings page mid-load.
export const getMyAccount = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      email: v.string(),
      locale: v.union(v.string(), v.null()),
      mfaMethod: v.union(v.literal("totp"), v.literal("email"), v.null()),
      lastAdminOrgs: v.array(v.object({ orgId: v.string(), name: v.string() })),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) return null
    const row = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique()
    if (row === null) return null

    // Orgs where this user is the sole admin. Drives the delete-account guard
    // UI (blocking deletion when it would leave an org admin-less). eraseSelf
    // re-derives the same set server-side, so the guard cannot be bypassed.
    const lastAdminOrgs = await soleAdminOrgs(ctx, identity.subject)

    return {
      name: row.name,
      email: row.email,
      locale: row.locale ?? null,
      mfaMethod: row.mfaMethod ?? null,
      lastAdminOrgs,
    }
  },
})

// Clears the caller's mfaConfirmedAt stamp. Used when the user initiates a
// "change 2FA method" flow: clearing the stamp forces the 2FA gate to treat
// setup as incomplete again, so the wizard re-runs. The new method is stamped
// by the existing confirmMfaSetup once setup completes.
// No audit row: account-security state is per-user, not org-domain, so it
// stays out of the org-scoped audit log (same carve-out as confirmMfaSetup).
export const clearMfaConfirmed = authedMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", ctx.authUserId))
      .unique()
    if (row === null) return null
    await ctx.db.patch(row._id, { mfaConfirmedAt: undefined })
    return null
  },
})

// Associates an already-validated blob as the caller's avatar and returns its
// served URL. Internal: only setMyAvatar (after validating the blob) calls this,
// passing the caller's auth id resolved from the JWT. Replacing an existing
// avatar deletes the previous file first, so storage never accumulates orphaned
// blobs.
export const applyAvatar = internalMutation({
  args: { authUserId: v.string(), storageId: v.id("_storage") },
  returns: v.string(),
  handler: async (ctx, { authUserId, storageId }) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", authUserId))
      .unique()
    if (row === null) throw appError(ERROR_CODES.notFound)
    const url = await replaceStoredImage(ctx, {
      previousId: row.imageId,
      storageId,
    })
    await ctx.db.patch(row._id, { imageId: storageId })
    return url
  },
})

// Sets the caller's avatar to a freshly uploaded file and returns its served
// URL (the client then mirrors it onto Better Auth via updateUser({ image })).
// The avatar is PERSONAL DATA stored only on the per-person mirror; it is erased
// with the row + file on account deletion. No audit row (per-person account
// state).
//
// An ACTION, not a mutation, because it must DELETE a rejected blob: a mutation
// runs in a transaction, so throwing would roll back the storage.delete and
// leave the bad blob orphaned. In an action the delete commits before the throw.
// The flow is: resolve identity from the JWT (never the client), re-validate the
// uploaded blob server-side (the client's 5MB/image-mime check is convenience
// only; the upload URL accepts any blob), and only on success delegate the row
// write to the internal applyAvatar mutation. A blob that is oversized, has a
// non-image content type, or has no metadata row is deleted and the call throws
// invalidInput, so a bad blob is neither associated nor left orphaned.
// Content-type note: in production Convex records the upload's Content-Type, so
// a non-image is rejected; when the content type is absent the size cap is the
// hard guarantee.
export const setMyAvatar = action({
  args: { storageId: v.id("_storage") },
  returns: v.string(),
  handler: async (ctx: ActionCtx, { storageId }): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) throw appError(ERROR_CODES.notAuthenticated)

    await assertValidImageBlob(ctx, storageId, IMAGE_UPLOAD_MAX_BYTES)
    return await ctx.runMutation(internal.accounts.account.applyAvatar, {
      authUserId: identity.subject,
      storageId,
    })
  },
})

// Removes the caller's avatar: deletes the stored file and clears the mirror
// field. A no-op when there is no avatar. The client then clears the Better Auth
// image via updateUser({ image: "" }). No audit row (per-person account state).
export const removeMyAvatar = authedMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", ctx.authUserId))
      .unique()
    if (row === null) return null
    if (row.imageId != null) {
      await clearStoredImage(ctx, row.imageId)
      await ctx.db.patch(row._id, { imageId: undefined })
    }
    return null
  },
})

// GDPR self-service erasure. The internal mutation mirrors platform/admin.ts
// deleteUser for the CURRENT caller, with the platform-admin gate and the
// self-delete block removed (self-delete is the whole point), and a last-admin
// guard added FIRST. Only ever called by deleteMyAccount after the password
// check, and given the caller's id resolved from the JWT (never the client), so
// a user can only ever erase themselves. Like the admin path, the erasure is
// recorded in the ADMIN log only; nothing is written to any org's auditLog.
export const eraseSelf = internalMutation({
  args: { authUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, { authUserId }) => {
    // Last-admin guard FIRST: re-validate server-side and erase NOTHING if the
    // caller is the sole admin of any org (leaving it admin-less). The client
    // surfaces this from getMyAccount, but the server is authoritative.
    const lastAdminOrgs = await soleAdminOrgs(ctx, authUserId)
    if (lastAdminOrgs.length > 0) throw appError(ERROR_CODES.lastAdmin)

    // Identity/membership/invitation rows + the person's email (from the
    // authoritative Better Auth record).
    const { orgIds, email } = await ctx.runMutation(
      components.betterAuth.provisioning.eraseUser,
      { userId: authUserId }
    )
    // GDPR erasure of the person's email PII: purge every message addressed to
    // them from the Sweego component. Scheduled so it commits with the erasure;
    // keyed on the Better Auth address (the authoritative source the mirror only
    // mirrors), so the purge runs even if the app mirror is missing.
    if (email !== null) {
      await ctx.scheduler.runAfter(
        0,
        internal.email.erasure.purgeRecipientEmails,
        { email }
      )
    }
    // App mirror.
    const mirror = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", authUserId))
      .unique()
    if (mirror !== null) {
      // GDPR erasure of the avatar PII: delete the stored file BEFORE the row,
      // so the personal image is gone from storage, not just dereferenced.
      if (mirror.imageId != null) await ctx.storage.delete(mirror.imageId)
      await ctx.db.delete(mirror._id)
    }
    // Anonymize this person's snapshotted name in both audit logs (rows kept for
    // the trail's legitimate-interest basis; their payloads carry IDs/codes only).
    const orgAuthored = await ctx.db
      .query("auditLog")
      .withIndex("by_actor", (q) => q.eq("actorId", authUserId))
      .collect()
    for (const row of orgAuthored) {
      await ctx.db.patch(row._id, { actorName: ERASED_ACTOR_NAME })
    }
    const platformAuthored = await ctx.db
      .query("platformAuditLog")
      .withIndex("by_actor", (q) => q.eq("actorId", authUserId))
      .collect()
    for (const row of platformAuthored) {
      await ctx.db.patch(row._id, { actorName: ERASED_ACTOR_NAME })
    }
    // The erasure is self-attributed (actor === target): the person deleted
    // their own account. Non-identifying org count only, never name/email.
    await logPlatformAudit(ctx, {
      actorId: authUserId,
      type: PLATFORM_AUDIT_EVENTS.userDeleted,
      targetUserId: authUserId,
      payload: { orgCount: orgIds.length },
    })
    return null
  },
})

// Self-service account deletion (GDPR hard delete). An ACTION because it must
// re-authenticate the caller against Better Auth's server API before erasing:
// authComponent.getAuth returns the auth object plus a Headers carrying the
// current session as a Bearer token (Convex functions have no request headers),
// and auth.api.verifyPassword re-checks the caller's password server-side. On a
// wrong password Better Auth throws (INVALID_PASSWORD), which we map to
// invalidInput so the UI can show it inline; we never reach the erasure. The
// caller id comes from the JWT subject, never the client, so a user can only
// erase themselves. The actual erasure (cascade + last-admin guard) runs in the
// eraseSelf internal mutation.
export const deleteMyAccount = action({
  args: { password: v.string() },
  returns: v.null(),
  handler: async (ctx: ActionCtx, { password }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) throw appError(ERROR_CODES.notAuthenticated)

    // Server-side re-auth, fail-closed. getAuth builds the session headers from
    // the current identity's sessionId; verifyPassword validates `password`
    // against the signed-in user's credential and throws INVALID_PASSWORD on a
    // mismatch. ANY failure here (wrong password, no credential, or a session
    // that cannot be resolved into headers) means we could not confirm the
    // caller's password, so we reject with invalidInput and erase nothing. The
    // whole boundary is wrapped so a missing/expired session is treated exactly
    // like a wrong password, never silently bypassing the gate.
    try {
      const { auth, headers } = await authComponent.getAuth(createAuth, ctx)
      await auth.api.verifyPassword({ body: { password }, headers })
    } catch {
      throw appError(ERROR_CODES.invalidInput)
    }

    await ctx.runMutation(internal.accounts.account.eraseSelf, {
      authUserId: identity.subject,
    })
    return null
  },
})

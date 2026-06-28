import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import {
  type ActionCtx,
  internalQuery,
  type MutationCtx,
} from "./_generated/server"
import { appError, ERROR_CODES } from "./lib/errors"
import { authedMutation } from "./lib/functions"

// Shared file-storage helpers for image uploads (user avatar, org logo). The
// per-table row write (which mirror row carries the storage id) stays in each
// typed caller; this module owns the storage-side primitives so the validate /
// upload-url / swap / clear logic lives in exactly one place.

// Authoritative server-side image-size cap, mirrored by the client's pre-check.
export const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024

// Pure validation: a stored blob is an allowed image iff it exists, is within
// the cap, and either has no recorded content type (then the size cap is the
// only gate) or an image/* one. Mirrors the prior account-avatar check.
export function isAllowedImageBlob(
  meta: { size: number; contentType: string | null } | null,
  maxBytes: number
): boolean {
  if (meta === null) return false
  if (meta.size > maxBytes) return false
  if (
    meta.contentType !== null &&
    meta.contentType !== "" &&
    !meta.contentType.startsWith("image/")
  ) {
    return false
  }
  return true
}

// Stored-blob metadata read from the _storage system table (getMetadata is
// deprecated and unavailable in actions). null when the id does not exist.
export const blobMeta = internalQuery({
  args: { storageId: v.id("_storage") },
  returns: v.union(
    v.null(),
    v.object({ size: v.number(), contentType: v.union(v.string(), v.null()) })
  ),
  handler: async (ctx, { storageId }) => {
    const meta = await ctx.db.system.get(storageId)
    if (meta === null) return null
    return { size: meta.size, contentType: meta.contentType ?? null }
  },
})

// One-shot upload URL the client POSTs an image to. Shared by the user-avatar
// and org-logo flows; the apply step (per surface) validates and authorizes.
// No audit row (the URL grant itself changes nothing). Inherent residual orphan
// if a client POSTs a blob but never applies it (same as before; sweep deferred).
export const generateImageUploadUrl = authedMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

// Action helper: validate an uploaded blob or delete it and throw. In an action
// the delete commits before the throw, so a rejected blob never orphans (a
// transactional mutation would roll the delete back).
export async function assertValidImageBlob(
  ctx: ActionCtx,
  storageId: Id<"_storage">,
  maxBytes: number
): Promise<void> {
  const meta = await ctx.runQuery(internal.files.blobMeta, { storageId })
  if (!isAllowedImageBlob(meta, maxBytes)) {
    await ctx.storage.delete(storageId)
    throw appError(ERROR_CODES.invalidInput)
  }
}

// Mutation helper: drop the previous file (if any) and return the served URL for
// the new one. The caller does the typed db.patch of its own table's id field.
export async function replaceStoredImage(
  ctx: MutationCtx,
  opts: { previousId?: Id<"_storage"> | null; storageId: Id<"_storage"> }
): Promise<string> {
  if (opts.previousId != null) await ctx.storage.delete(opts.previousId)
  const url = await ctx.storage.getUrl(opts.storageId)
  if (url === null) throw appError(ERROR_CODES.notFound)
  return url
}

// Mutation helper: drop a stored file if present. The caller clears its own
// typed id field.
export async function clearStoredImage(
  ctx: MutationCtx,
  previousId?: Id<"_storage"> | null
): Promise<void> {
  if (previousId != null) await ctx.storage.delete(previousId)
}

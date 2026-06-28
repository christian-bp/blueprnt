# Organization Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only `/organization` surface where an org admin edits the org profile (name, logo, currency, country, industry, default language) and manages the team (role changes, removal with a last-admin guard, email invitations, pending-invitation revoke), sharing one file-upload implementation with the existing user avatar.

**Architecture:** Three phases. (A) Extract a shared, typed file-upload foundation (`convex/files.ts` + a `useImageUpload` hook + a presentational `AvatarUpload`) and move the existing user avatar onto it without behavior change. (B) Fill the backend org gaps (org logo, org name, member role/remove mutations, new audit events) following the existing `adminMutation`/`logAudit` conventions. (C) Build the `/organization` frontend surface mirroring `/account`, gated to admins. Invitations ride the already-wired `authClient.organization.*` + invitation triggers; member role/remove go through new Convex mutations so the last-admin guard and real-actor audit are authoritative.

**Tech Stack:** Next.js 16 App Router (client components), React 19, Convex + Better Auth (organization plugin), convex-test (edge-runtime), next-intl (5 locales), Tailwind v4 + shadcn, react-hook-form + Zod, Vitest 4, Bun, Turborepo, motion/react.

## Global Constraints

These apply to EVERY task (copied from CLAUDE.md and the spec):

- **No em dashes** anywhere we write (UI copy, comments, commits). Use period/comma/colon/parentheses.
- **All user-facing text via next-intl.** Add new keys to `packages/i18n/messages/en.json` FIRST (English is the typed base), then mirror the SAME keys to `sv`, `nb`, `da`, `fi` in the same task. Nordic strings are machine drafts: add a native-review flag line to `docs/go-live-checklist.md`. Never write non-ASCII via shell `sed`/`perl` (double-encodes); use the Edit/Write tool.
- **Internal navigation uses the `Link` component** (`next/link` or `@workspace/i18n/navigation`), never `<a>`.
- **Forms:** `useForm({ resolver: zodResolver(makeXSchema(t)), mode: "onTouched" })`, fields via `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`. Pre-filled edit forms gate the submit on `disabled={!isValid || !isDirty}` (read both off `form.formState` so RHF tracks them). Schema factories build translated messages from `useTranslations("dashboard.validation")`.
- **Convex:** every function is org-scoped via the wrappers in `lib/functions.ts` (`orgQuery`, `orgMutation`, `adminMutation`, `adminQuery` all take an `orgId` arg automatically). `adminMutation`/`adminQuery` require `role === "admin"`. Backend returns error CODES (`appError(ERROR_CODES.*)`), never display text.
- **Audit:** org-domain changes write an audit row via `ctx.audit.log({ type: AUDIT_EVENTS.*, payload })` (org-scoped ctx) or `logAudit(ctx, { orgId, actorId, type, payload })` (internal ctx). Per-user account state (the user avatar) writes NO audit row. A new auditable event needs: a key in `AUDIT_EVENTS` (`lib/audit.ts`) AND a payload entry in `AuditPayloads` (`lib/auditPayloads.ts`) or the compile-time guards fail tsc.
- **Role ≠ Person:** never put person name/email/PII into audit payloads (ids/codes only). The org logo is org-domain content (audited); the user avatar is PII (not audited, erased on account deletion).
- **No worktrees/branches.** Work in the main checkout. Leave work uncommitted for review unless told otherwise; commit as focused single-concern commits with conventional prefixes. The pre-commit hook (Biome + full typecheck + full `turbo run test`) must pass; never `--no-verify`.
- **shadcn vendor code** (`packages/ui/src/*`) is never edited or reformatted.
- **Tests:** `bun run test` (never `bun test`). Per-package `vitest.config.ts`. Backend tests use convex-test on edge-runtime.
- **All five locales must actually work**, not just English.

**Reference exemplars (read before mirroring):**
- Account surface: `apps/dashboard/app/(app)/account/{layout,page}.tsx`, `account/{profile,security}/page.tsx`; `components/account/account-tabs.tsx`; `components/site-header.tsx`.
- Forms/sections: `components/account/profile-name-form.tsx`, `components/account/avatar-section.tsx`.
- Members + settings UI already done for platform admin: `components/admin/manage-organization-dialog.tsx` (role dropdown, remove, settings form, the `language`-via-`CountrySelect` mapping).
- Selects: `components/{country-select,currency-select,industry-select}.tsx`.
- Org context + admin gating: `components/org-context.tsx` (`useOrganization() → {orgId,name,role}`), `components/org-audit-log-section.tsx` (gates on `role === "admin"`), `components/app-sidebar.tsx`.
- Backend conventions: `accounts/organization.ts` (`adminMutation` + `ctx.audit.log` + `buildChanges`), `accounts/account.ts` (avatar action + `soleAdminOrgs`), `lib/functions.ts`, `lib/audit.ts`, `lib/auditPayloads.ts`, `accounts/mirrors.ts` (member/invitation triggers), `betterAuth/provisioning.ts`.
- Backend test setup: `accounts/organization.test.ts` (`initConvexTest`, `components.betterAuth.testing.seedMembership`, `onUserCreate`, `withIdentity`).

---

## Phase A - Shared image-upload foundation

### Task A1: Backend `convex/files.ts` shared storage module

**Files:**
- Create: `packages/backend/convex/files.ts`
- Test: `packages/backend/convex/files.test.ts`

> Location note: the module lives at `convex/files.ts` (top-level), NOT `convex/lib/files.ts` as the spec said. `lib/` holds only the custom-function builders and pure helpers; registered Convex endpoints (here `blobMeta`, `generateImageUploadUrl`) live outside `lib/`. Consumers import the pure helpers via `../files`.

**Interfaces:**
- Produces:
  - `IMAGE_UPLOAD_MAX_BYTES: number` (5 MiB)
  - `isAllowedImageBlob(meta: { size: number; contentType: string | null } | null, maxBytes: number): boolean` (pure)
  - `blobMeta` internalQuery `{ storageId: Id<"_storage"> } → { size: number; contentType: string | null } | null` → `internal.files.blobMeta`
  - `generateImageUploadUrl` authed mutation `{} → string` → `api.files.generateImageUploadUrl`
  - `assertValidImageBlob(ctx: ActionCtx, storageId: Id<"_storage">, maxBytes: number): Promise<void>` - validates via `blobMeta`; on invalid deletes the blob then throws `invalidInput`
  - `replaceStoredImage(ctx: MutationCtx, opts: { previousId?: Id<"_storage"> | null; storageId: Id<"_storage"> }): Promise<string>` - deletes `previousId` if set, returns served URL (throws `notFound` if null)
  - `clearStoredImage(ctx: MutationCtx, previousId?: Id<"_storage"> | null): Promise<void>`

- [ ] **Step 1: Write the failing tests** for the pure helper plus the upload-URL auth gate (convex-test). The `generateImageUploadUrl` auth-gate cases replace the two `generateAvatarUploadUrl` tests removed from `account.test.ts` in A2.

```ts
// packages/backend/convex/files.test.ts
import { describe, expect, it } from "vitest"
import { api } from "./_generated/api"
import { isAllowedImageBlob, IMAGE_UPLOAD_MAX_BYTES } from "./files"
import { initConvexTest } from "./testing.helpers"

describe("isAllowedImageBlob", () => {
  it("rejects null metadata", () => {
    expect(isAllowedImageBlob(null, IMAGE_UPLOAD_MAX_BYTES)).toBe(false)
  })
  it("rejects oversized blobs", () => {
    expect(
      isAllowedImageBlob(
        { size: IMAGE_UPLOAD_MAX_BYTES + 1, contentType: "image/png" },
        IMAGE_UPLOAD_MAX_BYTES
      )
    ).toBe(false)
  })
  it("rejects non-image content types", () => {
    expect(
      isAllowedImageBlob({ size: 10, contentType: "application/pdf" }, IMAGE_UPLOAD_MAX_BYTES)
    ).toBe(false)
  })
  it("accepts an image within the cap", () => {
    expect(
      isAllowedImageBlob({ size: 10, contentType: "image/jpeg" }, IMAGE_UPLOAD_MAX_BYTES)
    ).toBe(true)
  })
  it("accepts a null/empty content type within the cap (size cap is the gate)", () => {
    expect(isAllowedImageBlob({ size: 10, contentType: null }, IMAGE_UPLOAD_MAX_BYTES)).toBe(true)
    expect(isAllowedImageBlob({ size: 10, contentType: "" }, IMAGE_UPLOAD_MAX_BYTES)).toBe(true)
  })
})

describe("generateImageUploadUrl", () => {
  it("returns an upload URL for an authed caller", async () => {
    const t = initConvexTest()
    const url = await t
      .withIdentity({ subject: "user_1" })
      .mutation(api.files.generateImageUploadUrl, {})
    expect(typeof url).toBe("string")
  })
  it("rejects an unauthenticated caller", async () => {
    const t = initConvexTest()
    await expect(t.mutation(api.files.generateImageUploadUrl, {})).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test, verify it fails** - `cd packages/backend && bunx vitest run convex/files.test.ts` → FAIL (module not found).

- [ ] **Step 3: Create `convex/files.ts`.**

```ts
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"
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
```

- [ ] **Step 4: Run test, verify it passes** - `cd packages/backend && bunx vitest run convex/files.test.ts` → PASS (pure-helper cases + the two `generateImageUploadUrl` auth-gate cases).

- [ ] **Step 5: Typecheck** - `cd packages/backend && bun run typecheck` → exit 0. (Confirms `internal.files.blobMeta` / `api.files.generateImageUploadUrl` are generated.)

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/files.ts packages/backend/convex/files.test.ts
git commit -m "feat(files): add shared image-upload storage helpers"
```

---

### Task A2: Move the user avatar onto `files.ts`

**Files:**
- Modify: `packages/backend/convex/accounts/account.ts` (remove `AVATAR_MAX_BYTES`, `generateAvatarUploadUrl`, `avatarBlobMeta`; rewrite `setMyAvatar`, `applyAvatar`, `removeMyAvatar` to use `files.ts`)
- Test: `packages/backend/convex/accounts/account.test.ts` (existing - must stay green; add nothing unless a gap)

**Interfaces:**
- Consumes from A1: `IMAGE_UPLOAD_MAX_BYTES`, `assertValidImageBlob`, `replaceStoredImage`, `clearStoredImage`.
- Produces: `setMyAvatar` action (unchanged signature `{ storageId } → string`), `applyAvatar` internalMutation (unchanged `{ authUserId, storageId } → string`), `removeMyAvatar` authedMutation (`{} → null`). `generateAvatarUploadUrl` is REMOVED; its frontend caller moves to `api.files.generateImageUploadUrl` in Task A3.

- [ ] **Step 1: Confirm the existing account avatar tests pass first** - `cd packages/backend && bunx vitest run convex/accounts/account.test.ts` → PASS (baseline before refactor).

- [ ] **Step 2: Edit `account.ts` imports.** Remove the now-unused locals; import the shared helpers.

Replace the avatar limit comment+const (lines ~21-24) - delete `AVATAR_MAX_BYTES`. Add to imports near the top:

```ts
import {
  assertValidImageBlob,
  clearStoredImage,
  IMAGE_UPLOAD_MAX_BYTES,
  replaceStoredImage,
} from "../files"
```

- [ ] **Step 3: Delete `generateAvatarUploadUrl` and `avatarBlobMeta`** (the whole two function blocks, lines ~117-150). The shared `api.files.generateImageUploadUrl` and `internal.files.blobMeta` replace them.

- [ ] **Step 4: Rewrite `applyAvatar`** to use `replaceStoredImage` (keep the typed `users` patch local):

```ts
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
```

- [ ] **Step 5: Rewrite `setMyAvatar`** to use `assertValidImageBlob`:

```ts
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
```

(Keep the existing explanatory comment above `setMyAvatar` describing why it is an action.)

- [ ] **Step 6: Rewrite `removeMyAvatar`** to use `clearStoredImage`:

```ts
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
```

- [ ] **Step 7: Repoint the now-removed account tests (definite, not conditional).** `account.test.ts` has two LIVE tests that call `api.accounts.account.generateAvatarUploadUrl` (the "returns a string for an authed caller" and "rejects when unauthenticated" cases). Delete BOTH; their coverage moved to `files.test.ts` in A1 (`generateImageUploadUrl`, same `authedMutation` auth semantics). `avatarBlobMeta` is referenced by no test. Then run `cd packages/backend && bunx vitest run convex/accounts/account.test.ts && bun run typecheck` → PASS, exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/convex/accounts/account.ts packages/backend/convex/accounts/account.test.ts
git commit -m "refactor(account): move user avatar onto shared files helpers"
```

---

### Task A3: Shared `useImageUpload` hook + presentational `AvatarUpload`; rewire account avatar

**Files:**
- Create: `apps/dashboard/hooks/use-image-upload.ts`
- Create: `apps/dashboard/components/avatar-upload.tsx` (generalized, presentational; replaces `components/account/avatar-upload.tsx`)
- Delete: `apps/dashboard/components/account/avatar-upload.tsx`
- Modify: `apps/dashboard/components/account/avatar-section.tsx` (wire the hook with account bindings + the shared component)
- Test: `apps/dashboard/components/avatar-upload.test.tsx`, `apps/dashboard/hooks/use-image-upload.test.ts`

**Interfaces:**
- Produces:
  - `useImageUpload(opts): { previewUrl: string | null; isUploading: boolean; isRemoving: boolean; error: string | null; selectFile(file: File): Promise<void>; remove(): Promise<void> }` where
    ```ts
    opts: {
      generateUploadUrl: () => Promise<string>
      setImage: (storageId: string) => Promise<string>   // returns served URL
      removeImage: () => Promise<void>
      onMirror?: (url: string | null) => Promise<void>    // e.g. authClient.updateUser({ image })
      labels: { invalidType: string; tooLarge: string; error: string }
      maxBytes?: number                                    // default 5 MiB
    }
    ```
  - `AvatarUpload(props)` presentational:
    ```ts
    props: {
      imageUrl: string | null
      fallback: string                 // initials
      alt: string
      previewUrl: string | null
      isUploading: boolean
      isRemoving: boolean
      error: string | null
      onSelectFile: (file: File) => void
      onRemove: () => void
      removeLabel: string
      sizeClassName?: string           // default "size-20"
    }
    ```

- [ ] **Step 1: Write the failing hook test.**

```ts
// apps/dashboard/hooks/use-image-upload.test.ts
import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useImageUpload } from "./use-image-upload"

const labels = { invalidType: "bad type", tooLarge: "too large", error: "failed" }

function makeFile(type: string, size: number): File {
  const f = new File(["x"], "a", { type })
  Object.defineProperty(f, "size", { value: size })
  return f
}

beforeEach(() => {
  // jsdom/happy-dom lacks object URLs; stub them.
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview")
  globalThis.URL.revokeObjectURL = vi.fn()
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ storageId: "s1" }), { status: 200 }))
})
afterEach(() => vi.restoreAllMocks())

describe("useImageUpload", () => {
  it("rejects a non-image before any upload", async () => {
    const setImage = vi.fn()
    const { result } = renderHook(() =>
      useImageUpload({
        generateUploadUrl: vi.fn(),
        setImage,
        removeImage: vi.fn(),
        labels,
      })
    )
    await act(async () => {
      await result.current.selectFile(makeFile("application/pdf", 10))
    })
    expect(result.current.error).toBe("bad type")
    expect(setImage).not.toHaveBeenCalled()
  })

  it("uploads a valid image and mirrors the served url", async () => {
    const setImage = vi.fn(async () => "https://served/x")
    const onMirror = vi.fn(async () => {})
    const { result } = renderHook(() =>
      useImageUpload({
        generateUploadUrl: vi.fn(async () => "https://upload"),
        setImage,
        removeImage: vi.fn(),
        onMirror,
        labels,
      })
    )
    await act(async () => {
      await result.current.selectFile(makeFile("image/png", 10))
    })
    await waitFor(() => expect(setImage).toHaveBeenCalledWith("s1"))
    expect(onMirror).toHaveBeenCalledWith("https://served/x")
  })
})
```

- [ ] **Step 2: Run, verify fail** - `cd apps/dashboard && bunx vitest run hooks/use-image-upload.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement the hook.**

```ts
// apps/dashboard/hooks/use-image-upload.ts
"use client"

import { useState } from "react"

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024

// Headless upload flow shared by the user avatar and the org logo: client-side
// validation (type + size), object-URL preview, generate-url -> POST blob ->
// apply (server validates + stores) -> optional mirror -> revoke preview. The
// caller supplies the surface-specific Convex bindings; this owns the flow.
export function useImageUpload(opts: {
  generateUploadUrl: () => Promise<string>
  setImage: (storageId: string) => Promise<string>
  removeImage: () => Promise<void>
  onMirror?: (url: string | null) => Promise<void>
  labels: { invalidType: string; tooLarge: string; error: string }
  maxBytes?: number
}) {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function selectFile(file: File) {
    setError(null)
    if (!file.type.startsWith("image/")) {
      setError(opts.labels.invalidType)
      return
    }
    if (file.size > maxBytes) {
      setError(opts.labels.tooLarge)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    setIsUploading(true)
    try {
      const uploadUrl = await opts.generateUploadUrl()
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!res.ok) throw new Error("upload failed")
      const { storageId } = await res.json()
      const served = await opts.setImage(storageId)
      if (opts.onMirror) await opts.onMirror(served)
    } catch {
      setError(opts.labels.error)
    } finally {
      URL.revokeObjectURL(objectUrl)
      setPreviewUrl(null)
      setIsUploading(false)
    }
  }

  async function remove() {
    setError(null)
    setIsRemoving(true)
    try {
      await opts.removeImage()
      if (opts.onMirror) await opts.onMirror(null)
    } catch {
      setError(opts.labels.error)
    } finally {
      setIsRemoving(false)
    }
  }

  return { previewUrl, isUploading, isRemoving, error, selectFile, remove }
}
```

- [ ] **Step 4: Run hook test, verify pass** - `cd apps/dashboard && bunx vitest run hooks/use-image-upload.test.ts` → PASS.

- [ ] **Step 5: Write the failing component test.**

```ts
// apps/dashboard/components/avatar-upload.test.tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AvatarUpload } from "./avatar-upload"

afterEach(() => cleanup())

function baseProps() {
  return {
    imageUrl: null,
    fallback: "AB",
    alt: "Acme",
    previewUrl: null,
    isUploading: false,
    isRemoving: false,
    error: null,
    onSelectFile: vi.fn(),
    onRemove: vi.fn(),
    removeLabel: "Remove",
  }
}

describe("AvatarUpload", () => {
  it("shows the fallback initials when there is no image", () => {
    render(<AvatarUpload {...baseProps()} />)
    expect(screen.getByText("AB")).toBeDefined()
  })
  it("forwards the chosen file to onSelectFile", () => {
    const props = baseProps()
    const { container } = render(<AvatarUpload {...props} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(["x"], "a.png", { type: "image/png" })
    fireEvent.change(input, { target: { files: [file] } })
    expect(props.onSelectFile).toHaveBeenCalledWith(file)
  })
  it("shows the remove control and the error when an image is present", () => {
    const props = { ...baseProps(), imageUrl: "https://x/y", error: "failed" }
    render(<AvatarUpload {...props} />)
    expect(screen.getByLabelText("Remove")).toBeDefined()
    expect(screen.getByText("failed")).toBeDefined()
  })
})
```

- [ ] **Step 6: Run, verify fail** - `cd apps/dashboard && bunx vitest run components/avatar-upload.test.tsx` → FAIL.

- [ ] **Step 7: Implement `components/avatar-upload.tsx`** - a presentational generalization of the existing `account/avatar-upload.tsx` (read that file for the exact markup). No Convex/auth imports.

```tsx
"use client"

import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { useRef } from "react"

// Presentational clickable avatar with upload + remove. The Avatar is the click
// target; a hidden file input opens on click and the chosen File is forwarded to
// onSelectFile (the caller's useImageUpload hook validates + uploads). A small X
// removes a present image. Preview/busy/error are driven entirely by props so the
// same component serves the user avatar and the org logo.
export function AvatarUpload(props: {
  imageUrl: string | null
  fallback: string
  alt: string
  previewUrl: string | null
  isUploading: boolean
  isRemoving: boolean
  error: string | null
  onSelectFile: (file: File) => void
  onRemove: () => void
  removeLabel: string
  sizeClassName?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const displayImage = props.previewUrl ?? props.imageUrl ?? undefined
  const hasImage = !!(props.previewUrl ?? props.imageUrl)
  const isBusy = props.isUploading || props.isRemoving

  function handleClick() {
    if (!isBusy) inputRef.current?.click()
  }
  function handleChange(evt: React.ChangeEvent<HTMLInputElement>) {
    const file = evt.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ""
    if (file) props.onSelectFile(file)
  }
  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation()
    props.onRemove()
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="relative">
        <Avatar
          key={displayImage ?? "no-image"}
          className={`${props.sizeClassName ?? "size-20"} cursor-pointer`}
          onClick={handleClick}
        >
          {isBusy ? (
            <AvatarFallback>
              <Spinner className="size-6" />
            </AvatarFallback>
          ) : (
            <>
              {displayImage != null && (
                <AvatarImage src={displayImage} alt={props.alt} />
              )}
              <AvatarFallback>{props.fallback}</AvatarFallback>
            </>
          )}
        </Avatar>

        {hasImage && !isBusy && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={props.removeLabel}
            className="absolute -top-1 -right-1 size-6 rounded-full border border-border"
            onClick={handleRemove}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
          </Button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {props.error != null && (
        <p className="text-destructive text-sm">{props.error}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Run, verify pass** - `cd apps/dashboard && bunx vitest run components/avatar-upload.test.tsx` → PASS.

- [ ] **Step 9: Rewire the account avatar.** Delete `components/account/avatar-upload.tsx`. Rewrite `components/account/avatar-section.tsx` to own the account bindings via the hook and render the shared component:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useAction, useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { AvatarUpload } from "@/components/avatar-upload"
import { useImageUpload } from "@/hooks/use-image-upload"
import { authClient } from "@/lib/auth-client"

export function AvatarSection() {
  const t = useTranslations("dashboard.account.profile.avatar")
  const { data: session } = authClient.useSession()
  const generateUploadUrl = useMutation(api.files.generateImageUploadUrl)
  const setMyAvatar = useAction(api.accounts.account.setMyAvatar)
  const removeMyAvatar = useMutation(api.accounts.account.removeMyAvatar)

  const upload = useImageUpload({
    generateUploadUrl: () => generateUploadUrl({}),
    setImage: (storageId) => setMyAvatar({ storageId }),
    removeImage: async () => {
      await removeMyAvatar({})
    },
    onMirror: async (url) => {
      await authClient.updateUser({ image: url ?? "" })
    },
    labels: { invalidType: t("invalidType"), tooLarge: t("tooLarge"), error: t("error") },
  })

  const name = session?.user?.name ?? ""
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase()

  return (
    <Card>
      <div className="flex items-start justify-between gap-8">
        <CardHeader className="flex-1">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <div className="pt-6 pr-6">
          <AvatarUpload
            imageUrl={session?.user?.image ?? null}
            fallback={initials}
            alt={name}
            previewUrl={upload.previewUrl}
            isUploading={upload.isUploading}
            isRemoving={upload.isRemoving}
            error={upload.error}
            onSelectFile={upload.selectFile}
            onRemove={upload.remove}
            removeLabel={t("remove")}
          />
        </div>
      </div>
      <CardFooter className="text-muted-foreground text-sm">{t("helper")}</CardFooter>
    </Card>
  )
}
```

- [ ] **Step 10: Remove the old container test and re-home its account-specific coverage (definite).** `components/account/avatar-upload.test.tsx` imports the deleted component and mocks `api.accounts.account.generateAvatarUploadUrl`, so it must go: `git rm apps/dashboard/components/account/avatar-upload.test.tsx`. Re-home its coverage: the headless flow is already in `hooks/use-image-upload.test.ts`; add the account-specific mirror wiring in a NEW `components/account/avatar-section.test.tsx` that mocks `convex/react` (`useMutation`/`useAction` → spies, plus the `@workspace/backend/convex/_generated/api` string-ref mock so refs route) and `@/lib/auth-client` (`useSession` → a user; `updateUser` → spy), renders `<AvatarSection />`, completes an upload, and asserts `authClient.updateUser({ image: <served> })` is called (and `{ image: "" }` on remove). Model the mocks on the old `avatar-upload.test.tsx`. Run `cd apps/dashboard && bunx vitest run components/account` → PASS.

- [ ] **Step 11: Full dashboard typecheck + tests** - `cd apps/dashboard && bun run typecheck && bunx vitest run` → exit 0, all pass.

- [ ] **Step 12: Commit**

```bash
git add apps/dashboard/hooks/use-image-upload.ts apps/dashboard/hooks/use-image-upload.test.ts \
  apps/dashboard/components/avatar-upload.tsx apps/dashboard/components/avatar-upload.test.tsx \
  apps/dashboard/components/account/avatar-section.tsx \
  apps/dashboard/components/account/avatar-section.test.tsx
git rm apps/dashboard/components/account/avatar-upload.tsx apps/dashboard/components/account/avatar-upload.test.tsx
git commit -m "refactor(avatar): share one image-upload hook + component across surfaces"
```

---

## Phase B - Backend org gaps

### Task B1: `organizations.imageId` + `getOrganizationSettings` returns the logo URL

**Files:**
- Modify: `packages/backend/convex/accounts/tables.ts` (add `imageId` to `organizations`)
- Modify: `packages/backend/convex/accounts/organization.ts` (`getOrganizationSettings` returns `imageUrl`)
- Test: `packages/backend/convex/accounts/organization.test.ts` (extend)

**Interfaces:**
- Produces: `organizations.imageId?: Id<"_storage">`; `getOrganizationSettings` return shape gains `imageUrl: string | null` (resolved via `ctx.storage.getUrl(imageId)`).

- [ ] **Step 1: Add the field.** In `accounts/tables.ts`, inside `organizations = defineTable({ ... })` add:

```ts
  // The org logo's file-storage id. Org-domain content (not PII): edited by org
  // admins, audited, and unaffected by person erasure (Role != Person).
  imageId: v.optional(v.id("_storage")),
```

- [ ] **Step 2: Write the failing test** (extend `organization.test.ts`): `getOrganizationSettings` returns `imageUrl: null` when there is no logo.

```ts
it("getOrganizationSettings returns imageUrl null when no logo set", async () => {
  const { t, orgId, userId } = await setup("editor")
  const asMember = t.withIdentity({ subject: userId })
  const profile = await asMember.query(
    api.accounts.organization.getOrganizationSettings,
    { orgId }
  )
  expect(profile.imageUrl).toBeNull()
})
```

- [ ] **Step 3: Run, verify fail** - `cd packages/backend && bunx vitest run convex/accounts/organization.test.ts -t imageUrl` → FAIL (property missing).

- [ ] **Step 4: Update `getOrganizationSettings`.** Extend `settingsShape` with `imageUrl: v.union(v.string(), v.null())` and resolve it:

```ts
const settingsShape = v.object({
  orgId: v.string(),
  country: v.union(v.string(), v.null()),
  currency: v.union(v.string(), v.null()),
  language: v.union(v.string(), v.null()),
  employeeCount: v.union(v.number(), v.null()),
  industry: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
})
```

In the handler, after loading `settings` (throws notFound if null), add:

```ts
    const imageUrl =
      settings.imageId != null ? await ctx.storage.getUrl(settings.imageId) : null
    return {
      orgId: settings.orgId,
      country: settings.country ?? null,
      currency: settings.currency ?? null,
      language: settings.language ?? null,
      employeeCount: settings.employeeCount ?? null,
      industry: settings.industry ?? null,
      imageUrl,
    }
```

- [ ] **Step 5: Run, verify pass** - `cd packages/backend && bunx vitest run convex/accounts/organization.test.ts && bun run typecheck` → PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/accounts/tables.ts packages/backend/convex/accounts/organization.ts packages/backend/convex/accounts/organization.test.ts
git commit -m "feat(organization): add org logo storage field + expose its url"
```

---

### Task B2: Org logo set/remove with audit + an action admin guard

**Files:**
- Modify: `packages/backend/convex/lib/audit.ts` (`organizationLogoUpdated`, `organizationLogoRemoved` events)
- Modify: `packages/backend/convex/lib/auditPayloads.ts` (payload entries)
- Modify: `packages/backend/convex/lib/functions.ts` (`requireOrgAdminAction` helper)
- Modify: `packages/backend/convex/accounts/organization.ts` (`setOrgAvatar`, `applyOrgAvatar`, `removeOrgAvatar`)
- Test: `packages/backend/convex/accounts/organization.test.ts`

**Interfaces:**
- Consumes from A1: `assertValidImageBlob`, `replaceStoredImage`, `clearStoredImage`, `IMAGE_UPLOAD_MAX_BYTES`.
- Produces:
  - `requireOrgAdminAction(ctx: ActionCtx, orgId: string): Promise<string>` (returns the caller's authUserId; throws `notAuthenticated`/`notAMember`/`adminRequired`)
  - `setOrgAvatar` action `{ orgId, storageId } → string`
  - `applyOrgAvatar` internalMutation `{ orgId, storageId, actorId } → string`
  - `removeOrgAvatar` adminMutation `{} → null` (orgId injected)
  - `AUDIT_EVENTS.organizationLogoUpdated = "organization.logoUpdated"`, `AUDIT_EVENTS.organizationLogoRemoved = "organization.logoRemoved"`

- [ ] **Step 1: Add the audit events.** In `lib/audit.ts` `AUDIT_EVENTS`, after `onboardingCompleted`:

```ts
  organizationLogoUpdated: "organization.logoUpdated",
  organizationLogoRemoved: "organization.logoRemoved",
```

In `lib/auditPayloads.ts` `AuditPayloads`, after `"organization.onboardingCompleted": {...}`:

```ts
  "organization.logoUpdated": Record<string, never>
  "organization.logoRemoved": Record<string, never>
```

- [ ] **Step 2: Add `requireOrgAdminAction` to `lib/functions.ts`** (the action-context analogue of `resolveOrgContext`'s admin gate; the custom-mutation wrappers cannot run in an action):

```ts
import type { ActionCtx } from "../_generated/server"

// Action-context admin gate: actions cannot use the customMutation org wrappers,
// so this mirrors resolveOrgContext's identity + membership(role===admin) check
// for an ActionCtx and returns the caller's auth id. Same error codes.
export async function requireOrgAdminAction(
  ctx: ActionCtx,
  orgId: string
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (identity === null) throw appError(ERROR_CODES.notAuthenticated)
  const membership = await ctx.runQuery(
    components.betterAuth.membership.getMembership,
    { organizationId: orgId, userId: identity.subject }
  )
  if (membership === null) throw appError(ERROR_CODES.notAMember)
  if (membership.role !== "admin") throw appError(ERROR_CODES.adminRequired)
  return identity.subject
}
```

(Add `ActionCtx` to the existing `_generated/server` import.)

- [ ] **Step 3: Write the failing tests** (in `organization.test.ts`). Use a fake storage id by inserting a blob in `t.run` via `ctx.storage.store`, or assert the admin-gate + remove paths which do not need a real blob. Minimum:

```ts
it("removeOrgAvatar clears the logo and audits logoRemoved (admin only)", async () => {
  const { t, orgId, userId } = await setup("admin")
  // Seed a stored blob + point the org at it.
  const storageId = await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["img"], { type: "image/png" }))
    const row = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    await ctx.db.patch(row!._id, { imageId: id })
    return id
  })
  const asAdmin = t.withIdentity({ subject: userId })
  await asAdmin.mutation(api.accounts.organization.removeOrgAvatar, { orgId })
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    expect(row!.imageId).toBeUndefined()
    const audit = await ctx.db
      .query("auditLog")
      .withIndex("by_org_type", (q) =>
        q.eq("orgId", orgId).eq("type", "organization.logoRemoved")
      )
      .collect()
    expect(audit).toHaveLength(1)
    expect(await ctx.storage.getUrl(storageId)).toBeNull()
  })
})

it("removeOrgAvatar is rejected for editors", async () => {
  const { t, orgId, userId } = await setup("editor")
  const asEditor = t.withIdentity({ subject: userId })
  await expect(
    asEditor.mutation(api.accounts.organization.removeOrgAvatar, { orgId })
  ).rejects.toThrow()
})

it("applyOrgAvatar swaps the stored file and audits logoUpdated", async () => {
  const { t, orgId, userId } = await setup("admin")
  const storageId = await t.run(async (ctx) =>
    ctx.storage.store(new Blob(["img"], { type: "image/png" }))
  )
  await t.mutation(internal.accounts.organization.applyOrgAvatar, {
    orgId,
    storageId,
    actorId: userId,
  })
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    expect(row!.imageId).toBe(storageId)
    const audit = await ctx.db
      .query("auditLog")
      .withIndex("by_org_type", (q) =>
        q.eq("orgId", orgId).eq("type", "organization.logoUpdated")
      )
      .collect()
    expect(audit).toHaveLength(1)
    expect(audit[0].actorName).toBe("HR Person")
  })
})
```

(Note: `setOrgAvatar` itself is an action that validates via `internal.files.blobMeta`; convex-test storage records size but not content type, so unit tests cover the admin gate + apply/remove + audit. The action's end-to-end happy path and content-type rejection are e2e-only, like the user-avatar tests. Add an admin-gate test for the action: an editor calling `setOrgAvatar` rejects before any storage write.)

```ts
it("setOrgAvatar is rejected for editors", async () => {
  const { t, orgId, userId } = await setup("editor")
  const storageId = await t.run(async (ctx) =>
    ctx.storage.store(new Blob(["img"], { type: "image/png" }))
  )
  const asEditor = t.withIdentity({ subject: userId })
  await expect(
    asEditor.action(api.accounts.organization.setOrgAvatar, { orgId, storageId })
  ).rejects.toThrow()
})
```

- [ ] **Step 4: Run, verify fail** - `cd packages/backend && bunx vitest run convex/accounts/organization.test.ts -t logo` and `-t setOrgAvatar` → FAIL.

- [ ] **Step 5: Implement in `accounts/organization.ts`.** Add imports:

```ts
import { action, internalMutation } from "../_generated/server"
import { internal } from "../_generated/api"
import { assertValidImageBlob, clearStoredImage, IMAGE_UPLOAD_MAX_BYTES, replaceStoredImage } from "../files"
import { AUDIT_EVENTS, buildChanges, logAudit, SETTINGS_AUDIT_FIELDS } from "../lib/audit"
import { adminMutation, orgQuery, requireOrgAdminAction } from "../lib/functions"
```

(Merge with the existing imports; `logAudit` and `requireOrgAdminAction` are the new names.)

```ts
// Org logo upload. ACTION so a rejected blob can be deleted outside a
// transaction (a thrown mutation would roll the delete back). Admin-gated via
// requireOrgAdminAction (actions cannot use adminMutation). Validates the blob,
// then delegates the row write + audit to the internal applyOrgAvatar mutation.
export const setOrgAvatar = action({
  args: { orgId: v.string(), storageId: v.id("_storage") },
  returns: v.string(),
  handler: async (ctx, { orgId, storageId }): Promise<string> => {
    const actorId = await requireOrgAdminAction(ctx, orgId)
    await assertValidImageBlob(ctx, storageId, IMAGE_UPLOAD_MAX_BYTES)
    return await ctx.runMutation(internal.accounts.organization.applyOrgAvatar, {
      orgId,
      storageId,
      actorId,
    })
  },
})

// Associates a validated blob as the org logo, replacing any previous file, and
// audits organization.logoUpdated. Internal: only setOrgAvatar (after the admin
// + blob checks) calls it. Upserts the organizations row defensively.
export const applyOrgAvatar = internalMutation({
  args: { orgId: v.string(), storageId: v.id("_storage"), actorId: v.string() },
  returns: v.string(),
  handler: async (ctx, { orgId, storageId, actorId }) => {
    const row = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    const url = await replaceStoredImage(ctx, {
      previousId: row?.imageId ?? null,
      storageId,
    })
    if (row === null) {
      await ctx.db.insert("organizations", { orgId, imageId: storageId })
    } else {
      await ctx.db.patch(row._id, { imageId: storageId })
    }
    await logAudit(ctx, {
      orgId,
      actorId,
      type: AUDIT_EVENTS.organizationLogoUpdated,
      payload: {},
    })
    return url
  },
})

// Removes the org logo (file + field) and audits organization.logoRemoved.
// No-op when there is no logo. Admin-only.
export const removeOrgAvatar = adminMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (row === null || row.imageId == null) return null
    await clearStoredImage(ctx, row.imageId)
    await ctx.db.patch(row._id, { imageId: undefined })
    await ctx.audit.log({
      type: AUDIT_EVENTS.organizationLogoRemoved,
      payload: {},
    })
    return null
  },
})
```

- [ ] **Step 6: Run, verify pass** - `cd packages/backend && bunx vitest run convex/accounts/organization.test.ts && bun run typecheck` → PASS, exit 0. (Typecheck confirms the new `AuditPayloads` keys satisfy the compile-time coverage guards.)

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/lib/audit.ts packages/backend/convex/lib/auditPayloads.ts \
  packages/backend/convex/lib/functions.ts packages/backend/convex/accounts/organization.ts \
  packages/backend/convex/accounts/organization.test.ts
git commit -m "feat(organization): org logo upload/remove with audit"
```

---

### Task B3: Org name editing with audit

**Files:**
- Modify: `packages/backend/convex/betterAuth/provisioning.ts` (`getOrganization` query)
- Modify: `packages/backend/convex/lib/audit.ts` + `lib/auditPayloads.ts` (`organizationNameUpdated`)
- Modify: `packages/backend/convex/accounts/organization.ts` (`updateOrganizationName`)
- Test: `packages/backend/convex/accounts/organization.test.ts`

**Interfaces:**
- Produces:
  - `components.betterAuth.provisioning.getOrganization({ orgId }) → { name: string; slug: string } | null`
  - `updateOrganizationName` adminMutation `{ name } → null`
  - `AUDIT_EVENTS.organizationNameUpdated = "organization.nameUpdated"`, payload `{ changes: Changes }`

- [ ] **Step 1: Add `getOrganization` to `provisioning.ts`** (so the name change can be diffed; mirror `listAllOrganizations`):

```ts
export const getOrganization = query({
  args: { orgId: v.string() },
  returns: v.union(v.null(), v.object({ name: v.string(), slug: v.string() })),
  handler: async (ctx, { orgId }) => {
    const id = ctx.db.normalizeId("organization", orgId)
    if (id === null) return null
    const org = await ctx.db.get(id)
    if (org === null) return null
    return { name: org.name, slug: org.slug }
  },
})
```

- [ ] **Step 2: Add the audit event.** `lib/audit.ts` `AUDIT_EVENTS`: `organizationNameUpdated: "organization.nameUpdated",`. `lib/auditPayloads.ts`: `"organization.nameUpdated": { changes: Changes }`.

- [ ] **Step 3: Write the failing test.**

```ts
it("updateOrganizationName updates the BA name and audits nameUpdated (admin only)", async () => {
  const { t, orgId, userId } = await setup("admin")
  const asAdmin = t.withIdentity({ subject: userId })
  await asAdmin.mutation(api.accounts.organization.updateOrganizationName, {
    orgId,
    name: "Renamed AB",
  })
  await t.run(async (ctx) => {
    const audit = await ctx.db
      .query("auditLog")
      .withIndex("by_org_type", (q) =>
        q.eq("orgId", orgId).eq("type", "organization.nameUpdated")
      )
      .collect()
    expect(audit).toHaveLength(1)
    const payload = audit[0].payload as { changes: Record<string, { from: unknown; to: unknown }> }
    expect(payload.changes.name.to).toBe("Renamed AB")
  })
  const org = await t.query(components.betterAuth.provisioning.getOrganization, {
    orgId,
  })
  expect(org?.name).toBe("Renamed AB")
})

it("updateOrganizationName rejects an empty name and is admin-only", async () => {
  const { t, orgId, userId } = await setup("admin")
  const asAdmin = t.withIdentity({ subject: userId })
  await expect(
    asAdmin.mutation(api.accounts.organization.updateOrganizationName, { orgId, name: "   " })
  ).rejects.toThrow()
  const { t: t2, orgId: o2, userId: u2 } = await setup("editor")
  await expect(
    t2.withIdentity({ subject: u2 }).mutation(
      api.accounts.organization.updateOrganizationName,
      { orgId: o2, name: "X" }
    )
  ).rejects.toThrow()
})
```

(Confirmed against the harness: `seedMembership` inserts a real `organization` row whose id is the returned `orgId`, so `getOrganization` resolves it via `normalizeId("organization", orgId)` + `db.get`. No extra org seeding needed. Call `t.query(...)` at the top level, never nested inside a `t.run` transaction.)

- [ ] **Step 4: Run, verify fail** - `cd packages/backend && bunx vitest run convex/accounts/organization.test.ts -t nameUpdated` → FAIL.

- [ ] **Step 5: Implement `updateOrganizationName`** in `accounts/organization.ts`:

```ts
// Org name edit (the name lives on the Better Auth organization record, not the
// app mirror). Admin-only; audited as organization.nameUpdated with the old/new
// name diffed. updateOrganizationIdentity raw-patches the component row, which
// does not fire the member/invitation triggers, so we log explicitly here.
export const updateOrganizationName = adminMutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, { name }) => {
    const trimmed = name.trim()
    if (trimmed === "") throw appError(ERROR_CODES.invalidInput)
    const current = await ctx.runQuery(
      components.betterAuth.provisioning.getOrganization,
      { orgId: ctx.orgId }
    )
    const from = current?.name ?? null
    if (from === trimmed) return null
    await ctx.runMutation(
      components.betterAuth.provisioning.updateOrganizationIdentity,
      { orgId: ctx.orgId, name: trimmed }
    )
    await ctx.audit.log({
      type: AUDIT_EVENTS.organizationNameUpdated,
      payload: { changes: { name: { from, to: trimmed } } },
    })
    return null
  },
})
```

(Add `components` to the import from `../_generated/api` if not already present.)

- [ ] **Step 6: Run, verify pass** - `cd packages/backend && bunx vitest run convex/accounts/organization.test.ts && bun run typecheck` → PASS, exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/betterAuth/provisioning.ts packages/backend/convex/lib/audit.ts \
  packages/backend/convex/lib/auditPayloads.ts packages/backend/convex/accounts/organization.ts \
  packages/backend/convex/accounts/organization.test.ts
git commit -m "feat(organization): admin can rename the org (audited)"
```

---

### Task B4: Member roster query + role-change/remove mutations with last-admin guard

**Files:**
- Modify: `packages/backend/convex/accounts/organization.ts` (`listOrgMembers`, `updateMemberRole`, `removeMember`, plus a pure `isSoleAdmin` helper)
- Test: `packages/backend/convex/accounts/organization.test.ts`

**Interfaces:**
- Consumes: `components.betterAuth.provisioning.{listMembers,setMemberRole,removeMember}`.
- Produces:
  - `listOrgMembers` adminQuery `{} → { userId, name, email, role }[]`
  - `updateMemberRole` adminMutation `{ userId, role: "admin"|"editor" } → null` (last-admin guard; explicit `member.roleChanged` audit)
  - `removeMember` adminMutation `{ userId } → null` (last-admin guard; explicit `member.removed` audit)
- These explicitly log audit because the provisioning raw writes bypass the Better Auth adapter triggers (the "future slice" noted in `mirrors.ts`).

- [ ] **Step 1: Write the failing tests.** Seed a second admin via `provisionUser` + `addMember` to exercise the guard.

```ts
describe("organization members", () => {
  async function setupWithSecond(secondRole: "admin" | "editor") {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "admin@acme.se", name: "Admin One", role: "admin" }
    )
    const second = await t.mutation(
      components.betterAuth.provisioning.provisionUser,
      { email: "two@acme.se", name: "Member Two" }
    )
    await t.mutation(components.betterAuth.provisioning.addMember, {
      organizationId: orgId,
      userId: second.userId,
      role: secondRole,
    })
    await t.run(async (ctx) => {
      await onUserCreate(ctx, { _id: userId, email: "admin@acme.se", name: "Admin One" })
      await onUserCreate(ctx, { _id: second.userId, email: "two@acme.se", name: "Member Two" })
      await ctx.db.insert("organizations", { orgId })
    })
    return { t, orgId, adminId: userId, secondId: second.userId }
  }

  it("listOrgMembers returns the roster for an admin", async () => {
    const { t, orgId, adminId } = await setupWithSecond("editor")
    const rows = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.organization.listOrgMembers, { orgId })
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.role).sort()).toEqual(["admin", "editor"])
  })

  it("updateMemberRole promotes an editor and audits member.roleChanged", async () => {
    const { t, orgId, adminId, secondId } = await setupWithSecond("editor")
    await t.withIdentity({ subject: adminId }).mutation(
      api.accounts.organization.updateMemberRole,
      { orgId, userId: secondId, role: "admin" }
    )
    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "member.roleChanged")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0].actorName).toBe("Admin One")
      const p = audit[0].payload as { memberUserId: string; changes: { role: { from: unknown; to: unknown } } }
      expect(p.memberUserId).toBe(secondId)
      expect(p.changes.role).toEqual({ from: "editor", to: "admin" })
    })
  })

  it("updateMemberRole refuses to demote the sole admin", async () => {
    const { t, orgId, adminId } = await setupWithSecond("editor")
    await expect(
      t.withIdentity({ subject: adminId }).mutation(
        api.accounts.organization.updateMemberRole,
        { orgId, userId: adminId, role: "editor" }
      )
    ).rejects.toThrow()
  })

  it("updateMemberRole allows demoting one admin when two exist", async () => {
    const { t, orgId, adminId, secondId } = await setupWithSecond("admin")
    await t.withIdentity({ subject: adminId }).mutation(
      api.accounts.organization.updateMemberRole,
      { orgId, userId: secondId, role: "editor" }
    )
    const rows = await t
      .withIdentity({ subject: adminId })
      .query(api.accounts.organization.listOrgMembers, { orgId })
    expect(rows.find((r) => r.userId === secondId)?.role).toBe("editor")
  })

  it("removeMember removes a non-sole member and audits member.removed", async () => {
    const { t, orgId, adminId, secondId } = await setupWithSecond("editor")
    await t.withIdentity({ subject: adminId }).mutation(
      api.accounts.organization.removeMember,
      { orgId, userId: secondId }
    )
    await t.run(async (ctx) => {
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "member.removed")
        )
        .collect()
      expect(audit).toHaveLength(1)
      const p = audit[0].payload as { changes: { role: { from: unknown; to: unknown } } }
      expect(p.changes.role).toEqual({ from: "editor", to: null })
    })
  })

  it("removeMember refuses to remove the sole admin", async () => {
    const { t, orgId, adminId } = await setupWithSecond("editor")
    await expect(
      t.withIdentity({ subject: adminId }).mutation(
        api.accounts.organization.removeMember,
        { orgId, userId: adminId }
      )
    ).rejects.toThrow()
  })

  it("member mutations are admin-only", async () => {
    const { t, orgId, secondId } = await setupWithSecond("editor")
    await expect(
      t.withIdentity({ subject: secondId }).query(
        api.accounts.organization.listOrgMembers,
        { orgId }
      )
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run, verify fail** - `cd packages/backend && bunx vitest run convex/accounts/organization.test.ts -t members` → FAIL.

- [ ] **Step 3: Implement in `accounts/organization.ts`.** Add a member role validator + the functions:

```ts
import { adminQuery } from "../lib/functions" // add to the lib/functions import

const memberRoleArg = v.union(v.literal("admin"), v.literal("editor"))

// Pure: would changing/removing this member leave the org admin-less?
function isSoleAdmin(
  members: { userId: string; role: string }[],
  userId: string
): boolean {
  const target = members.find((m) => m.userId === userId)
  if (target === undefined || target.role !== "admin") return false
  return members.filter((m) => m.role === "admin").length === 1
}

// The team roster. Admin-only (this surface is admin-only). Wraps the component
// listMembers (id + name + email + role; bounded at 500).
export const listOrgMembers = adminQuery({
  args: {},
  returns: v.array(
    v.object({
      userId: v.string(),
      name: v.string(),
      email: v.string(),
      role: v.string(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.runQuery(components.betterAuth.provisioning.listMembers, {
      organizationId: ctx.orgId,
    })
  },
})

// Change a member's role. Admin-only. Refuses to demote the sole admin (would
// leave the org admin-less). Logs member.roleChanged explicitly (the raw
// provisioning patch bypasses the adapter trigger), with the real admin actor.
export const updateMemberRole = adminMutation({
  args: { userId: v.string(), role: memberRoleArg },
  returns: v.null(),
  handler: async (ctx, { userId, role }) => {
    const members = await ctx.runQuery(
      components.betterAuth.provisioning.listMembers,
      { organizationId: ctx.orgId }
    )
    if (role === "editor" && isSoleAdmin(members, userId)) {
      throw appError(ERROR_CODES.lastAdmin)
    }
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.setMemberRole,
      { organizationId: ctx.orgId, userId, role }
    )
    if (result === null || result.from === role) return null
    await ctx.audit.log({
      type: AUDIT_EVENTS.memberRoleChanged,
      payload: {
        memberUserId: userId,
        changes: { role: { from: result.from, to: role } },
      },
    })
    return null
  },
})

// Remove a member. Admin-only. Refuses to remove the sole admin. Logs
// member.removed explicitly with the real admin actor.
export const removeMember = adminMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const members = await ctx.runQuery(
      components.betterAuth.provisioning.listMembers,
      { organizationId: ctx.orgId }
    )
    if (isSoleAdmin(members, userId)) {
      throw appError(ERROR_CODES.lastAdmin)
    }
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.removeMember,
      { organizationId: ctx.orgId, userId }
    )
    if (result === null) return null
    await ctx.audit.log({
      type: AUDIT_EVENTS.memberRemoved,
      payload: {
        memberUserId: userId,
        changes: { role: { from: result.role, to: null } },
      },
    })
    return null
  },
})
```

- [ ] **Step 4: Run, verify pass** - `cd packages/backend && bunx vitest run convex/accounts/organization.test.ts && bun run typecheck` → PASS, exit 0.

- [ ] **Step 5: Full backend suite** - `cd packages/backend && bun run test` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/accounts/organization.ts packages/backend/convex/accounts/organization.test.ts
git commit -m "feat(organization): admin member roster, role change, and removal with last-admin guard"
```

---

## Phase C - Frontend `/organization` surface

> i18n note for all Phase C tasks: add new keys to `packages/i18n/messages/en.json` FIRST, then mirror the identical key set to `sv.json`, `nb.json`, `da.json`, `fi.json`. Run `cd packages/i18n && bun run test` after each to keep the parity test green. Add machine-translation review entries to `docs/go-live-checklist.md`.

### Task C1: Route scaffold, header tabs, admin gate, nav entry

**Files:**
- Create: `apps/dashboard/app/(app)/organization/layout.tsx`, `organization/page.tsx`, `organization/general/page.tsx`, `organization/members/page.tsx`
- Create: `apps/dashboard/components/organization/organization-tabs.tsx`
- Modify: `apps/dashboard/components/site-header.tsx` (render `OrganizationTabs` for `section === "organization"`)
- Modify: `apps/dashboard/components/nav-user.tsx` (admin-only "Organization" link)
- Modify i18n: `organization.tabs.{general,members}`, `nav.organization`, `organization.notAuthorized`
- Test: `apps/dashboard/components/organization/organization-tabs.test.tsx`

**Interfaces:**
- Produces: `OrganizationTabs` component; routes that render placeholder content gated by `useOrganization().role === "admin"`.

- [ ] **Step 1: Add i18n keys.** In `en.json` under `dashboard`:
  - `account` sibling `organization`: `{ "tabs": { "general": "General", "members": "Members" }, "notAuthorized": "Only organization admins can manage these settings." }`
  - `nav.organization`: `"Organization"`
  Mirror to all four other locales (translate the values). Run the i18n parity test.

- [ ] **Step 2: Write the failing `OrganizationTabs` test** (mirror `account-tabs` behavior - active underline by pathname).

```tsx
// apps/dashboard/components/organization/organization-tabs.test.tsx
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ usePathname: () => "/organization/general" }))

import { OrganizationTabs } from "./organization-tabs"

afterEach(() => cleanup())

it("renders the general and members tabs", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrganizationTabs />
    </NextIntlClientProvider>
  )
  expect(screen.getByText(messages.dashboard.organization.tabs.general)).toBeDefined()
  expect(screen.getByText(messages.dashboard.organization.tabs.members)).toBeDefined()
})
```

- [ ] **Step 3: Run, verify fail** - `cd apps/dashboard && bunx vitest run components/organization/organization-tabs.test.tsx` → FAIL.

- [ ] **Step 4: Create `organization-tabs.tsx`** (copy `account/account-tabs.tsx` exactly; change the TABS hrefs to `/organization/general` + `/organization/members`, the `useTranslations` namespace to `dashboard.organization.tabs`, the `aria-label` to `tNav("organization")`, and the `layoutId` to `"organization-tab-underline"`).

- [ ] **Step 5: Register in `site-header.tsx`.** Add `import { OrganizationTabs } from "@/components/organization/organization-tabs"`, `const inOrganizationSection = section === "organization"`, and a branch `: inOrganizationSection ? (<OrganizationTabs />)` before the plain-title fallback.

- [ ] **Step 6: Create the layout** `app/(app)/organization/layout.tsx` (client; admin gate via `useOrganization`):

```tsx
"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useOrganization } from "@/components/org-context"

// Admin-only surface. The nav entry is admin-gated and the backend re-checks,
// but a direct visit by an editor lands here, so gate authoritatively in the UI
// too. The tab bar lives in the site header (OrganizationTabs).
export default function OrganizationLayout(props: { children: ReactNode }) {
  const t = useTranslations("dashboard.organization")
  const { role } = useOrganization()
  if (role !== "admin") {
    return (
      <div className="w-full max-w-2xl">
        <p className="text-muted-foreground text-sm">{t("notAuthorized")}</p>
      </div>
    )
  }
  return <div className="w-full max-w-2xl">{props.children}</div>
}
```

- [ ] **Step 7: Create `organization/page.tsx`** (redirect to general):

```tsx
import { redirect } from "next/navigation"

export default function OrganizationPage() {
  redirect("/organization/general")
}
```

- [ ] **Step 8: Create placeholder `general/page.tsx` and `members/page.tsx`** (client, `usePageTitle`, a heading). These are filled by C2/C3. Example general:

```tsx
"use client"

import { useTranslations } from "next-intl"
import { usePageTitle } from "@/hooks/use-page-title"

export default function OrganizationGeneralPage() {
  const t = useTranslations("dashboard.organization.tabs")
  usePageTitle(t("general"))
  return <div className="space-y-6" />
}
```

(Members analogous with `t("members")`.)

- [ ] **Step 9: Add the nav entry in `nav-user.tsx`.** (Deliberate divergence from the spec, which named `org-switch-menu.tsx`: that submenu (`OrgSwitchMenuSub`) renders nothing for single-org users, so it is the wrong host for an always-visible admin link. `nav-user.tsx`, next to the Account-settings item and rendered inside `OrganizationProvider`, is the correct home.) Import `useOrganization`; read `const { role: orgRole } = useOrganization()`. Add, next to the Account settings item, gated on admin:

```tsx
{orgRole === "admin" && (
  <DropdownMenuItem asChild>
    <Link href="/organization">
      <HugeiconsIcon icon={Building01Icon} strokeWidth={2} />
      {t("nav.organization")}
    </Link>
  </DropdownMenuItem>
)}
```

(Import `Building01Icon` from `@hugeicons/core-free-icons`. `nav-user` is rendered inside the sidebar, which is inside `AppShell`/`OrganizationProvider`, so `useOrganization()` is available.)

- [ ] **Step 10: Run tab test + typecheck** - `cd apps/dashboard && bunx vitest run components/organization/organization-tabs.test.tsx && bun run typecheck` → PASS, exit 0.

- [ ] **Step 11: Commit**

```bash
git add apps/dashboard/app/\(app\)/organization apps/dashboard/components/organization/organization-tabs.tsx \
  apps/dashboard/components/organization/organization-tabs.test.tsx apps/dashboard/components/site-header.tsx \
  apps/dashboard/components/nav-user.tsx packages/i18n/messages docs/go-live-checklist.md
git commit -m "feat(organization): admin-only /organization surface scaffold + nav"
```

---

### Task C2: General tab - logo section + profile form

**Files:**
- Create: `apps/dashboard/lib/organization-schemas.ts` (`makeOrganizationProfileSchema`)
- Create: `apps/dashboard/components/organization/organization-logo-section.tsx`
- Create: `apps/dashboard/components/organization/organization-profile-form.tsx`
- Modify: `apps/dashboard/app/(app)/organization/general/page.tsx` (compose the two sections)
- Modify i18n: `organization.general.*`, `organization.logo.*`, `dashboard.help.{orgCurrencyLabel,orgCurrencyBody,orgLanguageLabel,orgLanguageBody}`
- Test: `apps/dashboard/components/organization/organization-profile-form.test.tsx`

**Interfaces:**
- Consumes: `useOrganization()` (orgId, name), `api.accounts.organization.{getOrganizationSettings,updateOrganizationSettings,updateOrganizationName,setOrgAvatar,removeOrgAvatar}`, `api.files.generateImageUploadUrl`, `useImageUpload`, `AvatarUpload`, `CountrySelect`/`CurrencySelect`/`IndustrySelect`, `defaultCurrencyFor`/`defaultLanguageFor`/`countryForLanguage`/`LANGUAGE_BY_COUNTRY` from `@workspace/constants`.
- Produces: `makeOrganizationProfileSchema(t) → ZodObject` with `{ name: required, country/currency/language/industry: optional string }`; `OrganizationProfileValues` type.

- [ ] **Step 1: Add the schema factory.**

```ts
// apps/dashboard/lib/organization-schemas.ts
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// The org profile edit form. Name is required (translated message); the rest are
// optional selects. Backend re-validates with appError codes; this is the client
// gate. A factory so messages stay in i18n (FormMessage stays vendor-pure).
export function makeOrganizationProfileSchema(t: ValidationT) {
  return z.object({
    name: z.string().trim().min(1, t("required")),
    country: z.string().trim().optional(),
    currency: z.string().trim().optional(),
    language: z.string().trim().optional(),
    industry: z.string().trim().optional(),
  })
}
export type OrganizationProfileValues = z.infer<
  ReturnType<typeof makeOrganizationProfileSchema>
>
```

- [ ] **Step 2: Add i18n keys** under `dashboard.organization`: `general` (`title`, `description`, `nameLabel`, `countryLabel`, `currencyLabel`, `languageLabel`, `industryLabel`, placeholders, `save`, `saved`, `error`, `activityLink`), `logo` (`title`, `description`, `helper`, `remove`, `invalidType`, `tooLarge`, `error`). Under `dashboard.help`: `orgCurrencyLabel`/`orgCurrencyBody` and `orgLanguageLabel`/`orgLanguageBody` (HelpMorphButton needs a `label` = popover title/aria-label AND body `children`; pair keys per the existing `*Label`/`*Body` convention). Mirror to all locales; run parity test.

- [ ] **Step 3: Create `organization-logo-section.tsx`** - the org analogue of `account/avatar-section.tsx`, wiring `useImageUpload` with org bindings and the org logo url:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useAction, useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { AvatarUpload } from "@/components/avatar-upload"
import { useOrganization } from "@/components/org-context"
import { useImageUpload } from "@/hooks/use-image-upload"

export function OrganizationLogoSection(props: { imageUrl: string | null }) {
  const t = useTranslations("dashboard.organization.logo")
  const { orgId, name } = useOrganization()
  const generateUploadUrl = useMutation(api.files.generateImageUploadUrl)
  const setOrgAvatar = useAction(api.accounts.organization.setOrgAvatar)
  const removeOrgAvatar = useMutation(api.accounts.organization.removeOrgAvatar)

  const upload = useImageUpload({
    generateUploadUrl: () => generateUploadUrl({}),
    setImage: (storageId) => setOrgAvatar({ orgId, storageId }),
    removeImage: async () => {
      await removeOrgAvatar({ orgId })
    },
    labels: { invalidType: t("invalidType"), tooLarge: t("tooLarge"), error: t("error") },
  })

  const initials = name.split(" ").slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase()

  return (
    <Card>
      <div className="flex items-start justify-between gap-8">
        <CardHeader className="flex-1">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <div className="pt-6 pr-6">
          <AvatarUpload
            imageUrl={props.imageUrl}
            fallback={initials}
            alt={name}
            previewUrl={upload.previewUrl}
            isUploading={upload.isUploading}
            isRemoving={upload.isRemoving}
            error={upload.error}
            onSelectFile={upload.selectFile}
            onRemove={upload.remove}
            removeLabel={t("remove")}
          />
        </div>
      </div>
      <CardFooter className="text-muted-foreground text-sm">{t("helper")}</CardFooter>
    </Card>
  )
}
```

- [ ] **Step 4: Write the failing profile-form test** (renders fields; submit disabled until dirty; saving calls both `updateOrganizationName` and `updateOrganizationSettings`). Mock `convex/react` (`useMutation` returns spies) and `@/components/org-context` (`useOrganization` → `{orgId:"o1",name:"Acme",role:"admin"}`). Model the mock on `components/admin/manage-organization-dialog.test.tsx`.

```tsx
// apps/dashboard/components/organization/organization-profile-form.test.tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const updateName = vi.fn(async () => null)
const updateSettings = vi.fn(async () => null)
// Mock the generated api to PLAIN STRING refs: a real Convex FunctionReference
// is a proxy that throws on String()/primitive coercion, so route useMutation by
// identity. Mirrors components/admin/manage-organization-dialog.test.tsx.
vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      organization: {
        updateOrganizationName: "accounts.organization.updateOrganizationName",
        updateOrganizationSettings: "accounts.organization.updateOrganizationSettings",
      },
    },
  },
}))
vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) =>
    ref === "accounts.organization.updateOrganizationName"
      ? updateName
      : updateSettings,
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "o1", name: "Acme AB", role: "admin" }),
}))

import { OrganizationProfileForm } from "./organization-profile-form"

const t = en.dashboard.organization.general

function renderForm(initial = { country: "se", currency: "SEK", language: "sv", industry: "tech" }) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <OrganizationProfileForm initial={initial} />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  cleanup()
  updateName.mockClear()
  updateSettings.mockClear()
})

describe("OrganizationProfileForm", () => {
  it("disables save until a field changes", () => {
    renderForm()
    const save = screen.getByRole("button", { name: t.save }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })
  it("saves the changed name through updateOrganizationName", async () => {
    renderForm()
    const nameInput = screen.getByLabelText(t.nameLabel)
    fireEvent.change(nameInput, { target: { value: "Renamed AB" } })
    fireEvent.blur(nameInput)
    const save = screen.getByRole("button", { name: t.save })
    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(save)
    await waitFor(() =>
      expect(updateName).toHaveBeenCalledWith({ orgId: "o1", name: "Renamed AB" })
    )
  })
})
```

- [ ] **Step 5: Run, verify fail** - `cd apps/dashboard && bunx vitest run components/organization/organization-profile-form.test.tsx` → FAIL.

- [ ] **Step 6: Implement `organization-profile-form.tsx`.** A `Card` + RHF form. Mirror `manage-organization-dialog.tsx` for the field set + the language-via-`CountrySelect` mapping and `profile-name-form.tsx` for the Card/footer/save-state pattern. Defaults: name from `useOrganization().name`, settings from the `initial` prop (the page passes the `getOrganizationSettings` result). On submit, call `updateOrganizationName` only if the name changed, and `updateOrganizationSettings` only if any setting changed; gate the submit on `!isValid || !isDirty`. Add `HelpMorphButton` (`dashboard.help.orgCurrency`, `dashboard.help.orgLanguage`) next to the currency and language labels. Key body:

```tsx
const form = useForm<OrganizationProfileValues>({
  resolver: zodResolver(makeOrganizationProfileSchema(tv)),
  mode: "onTouched",
  defaultValues: {
    name,
    country: initial.country ?? "",
    currency: initial.currency ?? "",
    language: initial.language ?? "",
    industry: initial.industry ?? "",
  },
})
const { isValid, isDirty, isSubmitting } = form.formState

async function onSubmit(values: OrganizationProfileValues) {
  setError(false); setSaved(false)
  try {
    if (values.name !== name) await updateName({ orgId, name: values.name })
    const settingsChanged =
      values.country !== (initial.country ?? "") ||
      values.currency !== (initial.currency ?? "") ||
      values.language !== (initial.language ?? "") ||
      values.industry !== (initial.industry ?? "")
    if (settingsChanged) {
      await updateSettings({
        orgId,
        country: values.country || undefined,
        currency: values.currency || undefined,
        language: values.language || undefined,
        industry: values.industry || undefined,
      })
    }
    form.reset(values)
    setSaved(true)
  } catch {
    setError(true)
  }
}
```

(Use `CountrySelect`/`CurrencySelect`/`IndustrySelect`; for `language` use `CountrySelect` with the `countryForLanguage`/`LANGUAGE_BY_COUNTRY` mapping exactly as `manage-organization-dialog.tsx` does. `tv = useTranslations("dashboard.validation")`. The submit `SubmitButton` gets `disabled={!isValid || !isDirty}`.)

The country `FormField`'s `onValueChange` must set the country AND derive the dependent fields, mirroring `onboarding/country-screen.tsx`: `(code) => { field.onChange(code); form.setValue("currency", defaultCurrencyFor(code), { shouldDirty: true, shouldValidate: true }); form.setValue("language", defaultLanguageFor(code), { shouldDirty: true, shouldValidate: true }) }`. Import `defaultCurrencyFor` and `defaultLanguageFor` from `@workspace/constants`. Add a `HelpMorphButton` beside the currency and language labels: `<HelpMorphButton label={tHelp("orgCurrencyLabel")}>{tHelp("orgCurrencyBody")}</HelpMorphButton>` (and the orgLanguage pair), where `tHelp = useTranslations("dashboard.help")`.

- [ ] **Step 7: Compose the general page** `organization/general/page.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { OrganizationLogoSection } from "@/components/organization/organization-logo-section"
import { OrganizationProfileForm } from "@/components/organization/organization-profile-form"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

export default function OrganizationGeneralPage() {
  const t = useTranslations("dashboard.organization.tabs")
  usePageTitle(t("general"))
  const { orgId } = useOrganization()
  const settings = useQuery(api.accounts.organization.getOrganizationSettings, { orgId })
  return (
    <div className="space-y-6">
      <OrganizationLogoSection imageUrl={settings?.imageUrl ?? null} />
      {settings !== undefined && (
        <OrganizationProfileForm
          initial={{
            country: settings.country,
            currency: settings.currency,
            language: settings.language,
            industry: settings.industry,
          }}
        />
      )}
    </div>
  )
}
```

> Note: `getOrganizationSettings` throws `notFound` only when the org row is absent. That row is created at org creation (`onOrganizationCreate`), and this admin surface only mounts post-onboarding, so it is always present. The `settings !== undefined` guard handles the loading state, not the (unreachable in the real flow) missing-row case.

- [ ] **Step 8: Run tests + typecheck** - `cd apps/dashboard && bunx vitest run components/organization && bun run typecheck` → PASS, exit 0.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/lib/organization-schemas.ts apps/dashboard/components/organization \
  apps/dashboard/app/\(app\)/organization/general/page.tsx packages/i18n/messages docs/go-live-checklist.md
git commit -m "feat(organization): general tab with logo + profile editing"
```

---

### Task C3: Members tab - roster, role change, removal, invite, pending invitations

**Files:**
- Create: `apps/dashboard/components/organization/organization-members-section.tsx`
- Create: `apps/dashboard/components/organization/invite-member-dialog.tsx`
- Create: `apps/dashboard/components/organization/organization-invitations-section.tsx`
- Modify: `apps/dashboard/app/(app)/organization/members/page.tsx`
- Modify i18n: `organization.members.*`, `organization.invite.*`, `organization.invitations.*`
- Test: `apps/dashboard/components/organization/organization-members-section.test.tsx`, `invite-member-dialog.test.tsx`

**Interfaces:**
- Consumes: `useOrganization()`, `api.accounts.organization.{listOrgMembers,updateMemberRole,removeMember}`, `authClient.organization.{inviteMember,listInvitations,cancelInvitation}`, `authClient.useSession()` (to identify "you" in the roster).
- Note: confirm the Better Auth org-client method names/args during implementation (`inviteMember({ email, role, organizationId })`, `listInvitations({ query: { organizationId } })` or the `useListInvitations` hook, `cancelInvitation({ invitationId })`). The client plugin is configured in `lib/auth-client.ts`.

- [ ] **Step 1: Add i18n keys** under `dashboard.organization`: `members` (`title`, `description`, `roleLabel`, `roleAdmin`, `roleEditor`, `you`, `memberActions`, `changeRole`, `remove`, `removeConfirmTitle`, `removeConfirmBody`, `removeConfirmCta`, `cancel`, `soleAdminNote`, `error`, `empty`), `invite` (`cta`, `title`, `description`, `emailLabel`, `roleLabel`, `submit`, `error`, `success`), `invitations` (`title`, `empty`, `revoke`, `revokeConfirm`, `pending`, `error`). Mirror to all locales; run parity test.

- [ ] **Step 2: Write the failing roster test** (mock `convex/react` `useQuery`→roster, `useMutation`→spies; mock `useOrganization`; mock `authClient.useSession`). Assert: rows render; demoting/removing the sole admin's controls are disabled; clicking remove opens the confirm and calls `removeMember`.

```tsx
// organization-members-section.test.tsx (sketch - model mocks on manage-organization-dialog.test.tsx)
// roster = [{userId:"u1",name:"Admin One",email:"a@x.se",role:"admin"},
//           {userId:"u2",name:"Editor Two",email:"e@x.se",role:"editor"}]
// expect both names render; the admin row (sole admin) has its Remove item disabled;
// the editor row Remove -> AlertDialog -> confirm calls removeMember({orgId, userId:"u2"}).
```

- [ ] **Step 3: Run, verify fail.**

- [ ] **Step 4: Implement `organization-members-section.tsx`.** A `Card` with a `<ul>` roster. Each row: name + email + role badge + a trailing `...` `DropdownMenu` (mirror `manage-organization-dialog.tsx` lines 176-199). Items:
  - **Change role** - a submenu or inline `Select` (admin/editor) calling `updateMemberRole({ orgId, userId, role })`. Disable switching to editor when `isSoleAdminRow` (compute client-side: target.role==="admin" && adminCount===1).
  - **Remove** - `variant="destructive"`; opens an `AlertDialog` (standard anatomy: cancel outline first, destructive confirm last) calling `removeMember({ orgId, userId })`. Disabled with `soleAdminNote` when the row is the sole admin.
  - Tag the current user's row with `you` (compare `userId` to `session.user.id`).
  - On a mutation error (e.g. `lastAdmin` slipping through), show an inline `role="alert"` message.
  - Animate add/remove with `AnimatePresence` + `layout` (per CLAUDE.md), reserving row height.

- [ ] **Step 5: Implement `invite-member-dialog.tsx`.** A primary "Invite member" button opening a `Dialog`. RHF form: email (`makeInviteSchema(t)` - `z.string().email`) + role `Select`. Submit calls `authClient.organization.inviteMember({ email, role, organizationId: orgId })`; on `{ error }` show inline error, else show success + close. Standard dialog anatomy; submit in the footer; gate on `isValid`.

```ts
// add to organization-schemas.ts
export function makeInviteSchema(t: ValidationT) {
  return z.object({
    email: z.string().trim().toLowerCase().email(t("invalidEmail")),
    role: z.enum(["admin", "editor"]),
  })
}
export type InviteValues = z.infer<ReturnType<typeof makeInviteSchema>>
```

- [ ] **Step 6: Implement `organization-invitations-section.tsx`.** List pending invitations from `authClient.organization.listInvitations` (filter `status === "pending"`). Each: email, role, expiry, and a **Revoke** action (`AlertDialog` confirm → `authClient.organization.cancelInvitation({ invitationId })`). Empty state uses `invitations.empty`. (Better Auth fires `invitation.revoked` audit via the trigger.)

- [ ] **Step 7: Compose `members/page.tsx`:**

```tsx
"use client"

import { useTranslations } from "next-intl"
import { InviteMemberDialog } from "@/components/organization/invite-member-dialog"
import { OrganizationInvitationsSection } from "@/components/organization/organization-invitations-section"
import { OrganizationMembersSection } from "@/components/organization/organization-members-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function OrganizationMembersPage() {
  const t = useTranslations("dashboard.organization.tabs")
  usePageTitle(t("members"))
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <InviteMemberDialog />
      </div>
      <OrganizationMembersSection />
      <OrganizationInvitationsSection />
    </div>
  )
}
```

- [ ] **Step 8: Run tests + typecheck** - `cd apps/dashboard && bunx vitest run components/organization && bun run typecheck` → PASS, exit 0.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/components/organization apps/dashboard/lib/organization-schemas.ts \
  apps/dashboard/app/\(app\)/organization/members/page.tsx packages/i18n/messages docs/go-live-checklist.md
git commit -m "feat(organization): members tab with roster, roles, removal, and invitations"
```

---

### Task C4: Full-suite verification + go-live checklist

**Files:**
- Modify: `docs/go-live-checklist.md` (consolidate the native-review flags for new Nordic strings; note any e2e debt for the org-logo content-type rejection and the invite/accept round-trip that convex-test cannot cover)

- [ ] **Step 1: Full repo gates** - from the repo root: `bun run test` (turbo) and a clean typecheck → all green. Fix any package that fails.
- [ ] **Step 2: i18n parity** - `cd packages/i18n && bun run test` → PASS (every locale mirrors `en`). Grep the new Nordic strings for mojibake (per the i18n-non-ASCII memory): `grep -Rn "Ã¥\|Ã¤\|Ã¶\|Ã…" packages/i18n/messages` → no matches.
- [ ] **Step 3: Manual smoke list (document, do not automate here):** admin sees the Organization nav entry and can edit profile + upload/remove logo + invite + change role + remove (blocked on sole admin); an editor sees no nav entry and is bounced by the layout guard.
- [ ] **Step 4: Commit** any checklist edits.

```bash
git add docs/go-live-checklist.md
git commit -m "docs(go-live): flag org-settings Nordic strings + e2e debt for review"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** Full profile editing (name C2/B3, logo C2/B1-B2, currency/country/language/industry C2/B-existing) ✓; admin-only (C1 layout + nav gate, backend adminMutation) ✓; team roster + role change + removal + last-admin guard (B4, C3) ✓; invitations + pending + revoke (C3 via authClient) ✓; DRY file architecture (A1-A3) ✓; audit events (B2 logo, B3 name; member events explicit in B4) ✓; i18n all locales (each UI task) ✓; out-of-scope: no delete-org, no editor read-only, audit-log link only ✓.

**Type consistency:** `setOrgAvatar({orgId,storageId})`, `applyOrgAvatar({orgId,storageId,actorId})`, `updateMemberRole({orgId,userId,role})`, `removeMember({orgId,userId})`, `updateOrganizationName({orgId,name})`, `getOrganizationSettings → {...,imageUrl}`, `useImageUpload(opts) → {previewUrl,isUploading,isRemoving,error,selectFile,remove}`, `AvatarUpload` props - all consistent across tasks. `api.files.generateImageUploadUrl`/`internal.files.blobMeta` used consistently after A1.

**Carve-outs verified:** member role/remove log explicitly (raw provisioning writes bypass the adapter triggers, per `mirrors.ts:311`); invitations audited by the existing triggers (adapter path). Org logo audited (org-domain); user avatar not (PII).

**Adversarial review (wf_0faaf5be-3a4):** architecture confirmed sound (adapter-only triggers so member role/remove must log explicitly; last-admin guard; action-context admin gate; `convex/files.ts` placement); the spec's audit line and `lib/files.ts` path were correctly overridden. The 4 blockers + 5 important + minors it found are folded in above. `seedMembership` is confirmed to insert a `getOrganization`-resolvable org row. Remaining confirm during implementation (non-blocking): the exact call-arg shapes of `authClient.organization.{inviteMember,listInvitations,cancelInvitation}` (the methods exist on the configured org client; verify args).

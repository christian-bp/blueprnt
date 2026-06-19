# Platform Admin Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, cross-org platform-admin page that lets a blueprnt operator create users, create organizations, connect users to organizations (with a role), edit org settings, remove memberships, and erase users (GDPR), reachable from the avatar menu and usable only by platform admins.

**Architecture:** A brand-new authorization path (`isPlatformAdmin` flag on the app `users` mirror, set out-of-band) gated by `platformQuery`/`platformMutation` builders that take no `orgId`. These call new Better Auth component mutations (direct table inserts, the proven seed pattern). Every admin action is recorded in a dedicated, org-free `platformAuditLog` (the admin audit log), with its own event vocabulary, kept deliberately separate from the per-organization `auditLog` so operator actions are never mixed into tenants' own audit trails. The UI is a separate `(admin)` route group that bypasses `OnboardingGate` with a minimal, org-independent shell. New-user access uses the existing `requestPasswordReset` plumbing plus a new public `/reset-password` page.

**Audit invariant (load-bearing):** Every `platformMutation` writes exactly one `platformAuditLog` row and writes NOTHING to the per-org `auditLog`. The admin audit log and the organization audit log are two separate tables with two separate event vocabularies (`PLATFORM_AUDIT_EVENTS` vs `AUDIT_EVENTS`). The single exception is the intrinsic `organization.created` lifecycle row (actor `system`) written when an org is created, which is identical to how seeded orgs already appear and is the org's own birth event, not an operator-attributed action.

**Tech Stack:** Convex (custom function builders via `convex-helpers`), Better Auth 1.6.17 (`@convex-dev/better-auth` 0.12.3), Next.js 16 App Router, next-intl, `@tanstack/react-table`, shadcn UI, Zod, Vitest 4 + convex-test.

**Worktree:** `feat/admin-platform` (already created, `bun install` done, `.env.local` copied). All commits land here and squash to `main` at the end.

**Conventions reminder (apply to every task):**
- No em dashes in any text we write (UI copy, comments, commits, docs). Use period/comma/colon/parentheses.
- All user-facing text via i18n; backend returns `errors.*` codes only.
- `bun run test` (never `bun test`). Backend codegen: `cd packages/backend && bunx convex codegen`.
- Commit only on green (pre-commit hook runs Biome + typecheck + full `turbo run test`). Never `--no-verify`.
- New code ships with tests in the same commit.

---

## Task 0: Pre-flight sanity check

**Files:** none (verification only)

- [ ] **Step 1: Confirm the worktree is healthy**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend` (or `bun run test` for everything)
Expected: PASS (baseline green before any change).

- [ ] **Step 2: Confirm the erasure CLAUDE.md rule is present (rides along in this worktree)**

Run: `grep -n "A person is erasable" CLAUDE.md`
Expected: one hit on line ~44. (Do not re-add it; it is already here.)

---

## Task 1: Schema changes (platform-admin flag, platform audit table, by_actor index)

**Files:**
- Modify: `packages/backend/convex/accounts/tables.ts`
- Modify: `packages/backend/convex/shared/tables.ts`
- Modify: `packages/backend/convex/schema.ts`

- [ ] **Step 1: Add `isPlatformAdmin` to the `users` mirror**

In `packages/backend/convex/accounts/tables.ts`, change the `users` table to add the optional flag (keep the existing comment, extend it):

```ts
// Thin mirror of Better Auth users (authId = Better Auth user id). Holds
// app-side per-user settings (locale) and gives audit log a join target.
// isPlatformAdmin is the cross-org operator flag (see docs/adr): it is the
// ONLY authorization source for the platform admin page and is written ONLY
// by the out-of-band bootstrap path (internal mutation / dev seed), never by
// any client-callable or org-scoped mutation.
export const users = defineTable({
  authId: v.string(),
  name: v.string(),
  email: v.string(),
  locale: v.optional(v.string()),
  isPlatformAdmin: v.optional(v.boolean()),
}).index("by_auth_id", ["authId"])
```

- [ ] **Step 2: Add the `by_actor` index to `auditLog` and the new `platformAuditLog` table**

In `packages/backend/convex/shared/tables.ts`, add `by_actor` to `auditLog` and append `platformAuditLog`:

```ts
// Append-only. actorName is snapshotted at write time so audit rows stay
// truthful if a user is later renamed or deleted. by_actor lets erasure find
// and anonymize a user's authored rows without a full scan.
export const auditLog = defineTable({
  orgId: v.string(),
  type: v.string(),
  actorId: v.string(),
  actorName: v.string(),
  payload: v.any(),
})
  .index("by_org", ["orgId"])
  .index("by_org_type", ["orgId", "type"])
  .index("by_actor", ["actorId"])

// The ADMIN audit log: the complete, authoritative record of every platform
// (admin page) action. Deliberately SEPARATE from the per-org auditLog above
// and never mixed with it. Org-free: platform-admin actions cross tenant
// boundaries (or have no org at all, e.g. user creation). Payloads carry IDs
// only, never the affected person's name or email, so an erased user leaves no
// PII here. by_actor lets erasure anonymize the operator's snapshotted name if
// the operator is themselves later erased.
export const platformAuditLog = defineTable({
  actorId: v.string(),
  actorName: v.string(),
  type: v.string(),
  targetUserId: v.optional(v.string()),
  targetOrgId: v.optional(v.string()),
  payload: v.any(),
}).index("by_actor", ["actorId"])
```

- [ ] **Step 3: Register `platformAuditLog` in the app schema**

In `packages/backend/convex/schema.ts`, update the import and the `defineSchema` object:

```ts
import { auditLog, suggestions, platformAuditLog } from "./shared/tables"
```

Add `platformAuditLog` to the `defineSchema({ ... })` object (after `auditLog`):

```ts
  auditLog,
  platformAuditLog,
```

- [ ] **Step 4: Regenerate Convex types**

Run: `cd packages/backend && bunx convex codegen`
Expected: completes without error; `_generated/dataModel.d.ts` now includes `platformAuditLog` and the `isPlatformAdmin` field.

- [ ] **Step 5: Typecheck**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS (no behavior change yet).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/accounts/tables.ts packages/backend/convex/shared/tables.ts packages/backend/convex/schema.ts packages/backend/convex/_generated
git commit -m "feat(platform): add isPlatformAdmin flag, platformAuditLog table, by_actor index"
```

---

## Task 2: Mirror helper (thread isPlatformAdmin to the users mirror)

**Files:**
- Modify: `packages/backend/convex/accounts/mirrors.ts`

These changes are backward-compatible: the Better Auth trigger path and the dev seed keep working unchanged (the new field is optional). The org/member mirror helpers are left untouched (admin actions never write to the org audit log).

- [ ] **Step 1: Add `isPlatformAdmin` to `AuthUserDoc` and `onUserCreate`**

In `packages/backend/convex/accounts/mirrors.ts`, update the `AuthUserDoc` interface (around line 9):

```ts
interface AuthUserDoc {
  _id: string
  email: string
  name: string
  isPlatformAdmin?: boolean
}
```

Update `onUserCreate` (around line 43) to persist the flag when present:

```ts
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
    ...(doc.isPlatformAdmin === true ? { isPlatformAdmin: true } : {}),
  })
}
```

- [ ] **Step 2: Add the `isPlatformAdmin` arg to `mirrorSeededUser`**

Update the `mirrorSeededUser` internalMutation (around line 59):

```ts
export const mirrorSeededUser = internalMutation({
  args: {
    authId: v.string(),
    email: v.string(),
    name: v.string(),
    isPlatformAdmin: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { authId, email, name, isPlatformAdmin }) => {
    await onUserCreate(ctx, { _id: authId, email, name, isPlatformAdmin })
    return null
  },
})
```

(The org/member mirror helpers `onMemberCreate`/`onMemberUpdate`/`onMemberDelete`/`onOrganizationCreate` are NOT changed. Platform mutations do not write to the org `auditLog`, so they never call the member helpers, and `onOrganizationCreate` keeps its existing `"system"`-attributed `organization.created` behavior. This keeps the admin audit log fully separate from the org audit log.)

- [ ] **Step 3: Typecheck**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS (existing mirror/seed/onboarding tests still green; the new field is optional).

- [ ] **Step 4: Commit**

```bash
git add packages/backend/convex/accounts/mirrors.ts
git commit -m "feat(platform): thread isPlatformAdmin through the users mirror"
```

---

## Task 3: Error code

**Files:**
- Modify: `packages/backend/convex/lib/errors.ts`

- [ ] **Step 1: Add the `platformAdminRequired` code**

In `packages/backend/convex/lib/errors.ts`, add to `ERROR_CODES` (after `adminRequired`):

```ts
  platformAdminRequired: "errors.platformAdminRequired",
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS.

```bash
git add packages/backend/convex/lib/errors.ts
git commit -m "feat(platform): add platformAdminRequired error code"
```

---

## Task 4: Admin audit vocabulary + `logPlatformAudit`

**Files:**
- Modify: `packages/backend/convex/lib/audit.ts`
- Test: `packages/backend/convex/lib/audit.test.ts` (create)

The admin audit log gets its OWN event vocabulary (`PLATFORM_AUDIT_EVENTS`), separate from the org `AUDIT_EVENTS`, so the two logs can never be conflated. `logPlatformAudit` only accepts a `PlatformAuditEvent`, and `logAudit` keeps accepting only an `AuditEvent`. Do NOT add the platform keys to `AUDIT_EVENTS`.

- [ ] **Step 1: Add the separate `PLATFORM_AUDIT_EVENTS` vocabulary**

In `packages/backend/convex/lib/audit.ts`, add a new exported const + type (place it after the existing `AUDIT_EVENTS` / `AuditEvent` declarations, leaving `AUDIT_EVENTS` unchanged):

```ts
// The ADMIN audit log's event vocabulary. Deliberately separate from
// AUDIT_EVENTS (the per-org log) so the two trails are never conflated. These
// values only ever go to platformAuditLog via logPlatformAudit.
export const PLATFORM_AUDIT_EVENTS = {
  userCreated: "platform.userCreated",
  userDeleted: "platform.userDeleted",
  orgCreated: "platform.orgCreated",
  orgUpdated: "platform.orgUpdated",
  membershipGranted: "platform.membershipGranted",
  membershipRoleChanged: "platform.membershipRoleChanged",
  membershipRevoked: "platform.membershipRevoked",
} as const

export type PlatformAuditEvent =
  (typeof PLATFORM_AUDIT_EVENTS)[keyof typeof PLATFORM_AUDIT_EVENTS]
```

- [ ] **Step 2: Add the `logPlatformAudit` helper**

Append to `packages/backend/convex/lib/audit.ts` (after `logAudit`):

```ts
// The admin audit log writer. Org-free operator trail, SEPARATE from logAudit
// (the per-org log). Mirrors logAudit's actorName snapshotting, but the entry
// carries IDs only (targetUserId/targetOrgId) and a payload that must never
// include the affected person's name or email, so erasure leaves no PII. The
// type is constrained to PlatformAuditEvent so org event keys cannot leak in.
export async function logPlatformAudit(
  ctx: GenericMutationCtx<DataModel>,
  entry: {
    actorId: string
    type: PlatformAuditEvent
    targetUserId?: string
    targetOrgId?: string
    payload: Record<string, unknown>
  }
) {
  let actorName = "unknown"
  try {
    const actor = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", entry.actorId))
      .first()
    if (actor !== null) actorName = actor.name
  } catch (error) {
    console.error("platform audit actor lookup failed", {
      actorId: entry.actorId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  await ctx.db.insert("platformAuditLog", {
    actorId: entry.actorId,
    actorName,
    type: entry.type,
    ...(entry.targetUserId !== undefined
      ? { targetUserId: entry.targetUserId }
      : {}),
    ...(entry.targetOrgId !== undefined
      ? { targetOrgId: entry.targetOrgId }
      : {}),
    payload: entry.payload,
  })
}
```

- [ ] **Step 3: Write the failing test**

Create `packages/backend/convex/lib/audit.test.ts`. `logPlatformAudit` is not itself a Convex function, so this task asserts the separate vocabulary exists and is disjoint from the org vocabulary (a cheap regression guard against the two logs being conflated). Behavioral coverage (real `platformAuditLog` rows) lands in Tasks 8 to 11, plus the dedicated coverage test in Task 11.

```ts
import { describe, expect, it } from "vitest"
import { AUDIT_EVENTS, PLATFORM_AUDIT_EVENTS } from "./audit"

describe("admin audit vocabulary", () => {
  it("defines the platform event keys", () => {
    expect(PLATFORM_AUDIT_EVENTS.userCreated).toBe("platform.userCreated")
    expect(PLATFORM_AUDIT_EVENTS.userDeleted).toBe("platform.userDeleted")
    expect(PLATFORM_AUDIT_EVENTS.orgCreated).toBe("platform.orgCreated")
    expect(PLATFORM_AUDIT_EVENTS.orgUpdated).toBe("platform.orgUpdated")
    expect(PLATFORM_AUDIT_EVENTS.membershipGranted).toBe(
      "platform.membershipGranted"
    )
    expect(PLATFORM_AUDIT_EVENTS.membershipRoleChanged).toBe(
      "platform.membershipRoleChanged"
    )
    expect(PLATFORM_AUDIT_EVENTS.membershipRevoked).toBe(
      "platform.membershipRevoked"
    )
  })

  it("keeps the admin and org vocabularies disjoint", () => {
    const orgValues = new Set(Object.values(AUDIT_EVENTS))
    for (const value of Object.values(PLATFORM_AUDIT_EVENTS)) {
      expect(orgValues.has(value)).toBe(false)
      expect(value.startsWith("platform.")).toBe(true)
    }
  })
})
```

- [ ] **Step 4: Run the test**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS. `logPlatformAudit` behavior is covered end-to-end in Tasks 8 to 11.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/lib/audit.ts packages/backend/convex/lib/audit.test.ts
git commit -m "feat(platform): add platform audit events and logPlatformAudit helper"
```

---

## Task 5: Authorization builders (`requirePlatformAdmin`, `platformQuery`, `platformMutation`)

**Files:**
- Modify: `packages/backend/convex/lib/functions.ts`

These are infrastructure; their behavior is verified by the consumer tests in Tasks 6 and 8 to 11 (a non-admin caller is rejected, an admin caller is allowed). No standalone probe function is added.

- [ ] **Step 1: Add the helper and builders**

Append to `packages/backend/convex/lib/functions.ts`:

```ts
// Resolves the caller's Better Auth id from the JWT and asserts they are a
// platform admin (the cross-org operator flag on the app users mirror, set
// out-of-band). Deliberately NOT org-scoped: platform functions act across
// every tenant. Returns the operator's auth id for audit attribution.
async function requirePlatformAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (identity === null) throw appError(ERROR_CODES.notAuthenticated)
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
    .unique()
  if (user === null || user.isPlatformAdmin !== true) {
    throw appError(ERROR_CODES.platformAdminRequired)
  }
  return identity.subject
}

// Platform-admin read. Injects ctx.authUserId. Takes NO orgId: the absence of
// the org arg is the structural guard that keeps these distinct from the
// org-scoped builders.
export const platformQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const authUserId = await requirePlatformAdmin(ctx)
    return { ctx: { authUserId }, args: {} }
  },
})

// Platform-admin write (cross-org). Injects ctx.authUserId. No orgId.
export const platformMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const authUserId = await requirePlatformAdmin(ctx)
    return { ctx: { authUserId }, args: {} }
  },
})
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS.

```bash
git add packages/backend/convex/lib/functions.ts
git commit -m "feat(platform): add requirePlatformAdmin guard and platformQuery/platformMutation builders"
```

---

## Task 6: Bootstrap (grant/revoke) + `isPlatformAdmin` query

**Files:**
- Create: `packages/backend/convex/platform/bootstrap.ts`
- Create: `packages/backend/convex/platform/admin.ts`
- Test: `packages/backend/convex/platform/admin.test.ts` (create)

- [ ] **Step 1: Write the bootstrap internal mutations**

Create `packages/backend/convex/platform/bootstrap.ts`. These are `internalMutation`s (never client-callable). They are the deliberate out-of-band channel: an operator with Convex backend access runs them from the CLI/dashboard. They are NOT localhost-guarded (production needs them); internal visibility is the security boundary.

```ts
import { v } from "convex/values"
import { internalMutation } from "../_generated/server"

// Out-of-band platform-admin granting. Run from the Convex CLI/dashboard only
// (internalMutation = never internet-exposed). The users mirror has no email
// index (email uniqueness is enforced in Better Auth, not the mirror), so this
// rare, operator-run path filters. Returns whether a matching mirror row was
// found and updated.
export const grantPlatformAdminByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first()
    if (user === null) return false
    await ctx.db.patch(user._id, { isPlatformAdmin: true })
    return true
  },
})

export const revokePlatformAdminByEmail = internalMutation({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first()
    if (user === null) return false
    await ctx.db.patch(user._id, { isPlatformAdmin: false })
    return true
  },
})
```

- [ ] **Step 2: Write the `isPlatformAdmin` query**

Create `packages/backend/convex/platform/admin.ts` with the non-throwing membership probe (used by the menu and the page guard). The rest of this file is filled in by later tasks.

```ts
import { v } from "convex/values"
import { query } from "../_generated/server"

// Non-throwing: returns false for anyone who is not a platform admin (signed
// out, no mirror row, or flag unset), so the avatar-menu link simply hides.
// The real security boundary is platformMutation/platformQuery, never this.
export const isPlatformAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) return false
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique()
    return user?.isPlatformAdmin === true
  },
})
```

- [ ] **Step 3: Regenerate types**

Run: `cd packages/backend && bunx convex codegen`
Expected: `api.platform.admin.isPlatformAdmin` and `internal.platform.bootstrap.*` now exist.

- [ ] **Step 4: Write the failing test**

Create `packages/backend/convex/platform/admin.test.ts`. The test seeds a Better Auth user via the component seeder, mirrors it to the app `users` table (this is what `requirePlatformAdmin`/`isPlatformAdmin` read), grants via the bootstrap mutation, and asserts the query flips.

```ts
import { describe, expect, it } from "vitest"
import { api, components, internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seedMirroredUser(
  t: ReturnType<typeof initConvexTest>,
  email: string
) {
  const { userId } = await t.mutation(
    components.betterAuth.testing.seedMembership,
    { email, name: "Operator", role: "admin" }
  )
  await t.mutation(internal.accounts.mirrors.mirrorSeededUser, {
    authId: userId,
    email,
    name: "Operator",
  })
  return userId
}

describe("isPlatformAdmin", () => {
  it("returns false for a signed-out caller", async () => {
    const t = initConvexTest()
    expect(await t.query(api.platform.admin.isPlatformAdmin, {})).toBe(false)
  })

  it("returns false for a normal user, true after granting", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "ops@blueprnt.se")
    const asUser = t.withIdentity({ subject: userId })
    expect(await asUser.query(api.platform.admin.isPlatformAdmin, {})).toBe(
      false
    )
    const granted = await t.mutation(
      internal.platform.bootstrap.grantPlatformAdminByEmail,
      { email: "ops@blueprnt.se" }
    )
    expect(granted).toBe(true)
    expect(await asUser.query(api.platform.admin.isPlatformAdmin, {})).toBe(
      true
    )
  })

  it("revoke flips it back to false", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "ops@blueprnt.se")
    await t.mutation(internal.platform.bootstrap.grantPlatformAdminByEmail, {
      email: "ops@blueprnt.se",
    })
    await t.mutation(internal.platform.bootstrap.revokePlatformAdminByEmail, {
      email: "ops@blueprnt.se",
    })
    const asUser = t.withIdentity({ subject: userId })
    expect(await asUser.query(api.platform.admin.isPlatformAdmin, {})).toBe(
      false
    )
  })
})
```

- [ ] **Step 5: Run the test**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/platform packages/backend/convex/_generated
git commit -m "feat(platform): bootstrap grant/revoke internal mutations and isPlatformAdmin query"
```

---

## Task 7: Better Auth component provisioning module

**Files:**
- Create: `packages/backend/convex/betterAuth/provisioning.ts`

This module lives INSIDE the betterAuth component (uses `./_generated/server`), so its functions are reachable from the app as `components.betterAuth.provisioning.*`. Cross-component calls require explicit `returns` validators (same rule as `membership.ts`). These functions do direct table writes (the seed pattern); they are never internet-exposed. They do NOT create credential accounts: `resetPassword` creates the credential account when the invited user sets their password (verified against better-auth 1.6.17).

- [ ] **Step 1: Write the component functions**

Create `packages/backend/convex/betterAuth/provisioning.ts`:

```ts
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Provision a Better Auth user with NO credential account. The account is
// created later by resetPassword when the invited user sets their password
// (better-auth 1.6.17 creates the credential row on reset if absent).
// emailVerified is true so a future requireEmailVerification flip cannot lock
// the account. Idempotent by email.
export const provisionUser = mutation({
  args: { email: v.string(), name: v.string() },
  returns: v.object({ userId: v.string(), created: v.boolean() }),
  handler: async (ctx, { email, name }) => {
    const existing = await ctx.db
      .query("user")
      .withIndex("email_name", (q) => q.eq("email", email))
      .first()
    if (existing) return { userId: existing._id.toString(), created: false }
    const now = Date.now()
    const id = await ctx.db.insert("user", {
      email,
      name,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    return { userId: id.toString(), created: true }
  },
})

// Idempotent by slug.
export const provisionOrganization = mutation({
  args: { name: v.string(), slug: v.string() },
  returns: v.object({ orgId: v.string(), created: v.boolean() }),
  handler: async (ctx, { name, slug }) => {
    const existing = await ctx.db
      .query("organization")
      .withIndex("slug", (q) => q.eq("slug", slug))
      .first()
    if (existing) return { orgId: existing._id.toString(), created: false }
    const now = Date.now()
    const id = await ctx.db.insert("organization", { name, slug, createdAt: now })
    return { orgId: id.toString(), created: true }
  },
})

// Idempotent on (organizationId, userId).
export const addMember = mutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    role: v.string(),
  },
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx, { organizationId, userId, role }) => {
    const existing = await ctx.db
      .query("member")
      .withIndex("organizationId_userId", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .unique()
    if (existing) return { created: false }
    await ctx.db.insert("member", {
      organizationId,
      userId,
      role,
      createdAt: Date.now(),
    })
    return { created: true }
  },
})

// Returns the previous role (null if no membership) so the caller can audit
// the change and skip a no-op.
export const setMemberRole = mutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    role: v.string(),
  },
  returns: v.union(v.null(), v.object({ from: v.string() })),
  handler: async (ctx, { organizationId, userId, role }) => {
    const member = await ctx.db
      .query("member")
      .withIndex("organizationId_userId", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .unique()
    if (member === null) return null
    const from = member.role
    await ctx.db.patch(member._id, { role })
    return { from }
  },
})

// Returns the removed role (null if no membership) so the caller can audit.
export const removeMember = mutation({
  args: { organizationId: v.string(), userId: v.string() },
  returns: v.union(v.null(), v.object({ role: v.string() })),
  handler: async (ctx, { organizationId, userId }) => {
    const member = await ctx.db
      .query("member")
      .withIndex("organizationId_userId", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .unique()
    if (member === null) return null
    const role = member.role
    await ctx.db.delete(member._id)
    return { role }
  },
})

// Patch organization identity (name/slug). Both optional.
export const updateOrganizationIdentity = mutation({
  args: {
    orgId: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, name, slug }) => {
    const id = ctx.db.normalizeId("organization", orgId)
    if (id === null) return null
    await ctx.db.patch(id, {
      ...(name !== undefined ? { name } : {}),
      ...(slug !== undefined ? { slug } : {}),
    })
    return null
  },
})

// GDPR erasure: delete every identity/membership row for a user. Returns the
// distinct org ids the user was a member of, so the caller can write per-org
// member.removed audit rows. Bounded reads are fine at V1 scale.
export const eraseUser = mutation({
  args: { userId: v.string() },
  returns: v.object({ orgIds: v.array(v.string()) }),
  handler: async (ctx, { userId }) => {
    const members = await ctx.db
      .query("member")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect()
    const orgIds = [...new Set(members.map((m) => m.organizationId))]
    for (const m of members) await ctx.db.delete(m._id)
    const accounts = await ctx.db
      .query("account")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect()
    for (const a of accounts) await ctx.db.delete(a._id)
    const sessions = await ctx.db
      .query("session")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect()
    for (const s of sessions) await ctx.db.delete(s._id)
    const uid = ctx.db.normalizeId("user", userId)
    if (uid !== null) await ctx.db.delete(uid)
    return { orgIds }
  },
})

// Cross-org listings for the admin page. Bounded at 500 rows for V1 (pagination
// is a post-V1 follow-up; the caller surfaces no truncation today).
export const listAllUsers = query({
  args: {},
  returns: v.array(
    v.object({ userId: v.string(), name: v.string(), email: v.string() })
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("user").take(500)
    return rows.map((u) => ({
      userId: u._id.toString(),
      name: u.name,
      email: u.email,
    }))
  },
})

export const listAllOrganizations = query({
  args: {},
  returns: v.array(
    v.object({ orgId: v.string(), name: v.string(), slug: v.string() })
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("organization").take(500)
    return rows.map((o) => ({
      orgId: o._id.toString(),
      name: o.name,
      slug: o.slug,
    }))
  },
})

// Members of one org, with the member's user identity joined in.
export const listMembers = query({
  args: { organizationId: v.string() },
  returns: v.array(
    v.object({
      userId: v.string(),
      name: v.string(),
      email: v.string(),
      role: v.string(),
    })
  ),
  handler: async (ctx, { organizationId }) => {
    const members = await ctx.db
      .query("member")
      .withIndex("organizationId", (q) =>
        q.eq("organizationId", organizationId)
      )
      .take(500)
    const result: {
      userId: string
      name: string
      email: string
      role: string
    }[] = []
    for (const m of members) {
      const uid = ctx.db.normalizeId("user", m.userId)
      const user = uid === null ? null : await ctx.db.get(uid)
      result.push({
        userId: m.userId,
        name: user?.name ?? "",
        email: user?.email ?? "",
        role: m.role,
      })
    }
    return result
  },
})
```

- [ ] **Step 2: Regenerate types**

Run: `cd packages/backend && bunx convex codegen`
Expected: `components.betterAuth.provisioning.*` references now exist in the generated component API.

- [ ] **Step 3: Typecheck**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS (no consumers yet; types compile).

- [ ] **Step 4: Commit**

```bash
git add packages/backend/convex/betterAuth/provisioning.ts packages/backend/convex/betterAuth/_generated packages/backend/convex/_generated
git commit -m "feat(platform): add betterAuth provisioning component functions"
```

---

## Task 8: Platform mutations: createUser + createOrganization

**Files:**
- Modify: `packages/backend/convex/platform/admin.ts`
- Modify: `packages/backend/convex/platform/admin.test.ts`

All platform functions in `admin.ts` use `platformMutation`/`platformQuery` (no `orgId` arg) and `ctx.authUserId` for audit attribution.

- [ ] **Step 1: Add imports and `createUser` + `createOrganization`**

In `packages/backend/convex/platform/admin.ts`, add imports at the top (below the existing ones):

```ts
import { components } from "../_generated/api"
import { platformMutation } from "../lib/functions"
import { appError, ERROR_CODES } from "../lib/errors"
import { PLATFORM_AUDIT_EVENTS, logPlatformAudit } from "../lib/audit"
import { onOrganizationCreate, onUserCreate } from "../accounts/mirrors"
```

(No `logAudit` import: platform mutations write only to the admin log, never the org log.)

Append the two mutations:

```ts
// Create a Better Auth user (no password yet) plus the app users mirror, and
// record the operator action. The new user receives a set-password email from
// the client (authClient.requestPasswordReset) after this resolves.
export const createUser = platformMutation({
  args: { name: v.string(), email: v.string() },
  returns: v.object({ authId: v.string(), created: v.boolean() }),
  handler: async (ctx, { name, email }) => {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    if (trimmedName === "" || trimmedEmail === "") {
      throw appError(ERROR_CODES.invalidInput)
    }
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.provisionUser,
      { email: trimmedEmail, name: trimmedName }
    )
    // Direct component inserts bypass the Better Auth triggers, so mirror the
    // app users row explicitly (idempotent).
    await onUserCreate(ctx, {
      _id: result.authId,
      email: trimmedEmail,
      name: trimmedName,
    })
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.userCreated,
      targetUserId: result.authId,
      payload: {},
    })
    return { authId: result.authId, created: result.created }
  },
})

export const createOrganization = platformMutation({
  args: { name: v.string(), slug: v.string() },
  returns: v.object({ orgId: v.string(), created: v.boolean() }),
  handler: async (ctx, { name, slug }) => {
    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()
    if (trimmedName === "" || trimmedSlug === "") {
      throw appError(ERROR_CODES.invalidInput)
    }
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.provisionOrganization,
      { name: trimmedName, slug: trimmedSlug }
    )
    // Mirror the app organizations row. onOrganizationCreate also writes the
    // org's own organization.created lifecycle row (actor "system"), exactly
    // as seeded orgs do; the operator-attributed record goes to the admin log
    // only. Idempotent.
    await onOrganizationCreate(ctx, { _id: result.orgId })
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.orgCreated,
      targetOrgId: result.orgId,
      payload: {},
    })
    return { orgId: result.orgId, created: result.created }
  },
})
```

Note the `v` import is already present (the `isPlatformAdmin` query uses it).

- [ ] **Step 2: Regenerate types**

Run: `cd packages/backend && bunx convex codegen`
Expected: `api.platform.admin.createUser` / `createOrganization` exist.

- [ ] **Step 3: Write the failing tests**

Append to `packages/backend/convex/platform/admin.test.ts`. Add a helper that grants platform-admin to a seeded mirrored user, then test reject (non-admin) and allow (admin) plus audit rows.

```ts
async function seedPlatformAdmin(t: ReturnType<typeof initConvexTest>) {
  const userId = await seedMirroredUser(t, "operator@blueprnt.se")
  await t.mutation(internal.platform.bootstrap.grantPlatformAdminByEmail, {
    email: "operator@blueprnt.se",
  })
  return userId
}

describe("createUser / createOrganization", () => {
  it("rejects a non-platform-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "nobody@blueprnt.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.mutation(api.platform.admin.createUser, {
        name: "X",
        email: "x@y.se",
      })
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })

  it("rejects an unauthenticated caller", async () => {
    const t = initConvexTest()
    await expect(
      t.mutation(api.platform.admin.createOrganization, {
        name: "Acme",
        slug: "acme",
      })
    ).rejects.toThrow(/errors.notAuthenticated/)
  })

  it("creates a user and writes a platform audit row", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { authId, created } = await asAdmin.mutation(
      api.platform.admin.createUser,
      { name: "New Hire", email: "hire@acme.se" }
    )
    expect(created).toBe(true)
    expect(typeof authId).toBe("string")
    // The platform audit row exists, carries the operator, and no PII payload.
    const rows = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const created_row = rows.find((r) => r.type === "platform.userCreated")
    expect(created_row?.actorId).toBe(adminId)
    expect(created_row?.targetUserId).toBe(authId)
    expect(created_row?.payload).toEqual({})
  })

  it("createUser is idempotent by email", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const first = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Dup",
      email: "dup@acme.se",
    })
    const second = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Dup",
      email: "dup@acme.se",
    })
    expect(second.created).toBe(false)
    expect(second.authId).toBe(first.authId)
  })

  it("creates an org: admin log records the operator, org log stays system", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-1" }
    )
    // Admin log: operator-attributed.
    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const created = plat.find((r) => r.type === "platform.orgCreated")
    expect(created?.actorId).toBe(adminId)
    expect(created?.targetOrgId).toBe(orgId)
    // Org log: the org's own birth event, NEVER operator-attributed (proves
    // the admin and org logs stay separate).
    const orgAudit = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    expect(orgAudit.every((r) => r.actorId !== adminId)).toBe(true)
  })
})
```

Note: `t.run(async (ctx) => ...)` runs arbitrary code against the app DB in convex-test (used here to read `platformAuditLog`/`auditLog` directly). If `t.run` is unavailable in the installed convex-test, read the rows through a throwaway `internalQuery` instead, but `t.run` is the standard convex-test escape hatch.

- [ ] **Step 4: Run the tests**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/platform packages/backend/convex/_generated
git commit -m "feat(platform): createUser and createOrganization mutations"
```

---

## Task 9: Platform mutations: membership (add / set role / remove)

**Files:**
- Modify: `packages/backend/convex/platform/admin.ts`
- Modify: `packages/backend/convex/platform/admin.test.ts`

Membership attach is authoritative (the admin places the user directly; no invitation-accept). Each mutation validates that the user mirror and org mirror exist (so errors stay `errors.*` codes), then calls the component and writes org-scoped + platform audit.

- [ ] **Step 1: Add a role validator and the three mutations**

In `packages/backend/convex/platform/admin.ts`, add a shared role validator near the top (after imports):

```ts
const roleArg = v.union(v.literal("admin"), v.literal("editor"))
```

Append:

```ts
// Validates the user mirror and org mirror both exist; throws errors.notFound
// otherwise so no display text crosses the wire.
async function assertUserAndOrg(
  ctx: { db: import("../_generated/server").QueryCtx["db"] },
  authId: string,
  orgId: string
): Promise<void> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", authId))
    .unique()
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  if (user === null || org === null) throw appError(ERROR_CODES.notFound)
}

export const addMembership = platformMutation({
  args: { authId: v.string(), orgId: v.string(), role: roleArg },
  returns: v.null(),
  handler: async (ctx, { authId, orgId, role }) => {
    await assertUserAndOrg(ctx, authId, orgId)
    const { created } = await ctx.runMutation(
      components.betterAuth.provisioning.addMember,
      { organizationId: orgId, userId: authId, role }
    )
    if (!created) return null // idempotent: already a member, nothing to log
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.membershipGranted,
      targetUserId: authId,
      targetOrgId: orgId,
      payload: { role },
    })
    return null
  },
})

export const setMembershipRole = platformMutation({
  args: { authId: v.string(), orgId: v.string(), role: roleArg },
  returns: v.null(),
  handler: async (ctx, { authId, orgId, role }) => {
    await assertUserAndOrg(ctx, authId, orgId)
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.setMemberRole,
      { organizationId: orgId, userId: authId, role }
    )
    if (result === null) throw appError(ERROR_CODES.notFound)
    if (result.from === role) return null // no-op
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.membershipRoleChanged,
      targetUserId: authId,
      targetOrgId: orgId,
      payload: { from: result.from, to: role },
    })
    return null
  },
})

export const removeMembership = platformMutation({
  args: { authId: v.string(), orgId: v.string() },
  returns: v.null(),
  handler: async (ctx, { authId, orgId }) => {
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.removeMember,
      { organizationId: orgId, userId: authId }
    )
    if (result === null) throw appError(ERROR_CODES.notFound)
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.membershipRevoked,
      targetUserId: authId,
      targetOrgId: orgId,
      payload: {},
    })
    return null
  },
})
```

- [ ] **Step 2: Regenerate types**

Run: `cd packages/backend && bunx convex codegen`
Expected: the three `api.platform.admin.*Membership*` functions exist.

- [ ] **Step 3: Write the failing tests**

Append to `packages/backend/convex/platform/admin.test.ts`:

```ts
describe("membership management", () => {
  it("connects a user to an org, sets role, removes (full cycle)", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Member",
      email: "member@acme.se",
    })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-2" }
    )
    await asAdmin.mutation(api.platform.admin.addMembership, {
      authId,
      orgId,
      role: "editor",
    })
    await asAdmin.mutation(api.platform.admin.setMembershipRole, {
      authId,
      orgId,
      role: "admin",
    })
    await asAdmin.mutation(api.platform.admin.removeMembership, {
      authId,
      orgId,
    })
    // Every action is recorded in the ADMIN log, attributed to the operator.
    const events = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const types = events.map((e) => e.type)
    expect(types).toContain("platform.membershipGranted")
    expect(types).toContain("platform.membershipRoleChanged")
    expect(types).toContain("platform.membershipRevoked")
    for (const e of events) expect(e.actorId).toBe(adminId)
    // The org's own auditLog received NO operator-attributed rows (the two
    // logs stay separate).
    const orgEvents = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
    expect(orgEvents.every((e) => e.actorId !== adminId)).toBe(true)
  })

  it("rejects addMembership for an unknown org", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "M",
      email: "m@acme.se",
    })
    await expect(
      asAdmin.mutation(api.platform.admin.addMembership, {
        authId,
        orgId: "nonexistent",
        role: "editor",
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("rejects a non-admin caller", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "x@acme.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.mutation(api.platform.admin.removeMembership, {
        authId: "a",
        orgId: "b",
      })
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })
})
```

- [ ] **Step 4: Run + commit**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS.

```bash
git add packages/backend/convex/platform packages/backend/convex/_generated
git commit -m "feat(platform): membership add/setRole/remove mutations"
```

---

## Task 10: Platform queries + updateOrganization

**Files:**
- Modify: `packages/backend/convex/platform/admin.ts`
- Modify: `packages/backend/convex/platform/admin.test.ts`

- [ ] **Step 1: Add `platformQuery` to the imports**

Update the `lib/functions` import in `admin.ts` to include `platformQuery`:

```ts
import { platformMutation, platformQuery } from "../lib/functions"
```

- [ ] **Step 2: Add the listing queries and updateOrganization**

Append to `packages/backend/convex/platform/admin.ts`:

```ts
// All users across the installation (basic identity). Cross-org by design.
export const listUsers = platformQuery({
  args: {},
  returns: v.array(
    v.object({
      authId: v.string(),
      name: v.string(),
      email: v.string(),
      isPlatformAdmin: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const baUsers = await ctx.runQuery(
      components.betterAuth.provisioning.listAllUsers,
      {}
    )
    // Join the app mirror to surface the platform-admin flag.
    const result: {
      authId: string
      name: string
      email: string
      isPlatformAdmin: boolean
    }[] = []
    for (const u of baUsers) {
      const mirror = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", u.userId))
        .unique()
      result.push({
        authId: u.userId,
        name: u.name,
        email: u.email,
        isPlatformAdmin: mirror?.isPlatformAdmin === true,
      })
    }
    return result
  },
})

// All organizations with their app-side settings.
export const listOrganizations = platformQuery({
  args: {},
  returns: v.array(
    v.object({
      orgId: v.string(),
      name: v.string(),
      slug: v.string(),
      country: v.union(v.null(), v.string()),
      currency: v.union(v.null(), v.string()),
      language: v.union(v.null(), v.string()),
      industry: v.union(v.null(), v.string()),
      onboarded: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const baOrgs = await ctx.runQuery(
      components.betterAuth.provisioning.listAllOrganizations,
      {}
    )
    const result = []
    for (const o of baOrgs) {
      const settings = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", o.orgId))
        .unique()
      result.push({
        orgId: o.orgId,
        name: o.name,
        slug: o.slug,
        country: settings?.country ?? null,
        currency: settings?.currency ?? null,
        language: settings?.language ?? null,
        industry: settings?.industry ?? null,
        onboarded: typeof settings?.onboardingCompletedAt === "number",
      })
    }
    return result
  },
})

// One org's members (identity + role), for the manage view.
export const listOrganizationMembers = platformQuery({
  args: { orgId: v.string() },
  returns: v.array(
    v.object({
      authId: v.string(),
      name: v.string(),
      email: v.string(),
      role: v.string(),
    })
  ),
  handler: async (ctx, { orgId }) => {
    const members = await ctx.runQuery(
      components.betterAuth.provisioning.listMembers,
      { organizationId: orgId }
    )
    return members.map((m) => ({
      authId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
    }))
  },
})

// Edit org identity (name/slug, in the component) and settings (country/
// currency/language/industry, in the app mirror). All fields optional.
export const updateOrganization = platformMutation({
  args: {
    orgId: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    language: v.optional(v.string()),
    industry: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, name, slug, ...settings }) => {
    const mirror = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    if (mirror === null) throw appError(ERROR_CODES.notFound)
    if (name !== undefined || slug !== undefined) {
      await ctx.runMutation(
        components.betterAuth.provisioning.updateOrganizationIdentity,
        {
          orgId,
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(slug !== undefined ? { slug: slug.trim() } : {}),
        }
      )
    }
    const settingsPatch = Object.fromEntries(
      Object.entries(settings).filter(([, val]) => val !== undefined)
    )
    if (Object.keys(settingsPatch).length > 0) {
      await ctx.db.patch(mirror._id, settingsPatch)
    }
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.orgUpdated,
      targetOrgId: orgId,
      // Field names only (no values), so no settings value lands in the log.
      payload: { changed: Object.keys({ name, slug, ...settingsPatch }) },
    })
    return null
  },
})
```

- [ ] **Step 3: Regenerate types**

Run: `cd packages/backend && bunx convex codegen`

- [ ] **Step 4: Write the failing tests**

Append to `packages/backend/convex/platform/admin.test.ts`:

```ts
describe("platform queries + updateOrganization", () => {
  it("lists users and orgs and marks the platform admin", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Plain",
      email: "plain@acme.se",
    })
    await asAdmin.mutation(api.platform.admin.createOrganization, {
      name: "Acme",
      slug: "acme-3",
    })
    const users = await asAdmin.query(api.platform.admin.listUsers, {})
    const operator = users.find((u) => u.email === "operator@blueprnt.se")
    const plain = users.find((u) => u.email === "plain@acme.se")
    expect(operator?.isPlatformAdmin).toBe(true)
    expect(plain?.isPlatformAdmin).toBe(false)
    const orgs = await asAdmin.query(api.platform.admin.listOrganizations, {})
    expect(orgs.some((o) => o.slug === "acme-3")).toBe(true)
  })

  it("listUsers rejects a non-admin", async () => {
    const t = initConvexTest()
    const userId = await seedMirroredUser(t, "x2@acme.se")
    const asUser = t.withIdentity({ subject: userId })
    await expect(
      asUser.query(api.platform.admin.listUsers, {})
    ).rejects.toThrow(/errors.platformAdminRequired/)
  })

  it("updates org settings and audits the change", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-4" }
    )
    await asAdmin.mutation(api.platform.admin.updateOrganization, {
      orgId,
      country: "se",
      currency: "SEK",
    })
    const orgs = await asAdmin.query(api.platform.admin.listOrganizations, {})
    const row = orgs.find((o) => o.orgId === orgId)
    expect(row?.country).toBe("se")
    expect(row?.currency).toBe("SEK")
  })
})
```

- [ ] **Step 5: Run + commit**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS.

```bash
git add packages/backend/convex/platform packages/backend/convex/_generated
git commit -m "feat(platform): listing queries and updateOrganization"
```

---

## Task 11: Platform mutation: deleteUser (GDPR erasure)

**Files:**
- Modify: `packages/backend/convex/platform/admin.ts`
- Modify: `packages/backend/convex/platform/admin.test.ts`

- [ ] **Step 1: Add the erasure mutation**

Append to `packages/backend/convex/platform/admin.ts`. Tombstone keeps the audit row but strips the PII name.

```ts
// Tombstone replacing a deleted person's snapshotted name in append-only logs.
const ERASED_ACTOR_NAME = "deleted user"

// GDPR erasure. Deletes every identity/membership row (via the component),
// the app users mirror, and anonymizes the person's snapshotted actorName in
// both audit logs (the rows are kept for the trail's legitimate-interest
// basis). The erasure itself is recorded in the ADMIN log only; nothing is
// written to any org's auditLog. Self-delete is blocked. The admin-log payload
// carries a non-identifying org count, never the erased name/email.
export const deleteUser = platformMutation({
  args: { authId: v.string() },
  returns: v.null(),
  handler: async (ctx, { authId }) => {
    if (authId === ctx.authUserId) throw appError(ERROR_CODES.invalidInput)
    const { orgIds } = await ctx.runMutation(
      components.betterAuth.provisioning.eraseUser,
      { userId: authId }
    )
    // App mirror.
    const mirror = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", authId))
      .unique()
    if (mirror !== null) await ctx.db.delete(mirror._id)
    // Anonymize this person's snapshotted name in both audit logs.
    const orgAuthored = await ctx.db
      .query("auditLog")
      .withIndex("by_actor", (q) => q.eq("actorId", authId))
      .collect()
    for (const row of orgAuthored) {
      await ctx.db.patch(row._id, { actorName: ERASED_ACTOR_NAME })
    }
    const platformAuthored = await ctx.db
      .query("platformAuditLog")
      .withIndex("by_actor", (q) => q.eq("actorId", authId))
      .collect()
    for (const row of platformAuthored) {
      await ctx.db.patch(row._id, { actorName: ERASED_ACTOR_NAME })
    }
    await logPlatformAudit(ctx, {
      actorId: ctx.authUserId,
      type: PLATFORM_AUDIT_EVENTS.userDeleted,
      targetUserId: authId,
      payload: { orgCount: orgIds.length },
    })
    return null
  },
})
```

- [ ] **Step 2: Regenerate types**

Run: `cd packages/backend && bunx convex codegen`

- [ ] **Step 3: Write the failing tests**

Append to `packages/backend/convex/platform/admin.test.ts`:

```ts
describe("deleteUser (erasure)", () => {
  it("removes identity, mirror, memberships and anonymizes audit", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Erase Me",
      email: "erase@acme.se",
    })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-5" }
    )
    await asAdmin.mutation(api.platform.admin.addMembership, {
      authId,
      orgId,
      role: "editor",
    })
    await asAdmin.mutation(api.platform.admin.deleteUser, { authId })

    // App mirror gone.
    const mirror = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", authId))
        .unique()
    )
    expect(mirror).toBeNull()
    // BA user gone (not in listUsers anymore).
    const users = await asAdmin.query(api.platform.admin.listUsers, {})
    expect(users.some((u) => u.authId === authId)).toBe(false)
    // Membership gone.
    const members = await asAdmin.query(
      api.platform.admin.listOrganizationMembers,
      { orgId }
    )
    expect(members.some((m) => m.authId === authId)).toBe(false)
    // platform.userDeleted recorded, no PII payload.
    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    const del = plat.find((r) => r.type === "platform.userDeleted")
    expect(del?.targetUserId).toBe(authId)
    expect(del?.payload).toEqual({ orgCount: 1 })
  })

  it("blocks self-deletion", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })
    await expect(
      asAdmin.mutation(api.platform.admin.deleteUser, { authId: adminId })
    ).rejects.toThrow(/errors.invalidInput/)
  })
})

describe("admin audit log coverage (every action is logged, separately)", () => {
  it("each admin mutation writes a platform.* row and nothing org-attributed", async () => {
    const t = initConvexTest()
    const adminId = await seedPlatformAdmin(t)
    const asAdmin = t.withIdentity({ subject: adminId })

    // Exercise the full set of admin mutations once.
    const { authId } = await asAdmin.mutation(api.platform.admin.createUser, {
      name: "Audited",
      email: "audited@acme.se",
    })
    const { orgId } = await asAdmin.mutation(
      api.platform.admin.createOrganization,
      { name: "Acme", slug: "acme-audit" }
    )
    await asAdmin.mutation(api.platform.admin.addMembership, {
      authId,
      orgId,
      role: "editor",
    })
    await asAdmin.mutation(api.platform.admin.setMembershipRole, {
      authId,
      orgId,
      role: "admin",
    })
    await asAdmin.mutation(api.platform.admin.updateOrganization, {
      orgId,
      country: "se",
    })
    await asAdmin.mutation(api.platform.admin.removeMembership, {
      authId,
      orgId,
    })
    await asAdmin.mutation(api.platform.admin.deleteUser, { authId })

    const plat = await t.run(async (ctx) =>
      ctx.db.query("platformAuditLog").collect()
    )
    // Every recorded admin action is a platform.* event attributed to the
    // operator (the seeded grant in setup is out-of-band and not logged here).
    const types = plat.map((r) => r.type).sort()
    expect(types).toEqual(
      [
        "platform.membershipGranted",
        "platform.membershipRevoked",
        "platform.membershipRoleChanged",
        "platform.orgCreated",
        "platform.orgUpdated",
        "platform.userCreated",
        "platform.userDeleted",
      ].sort()
    )
    for (const r of plat) {
      expect(r.type.startsWith("platform.")).toBe(true)
      expect(r.actorId).toBe(adminId)
    }
    // No operator-attributed rows leaked into ANY org's audit log.
    const orgRows = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_actor", (q) => q.eq("actorId", adminId))
        .collect()
    )
    expect(orgRows).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Run + commit**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS.

```bash
git add packages/backend/convex/platform packages/backend/convex/_generated
git commit -m "feat(platform): deleteUser GDPR erasure with audit anonymization"
```

---

## Task 12: Seed the demo user as a platform admin

**Files:**
- Modify: `packages/backend/convex/seed.ts`

- [ ] **Step 1: Pass `isPlatformAdmin: true` for the demo user**

In `packages/backend/convex/seed.ts`, in `seedDevUser` (around line 229), update the `mirrorSeededUser` call to flag the demo account so the admin page is reachable locally:

```ts
    await ctx.runMutation(internal.accounts.mirrors.mirrorSeededUser, {
      authId: result.userId,
      email,
      name,
      isPlatformAdmin: true,
    })
```

(Leave the `seedProduction` call site unchanged: production admins are granted out-of-band via `internal.platform.bootstrap.grantPlatformAdminByEmail`.)

- [ ] **Step 2: Verify**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/backend`
Expected: PASS (seed tests still green).

- [ ] **Step 3: Commit**

```bash
git add packages/backend/convex/seed.ts
git commit -m "chore(seed): make the dev demo user a platform admin"
```

---

## Task 13: i18n keys (all five locales)

**Files:**
- Modify: `packages/i18n/messages/en.json` (source of truth)
- Modify: `packages/i18n/messages/sv.json`, `nb.json`, `da.json`, `fi.json`

**Rule:** add to `en.json` first (it generates the `Messages` type), then mirror the SAME key set into the other four. The parity test (`packages/i18n/src/messages.test.ts`) fails if any locale's flattened key set differs. Edit JSON directly (no shell perl/sed: it double-encodes non-ASCII). Non-`en` strings are machine-translated drafts; flag them for native review in the commit body.

- [ ] **Step 1: Add `nav.admin` to `dashboard.nav` in en.json**

In `packages/i18n/messages/en.json`, in the `dashboard.nav` object, add `"admin": "Admin"` (after `"model"`):

```json
      "model": "Model",
      "admin": "Admin",
      "signOut": "Sign out"
```

- [ ] **Step 2: Add `resetPassword` to `dashboard.auth` in en.json**

In the `dashboard.auth` object, add a `resetPassword` sub-object (after `invitation`):

```json
      "resetPassword": {
        "title": "Set your password",
        "description": "Choose a password to finish setting up your account.",
        "passwordLabel": "New password",
        "cta": "Set password",
        "success": "Your password is set. You can sign in now.",
        "missingToken": "This link is invalid or has expired. Ask an administrator to resend your invitation.",
        "error": "Something went wrong. Try again."
      },
```

- [ ] **Step 3: Add the `dashboard.admin` section in en.json**

Insert a new `admin` object as a sibling under `dashboard` (after the `help` object, the current last sub-key). Mind the trailing comma on `help`'s closing brace.

```json
    "admin": {
      "heading": "Platform administration",
      "description": "Create and manage organizations, users, and memberships across the whole installation.",
      "platformAdminLabel": "Platform admin",
      "backToApp": "Back to app",
      "notAuthorized": "You do not have access to this page.",
      "users": {
        "heading": "Users",
        "description": "Everyone with an account, across all organizations.",
        "newCta": "Create user",
        "empty": "No users yet.",
        "searchPlaceholder": "Search by name or email",
        "table": {
          "name": "Name",
          "email": "Email",
          "platformAdmin": "Platform admin",
          "actions": "Actions"
        },
        "platformAdminBadge": "Platform admin",
        "resendInvite": "Resend invitation",
        "resendDone": "Invitation sent.",
        "deleteCta": "Delete user",
        "create": {
          "title": "Create user",
          "description": "The user gets an email link to set their own password.",
          "nameLabel": "Name",
          "emailLabel": "Email",
          "cta": "Create user",
          "cancel": "Cancel",
          "done": "User created. An invitation email has been sent.",
          "error": "The user could not be created. Try again."
        },
        "delete": {
          "title": "Delete {name}?",
          "description": "This permanently erases the account and removes it from every organization. This cannot be undone. Type the email to confirm.",
          "confirmLabel": "Type {email} to confirm",
          "confirm": "Permanently delete",
          "cancel": "Cancel",
          "error": "The user could not be deleted. Try again."
        }
      },
      "orgs": {
        "heading": "Organizations",
        "description": "Every tenant in the installation.",
        "newCta": "Create organization",
        "empty": "No organizations yet.",
        "searchPlaceholder": "Search by name or slug",
        "table": {
          "name": "Name",
          "slug": "Slug",
          "country": "Country",
          "onboarded": "Onboarded",
          "members": "Members",
          "actions": "Actions"
        },
        "onboardedYes": "Yes",
        "onboardedNo": "No",
        "manageCta": "Manage",
        "create": {
          "title": "Create organization",
          "description": "A name and a unique slug. Settings can be edited after.",
          "nameLabel": "Name",
          "slugLabel": "Slug",
          "cta": "Create organization",
          "cancel": "Cancel",
          "error": "The organization could not be created. Try again."
        },
        "manage": {
          "title": "Manage {name}",
          "membersHeading": "Members",
          "noMembers": "No members yet.",
          "addMemberHeading": "Add a member",
          "userLabel": "User",
          "userPlaceholder": "Select a user",
          "roleLabel": "Role",
          "addCta": "Add member",
          "removeCta": "Remove",
          "roleAdmin": "Admin",
          "roleEditor": "Editor",
          "settingsHeading": "Settings",
          "countryLabel": "Country",
          "currencyLabel": "Currency",
          "languageLabel": "Language",
          "industryLabel": "Industry",
          "saveSettings": "Save settings",
          "close": "Close",
          "error": "Something went wrong. Try again."
        }
      }
    },
```

- [ ] **Step 4: Mirror every new key into sv/nb/da/fi**

Add the SAME structure (`dashboard.nav.admin`, `dashboard.auth.resetPassword.*`, the whole `dashboard.admin.*` tree, and `errors.platformAdminRequired` from Step 5) into each of `sv.json`, `nb.json`, `da.json`, `fi.json`, with translated values. Draft translations (flag for native review). Reference values:

- Swedish (`sv.json`): `nav.admin` = "Admin"; `resetPassword.title` = "Ange ditt lösenord", `description` = "Välj ett lösenord för att slutföra ditt konto.", `passwordLabel` = "Nytt lösenord", `cta` = "Spara lösenord", `success` = "Ditt lösenord är sparat. Du kan logga in nu.", `missingToken` = "Länken är ogiltig eller har gått ut. Be en administratör skicka inbjudan igen.", `error` = "Något gick fel. Försök igen."; `admin.heading` = "Plattformsadministration", `description` = "Skapa och hantera organisationer, användare och medlemskap i hela installationen.", `platformAdminLabel` = "Plattformsadmin", `backToApp` = "Tillbaka till appen", `notAuthorized` = "Du har inte åtkomst till den här sidan."; `users.heading` = "Användare", `description` = "Alla med ett konto, i alla organisationer.", `newCta` = "Skapa användare", `empty` = "Inga användare än.", `searchPlaceholder` = "Sök på namn eller e-post", `table.name` = "Namn", `table.email` = "E-post", `table.platformAdmin` = "Plattformsadmin", `table.actions` = "Åtgärder", `platformAdminBadge` = "Plattformsadmin", `resendInvite` = "Skicka inbjudan igen", `resendDone` = "Inbjudan skickad.", `deleteCta` = "Ta bort användare", `create.title` = "Skapa användare", `create.description` = "Användaren får en e-postlänk för att ange sitt lösenord.", `create.nameLabel` = "Namn", `create.emailLabel` = "E-post", `create.cta` = "Skapa användare", `create.cancel` = "Avbryt", `create.done` = "Användaren skapad. Ett inbjudningsmejl har skickats.", `create.error` = "Användaren kunde inte skapas. Försök igen.", `delete.title` = "Ta bort {name}?", `delete.description` = "Detta raderar kontot permanent och tar bort det från alla organisationer. Detta kan inte ångras. Skriv e-postadressen för att bekräfta.", `delete.confirmLabel` = "Skriv {email} för att bekräfta", `delete.confirm` = "Ta bort permanent", `delete.cancel` = "Avbryt", `delete.error` = "Användaren kunde inte tas bort. Försök igen."; `orgs.heading` = "Organisationer", `description` = "Alla organisationer i installationen.", `newCta` = "Skapa organisation", `empty` = "Inga organisationer än.", `searchPlaceholder` = "Sök på namn eller slug", `table.name` = "Namn", `table.slug` = "Slug", `table.country` = "Land", `table.onboarded` = "Onboardad", `table.members` = "Medlemmar", `table.actions` = "Åtgärder", `onboardedYes` = "Ja", `onboardedNo` = "Nej", `manageCta` = "Hantera", `create.title` = "Skapa organisation", `create.description` = "Ett namn och en unik slug. Inställningar kan ändras efteråt.", `create.nameLabel` = "Namn", `create.slugLabel` = "Slug", `create.cta` = "Skapa organisation", `create.cancel` = "Avbryt", `create.error` = "Organisationen kunde inte skapas. Försök igen.", `manage.title` = "Hantera {name}", `manage.membersHeading` = "Medlemmar", `manage.noMembers` = "Inga medlemmar än.", `manage.addMemberHeading` = "Lägg till en medlem", `manage.userLabel` = "Användare", `manage.userPlaceholder` = "Välj en användare", `manage.roleLabel` = "Roll", `manage.addCta` = "Lägg till medlem", `manage.removeCta` = "Ta bort", `manage.roleAdmin` = "Admin", `manage.roleEditor` = "Redaktör", `manage.settingsHeading` = "Inställningar", `manage.countryLabel` = "Land", `manage.currencyLabel` = "Valuta", `manage.languageLabel` = "Språk", `manage.industryLabel` = "Bransch", `manage.saveSettings` = "Spara inställningar", `manage.close` = "Stäng", `manage.error` = "Något gick fel. Försök igen."
- For `nb.json`, `da.json`, `fi.json`: provide equivalent draft translations (Norwegian bokmål, Danish, Finnish). Keep international terms ("slug", "admin") as-is where idiomatic (per the Nordic-job-title localization convention). If unsure of a term, copy the English value as a placeholder and flag it; the parity test only checks keys, not values, so the build stays green while drafts await review.

- [ ] **Step 5: Add `errors.platformAdminRequired` to all five locales**

In the top-level `errors` object of each of the five files, add (after `adminRequired`):

- en: `"platformAdminRequired": "You do not have platform admin access."`
- sv: `"platformAdminRequired": "Du har inte plattformsadminbehörighet."`
- nb: `"platformAdminRequired": "Du har ikke plattformadmin-tilgang."`
- da: `"platformAdminRequired": "Du har ikke platformadmin-adgang."`
- fi: `"platformAdminRequired": "Sinulla ei ole alustan ylläpito-oikeuksia."`

- [ ] **Step 6: Run the parity test**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/i18n`
Expected: PASS (all five locales have identical key sets). If it fails, the error names the missing/extra key path; fix and rerun.

- [ ] **Step 7: Sanity-check for mojibake (non-ASCII integrity)**

Run: `grep -nE "Ã|Â|�" packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json`
Expected: no matches (clean UTF-8). If matches appear, the JSON was double-encoded; rewrite those values directly with the Edit tool.

- [ ] **Step 8: Drop any unused keys (run AFTER the frontend tasks, or re-check then)**

The reference block above is deliberately generous. The no-unused-i18n-keys rule means every leaf must be referenced by a `t(...)` call once the UI exists. After Tasks 15 to 18, grep each `dashboard.admin.*` leaf against `apps/dashboard/components/admin` and the admin pages, and delete any leaf not referenced (from ALL five locale files, to keep parity). Known candidates to verify/remove unless you wire a confirmation UI for them: `users.newCta`, `orgs.newCta`, `orgs.table.members`, `users.create.done`, `users.resendDone`, `orgs.manage.error`, and `auth.resetPassword.success` (the create dialogs and reset page close silently on success, matching the existing create-role-dialog pattern). If you prefer to surface a brief success confirmation instead (the guidance principle favors feedback), wire those keys rather than delete them. Re-run the parity test after any change.

- [ ] **Step 9: Commit**

```bash
git add packages/i18n/messages
git commit -m "feat(i18n): platform admin, reset-password, and platformAdminRequired strings (nordic drafts for review)"
```

---

## Task 14: Client Zod schemas for the admin forms

**Files:**
- Create: `apps/dashboard/lib/admin-schemas.ts`
- Test: `apps/dashboard/lib/admin-schemas.test.ts`

The CLAUDE.md rule requires client validation via Zod. The dialogs derive `canSubmit` from `schema.safeParse(...).success` (Zod is the source of truth; the plain-`useState` UI pattern from `create-role-dialog.tsx` still applies). The backend re-validates independently.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/lib/admin-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  createOrgSchema,
  createUserSchema,
  orgSettingsSchema,
} from "./admin-schemas"

describe("admin-schemas", () => {
  it("createUserSchema requires a name and a valid email", () => {
    expect(createUserSchema.safeParse({ name: "A", email: "a@b.se" }).success).toBe(
      true
    )
    expect(createUserSchema.safeParse({ name: "", email: "a@b.se" }).success).toBe(
      false
    )
    expect(createUserSchema.safeParse({ name: "A", email: "nope" }).success).toBe(
      false
    )
  })

  it("createOrgSchema requires a name and a slug-shaped slug", () => {
    expect(
      createOrgSchema.safeParse({ name: "Acme", slug: "acme-ab" }).success
    ).toBe(true)
    expect(
      createOrgSchema.safeParse({ name: "Acme", slug: "Acme AB" }).success
    ).toBe(false)
    expect(createOrgSchema.safeParse({ name: "", slug: "acme" }).success).toBe(
      false
    )
  })

  it("orgSettingsSchema accepts an all-optional patch", () => {
    expect(orgSettingsSchema.safeParse({}).success).toBe(true)
    expect(orgSettingsSchema.safeParse({ country: "se" }).success).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/dashboard`
Expected: FAIL (`admin-schemas` not found).

- [ ] **Step 3: Write the schemas**

Create `apps/dashboard/lib/admin-schemas.ts`:

```ts
import { z } from "zod"

// Client gates for the platform-admin forms. The backend re-validates with
// Convex validators + appError codes; these schemas drive canSubmit and are
// the single client-side source of form rules.

export const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
})
export type CreateUserValues = z.infer<typeof createUserSchema>

// Lowercase letters, digits, hyphens: the slug doubles as the org's unique
// Better Auth identifier.
export const createOrgSchema = z.object({
  name: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})
export type CreateOrgValues = z.infer<typeof createOrgSchema>

export const orgSettingsSchema = z.object({
  country: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  language: z.string().trim().optional(),
  industry: z.string().trim().optional(),
})
export type OrgSettingsValues = z.infer<typeof orgSettingsSchema>

export const membershipRole = z.enum(["admin", "editor"])
export type MembershipRole = z.infer<typeof membershipRole>
```

- [ ] **Step 4: Run + commit**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/dashboard`
Expected: PASS.

```bash
git add apps/dashboard/lib/admin-schemas.ts apps/dashboard/lib/admin-schemas.test.ts
git commit -m "feat(admin): client Zod schemas for admin forms"
```

---

## Task 15: Admin route group, shell, guard, and avatar link

**Files:**
- Create: `apps/dashboard/components/admin/admin-shell.tsx`
- Create: `apps/dashboard/components/admin/platform-admin-guard.tsx`
- Create: `apps/dashboard/app/(admin)/layout.tsx`
- Create: `apps/dashboard/app/(admin)/admin/page.tsx` (placeholder; filled in Task 16)
- Modify: `apps/dashboard/components/nav-user.tsx`

The `(admin)` group replicates the three auth gates from `(app)/layout.tsx` but skips `OnboardingGate` (which blanks the screen for org-less users) and uses a minimal, org-independent shell. The page itself is org-independent, so `useOrganization()` must never be called inside it.

- [ ] **Step 1: Write the minimal AdminShell**

Create `apps/dashboard/components/admin/admin-shell.tsx`. It is intentionally simple (no sidebar, no OrganizationProvider): a header with the product mark, a "Platform admin" label, a back-to-app link, and sign-out, plus the page content.

```tsx
"use client"

import { Logout01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { Logo } from "@/components/logo"
import { authClient } from "@/lib/auth-client"

export function AdminShell(props: { children: ReactNode }) {
  const t = useTranslations("dashboard")
  const tAdmin = useTranslations("dashboard.admin")
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-4 border-b px-4 py-3 lg:px-6">
        <Logo label={t("title")} className="h-7 text-brand" />
        <span className="font-medium text-muted-foreground text-sm">
          {tAdmin("platformAdminLabel")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">{tAdmin("backToApp")}</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
            {t("nav.signOut")}
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-8 px-4 py-6 lg:px-6">
        {props.children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Write the platform-admin guard**

Create `apps/dashboard/components/admin/platform-admin-guard.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { AdminShell } from "@/components/admin/admin-shell"

// undefined = query in flight; false = not a platform admin; true = allowed.
export function PlatformAdminGuard(props: { children: ReactNode }) {
  const t = useTranslations("dashboard")
  const tAdmin = useTranslations("dashboard.admin")
  const allowed = useQuery(api.platform.admin.isPlatformAdmin)

  if (allowed === undefined) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner aria-label={t("auth.loading")} />
      </main>
    )
  }
  if (allowed === false) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">
          {tAdmin("notAuthorized")}
        </p>
      </main>
    )
  }
  return <AdminShell>{props.children}</AdminShell>
}
```

- [ ] **Step 3: Write the (admin) layout**

Create `apps/dashboard/app/(admin)/layout.tsx`. It mirrors `(app)/layout.tsx`'s gates but swaps `OnboardingGate` for `PlatformAdminGuard`.

```tsx
"use client"

import { Spinner } from "@workspace/ui/components/spinner"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { PlatformAdminGuard } from "@/components/admin/platform-admin-guard"
import { SignInScreen } from "@/components/auth/sign-in-screen"

// The admin area sits behind auth, but NOT behind OnboardingGate: a platform
// operator may have no organization, and OnboardingGate renders nothing for a
// user with zero memberships. PlatformAdminGuard is the access gate here.
export default function AdminLayout(props: { children: ReactNode }) {
  const t = useTranslations("dashboard")
  return (
    <>
      <AuthLoading>
        <main className="flex min-h-svh items-center justify-center">
          <Spinner aria-label={t("auth.loading")} />
        </main>
      </AuthLoading>
      <Unauthenticated>
        <SignInScreen />
      </Unauthenticated>
      <Authenticated>
        <PlatformAdminGuard>{props.children}</PlatformAdminGuard>
      </Authenticated>
    </>
  )
}
```

- [ ] **Step 4: Write a placeholder admin page (replaced in Task 16)**

Create `apps/dashboard/app/(admin)/admin/page.tsx`:

```tsx
"use client"

import { useTranslations } from "next-intl"

export default function AdminPage() {
  const t = useTranslations("dashboard.admin")
  return (
    <div className="space-y-2">
      <h1 className="font-medium text-2xl">{t("heading")}</h1>
      <p className="text-muted-foreground text-sm">{t("description")}</p>
    </div>
  )
}
```

- [ ] **Step 5: Add the conditional admin link to the avatar menu**

In `apps/dashboard/components/nav-user.tsx`, add imports:

```tsx
import { api } from "@workspace/backend/convex/_generated/api"
import { Settings01Icon } from "@hugeicons/core-free-icons"
import { useQuery } from "convex/react"
import Link from "next/link"
```

Inside `NavUser`, after `const { data: session } = authClient.useSession()`:

```tsx
  const isPlatformAdmin = useQuery(api.platform.admin.isPlatformAdmin)
```

Then, in the dropdown body, insert the admin item between `<LanguageMenuSub />` and the separator that precedes sign-out (only when the flag is true):

```tsx
            <LanguageMenuSub />
            {isPlatformAdmin === true && (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
                  {t("nav.admin")}
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
```

(Verify `Settings01Icon` exists in `@hugeicons/core-free-icons`; if not, use `Settings02Icon` or another gear icon already used in the app. Confirm with `grep -rn "Settings0" apps/dashboard packages/ui` or browse the icon set.)

- [ ] **Step 6: Typecheck**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/dashboard`
Expected: PASS (typecheck clean; no component tests yet, per codebase norms).

- [ ] **Step 7: Manual smoke (optional but recommended)**

Start dev (`bun dev` from repo root or the dashboard app), sign in as the seeded `hej@blueprnt.se`, confirm "Admin" appears in the avatar menu and `/admin` renders the heading. Confirm a non-admin (a seeded editor without the flag) does not see the link and hitting `/admin` shows the not-authorized text.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/components/admin apps/dashboard/app/(admin) apps/dashboard/components/nav-user.tsx
git commit -m "feat(admin): (admin) route group, minimal shell, platform guard, avatar link"
```

---

## Task 16: Users section, create-user dialog, and reset-password page

**Files:**
- Create: `apps/dashboard/components/admin/create-user-dialog.tsx`
- Create: `apps/dashboard/components/admin/users-section.tsx`
- Create: `apps/dashboard/app/reset-password/page.tsx`
- Modify: `apps/dashboard/app/(admin)/admin/page.tsx`

New-user access: `createUser` provisions the account; the dialog then calls `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`, which fires the existing `resetPassword` email. The user opens `/reset-password?token=...` and sets a password (which creates their credential account).

- [ ] **Step 1: Create the create-user dialog**

Create `apps/dashboard/components/admin/create-user-dialog.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { createUserSchema } from "@/lib/admin-schemas"

export function CreateUserDialog() {
  const t = useTranslations("dashboard.admin.users.create")
  const createUser = useMutation(api.platform.admin.createUser)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const parsed = createUserSchema.safeParse({ name, email })
  const canSubmit = parsed.success && !pending

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setName("")
      setEmail("")
      setFailed(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed.success) return
    setPending(true)
    setFailed(false)
    try {
      await createUser({ name: parsed.data.name, email: parsed.data.email })
      // Send the set-password email. A failure here is non-fatal: the account
      // exists and the invite can be resent from the users table.
      await authClient.requestPasswordReset({
        email: parsed.data.email,
        redirectTo: "/reset-password",
      })
      handleOpenChange(false)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>{t("cta")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">{t("nameLabel")}</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">{t("emailLabel")}</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {failed && (
            <p role="alert" className="text-destructive text-sm">
              {t("error")}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {t("cta")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create the users section (table + delete + resend)**

Create `apps/dashboard/components/admin/users-section.tsx`. The delete dialog is its own component (Task 18); this file imports it. Resend invite calls `authClient.requestPasswordReset` again.

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { CreateUserDialog } from "@/components/admin/create-user-dialog"
import { DeleteUserDialog } from "@/components/admin/delete-user-dialog"
import { authClient } from "@/lib/auth-client"

export function UsersSection() {
  const t = useTranslations("dashboard.admin.users")
  const users = useQuery(api.platform.admin.listUsers, {})
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (users === undefined) return []
    if (q === "") return users
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [users, query])

  async function resend(email: string) {
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium text-lg">{t("heading")}</h2>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <CreateUserDialog />
      </div>
      <Input
        value={query}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        onChange={(event) => setQuery(event.target.value)}
        className="w-72"
      />
      {users !== undefined && filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.email")}</TableHead>
              <TableHead>{t("table.platformAdmin")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
              <TableRow key={user.authId}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  {user.isPlatformAdmin && (
                    <Badge variant="secondary">{t("platformAdminBadge")}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => resend(user.email)}
                    >
                      {t("resendInvite")}
                    </Button>
                    <DeleteUserDialog
                      authId={user.authId}
                      name={user.name}
                      email={user.email}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Create the public reset-password page**

Create `apps/dashboard/app/reset-password/page.tsx`. Next 16 requires `useSearchParams` to sit inside a Suspense boundary, so the page wraps the form.

```tsx
"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { useTranslations } from "next-intl"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Logo } from "@/components/logo"
import { authClient } from "@/lib/auth-client"

function ResetPasswordForm() {
  const t = useTranslations("dashboard.auth.resetPassword")
  const tApp = useTranslations("dashboard")
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (token === null || password.length === 0) return
    setPending(true)
    setError(false)
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (resetError) {
        setError(true)
        return
      }
      router.push("/")
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo label={tApp("title")} className="h-10 self-center text-brand" />
        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {token === null ? (
              <p role="alert" className="text-destructive text-sm">
                {t("missingToken")}
              </p>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="new-password">
                      {t("passwordLabel")}
                    </FieldLabel>
                    <Input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </Field>
                  {error && (
                    <p role="alert" className="text-destructive text-sm">
                      {t("error")}
                    </p>
                  )}
                  <Field>
                    <Button type="submit" disabled={pending}>
                      {t("cta")}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
```

- [ ] **Step 4: Wire the users section into the admin page**

Replace `apps/dashboard/app/(admin)/admin/page.tsx`:

```tsx
"use client"

import { useTranslations } from "next-intl"
import { OrganizationsSection } from "@/components/admin/organizations-section"
import { UsersSection } from "@/components/admin/users-section"

export default function AdminPage() {
  const t = useTranslations("dashboard.admin")
  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="font-medium text-2xl">{t("heading")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      <UsersSection />
      <OrganizationsSection />
    </div>
  )
}
```

(`OrganizationsSection` is created in Task 17; `DeleteUserDialog` in Task 18. This page will not typecheck until those exist, so run the typecheck at the end of Task 18, not here. To keep commits green, implement Tasks 16 to 18 then run the suite once and make a single commit, OR stub the two missing components first. The plan commits them together in Task 18 Step 6.)

- [ ] **Step 5: Verify the reset API surface against better-auth 1.6.17**

Run: `grep -rn "requestPasswordReset\|resetPassword" node_modules/better-auth/dist/client` (or inspect the client types)
Expected: both methods exist on the client. Confirm `requestPasswordReset` takes `{ email, redirectTo }` and `resetPassword` takes `{ newPassword, token }`. (Recon already confirmed this for 1.6.17; this step is the in-situ double-check the spec requires before relying on it.)

---

## Task 17: Organizations section, create-org dialog, manage-org dialog

**Files:**
- Create: `apps/dashboard/components/admin/create-organization-dialog.tsx`
- Create: `apps/dashboard/components/admin/manage-organization-dialog.tsx`
- Create: `apps/dashboard/components/admin/organizations-section.tsx`

- [ ] **Step 1: Create the create-organization dialog**

Create `apps/dashboard/components/admin/create-organization-dialog.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { createOrgSchema } from "@/lib/admin-schemas"

export function CreateOrganizationDialog() {
  const t = useTranslations("dashboard.admin.orgs.create")
  const createOrg = useMutation(api.platform.admin.createOrganization)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const parsed = createOrgSchema.safeParse({ name, slug })
  const canSubmit = parsed.success && !pending

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setName("")
      setSlug("")
      setFailed(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed.success) return
    setPending(true)
    setFailed(false)
    try {
      await createOrg({ name: parsed.data.name, slug: parsed.data.slug })
      handleOpenChange(false)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>{t("cta")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">{t("nameLabel")}</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">{t("slugLabel")}</Label>
            <Input
              id="org-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>
          {failed && (
            <p role="alert" className="text-destructive text-sm">
              {t("error")}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {t("cta")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create the manage-organization dialog (members + add + settings)**

Create `apps/dashboard/components/admin/manage-organization-dialog.tsx`. It lists members (with role change + remove), an add-member control (pick a user + role), and an org-settings form. It receives the org row and the full user list (for the add picker) as props.

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface AdminUser {
  authId: string
  name: string
  email: string
}

interface AdminOrg {
  orgId: string
  name: string
  slug: string
  country: string | null
  currency: string | null
  language: string | null
  industry: string | null
}

export function ManageOrganizationDialog(props: {
  org: AdminOrg
  users: AdminUser[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { org, users, open, onOpenChange } = props
  const t = useTranslations("dashboard.admin.orgs.manage")
  const members = useQuery(
    api.platform.admin.listOrganizationMembers,
    open ? { orgId: org.orgId } : "skip"
  )
  const addMembership = useMutation(api.platform.admin.addMembership)
  const setRole = useMutation(api.platform.admin.setMembershipRole)
  const removeMembership = useMutation(api.platform.admin.removeMembership)
  const updateOrg = useMutation(api.platform.admin.updateOrganization)

  const [addUserId, setAddUserId] = useState("")
  const [addRole, setAddRole] = useState<"admin" | "editor">("editor")
  const [country, setCountry] = useState(org.country ?? "")
  const [currency, setCurrency] = useState(org.currency ?? "")
  const [language, setLanguage] = useState(org.language ?? "")
  const [industry, setIndustry] = useState(org.industry ?? "")
  const [busy, setBusy] = useState(false)

  const memberIds = new Set((members ?? []).map((m) => m.authId))
  const addableUsers = users.filter((u) => !memberIds.has(u.authId))

  async function handleAdd() {
    if (addUserId === "") return
    setBusy(true)
    try {
      await addMembership({ authId: addUserId, orgId: org.orgId, role: addRole })
      setAddUserId("")
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveSettings() {
    setBusy(true)
    try {
      await updateOrg({
        orgId: org.orgId,
        country,
        currency,
        language,
        industry,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title", { name: org.name })}</DialogTitle>
          <DialogDescription>{org.slug}</DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="font-medium text-sm">{t("membersHeading")}</h3>
          {members !== undefined && members.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noMembers")}</p>
          ) : (
            <ul className="space-y-2">
              {(members ?? []).map((m) => (
                <li
                  key={m.authId}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate text-sm">
                    {m.name} <span className="text-muted-foreground">{m.email}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={m.role}
                      onValueChange={(value) =>
                        setRole({
                          authId: m.authId,
                          orgId: org.orgId,
                          role: value as "admin" | "editor",
                        })
                      }
                    >
                      <SelectTrigger className="w-32" aria-label={t("roleLabel")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                        <SelectItem value="editor">{t("roleEditor")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        removeMembership({ authId: m.authId, orgId: org.orgId })
                      }
                    >
                      {t("removeCta")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 border-t pt-4">
          <h3 className="font-medium text-sm">{t("addMemberHeading")}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1 space-y-2">
              <Label>{t("userLabel")}</Label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger aria-label={t("userLabel")}>
                  <SelectValue placeholder={t("userPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {addableUsers.map((u) => (
                    <SelectItem key={u.authId} value={u.authId}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36 space-y-2">
              <Label>{t("roleLabel")}</Label>
              <Select
                value={addRole}
                onValueChange={(value) => setAddRole(value as "admin" | "editor")}
              >
                <SelectTrigger aria-label={t("roleLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                  <SelectItem value="editor">{t("roleEditor")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={addUserId === "" || busy}
            >
              {t("addCta")}
            </Button>
          </div>
        </section>

        <section className="space-y-3 border-t pt-4">
          <h3 className="font-medium text-sm">{t("settingsHeading")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-country">{t("countryLabel")}</Label>
              <Input
                id="org-country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-currency">{t("currencyLabel")}</Label>
              <Input
                id="org-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-language">{t("languageLabel")}</Label>
              <Input
                id="org-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-industry">{t("industryLabel")}</Label>
              <Input
                id="org-industry"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
              />
            </div>
          </div>
        </section>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
          <Button type="button" onClick={handleSaveSettings} disabled={busy}>
            {t("saveSettings")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

(Note: country/currency/language/industry are free-text inputs in V1 to keep scope tight. If the app already has constants/pickers for these, prefer them; otherwise free text is acceptable and noted as polish.)

- [ ] **Step 3: Create the organizations section**

Create `apps/dashboard/components/admin/organizations-section.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { CreateOrganizationDialog } from "@/components/admin/create-organization-dialog"
import { ManageOrganizationDialog } from "@/components/admin/manage-organization-dialog"

export function OrganizationsSection() {
  const t = useTranslations("dashboard.admin.orgs")
  const orgs = useQuery(api.platform.admin.listOrganizations, {})
  const users = useQuery(api.platform.admin.listUsers, {})
  const [query, setQuery] = useState("")
  const [manageOrgId, setManageOrgId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (orgs === undefined) return []
    if (q === "") return orgs
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)
    )
  }, [orgs, query])

  const manageOrg = (orgs ?? []).find((o) => o.orgId === manageOrgId) ?? null

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium text-lg">{t("heading")}</h2>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <CreateOrganizationDialog />
      </div>
      <Input
        value={query}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        onChange={(event) => setQuery(event.target.value)}
        className="w-72"
      />
      {orgs !== undefined && filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.slug")}</TableHead>
              <TableHead>{t("table.country")}</TableHead>
              <TableHead>{t("table.onboarded")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((org) => (
              <TableRow key={org.orgId}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell className="text-muted-foreground">{org.slug}</TableCell>
                <TableCell>{org.country ?? ""}</TableCell>
                <TableCell>
                  <Badge variant={org.onboarded ? "secondary" : "outline"}>
                    {org.onboarded ? t("onboardedYes") : t("onboardedNo")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setManageOrgId(org.orgId)}
                  >
                    {t("manageCta")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {manageOrg !== null && (
        <ManageOrganizationDialog
          org={manageOrg}
          users={users ?? []}
          open={manageOrgId !== null}
          onOpenChange={(next) => {
            if (!next) setManageOrgId(null)
          }}
        />
      )}
    </section>
  )
}
```

- [ ] **Step 4: Commit happens at the end of Task 18 (these files are interdependent with the admin page).**

---

## Task 18: Delete-user dialog (AlertDialog + type-to-confirm), then build the frontend green

**Files:**
- Create: `apps/dashboard/components/admin/delete-user-dialog.tsx`

The codebase has no type-to-confirm pattern, so this builds one on the standard `AlertDialog`: the destructive action stays disabled until the admin types the user's exact email.

- [ ] **Step 1: Create the delete-user dialog**

Create `apps/dashboard/components/admin/delete-user-dialog.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"

export function DeleteUserDialog(props: {
  authId: string
  name: string
  email: string
}) {
  const t = useTranslations("dashboard.admin.users.delete")
  const tUsers = useTranslations("dashboard.admin.users")
  const deleteUser = useMutation(api.platform.admin.deleteUser)
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const confirmed = confirmText.trim() === props.email

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setConfirmText("")
      setFailed(false)
    }
  }

  async function handleDelete() {
    if (!confirmed) return
    setBusy(true)
    setFailed(false)
    try {
      await deleteUser({ authId: props.authId })
      handleOpenChange(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        {tUsers("deleteCta")}
      </Button>
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("title", { name: props.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`confirm-${props.authId}`}>
              {t("confirmLabel", { email: props.email })}
            </Label>
            <Input
              id={`confirm-${props.authId}`}
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
            />
            {failed && (
              <p role="alert" className="text-destructive text-sm">
                {t("error")}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!confirmed || busy}
              onClick={(event) => {
                // Keep the dialog mounted; we close it ourselves on success.
                event.preventDefault()
                void handleDelete()
              }}
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

(Verify `AlertDialogAction` accepts a `variant` prop in this repo's shadcn copy: `criterion-item.tsx` uses `variant="destructive"` on it, so it does.)

- [ ] **Step 2: Build the whole dashboard and typecheck**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test --filter=@workspace/dashboard`
Expected: PASS. If a missing import surfaces (e.g. `Logo`, `Field` primitives, an icon name), fix it against the actual export and rerun. Confirm `apps/dashboard/i18n-env.d.ts` exists (it does) so the new `dashboard.admin.*` keys are typed.

- [ ] **Step 3: Full suite**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test`
Expected: PASS (backend, i18n parity, dashboard typecheck all green).

- [ ] **Step 4: Manual smoke (recommended)**

With `bun dev`, as `hej@blueprnt.se`: open `/admin`, create a user (confirm the invite email row appears in the Convex `emails` table / dashboard), create an org, open Manage, add the user with a role, change the role, remove them, edit settings. Then delete the created user (type-to-confirm) and confirm they vanish from the list. Open the emailed reset link locally (copy `props.url` from the `emails` row) and confirm `/reset-password` sets a password and lets you sign in.

- [ ] **Step 5: Commit the frontend (Tasks 16, 17, 18 together)**

```bash
git add apps/dashboard/components/admin apps/dashboard/app/(admin)/admin/page.tsx apps/dashboard/app/reset-password
git commit -m "feat(admin): users and organizations management UI, reset-password page"
```

---

## Task 19: ADR for the platform-admin authorization carve-out

**Files:**
- Create: `docs/adr/NNNN-platform-admin.md` (Swedish; pick the next ADR number)

`docs/adr/` is a domain-document location, so the ADR is written in Swedish (per CLAUDE.md). Code identifiers stay English.

- [ ] **Step 1: Find the next ADR number**

Run: `ls docs/adr`
Expected: a list like `0001-...md` ... pick the next sequential number `NNNN`.

- [ ] **Step 2: Write the ADR (Swedish)**

Create `docs/adr/NNNN-platform-admin.md` documenting: the new `isPlatformAdmin` flag on the `users` mirror and that it is set only out-of-band (no in-app granting in V1); the `platformQuery`/`platformMutation` builders that deliberately bypass org-scoping (the documented exception to "varje Convex-funktion är org-scopad"); the **separat adminrevisionslogg** (`platformAuditLog` med egen händelsevokabulär `PLATFORM_AUDIT_EVENTS`) som är medvetet åtskild från organisationernas `auditLog`. Varje adminåtgärd loggas i adminloggen och INGET skrivs till någon organisations `auditLog` (enda undantaget: den inneboende `organization.created`-livscykelraden med aktör `system` när en organisation skapas, identisk med hur seedade organisationer ser ut). Skälet: operatörsåtgärder ska aldrig blandas in i hyresgästernas egna revisionsspår. Dokumentera även GDPR-raderingen (hård radering plus anonymisering av `actorName` i båda loggarna, raderna behålls med rättslig grund berättigat intresse) och V1-begränsningen (e-post inbäddad i auditpayloads, endast de ännu inte lanserade invitation-händelserna, skrubbas i en uppföljning när invitations-flödet byggs). Follow the structure of the existing ADRs in `docs/adr/` (Kontext, Beslut, Konsekvenser).

- [ ] **Step 3: Commit**

```bash
git add docs/adr
git commit -m "docs(adr): platform-admin authorization carve-out and GDPR erasure"
```

---

## Task 20: Final verification and merge to main

**Files:** none (process)

- [ ] **Step 1: Full green run from the worktree**

Run: `cd /Volumes/development/blueprnt/admin-platform && bun run test`
Expected: PASS across all packages.

- [ ] **Step 2: Confirm no stray PII-in-payload regressions and no hardcoded UI text**

Run: `grep -rn "actorName" packages/backend/convex/platform` (sanity: only the tombstone constant) and skim the new components for any literal user-facing string (there should be none; all via `t(...)`).

- [ ] **Step 3: Review the diff for containment**

Run: `git -C /Volumes/development/blueprnt/admin-platform diff main --stat`
Expected: only the files this plan touched (backend platform/betterAuth/lib/accounts/schema, i18n messages, dashboard admin/reset-password/nav-user, docs, CLAUDE.md erasure line).

- [ ] **Step 4: Squash-merge to main (from the MAIN checkout), per the worktree convention**

From `/Volumes/development/blueprnt/frontend` (main): `git merge --squash feat/admin-platform`, resolve nothing if clean, then `git commit` with a `feat(admin): platform administration page` message and a body summarizing what landed (note the Nordic i18n drafts await native review). **Do not push.** Christian approves pushes explicitly.

- [ ] **Step 5: Verify containment and clean up**

Run: `git -C /Volumes/development/blueprnt/frontend diff feat/admin-platform main --stat`
Expected: empty (main now contains everything from the branch). Then `git worktree remove ../admin-platform` and `git branch -d feat/admin-platform`.

---

## Notes / V1 limitations (carried from the spec)

- Granting/revoking platform-admin is out-of-band only (`internal.platform.bootstrap.*` via Convex CLI/dashboard, or the dev seed). No in-app grant UI.
- New-user email reuses the `resetPassword` template ("Reset your password"); a dedicated welcome template is optional polish.
- An org-less platform admin who signs in lands on a blank `/` (OnboardingGate renders nothing for zero memberships) and must navigate to `/admin` directly. Typical admins are also org members and reach it from the avatar menu. A redirect for org-less admins is a future polish.
- Erasure anonymizes `actorName` snapshots; email strings embedded in audit *payloads* (only the not-yet-shipped invitation events) are a documented follow-up.
- Cross-org listings are bounded at 500 rows; pagination is post-V1.
- Org settings in the manage dialog are free-text in V1; wire to existing country/currency/industry constants as polish.










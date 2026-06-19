import type { GenericMutationCtx } from "convex/server"
import { v } from "convex/values"
import type { DataModel } from "../_generated/dataModel"
import { internalMutation } from "../_generated/server"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"

type Ctx = GenericMutationCtx<DataModel>

interface AuthUserDoc {
  _id: string
  email: string
  name: string
  isPlatformAdmin?: boolean
}

interface AuthOrgDoc {
  _id: string
}

interface AuthMemberDoc {
  _id: string
  organizationId: string
  userId: string
  role: string
  createdAt: number
}

// invitation fields: organizationId/email/inviterId/status are required strings
// per generatedSchema.ts; role is optional(union(null, string)).
interface AuthInvitationDoc {
  _id: string
  organizationId: string
  email: string
  role?: string | null
  status: string
  expiresAt: number
  createdAt: number
  inviterId: string
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
    ...(doc.isPlatformAdmin === true ? { isPlatformAdmin: true } : {}),
  })
}

// Used by the dev seed (convex/seed.ts): direct component-table inserts
// bypass the Better Auth triggers, so the app-side mirror row is created
// explicitly. Idempotent via onUserCreate.
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

// Cleanup counterpart for the dev seed; email and name are irrelevant to
// the delete path.
export const removeMirroredUser = internalMutation({
  args: { authId: v.string() },
  returns: v.null(),
  handler: async (ctx, { authId }) => {
    await onUserDelete(ctx, { _id: authId, email: "", name: "" })
    return null
  },
})

// Symmetric counterpart to mirrorSeededOrganization. Dev/test cleanup only:
// the product never deletes tenants (disableOrganizationDeletion). Deletes
// every app-side row scoped to the org in child-first order so foreign-key
// style invariants are respected even at dev scale.
export const removeSeededOrganization = internalMutation({
  args: { orgId: v.string() },
  returns: v.null(),
  handler: async (ctx, { orgId }) => {
    // Models: criteria, then the model itself. Anchors and band thresholds
    // ride along on their parent documents; tracks are constants (ADR-0006).
    const models = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
    for (const model of models) {
      const criteria = await ctx.db
        .query("criteria")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      for (const criterion of criteria) {
        await ctx.db.delete(criterion._id)
      }

      await ctx.db.delete(model._id)
    }

    // Roles and ratings.
    for (const table of ["roles", "ratings"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      for (const row of rows) {
        await ctx.db.delete(row._id)
      }
    }

    // Suggestions, organizations, auditLog.
    for (const table of ["suggestions", "organizations", "auditLog"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      for (const row of rows) {
        await ctx.db.delete(row._id)
      }
    }

    return null
  },
})

// Used by the dev organization seed (convex/seed.ts): seeds the organization
// settings row plus the organization.created audit entry (idempotent), and
// audits the member.added event only when the seed actually created the member
// row.
export const mirrorSeededOrganization = internalMutation({
  args: {
    orgId: v.string(),
    memberUserId: v.string(),
    role: v.string(),
    auditMember: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, memberUserId, role, auditMember }) => {
    await onOrganizationCreate(ctx, { _id: orgId })
    if (auditMember) {
      await onMemberCreate(ctx, {
        _id: "seeded",
        organizationId: orgId,
        userId: memberUserId,
        role,
        createdAt: Date.now(),
      })
    }
    return null
  },
})

// Dev/seed-only: fill an org's settings and (optionally) mark onboarding
// complete without an auth context. updateOrganizationSettings and
// completeOnboarding are admin mutations (they need an identity), which the
// "use node" dev seed action does not have. This patches the bare
// organizations row mirrorSeededOrganization already created. Idempotent: the
// first onboardingCompletedAt timestamp is preserved across re-runs, and the
// audit rows are written only on the first seed.
export const seedOrganizationSettings = internalMutation({
  args: {
    orgId: v.string(),
    country: v.string(),
    currency: v.string(),
    language: v.string(),
    industry: v.string(),
    completeOnboarding: v.boolean(),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { orgId, country, currency, language, industry, completeOnboarding }
  ) => {
    const row = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    const firstSettings = row === null || !row.country
    const stampCompletion =
      completeOnboarding &&
      (row === null || typeof row.onboardingCompletedAt !== "number")
    const fields = {
      country,
      currency,
      language,
      industry,
      ...(stampCompletion ? { onboardingCompletedAt: Date.now() } : {}),
    }
    if (row === null) {
      await ctx.db.insert("organizations", { orgId, ...fields })
    } else {
      await ctx.db.patch(row._id, fields)
    }
    if (firstSettings) {
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.organizationSettingsUpdated,
        actorId: "system",
        payload: { changed: ["country", "currency", "language", "industry"] },
      })
    }
    if (stampCompletion) {
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.onboardingCompleted,
        actorId: "system",
        payload: {},
      })
    }
    return null
  },
})

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
    .query("organizations")
    .withIndex("by_org", (q) => q.eq("orgId", doc._id))
    .unique()
  if (existing !== null) return
  await ctx.db.insert("organizations", { orgId: doc._id })
  // Audit only on first creation so the row is not duplicated on re-fire.
  await logAudit(ctx, {
    orgId: doc._id,
    type: AUDIT_EVENTS.organizationCreated,
    actorId: "system",
    payload: {},
  })
}

// Triggers carry no caller identity; actor attribution for member events
// is "system" until a server-side member-management mutation logs the real
// admin actor (future slice). payload.memberUserId identifies the subject.

export async function onMemberCreate(ctx: Ctx, doc: AuthMemberDoc) {
  await logAudit(ctx, {
    orgId: doc.organizationId,
    type: AUDIT_EVENTS.memberAdded,
    actorId: "system",
    payload: { memberUserId: doc.userId, role: doc.role },
  })
}

export async function onMemberUpdate(
  ctx: Ctx,
  newDoc: AuthMemberDoc,
  oldDoc: AuthMemberDoc
) {
  if (newDoc.role === oldDoc.role) return
  await logAudit(ctx, {
    orgId: newDoc.organizationId,
    type: AUDIT_EVENTS.memberRoleChanged,
    actorId: "system",
    payload: {
      memberUserId: newDoc.userId,
      from: oldDoc.role,
      to: newDoc.role,
    },
  })
}

export async function onMemberDelete(ctx: Ctx, doc: AuthMemberDoc) {
  await logAudit(ctx, {
    orgId: doc.organizationId,
    type: AUDIT_EVENTS.memberRemoved,
    actorId: "system",
    payload: { memberUserId: doc.userId },
  })
}

export async function onInvitationCreate(ctx: Ctx, doc: AuthInvitationDoc) {
  await logAudit(ctx, {
    orgId: doc.organizationId,
    type: AUDIT_EVENTS.invitationCreated,
    actorId: doc.inviterId,
    // IDs only, never the invitee email: keeps PII out of the per-org log so
    // erasure stays complete (see auditLog table comment).
    payload: { invitationId: doc._id },
  })
}

export async function onInvitationUpdate(
  ctx: Ctx,
  newDoc: AuthInvitationDoc,
  oldDoc: AuthInvitationDoc
) {
  if (newDoc.status === oldDoc.status) return
  // Deliberate V1 collapse: both invitee-declined (rejected) and
  // admin-canceled map to invitation.revoked; payload.status preserves the
  // distinction for any future reporting.
  const type =
    newDoc.status === "accepted"
      ? AUDIT_EVENTS.invitationAccepted
      : AUDIT_EVENTS.invitationRevoked
  await logAudit(ctx, {
    orgId: newDoc.organizationId,
    type,
    actorId: newDoc.inviterId,
    // IDs/codes only, never the invitee email; status preserves the
    // declined-vs-canceled distinction for future reporting.
    payload: { invitationId: newDoc._id, status: newDoc.status },
  })
}

import type { GenericMutationCtx } from "convex/server"
import { v } from "convex/values"
import type { DataModel } from "../_generated/dataModel"
import { internalMutation } from "../_generated/server"
import { AUDIT_EVENTS, buildChanges, logAudit } from "../lib/audit"

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

    // People/pay bounded context: payRecords and personAssignments are children
    // of people rows; delete them first (child-first order), then people, then
    // the import mapping profile. importMappingProfiles has no children.
    for (const table of [
      "payRecords",
      "personAssignments",
      "people",
      "importMappingProfiles",
    ] as const) {
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
    // The founder account the seed creates the org for. Threaded into the
    // organization.created and member.added audit rows so the seeded org's
    // log reads as that account having set it up, not the "system" sentinel.
    actorId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, memberUserId, role, auditMember, actorId }) => {
    await onOrganizationCreate(ctx, { _id: orgId }, actorId)
    if (auditMember) {
      await onMemberCreate(
        ctx,
        {
          _id: "seeded",
          organizationId: orgId,
          userId: memberUserId,
          role,
          createdAt: Date.now(),
        },
        actorId
      )
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
    // The founder account the seed runs for: attributed on the
    // settingsUpdated and onboardingCompleted audit rows.
    actorId: v.string(),
  },
  returns: v.null(),
  handler: async (
    ctx,
    {
      orgId,
      country,
      currency,
      language,
      industry,
      completeOnboarding,
      actorId,
    }
  ) => {
    const row = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    const firstSettings = row === null || !row.country
    const stampCompletion =
      completeOnboarding &&
      (row === null || typeof row.onboardingCompletedAt !== "number")
    // Hoisted so the patched/inserted value and the audited `to` are identical.
    const completedAt = Date.now()
    const fields = {
      country,
      currency,
      language,
      industry,
      ...(stampCompletion ? { onboardingCompletedAt: completedAt } : {}),
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
        actorId,
        payload: {
          changes: buildChanges(
            row ?? {},
            { country, currency, language, industry },
            ["country", "currency", "language", "industry"]
          ),
        },
      })
    }
    if (stampCompletion) {
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.onboardingCompleted,
        actorId,
        payload: {
          changes: {
            onboardingCompletedAt: {
              from: row?.onboardingCompletedAt ?? null,
              to: completedAt,
            },
          },
        },
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

// actorId defaults to the "system" sentinel for the identity-less caller paths
// (the Better Auth organization.onCreate trigger and the platform-admin org
// provisioning, which attributes the operator to the platform log instead). The
// dev/prod seed passes the founder authId so the seeded org's log reads as that
// account having created it.
export async function onOrganizationCreate(
  ctx: Ctx,
  doc: AuthOrgDoc,
  actorId = "system"
) {
  const existing = await ctx.db
    .query("organizations")
    .withIndex("by_org", (q) => q.eq("orgId", doc._id))
    .unique()
  if (existing !== null) return
  await ctx.db.insert("organizations", { orgId: doc._id })
  // Audit only on first creation so the row is not duplicated on re-fire.
  // Intentional id-only marker: the substantive before/after is the following
  // settingsUpdated row. No founder name/email (Role != Person; PII).
  await logAudit(ctx, {
    orgId: doc._id,
    type: AUDIT_EVENTS.organizationCreated,
    actorId,
    payload: { changes: { orgId: { from: null, to: doc._id } } },
  })
}

// Triggers carry no caller identity; actor attribution for member events
// is "system" until a server-side member-management mutation logs the real
// admin actor (future slice). payload.memberUserId identifies the subject.
//
// onMemberCreate takes an optional actorId (default "system") because the seed
// reuses it to record the founder as the actor on member.added; the trigger
// caller keeps the default. onMemberUpdate/onMemberDelete are trigger-only and
// stay "system".

export async function onMemberCreate(
  ctx: Ctx,
  doc: AuthMemberDoc,
  actorId = "system"
) {
  await logAudit(ctx, {
    orgId: doc.organizationId,
    type: AUDIT_EVENTS.memberAdded,
    actorId,
    // Id + role only, NEVER name/email (Role != Person; PII). The seed passes
    // a sentinel "seeded" _id, which is not a real member id, so it is omitted.
    payload: {
      memberUserId: doc.userId,
      ...(doc._id !== "seeded" ? { memberId: doc._id } : {}),
      changes: { role: { from: null, to: doc.role } },
    },
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
    // Id + role only, never name/email.
    payload: {
      memberUserId: newDoc.userId,
      memberId: newDoc._id,
      changes: { role: { from: oldDoc.role, to: newDoc.role } },
    },
  })
}

export async function onMemberDelete(ctx: Ctx, doc: AuthMemberDoc) {
  await logAudit(ctx, {
    orgId: doc.organizationId,
    type: AUDIT_EVENTS.memberRemoved,
    actorId: "system",
    // Id + role only, never name/email. The removed role goes to null.
    payload: {
      memberUserId: doc.userId,
      ...(doc._id !== "seeded" ? { memberId: doc._id } : {}),
      changes: { role: { from: doc.role, to: null } },
    },
  })
}

export async function onInvitationCreate(ctx: Ctx, doc: AuthInvitationDoc) {
  await logAudit(ctx, {
    orgId: doc.organizationId,
    type: AUDIT_EVENTS.invitationCreated,
    actorId: doc.inviterId,
    // IDs only, never the invitee email: keeps PII out of the per-org log so
    // erasure stays complete (see auditLog table comment). Captures the
    // invitation's created state (role/status/expiry) as before/after.
    payload: {
      invitationId: doc._id,
      changes: {
        role: { from: null, to: doc.role ?? null },
        status: { from: null, to: doc.status },
        expiresAt: { from: null, to: doc.expiresAt },
      },
    },
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
    // IDs/codes only, never the invitee email; top-level status preserves the
    // declined-vs-canceled distinction for future reporting, and changes
    // records the status transition as before/after.
    payload: {
      invitationId: newDoc._id,
      status: newDoc.status,
      changes: { status: { from: oldDoc.status, to: newDoc.status } },
    },
  })
}

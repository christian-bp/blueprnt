import {
  type AuthFunctions,
  createClient,
  type GenericCtx,
} from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils"
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal"
import { organization } from "better-auth/plugins"
import { components, internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import authConfig from "./auth.config"
import { ac, admin, editor } from "./betterAuth/permissions"
import authSchema from "./betterAuth/schema"
import {
  onInvitationCreate,
  onInvitationUpdate,
  onMemberCreate,
  onMemberDelete,
  onMemberUpdate,
  onOrganizationCreate,
  onUserCreate,
  onUserDelete,
  onUserUpdate,
} from "./accounts/mirrors"

function requireSiteUrl(): string {
  const url = process.env.SITE_URL
  if (!url) {
    throw new Error("SITE_URL env var is not set on the deployment")
  }
  return url
}

const authFunctions: AuthFunctions = internal.auth

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: { schema: authSchema },
    authFunctions,
    triggers: {
      user: {
        onCreate: async (ctx, doc) => {
          await onUserCreate(ctx, doc)
        },
        onUpdate: async (ctx, newDoc, oldDoc) => {
          await onUserUpdate(ctx, newDoc, oldDoc)
        },
        onDelete: async (ctx, doc) => {
          await onUserDelete(ctx, doc)
        },
      },
      organization: {
        onCreate: async (ctx, doc) => {
          await onOrganizationCreate(ctx, doc)
        },
      },
      member: {
        onCreate: async (ctx, doc) => {
          await onMemberCreate(ctx, doc)
        },
        onUpdate: async (ctx, newDoc, oldDoc) => {
          await onMemberUpdate(ctx, newDoc, oldDoc)
        },
        onDelete: async (ctx, doc) => {
          await onMemberDelete(ctx, doc)
        },
      },
      invitation: {
        onCreate: async (ctx, doc) => {
          await onInvitationCreate(ctx, doc)
        },
        onUpdate: async (ctx, newDoc, oldDoc) => {
          await onInvitationUpdate(ctx, newDoc, oldDoc)
        },
      },
    },
  }
)

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

export const createAuthOptions = (
  ctx: GenericCtx<DataModel>,
  overrides?: { baseURL?: string }
) => {
  // Hoisted so both baseURL and the invite accept link use the same value.
  // Analysis/codegen contexts pass an override and must not call requireSiteUrl.
  const resolvedBaseUrl = overrides?.baseURL ?? requireSiteUrl()
  return {
    baseURL: resolvedBaseUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      // The durable outbox exists now (Task 12), so we can require verification.
      requireEmailVerification: true,
      sendResetPassword: async (data) => {
        // No per-account locale yet (Task 12 slice); reset emails go out in en.
        await requireRunMutationCtx(ctx).runMutation(
          internal.email.outbox.enqueueEmail,
          {
            to: data.user.email,
            templateKey: "resetPassword",
            props: { url: data.url },
            locale: "en",
          }
        )
      },
    },
    emailVerification: {
      sendVerificationEmail: async (data) => {
        // No per-account locale yet (Task 12 slice); verify emails go out in en.
        await requireRunMutationCtx(ctx).runMutation(
          internal.email.outbox.enqueueEmail,
          {
            to: data.user.email,
            templateKey: "verifyEmail",
            props: { url: data.url },
            locale: "en",
          }
        )
      },
    },
    plugins: [
      organization({
        ac,
        roles: { admin, editor },
        creatorRole: "admin",
        // Deliberate V1 posture: tenant deletion is an out-of-band support
        // operation. No product path to delete an organization exists.
        // Revisit post-V1.
        disableOrganizationDeletion: true,
        sendInvitationEmail: async (data) => {
          const mctx = requireRunMutationCtx(ctx)
          // Resolve the workspace's language so the invite goes out in the
          // org's locale; fall back to en if the profile has no language set.
          const profile = await mctx.runQuery(
            internal.accounts.workspace.getProfileForOrg,
            { orgId: data.organization.id }
          )
          await mctx.runMutation(internal.email.outbox.enqueueEmail, {
            to: data.email,
            templateKey: "invitation",
            props: {
              inviterName: data.inviter.user.name,
              workspaceName: data.organization.name,
              acceptUrl: `${resolvedBaseUrl}/accept-invitation/${data.id}`,
            },
            locale: profile?.language ?? "en",
          })
        },
      }),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx))

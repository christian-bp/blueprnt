import {
  type AuthFunctions,
  createClient,
  type GenericCtx,
} from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal"
import { organization } from "better-auth/plugins"
import { components, internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import authConfig from "./auth.config"
import { ac, admin, editor } from "./betterAuth/permissions"
import authSchema from "./betterAuth/schema"
import {
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
    },
  }
)

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

export const createAuthOptions = (
  ctx: GenericCtx<DataModel>,
  overrides?: { baseURL?: string }
) => {
  return {
    baseURL: overrides?.baseURL ?? requireSiteUrl(),
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      // Flipped to true in Task 12 when the email outbox exists.
      requireEmailVerification: false,
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
      }),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx))

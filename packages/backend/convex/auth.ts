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

const siteUrl = process.env.SITE_URL ?? ""

const authFunctions: AuthFunctions = internal.auth

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: { schema: authSchema },
    authFunctions,
    triggers: {
      // Wired in Task 8 (users mirror + workspace profile seed).
    },
  }
)

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    baseURL: siteUrl,
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
      }),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx))

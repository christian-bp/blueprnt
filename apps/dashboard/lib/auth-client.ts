import { convexClient } from "@convex-dev/better-auth/client/plugins"
import {
  ac,
  admin,
  editor,
} from "@workspace/backend/convex/betterAuth/permissions"
import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [
    organizationClient({ ac, roles: { admin, editor } }),
    convexClient(),
  ],
})

export type AppAuthClient = typeof authClient

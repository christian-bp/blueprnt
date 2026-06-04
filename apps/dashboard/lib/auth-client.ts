import type { AuthClient } from "@convex-dev/better-auth/react"
import { convexClient } from "@convex-dev/better-auth/client/plugins"
import {
  ac,
  admin,
  editor,
} from "@workspace/backend/convex/betterAuth/permissions"
import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient: AuthClient = createAuthClient({
  plugins: [
    organizationClient({ ac, roles: { admin, editor } }),
    convexClient(),
  ],
})

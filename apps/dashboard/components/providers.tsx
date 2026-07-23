"use client"

import {
  type AuthClient,
  ConvexBetterAuthProvider,
} from "@convex-dev/better-auth/react"
import { ConvexReactClient } from "convex/react"
import { Toaster } from "@workspace/ui/components/sonner"
import { MotionConfig } from "motion/react"
import type { ReactNode } from "react"
import { authClient } from "@/lib/auth-client"

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "")

export function Providers(props: {
  children: ReactNode
  initialToken: string | null
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      // Cast to the provider's own exported prop type: since better-auth
      // 1.6.25 its session inference collapses to `never` inside
      // @convex-dev/better-auth's abstract AuthClient union, so NO concrete
      // client is assignable even though 1.6.x is inside the component's
      // declared peer range. Remove the cast when the component fixes its
      // AuthClient type.
      authClient={authClient as unknown as AuthClient}
      initialToken={props.initialToken}
    >
      {/* Honour the OS-level prefers-reduced-motion preference for all motion
          components in this app. */}
      <MotionConfig reducedMotion="user">{props.children}</MotionConfig>
      {/* App-wide toast host: CRUD success/error notifications render here. */}
      <Toaster />
    </ConvexBetterAuthProvider>
  )
}

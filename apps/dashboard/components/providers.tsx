"use client"

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
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
      authClient={authClient}
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

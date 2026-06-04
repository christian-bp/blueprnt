"use client"

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
import { ConvexReactClient } from "convex/react"
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
      {props.children}
    </ConvexBetterAuthProvider>
  )
}

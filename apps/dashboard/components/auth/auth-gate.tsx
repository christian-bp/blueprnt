"use client"

import { useConvexAuth } from "convex/react"
import { type ReactNode, useRef } from "react"

// Auth gate for the (app) group. Like convex/react's <Authenticated> /
// <AuthLoading> / <Unauthenticated>, but LATCHED: once the user has been
// authenticated, a transient auth-loading blip keeps the authenticated subtree
// MOUNTED instead of tearing it down and remounting it fresh.
//
// twoFactor.enable() (and other session changes) refresh the Convex token, which
// briefly drops auth out of "authenticated". The raw <Authenticated> component
// unmounts its whole subtree during that blip, so an in-progress flow like the
// 2FA setup wizard loses its step state and bounces back to the start. Keeping
// the subtree mounted through the blip preserves that state; the queries inside
// simply reload. We fall back to sign-in only on a DEFINITIVE unauthenticated
// state (loading settled, still not authenticated), never on the transient.
export function AuthGate(props: {
  children: ReactNode
  loading: ReactNode
  unauthenticated: ReactNode
}) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  // Latch: remember that we have been authenticated. Set during render (an
  // idempotent write) so the very render that sees the blip already has it.
  const hasAuthed = useRef(false)
  if (isAuthenticated) hasAuthed.current = true

  if (isAuthenticated || (hasAuthed.current && isLoading)) {
    return <>{props.children}</>
  }
  if (isLoading) return <>{props.loading}</>
  return <>{props.unauthenticated}</>
}

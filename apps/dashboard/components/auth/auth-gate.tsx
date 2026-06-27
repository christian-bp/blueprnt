"use client"

import { useConvexAuth } from "convex/react"
import { type ReactNode, useRef } from "react"

// Auth gate for the (app) group. Like convex/react's <Authenticated> /
// <AuthLoading> / <Unauthenticated>, but it swaps sides only on a SETTLED
// (non-loading) auth state and shows the loading spinner ONLY before the first
// settle. After that, a transient auth-loading blip keeps whichever side we last
// settled on mounted, instead of flipping to the spinner and remounting it.
//
// Why: both sides run multi-step flows that hold local React state across that
// blip. While authenticated, twoFactor.enable() refreshes the Convex token and
// the 2FA setup wizard must not be torn down (it would reset to method-choice).
// While signed out, the sign-in -> 2FA-challenge sequence is the same: a refresh
// blip must not unmount SignInScreen and drop the challenge phase, bouncing the
// user back to the credentials screen. The raw convex/react components flip to
// <AuthLoading> on every blip and unmount the current subtree; gating on the
// settled state keeps it alive. We fall back to sign-in only on a settled
// unauthenticated state, never on the transient.
export function AuthGate(props: {
  children: ReactNode
  loading: ReactNode
  unauthenticated: ReactNode
}) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  // The last settled (non-loading) auth state; null until the first settle.
  // Written during render (an idempotent write) so this render already reflects
  // it. While loading, it holds its previous value, so a blip never swaps sides.
  const settled = useRef<boolean | null>(null)
  if (!isLoading) settled.current = isAuthenticated

  if (settled.current === null) return props.loading
  return settled.current ? props.children : props.unauthenticated
}

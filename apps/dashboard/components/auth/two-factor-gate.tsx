"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect, useState } from "react"
import { TwoFactorSetup } from "@/components/auth/two-factor-setup"

// Mandatory-2FA gate. Sits above OnboardingGate in the (app) layout: an
// authenticated user without a confirmed second factor is held in setup before
// the org wizard or the dashboard. "confirmed" is our own mfaConfirmedAt marker
// (see accounts/twoFactor.ts), not Better Auth's twoFactorEnabled.
export function TwoFactorGate(props: { children: ReactNode }) {
  const t = useTranslations("dashboard.auth")
  const status = useQuery(api.accounts.twoFactor.getMyMfaStatus, {})

  // Once setup is needed, the wizard OWNS the screen until the user continues
  // from its completion screen (onConfirmed -> done). twoFactor.enable() changes
  // the session's 2FA state, which makes the Convex auth token refresh; during
  // that blip getMyMfaStatus reloads to undefined (loading) or null (the query
  // returns null rather than throwing while the identity is momentarily absent).
  // Without the setupStarted latch the gate would flip to the spinner, unmount
  // TwoFactorSetup, and reset its step (a visible bounce). Mirrors OnboardingGate.
  const [setupStarted, setSetupStarted] = useState(false)
  const [done, setDone] = useState(false)
  const needsSetup = status != null && !status.confirmed
  useEffect(() => {
    if (needsSetup) setSetupStarted(true)
  }, [needsSetup])

  // Enter the app once the wizard's completion screen is acknowledged this
  // session (done), or when 2FA was already confirmed before this session (a
  // returning user who never started setup).
  if (done || (status?.confirmed && !setupStarted)) {
    return <>{props.children}</>
  }
  // Setup needed or in progress: the wizard owns the screen. status flips to
  // confirmed the instant the code verifies, so entering on status alone here
  // would skip the completion screen; we wait for onConfirmed instead.
  if (needsSetup || setupStarted) {
    return <TwoFactorSetup onConfirmed={() => setDone(true)} />
  }
  // First load only (never started): wait for the initial status to resolve.
  return (
    <main className="flex min-h-svh items-center justify-center">
      <Spinner aria-label={t("loading")} />
    </main>
  )
}

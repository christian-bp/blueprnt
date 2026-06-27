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

  // Once setup is needed, the wizard OWNS the screen until 2FA is confirmed.
  // twoFactor.enable() changes the session's 2FA state, which makes the Convex
  // auth token refresh; during that blip getMyMfaStatus reloads to undefined.
  // Without this latch the gate would flip to the spinner, unmount
  // TwoFactorSetup, and reset its step back to method-choice (a visible bounce).
  // Mirrors OnboardingGate's session latch. onConfirmed is a no-op: confirmMfaSetup
  // updates server state and getMyMfaStatus re-runs reactively to confirmed.
  const [setupStarted, setSetupStarted] = useState(false)
  const needsSetup = status !== undefined && !status.confirmed
  useEffect(() => {
    if (needsSetup) setSetupStarted(true)
  }, [needsSetup])

  if (status?.confirmed) {
    return <>{props.children}</>
  }
  if (needsSetup || setupStarted) {
    return <TwoFactorSetup onConfirmed={() => {}} />
  }
  // First load only (never started): wait for the initial status to resolve.
  return (
    <main className="flex min-h-svh items-center justify-center">
      <Spinner aria-label={t("loading")} />
    </main>
  )
}

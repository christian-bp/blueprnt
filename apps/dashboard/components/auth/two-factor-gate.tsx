"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { TwoFactorSetup } from "@/components/auth/two-factor-setup"

// Mandatory-2FA gate. Sits above OnboardingGate in the (app) layout: an
// authenticated user without a confirmed second factor is held in setup before
// the org wizard or the dashboard. "confirmed" is our own mfaConfirmedAt marker
// (see accounts/twoFactor.ts), not Better Auth's twoFactorEnabled.
export function TwoFactorGate(props: { children: ReactNode }) {
  const t = useTranslations("dashboard.auth")
  const status = useQuery(api.accounts.twoFactor.getMyMfaStatus, {})

  if (status === undefined) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner aria-label={t("loading")} />
      </main>
    )
  }
  if (!status.confirmed) {
    // onConfirmed is a no-op: confirmMfaSetup updates server state, getMyMfaStatus
    // re-runs reactively, and this gate re-renders into its children.
    return <TwoFactorSetup onConfirmed={() => {}} />
  }
  return <>{props.children}</>
}

"use client"

import { Spinner } from "@workspace/ui/components/spinner"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { AuthGate } from "@/components/auth/auth-gate"
import { SignInScreen } from "@/components/auth/sign-in-screen"
import { TwoFactorGate } from "@/components/auth/two-factor-gate"
import { OnboardingGate } from "@/components/onboarding/onboarding-gate"

// Every page in the (app) group sits behind the same gates: auth loading,
// signed out, mandatory 2FA, and onboarding. Deep links keep working: an
// unauthenticated visit to /roles shows sign-in and stays on /roles. AuthGate is
// latched, so the token refresh that twoFactor.enable() triggers does not unmount
// the subtree mid-setup (see AuthGate).
export default function AppLayout(props: { children: ReactNode }) {
  const t = useTranslations("dashboard")
  return (
    <AuthGate
      loading={
        <main className="flex min-h-svh items-center justify-center">
          <Spinner aria-label={t("auth.loading")} />
        </main>
      }
      unauthenticated={<SignInScreen />}
    >
      <TwoFactorGate>
        <OnboardingGate>{props.children}</OnboardingGate>
      </TwoFactorGate>
    </AuthGate>
  )
}

"use client"

import { Spinner } from "@workspace/ui/components/spinner"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { SignInScreen } from "@/components/auth/sign-in-screen"
import { OnboardingGate } from "@/components/onboarding/onboarding-gate"

// Every page in the (app) group sits behind the same three gates: auth
// loading, signed out, and onboarding. Deep links keep working: an
// unauthenticated visit to /roles shows sign-in and stays on /roles.
export default function AppLayout(props: { children: ReactNode }) {
  const t = useTranslations("dashboard")
  return (
    <>
      <AuthLoading>
        <main className="flex min-h-svh items-center justify-center">
          <Spinner aria-label={t("auth.loading")} />
        </main>
      </AuthLoading>
      <Unauthenticated>
        <SignInScreen />
      </Unauthenticated>
      <Authenticated>
        <OnboardingGate>{props.children}</OnboardingGate>
      </Authenticated>
    </>
  )
}

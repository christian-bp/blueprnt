"use client"

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { Spinner } from "@workspace/ui/components/spinner"
import { useTranslations } from "next-intl"
import { SignInScreen } from "@/components/auth/sign-in-screen"
import { OnboardingGate } from "@/components/onboarding/onboarding-gate"

export default function HomePage() {
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
        <OnboardingGate />
      </Authenticated>
    </>
  )
}

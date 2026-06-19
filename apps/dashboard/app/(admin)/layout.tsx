"use client"

import { Spinner } from "@workspace/ui/components/spinner"
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { PlatformAdminGuard } from "@/components/admin/platform-admin-guard"
import { SignInScreen } from "@/components/auth/sign-in-screen"

// The admin area sits behind auth, but NOT behind OnboardingGate: a platform
// operator may have no organization, and OnboardingGate renders nothing for a
// user with zero memberships. PlatformAdminGuard is the access gate here.
export default function AdminLayout(props: { children: ReactNode }) {
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
        <PlatformAdminGuard>{props.children}</PlatformAdminGuard>
      </Authenticated>
    </>
  )
}

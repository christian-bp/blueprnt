"use client"

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { useTranslations } from "next-intl"
import { SignInScreen } from "@/components/auth/sign-in-screen"
import { DashboardShell } from "@/components/dashboard-shell"

export default function HomePage() {
  const t = useTranslations("dashboard")
  return (
    <>
      <AuthLoading>
        <main className="flex min-h-svh items-center justify-center">
          <p>{t("auth.loading")}</p>
        </main>
      </AuthLoading>
      <Unauthenticated>
        <SignInScreen />
      </Unauthenticated>
      <Authenticated>
        <DashboardShell />
      </Authenticated>
    </>
  )
}

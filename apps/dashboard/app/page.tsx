"use client"

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { DashboardShell } from "@/components/dashboard-shell"

export default function HomePage() {
  const t = useTranslations("dashboard")
  return (
    <>
      <AuthLoading>
        <main>
          <p>{t("auth.loading")}</p>
        </main>
      </AuthLoading>
      <Unauthenticated>
        <main>
          <h1>{t("title")}</h1>
          <Link href="/sign-in">{t("auth.signIn.cta")}</Link>
        </main>
      </Unauthenticated>
      <Authenticated>
        <DashboardShell />
      </Authenticated>
    </>
  )
}

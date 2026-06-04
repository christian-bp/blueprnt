"use client"

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"

export default function HomePage() {
  const t = useTranslations("dashboard")
  return (
    <main>
      <h1>{t("title")}</h1>
      <AuthLoading>
        <p>{t("auth.loading")}</p>
      </AuthLoading>
      <Unauthenticated>
        <Link href="/sign-in">{t("auth.signIn.cta")}</Link>
      </Unauthenticated>
      <Authenticated>
        <p>{t("auth.signedIn")}</p>
      </Authenticated>
    </main>
  )
}

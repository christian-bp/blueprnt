"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useTranslations } from "next-intl"
import { usePageTitle } from "@/hooks/use-page-title"

// Landing page for the Better Auth email-verification callback URL.
// Better Auth appends ?error=... when the link is invalid or expired;
// without that param the verification succeeded.
function EmailVerifiedContent() {
  const t = useTranslations("dashboard.account.email")
  const params = useSearchParams()
  const hasError = params.has("error")

  usePageTitle(hasError ? t("invalidTitle") : t("verifiedTitle"))

  if (hasError) {
    return (
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <h1 className="font-medium text-lg">{t("invalidTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("invalidBody")}</p>
        </div>
        <Link
          href="/account/profile"
          className="text-sm underline underline-offset-4"
        >
          {t("backToProfile")}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="font-medium text-lg">{t("verifiedTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("verifiedBody")}</p>
      </div>
      <Link
        href="/account/profile"
        className="text-sm underline underline-offset-4"
      >
        {t("backToProfile")}
      </Link>
    </div>
  )
}

export default function EmailVerifiedPage() {
  return (
    <Suspense>
      <EmailVerifiedContent />
    </Suspense>
  )
}

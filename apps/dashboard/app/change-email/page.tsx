"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Logo } from "@/components/logo"
import { SuccessCheck } from "@/components/auth/success-check"
import { usePageTitle } from "@/hooks/use-page-title"

// Standalone landing page for the Better Auth change-email double opt-in flow.
// This is a top-level page (outside the (app) shell) so it works when opened
// signed-out from either inbox.
//
// Hop 1 (step=confirmed): user clicked the link in their CURRENT inbox.
//   Better Auth re-issues a token and emails the NEW address. The email is not
//   changed yet; do NOT say they can sign in with the new address.
//
// Hop 2 (step=done): user clicked the link in their NEW inbox.
//   Better Auth applies the change. Email is now updated.
//
// error param present: link was invalid or expired.

function ChangeEmailContent() {
  const t = useTranslations("dashboard.changeEmail")
  const params = useSearchParams()
  const step = params.get("step")
  const hasError = params.has("error")

  const isConfirmed = !hasError && step === "confirmed"

  const pageTitle = hasError
    ? t("invalidTitle")
    : isConfirmed
      ? t("confirmedTitle")
      : t("doneTitle")

  usePageTitle(pageTitle)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <Logo className="h-7 text-brand" />

        {hasError ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="space-y-2">
              <h1 className="font-semibold text-xl">{t("invalidTitle")}</h1>
              <p className="text-muted-foreground text-sm">
                {t("invalidBody")}
              </p>
            </div>
            <p className="text-muted-foreground text-xs">{t("closeHint")}</p>
          </div>
        ) : isConfirmed ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <SuccessCheck />
            <div className="space-y-2">
              <h1 className="font-semibold text-xl">{t("confirmedTitle")}</h1>
              <p className="text-muted-foreground text-sm">
                {t("confirmedBody")}
              </p>
            </div>
            <p className="text-muted-foreground text-xs">{t("closeHint")}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <SuccessCheck />
            <div className="space-y-2">
              <h1 className="font-semibold text-xl">{t("doneTitle")}</h1>
              <p className="text-muted-foreground text-sm">{t("doneBody")}</p>
            </div>
            <p className="text-muted-foreground text-xs">{t("closeHint")}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChangeEmailPage() {
  return (
    <Suspense>
      <ChangeEmailContent />
    </Suspense>
  )
}

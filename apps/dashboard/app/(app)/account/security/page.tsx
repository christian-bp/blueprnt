"use client"

import { useTranslations } from "next-intl"
import { ChangePasswordForm } from "@/components/account/change-password-form"
import { DeleteAccountSection } from "@/components/account/delete-account-section"
import { TwoFactorSection } from "@/components/account/two-factor-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AccountSecurityPage() {
  const t = useTranslations("dashboard.account")
  const tTabs = useTranslations("dashboard.account.tabs")
  usePageTitle(tTabs("security"))

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-medium text-lg">{t("security.password.title")}</h2>
        <ChangePasswordForm />
      </section>
      <section className="space-y-4">
        <h2 className="font-medium text-lg">{t("security.twoFactor.title")}</h2>
        <TwoFactorSection />
      </section>
      {/* DeleteAccountSection renders its own h3 title inside its bordered card. */}
      <DeleteAccountSection />
    </div>
  )
}

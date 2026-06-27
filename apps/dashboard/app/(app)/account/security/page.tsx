"use client"

import { useTranslations } from "next-intl"
import { ChangePasswordForm } from "@/components/account/change-password-form"
import { DeleteAccountSection } from "@/components/account/delete-account-section"
import { TwoFactorSection } from "@/components/account/two-factor-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AccountSecurityPage() {
  const tTabs = useTranslations("dashboard.account.tabs")
  usePageTitle(tTabs("security"))

  return (
    <div className="space-y-6">
      <ChangePasswordForm />
      <TwoFactorSection />
      <DeleteAccountSection />
    </div>
  )
}

"use client"

import { useTranslations } from "next-intl"
import { AvatarSection } from "@/components/account/avatar-section"
import { ChangeEmailForm } from "@/components/account/change-email-form"
import { LanguageSection } from "@/components/account/language-section"
import { ProfileNameForm } from "@/components/account/profile-name-form"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AccountProfilePage() {
  const tTabs = useTranslations("dashboard.account.tabs")
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tTabs("profile"))

  return (
    <div className="space-y-6">
      <PageBreadcrumbRow
        segments={[{ label: tNav("settings") }, { label: tTabs("profile") }]}
      />
      <AvatarSection />
      <ProfileNameForm />
      <ChangeEmailForm />
      <LanguageSection />
    </div>
  )
}

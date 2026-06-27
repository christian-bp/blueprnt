"use client"

import { useTranslations } from "next-intl"
import { AvatarSection } from "@/components/account/avatar-section"
import { ChangeEmailForm } from "@/components/account/change-email-form"
import { LanguageSection } from "@/components/account/language-section"
import { ProfileNameForm } from "@/components/account/profile-name-form"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AccountProfilePage() {
  const tTabs = useTranslations("dashboard.account.tabs")
  usePageTitle(tTabs("profile"))

  return (
    <div className="space-y-6">
      <AvatarSection />
      <ProfileNameForm />
      <ChangeEmailForm />
      <LanguageSection />
    </div>
  )
}

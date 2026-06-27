"use client"

import { useTranslations } from "next-intl"
import { ChangeEmailForm } from "@/components/account/change-email-form"
import { LanguageSection } from "@/components/account/language-section"
import { ProfileNameForm } from "@/components/account/profile-name-form"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AccountProfilePage() {
  const t = useTranslations("dashboard.account")
  const tTabs = useTranslations("dashboard.account.tabs")
  usePageTitle(tTabs("profile"))

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-medium text-lg">{t("profile.title")}</h2>
        <ProfileNameForm />
      </section>
      <section className="space-y-4">
        <h2 className="font-medium text-lg">{t("email.title")}</h2>
        <ChangeEmailForm />
      </section>
      <section className="space-y-4">
        <h2 className="font-medium text-lg">{t("profile.languageTitle")}</h2>
        <LanguageSection />
      </section>
    </div>
  )
}

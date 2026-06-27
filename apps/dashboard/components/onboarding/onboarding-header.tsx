"use client"

import { useTranslations } from "next-intl"
import { AccountMenu } from "@/components/account-menu"
import { Logo } from "@/components/logo"

export function OnboardingHeader() {
  const t = useTranslations("dashboard")
  return (
    <header className="flex h-14 items-center justify-between px-6">
      <Logo label={t("title")} className="h-8 text-brand" />
      <AccountMenu />
    </header>
  )
}

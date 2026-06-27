"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { AccountTabs } from "@/components/account/account-tabs"

// Layout for the account settings section (/account/profile, /account/security).
// Renders the section title and the tab bar above the page content.
export default function AccountLayout(props: { children: ReactNode }) {
  const t = useTranslations("dashboard.account")

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-xl">{t("title")}</h1>
        <AccountTabs />
      </div>
      {props.children}
    </div>
  )
}

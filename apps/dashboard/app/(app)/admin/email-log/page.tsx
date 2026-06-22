"use client"

import { useTranslations } from "next-intl"
import { EmailLogSection } from "@/components/admin/email-log-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AdminEmailLogPage() {
  const tNav = useTranslations("dashboard.nav")
  const tTabs = useTranslations("dashboard.admin.tabs")
  usePageTitle([tNav("admin"), tTabs("emailLog")])
  return <EmailLogSection />
}

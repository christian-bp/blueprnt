"use client"

import { useTranslations } from "next-intl"
import { EmailLogSection } from "@/components/admin/email-log-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AdminEmailLogPage() {
  const tTabs = useTranslations("dashboard.admin.tabs")
  usePageTitle(tTabs("emailLog"))
  return <EmailLogSection />
}

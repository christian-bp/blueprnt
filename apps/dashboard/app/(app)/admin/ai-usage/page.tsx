"use client"

import { useTranslations } from "next-intl"
import { AiUsageSection } from "@/components/admin/ai-usage-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AdminAiUsagePage() {
  const tNav = useTranslations("dashboard.nav")
  const tTabs = useTranslations("dashboard.admin.tabs")
  usePageTitle([tNav("admin"), tTabs("aiUsage")])
  return <AiUsageSection />
}

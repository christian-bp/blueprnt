"use client"

import { useTranslations } from "next-intl"
import { AiUsageSection } from "@/components/admin/ai-usage-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AdminAiUsagePage() {
  const tTabs = useTranslations("dashboard.admin.tabs")
  usePageTitle(tTabs("aiUsage"))
  return <AiUsageSection />
}

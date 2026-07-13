"use client"

import { useTranslations } from "next-intl"
import { PayMappingsSection } from "@/components/pay-mapping/pay-mappings-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function PayMappingsPage() {
  const t = useTranslations("dashboard.payMapping")
  usePageTitle(t("heading"))
  return <PayMappingsSection />
}

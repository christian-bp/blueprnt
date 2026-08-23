"use client"

import { useTranslations } from "next-intl"
import { OrganizationsSection } from "@/components/admin/organizations-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function AdminOrganizationsPage() {
  const tTabs = useTranslations("dashboard.admin.tabs")
  usePageTitle(tTabs("organizations"))
  return <OrganizationsSection />
}
